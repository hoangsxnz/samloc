import { rankOf, sortHand, type CardId } from '@samloc/rules';

export type HandSortMode = 'rank' | 'group';

const MIN_RUN = 3;

/** Groups of the same rank, largest first: quads, then triples, then pairs. */
function takeSets(sorted: readonly CardId[]): { sets: CardId[][]; loose: CardId[] } {
  const byRank = new Map<number, CardId[]>();
  for (const id of sorted) {
    const rank = rankOf(id);
    const bucket = byRank.get(rank);
    if (bucket) bucket.push(id);
    else byRank.set(rank, [id]);
  }
  const sets: CardId[][] = [];
  const loose: CardId[] = [];
  for (const [, cards] of [...byRank].sort((a, b) => a[0] - b[0])) {
    if (cards.length >= 2) sets.push(cards);
    else loose.push(...cards);
  }
  sets.sort((a, b) => b.length - a.length || rankOf(a[0] ?? '3S') - rankOf(b[0] ?? '3S'));
  return { sets, loose };
}

/** Maximal consecutive runs of ≥3 among the leftover cards; everything else stays a single. */
function takeRuns(loose: readonly CardId[]): { runs: CardId[][]; singles: CardId[] } {
  const runs: CardId[][] = [];
  const singles: CardId[] = [];
  let current: CardId[] = [];
  const flush = (): void => {
    if (current.length >= MIN_RUN) runs.push(current);
    else singles.push(...current);
    current = [];
  };
  for (const id of loose) {
    const prev = current[current.length - 1];
    if (prev !== undefined && rankOf(id) === rankOf(prev) + 1) current.push(id);
    else {
      flush();
      current = [id];
    }
  }
  flush();
  return { runs, singles };
}

/**
 * Display order for the hand. `rank` is the server's plain ascending order; `group` clusters the
 * combos a player would actually play — sets first, then runs, then loose singles.
 * Display only: a play still sends the selected ids, which the server re-validates.
 */
export function orderHand(hand: readonly CardId[], mode: HandSortMode): CardId[] {
  const sorted = sortHand(hand);
  if (mode === 'rank') return sorted;
  const { sets, loose } = takeSets(sorted);
  const { runs, singles } = takeRuns(loose);
  return [...sets.flat(), ...runs.flat(), ...singles];
}
