import { TWO_RANK, sortHand, toCard, type CardId } from './cards';
import { lowRank, parseCombo, type Combo } from './combos';
import { canBeat } from './compare';

const MIN_RUN = 3;

function groupByRank(hand: readonly CardId[]): Map<number, CardId[]> {
  const byRank = new Map<number, CardId[]>();
  for (const id of hand) {
    const { rank } = toCard(id);
    const bucket = byRank.get(rank);
    if (bucket) bucket.push(id);
    else byRank.set(rank, [id]);
  }
  return byRank;
}

/** Every m-sized subset of `items`, in input order. */
function subsets(items: readonly CardId[], size: number): CardId[][] {
  if (size === 0) return [[]];
  const out: CardId[][] = [];
  for (let i = 0; i <= items.length - size; i++) {
    const head = items[i];
    if (head === undefined) continue;
    for (const tail of subsets(items.slice(i + 1), size - 1)) out.push([head, ...tail]);
  }
  return out;
}

/** Singles, pairs, triples and quads — every combination, so any held card can seed a hint. */
function sameRankCandidates(byRank: Map<number, CardId[]>): CardId[][] {
  const out: CardId[][] = [];
  for (const cards of byRank.values()) {
    for (let size = 1; size <= cards.length && size <= 4; size++) out.push(...subsets(cards, size));
  }
  return out;
}

/** One card per rank, all suit combinations, for every consecutive slice starting at `ranks[i]`. */
function runsFrom(ranks: readonly number[], start: number, pick: Map<number, CardId[]>, out: CardId[][]): void {
  let combos: CardId[][] = [[]];
  for (let i = start; i < ranks.length; i++) {
    const rank = ranks[i];
    const prev = ranks[i - 1];
    if (rank === undefined) break;
    if (i > start && prev !== undefined && rank !== prev + 1) break;
    const cards = pick.get(rank) ?? [];
    combos = combos.flatMap((run) => cards.map((card) => [...run, card]));
    if (i - start + 1 >= MIN_RUN) out.push(...combos);
  }
}

/** Normal straights plus the low ones where the 2 sits at the bottom. */
function straightCandidates(byRank: Map<number, CardId[]>): CardId[][] {
  const out: CardId[][] = [];
  const normal = new Map([...byRank].filter(([rank]) => rank !== TWO_RANK));
  const normalRanks = [...normal.keys()].sort((a, b) => a - b);
  for (let i = 0; i < normalRanks.length; i++) runsFrom(normalRanks, i, normal, out);

  if (!byRank.has(TWO_RANK)) return out;
  const low = new Map([...byRank].map(([rank, cards]) => [lowRank(rank), cards] as const));
  const lowRanks = [...low.keys()].sort((a, b) => a - b);
  // Only runs anchored on the A or the 2 are new; anything higher repeats a normal straight.
  for (let i = 0; i < lowRanks.length; i++) {
    const rank = lowRanks[i];
    if (rank !== undefined && rank <= 2) runsFrom(lowRanks, i, low, out);
  }
  return out;
}

/**
 * Every play that is legal against `trick` (null === leading), cheapest first:
 * ascending by card count, then by combo rank. Bounded by the 10-card hand size.
 */
export function legalMoves(hand: readonly CardId[], trick: Combo | null): CardId[][] {
  const byRank = groupByRank(sortHand(hand));
  const candidates = [...sameRankCandidates(byRank), ...straightCandidates(byRank)];
  const scored: { cards: CardId[]; combo: Combo }[] = [];
  for (const cards of candidates) {
    const combo = parseCombo(cards);
    if (combo === null || !canBeat(trick, combo)) continue;
    scored.push({ cards, combo });
  }
  scored.sort((a, b) => a.cards.length - b.cards.length || a.combo.rank - b.combo.rank);
  return scored.map((m) => m.cards);
}

/** Cheapest legal play, or null when the seat can only pass. */
export function lowestLegalMove(hand: readonly CardId[], trick: Combo | null): CardId[] | null {
  return legalMoves(hand, trick)[0] ?? null;
}
