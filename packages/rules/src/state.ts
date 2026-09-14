import type { CardId } from './cards';
import type { Combo } from './combos';
import { createDeal } from './deal';
import { hasInstantWin, type InstantWinKind } from './instant-win';
import { applyPass, applyPlay, applyTimeout } from './reducer-play';
import { applyDeclareSam } from './reducer-sam';

export type Phase = 'sam-window' | 'playing' | 'ended';

export interface PlayerState {
  /** 0..n-1 = deal order = clockwise. */
  seat: number;
  /** Sorted ascending. */
  hand: CardId[];
  /** Cards played this hand; 0 at hand end === cóng. */
  played: number;
  /** Pass-locked for the current trick. */
  passed: boolean;
}

export interface TrickState {
  /** Combo to beat; null === nobody has led yet. */
  combo: Combo | null;
  cards: CardId[];
  /** Played `combo`, or the seat to lead when combo is null. */
  ownerSeat: number;
}

export interface Transfer {
  fromSeat: number;
  toSeat: number;
  amount: number;
}

export interface RulesState {
  handNo: number;
  players: PlayerState[];
  turnSeat: number;
  phase: Phase;
  trick: TrickState;
  /** Báo sâm declarer. */
  samSeat: number | null;
  samResult: 'success' | 'fail' | null;
  instantWin: { seat: number; kind: InstantWinKind } | null;
  /** Seats already announced at 1 card. */
  bao1Seats: number[];
  /** Settled chặt 2 / chặt chồng transfers. */
  chatChain: Transfer[];
  /** Head of the chặt chain; reset at trick end. */
  lastCut: { seat: number; amount: number } | null;
  denWatch: { leaderSeat: number; targetSeat: number } | null;
  /** Đền bài offender. */
  denSeat: number | null;
  winnerSeat: number | null;
  /** Beat a failed sâm; leads the next hand. */
  blockerSeat: number | null;
}

export type Action =
  | { type: 'play'; seat: number; cards: CardId[] }
  | { type: 'declareSam' | 'pass' | 'timeout'; seat: number };

export type GameEvent =
  | { type: 'anTrang'; seat: number; kind: InstantWinKind }
  | { type: 'chat2'; seat: number; fromSeat: number; amount: number; chong: boolean }
  | { type: 'baoSam' | 'bao1' | 'denBai'; seat: number }
  | { type: 'trickEnd'; leadSeat: number }
  | { type: 'handEnd'; winnerSeat: number | null };

export interface StepResult {
  state: RulesState;
  events: GameEvent[];
  error?: string;
}

/**
 * Deals a hand. `leadSeat` overrides the lowest-card rule from hand 2 onward (previous winner leads).
 * `seed` must come from a CSPRNG on the server; a guessable seed leaks every hand.
 */
export function createHand(
  seats: number,
  handNo: number,
  seed: number,
  leadSeat?: number,
): { state: RulesState; events: GameEvent[] } {
  const deal = createDeal(seats, seed);
  return buildHand(deal.hands, handNo, leadSeat ?? deal.leadSeat);
}

/**
 * Opens a hand from already-dealt, sorted hands. Scans for ăn trắng in seat order; the first hit
 * ends the hand immediately, so the sâm window never opens.
 */
export function buildHand(
  hands: readonly (readonly CardId[])[],
  handNo: number,
  lead: number,
): { state: RulesState; events: GameEvent[] } {
  const players: PlayerState[] = hands.map((hand, seat) => ({ seat, hand: [...hand], played: 0, passed: false }));
  const state: RulesState = {
    handNo,
    players,
    turnSeat: lead,
    phase: 'sam-window',
    trick: { combo: null, cards: [], ownerSeat: lead },
    samSeat: null,
    samResult: null,
    instantWin: null,
    bao1Seats: [],
    chatChain: [],
    lastCut: null,
    denWatch: null,
    denSeat: null,
    winnerSeat: null,
    blockerSeat: null,
  };
  const events: GameEvent[] = [];
  for (const p of players) {
    const kind = hasInstantWin(p.hand);
    if (kind === null) continue;
    state.instantWin = { seat: p.seat, kind };
    state.winnerSeat = p.seat;
    state.phase = 'ended';
    events.push({ type: 'anTrang', seat: p.seat, kind }, { type: 'handEnd', winnerSeat: p.seat });
    break;
  }
  return { state, events };
}

/** Pure reducer: never mutates `state`; on error returns the original state object unchanged. */
export function applyAction(state: RulesState, action: Action): StepResult {
  switch (action.type) {
    case 'play':
      return applyPlay(state, action.seat, action.cards);
    case 'pass':
      return applyPass(state, action.seat);
    case 'timeout':
      return applyTimeout(state, action.seat);
    case 'declareSam':
      return applyDeclareSam(state, action.seat);
  }
}
