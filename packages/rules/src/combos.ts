import { ACE_RANK, toCard, type CardId } from './cards';

export type ComboType = 'single' | 'pair' | 'triple' | 'quad' | 'straight';

export interface Combo {
  type: ComboType;
  /** Top rank of the combo (for a straight, the highest card). */
  rank: number;
  length: number;
}

const SAME_RANK_TYPES: Record<number, ComboType> = { 1: 'single', 2: 'pair', 3: 'triple', 4: 'quad' };

function rankCounts(ranks: readonly number[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  return counts;
}

/**
 * Straight = ≥3 distinct consecutive ranks within 3..A. A 2 (rank 15) never belongs to a straight,
 * so K-A-2 and A-2-3 are both rejected; there is no wrap-around.
 */
function isConsecutive(ranks: readonly number[]): boolean {
  const unique = [...new Set(ranks)].sort((a, b) => a - b);
  if (unique.length !== ranks.length || unique.length < 3) return false;
  const min = unique[0];
  const max = unique[unique.length - 1];
  if (min === undefined || max === undefined || max > ACE_RANK) return false;
  return max - min === unique.length - 1;
}

/** Recognises single / pair / triple / quad / straight; anything else is null. Input has no duplicate ids. */
export function parseCombo(cards: readonly CardId[]): Combo | null {
  if (cards.length === 0 || cards.length > 10) return null;
  const ranks = cards.map((id) => toCard(id).rank);
  const counts = rankCounts(ranks);

  if (counts.size === 1 && cards.length <= 4) {
    const type = SAME_RANK_TYPES[cards.length];
    const rank = ranks[0];
    if (type === undefined || rank === undefined) return null;
    return { type, rank, length: cards.length };
  }

  if (isConsecutive(ranks)) {
    return { type: 'straight', rank: Math.max(...ranks), length: cards.length };
  }
  return null;
}
