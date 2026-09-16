import { ACE_RANK, TWO_RANK, toCard, type CardId } from './cards';

export type ComboType = 'single' | 'pair' | 'triple' | 'quad' | 'straight';

export interface Combo {
  type: ComboType;
  /** Top rank of the combo. For a low straight this is the remapped top (A-2-3 → 3, 2-3-4 → 4). */
  rank: number;
  length: number;
}

const SAME_RANK_TYPES: Record<number, ComboType> = { 1: 'single', 2: 'pair', 3: 'triple', 4: 'quad' };

/** A→1, 2→2, everything else unchanged. Used to read a straight with the 2 at the bottom. */
export function lowRank(rank: number): number {
  if (rank === ACE_RANK) return 1;
  if (rank === TWO_RANK) return 2;
  return rank;
}

function rankCounts(ranks: readonly number[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  return counts;
}

/** ≥3 distinct ranks with no gaps. Returns the top rank, or null. */
function runTop(ranks: readonly number[]): number | null {
  const unique = [...new Set(ranks)].sort((a, b) => a - b);
  if (unique.length !== ranks.length || unique.length < 3) return null;
  const min = unique[0];
  const max = unique[unique.length - 1];
  if (min === undefined || max === undefined) return null;
  return max - min === unique.length - 1 ? max : null;
}

/** Straight in the normal reading: consecutive ranks inside 3..A, never a 2. */
function normalRun(ranks: readonly number[]): number | null {
  if (ranks.some((r) => r > ACE_RANK)) return null;
  return runTop(ranks);
}

/**
 * Straight with the 2 counting as the lowest rank: A-2-3, 2-3-4, A-2-3-4-5, …
 * The 2 must be part of the run, so K-A-2 and Q-K-A never come back in through here.
 */
function lowRun(ranks: readonly number[]): number | null {
  if (!ranks.includes(TWO_RANK)) return null;
  return runTop(ranks.map(lowRank));
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

  const top = normalRun(ranks) ?? lowRun(ranks);
  if (top !== null) return { type: 'straight', rank: top, length: cards.length };
  return null;
}
