import { sortHand, type CardId } from '../src/cards';
import { applyAction, type Action, type RulesState, type StepResult } from '../src/state';

/** Builds a mid-hand state from explicit hands; seat 0 leads unless overridden. */
export function makeState(hands: CardId[][], overrides: Partial<RulesState> = {}): RulesState {
  const lead = overrides.turnSeat ?? 0;
  return {
    handNo: 1,
    players: hands.map((hand, seat) => ({ seat, hand: sortHand(hand), played: 0, passed: false })),
    turnSeat: lead,
    phase: 'playing',
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
    ...overrides,
  };
}

/** Applies an action that must succeed and returns the result. */
export function step(state: RulesState, action: Action): StepResult {
  const res = applyAction(state, action);
  expect(res.error).toBeUndefined();
  return res;
}

export function play(state: RulesState, seat: number, cards: CardId[]): StepResult {
  return step(state, { type: 'play', seat, cards });
}

export function pass(state: RulesState, seat: number): StepResult {
  return step(state, { type: 'pass', seat });
}

export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value);
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
  }
  return value;
}
