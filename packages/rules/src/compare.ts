import { TWO_RANK, sortHand, type CardId } from './cards';
import type { Combo } from './combos';

/**
 * Can `next` be played on top of `prev`?
 * - Leading (prev null): any valid combo.
 * - Quad: beats a single 2 (chặt heo) and a smaller quad (chặt chồng); nothing else.
 * - Otherwise same type, same length, strictly higher top rank.
 */
export function canBeat(prev: Combo | null, next: Combo): boolean {
  if (prev === null) return true;
  if (next.type === 'quad') {
    if (prev.type === 'single' && prev.rank === TWO_RANK) return true;
    if (prev.type === 'quad') return next.rank > prev.rank;
    return false;
  }
  if (next.type !== prev.type) return false;
  if (next.length !== prev.length) return false;
  return next.rank > prev.rank;
}

/** Lowest card of a hand by (rank, suit). Throws on an empty hand. */
export function lowestSingle(hand: readonly CardId[]): CardId {
  const first = sortHand(hand)[0];
  if (first === undefined) throw new Error('Bài trên tay đang trống');
  return first;
}

/** Highest card of a hand by (rank, suit). Throws on an empty hand. */
export function highestSingle(hand: readonly CardId[]): CardId {
  const sorted = sortHand(hand);
  const last = sorted[sorted.length - 1];
  if (last === undefined) throw new Error('Bài trên tay đang trống');
  return last;
}
