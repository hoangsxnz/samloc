import { TWO_RANK, rankOf, type CardId } from './cards';
import type { Combo } from './combos';
import { highestSingle } from './compare';
import type { GameEvent, RulesState } from './state';

const CHAT_2_AMOUNT = 15;

/**
 * Chặt 2 (quad on a single 2) pays 15 from the 2's owner to the cutter, immediately and finally.
 * Chặt chồng (quad on a cut quad) pays double the previous cut from the previous cutter; earlier
 * transfers stand. Skipped entirely during a báo sâm hand. Must run before `trick` is replaced.
 */
export function applyChat(next: RulesState, seat: number, combo: Combo, events: GameEvent[]): void {
  if (next.samSeat !== null || combo.type !== 'quad') return;
  const prev = next.trick.combo;
  if (prev?.type === 'single' && prev.rank === TWO_RANK) {
    next.chatChain.push({ fromSeat: next.trick.ownerSeat, toSeat: seat, amount: CHAT_2_AMOUNT });
    next.lastCut = { seat, amount: CHAT_2_AMOUNT };
    events.push({ type: 'chat2', seat, fromSeat: next.trick.ownerSeat, amount: CHAT_2_AMOUNT, chong: false });
  } else if (prev?.type === 'quad' && next.lastCut) {
    const amount = next.lastCut.amount * 2;
    const fromSeat = next.lastCut.seat;
    next.chatChain.push({ fromSeat, toSeat: seat, amount });
    next.lastCut = { seat, amount };
    events.push({ type: 'chat2', seat, fromSeat, amount, chong: true });
  }
}

/** Server-driven báo 1: announced once per seat when it drops to a single card. */
export function checkBao1(next: RulesState, seat: number, events: GameEvent[]): void {
  const player = next.players[seat];
  if (!player || player.hand.length !== 1 || next.bao1Seats.includes(seat)) return;
  next.bao1Seats.push(seat);
  events.push({ type: 'bao1', seat });
}

/**
 * Đền bài watch. Arms when a leader plays a single that is not their highest while the next seat
 * holds one card; disarms when anyone else takes the trick; fires when the watched seat wins on it.
 */
export function updateDenWatch(
  next: RulesState,
  seat: number,
  combo: Combo,
  cards: CardId[],
  wasLead: boolean,
  handBefore: CardId[],
  events: GameEvent[],
): void {
  const n = next.players.length;
  const following = next.players[(seat + 1) % n];
  const first = cards[0];
  if (wasLead) {
    const armed =
      combo.type === 'single' &&
      following !== undefined &&
      following.hand.length === 1 &&
      first !== undefined &&
      rankOf(first) < rankOf(highestSingle(handBefore));
    next.denWatch = armed ? { leaderSeat: seat, targetSeat: following.seat } : null;
    return;
  }
  if (next.denWatch === null) return;
  if (seat !== next.denWatch.targetSeat) {
    next.denWatch = null;
    return;
  }
  const player = next.players[seat];
  if (player && player.hand.length === 0) {
    next.denSeat = next.denWatch.leaderSeat;
    events.push({ type: 'denBai', seat: next.denSeat });
  }
}
