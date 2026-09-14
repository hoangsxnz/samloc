import { ACE_RANK, TWO_RANK, toCard, type CardId } from './cards';

export type InstantWinKind = 'sanh-rong' | 'tu-quy-2' | 'dong-mau' | 'ba-sam-co' | 'nam-doi';

const HAND_SIZE = 10;

function countByRank(ranks: readonly number[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  return counts;
}

/** Ten distinct consecutive ranks within 3..A (only 3→Q, 4→K, 5→A are possible). */
function isSanhRong(ranks: readonly number[]): boolean {
  const unique = [...new Set(ranks)].sort((a, b) => a - b);
  const min = unique[0];
  const max = unique[unique.length - 1];
  if (unique.length !== HAND_SIZE || min === undefined || max === undefined) return false;
  return max <= ACE_RANK && max - min === HAND_SIZE - 1;
}

function isDongMau(suits: readonly number[]): boolean {
  const allRed = suits.every((s) => s === 2 || s === 3);
  const allBlack = suits.every((s) => s === 0 || s === 1);
  return allRed || allBlack;
}

/**
 * Ăn trắng detection in priority order: sảnh rồng, tứ quý 2, đồng màu, ba sám cô, năm đôi.
 * A quad counts as one of the three triples for ba sám cô (house reading).
 */
export function hasInstantWin(hand: readonly CardId[]): InstantWinKind | null {
  if (hand.length !== HAND_SIZE) return null;
  const cards = hand.map(toCard);
  const ranks = cards.map((c) => c.rank);
  const counts = countByRank(ranks);

  if (isSanhRong(ranks)) return 'sanh-rong';
  if ((counts.get(TWO_RANK) ?? 0) === 4) return 'tu-quy-2';
  if (isDongMau(cards.map((c) => c.suit))) return 'dong-mau';

  let triples = 0;
  let pairs = 0;
  for (const n of counts.values()) {
    if (n >= 3) triples++;
    if (n === 2) pairs++;
  }
  if (triples >= 3) return 'ba-sam-co';
  if (pairs === 5 && counts.size === 5) return 'nam-doi';
  return null;
}
