---
phase: 1
title: "Rules engine — low straights and legal moves"
status: completed
priority: P1
effort: "3h"
dependencies: []
---

# Phase 1: Rules engine — low straights and legal moves

## Overview

Two rule changes in `@samloc/rules`: straights may use 2 as the lowest rank
(`A-2-3`, `2-3-4`, …) while `K-A-2` stays illegal, and a new legal-move
enumerator that powers both the timeout auto-play (phase 2) and the client hint
highlight (phase 3). Also a small settlement helper so the worker can announce
thối 2.

## Requirements

Functional:
- `parseCombo` accepts a straight whose ranks, after mapping `A→1` and `2→2`, are
  ≥3 distinct consecutive values — i.e. `A-2-3`, `A-2-3-4…`, `2-3-4`, `2-3-4-5…`.
- A straight is rejected when the 2 sits at the top (`K-A-2`, `Q-K-A-2`) or when a
  wrap sequence does not actually contain the 2 (nothing changes for `Q-K-A`).
- Comparison order: `A-2-3 < 2-3-4 < 3-4-5`, and generally a wrap straight is
  always lower than any normal straight of the same length.
- `lowestLegalMove(hand, trick)` returns the cheapest legal play, or `null` when
  the player can only pass.
- `legalMoves(hand, trick)` returns every legal play (used for hint highlighting).
- `thoi2Counts(state)` reports, per seat, how many 2s were left in hand and the lá
  penalty, for the seats that actually pay it.

Non-functional:
- Zero new deps, pure functions, JSON-serialisable results, files under 200 lines.
- No change to `Combo`'s shape: wrap straights are expressed through `rank` alone.

## Architecture

**Rank remapping.** `A` = 14 and `2` = 15 normally. For a straight, try the
normal reading first (all ranks 3…A, consecutive). If that fails, try the low
reading: `A→1`, `2→2`, everything else unchanged. The low reading is only
accepted when the set contains a 2 (so `Q-K-A` never re-enters through it) and
the remapped ranks are consecutive.

`Combo.rank` for a wrap straight is the remapped top (`A-2-3` → 3, `2-3-4` → 4,
`A-2-3-4-5` → 5). This keeps `canBeat` untouched: for a given length the wrap top
is at most `length + 1`, while the lowest normal straight of that length tops out
at `length + 2`, so the two ranges never collide and the ordering falls out for
free.

```
len 3:  A-2-3 → 3   2-3-4 → 4   | normal 3-4-5 → 5 … Q-K-A → 14
len 4:  A-2-3-4 → 4  2-3-4-5 → 5 | normal 3-4-5-6 → 6 …
```

Label rendering (client, phase 3): for a straight, `from = rank - length + 1`;
if `from <= 2` it is a wrap straight and ranks 1 and 2 render as `A` and `2`.

**Legal moves.** `legal-moves.ts` enumerates candidate plays from a sorted hand:

- Lead (trick combo `null`): every single, every pair/triple/quad from rank
  groups, every straight run of length ≥3 (including wrap runs) built from the
  distinct ranks present.
- Responding: only combos that satisfy `canBeat(trickCombo, combo)` — same type
  and length with a higher rank, plus quads over a single 2 and over a smaller
  quad.
- Ordering: ascending by (card count, combo rank) so `[0]` is the cheapest play.
  `lowestLegalMove` returns `moves[0] ?? null`.
- Hand size ≤ 10 keeps the enumeration trivially bounded; no memoisation.

**Thối 2 data.** `settle()` already computes the penalty inline. Extract the
per-seat figure into `thoi2Counts(state): { seat: number; count: number; amount:
number }[]`, returning `[]` for ăn trắng / báo sâm hands (those skip thối 2), and
let `settle` keep its own arithmetic — the helper is a read-only report, the
worker uses it to emit events.

## Related Code Files

- Modify: `packages/rules/src/combos.ts` (low-straight parsing)
- Modify: `packages/rules/src/reducer-play.ts` (`applyTimeout` — phase 2 pairs with it)
- Modify: `packages/rules/src/settle.ts` (export the thối 2 breakdown)
- Modify: `packages/rules/src/index.ts` (exports)
- Create: `packages/rules/src/legal-moves.ts`
- Modify: `packages/rules/tests/combos.test.ts`, `tests/compare.test.ts`, `tests/settle.test.ts`
- Create: `packages/rules/tests/legal-moves.test.ts`

## Implementation Steps

1. In `combos.ts`, split the straight check into `normalRun(ranks)` and
   `lowRun(ranks)`. `lowRun` maps `14→1`, `15→2`, requires the set to contain the
   original 15, requires ≥3 distinct consecutive remapped ranks, and returns the
   remapped max as the combo rank. `parseCombo` tries normal first, then low.
2. Keep the existing guards: no duplicate ranks inside a straight, length ≤ 10,
   quads/triples/pairs unchanged.
3. Add `packages/rules/src/legal-moves.ts` with `legalMoves(hand, trick)` and
   `lowestLegalMove(hand, trick)`, where `trick` is `Combo | null`. Build
   candidates from the hand, parse each through `parseCombo`, keep those passing
   `canBeat`, sort ascending by `(length, rank)`.
4. In `settle.ts`, add `thoi2Counts(state)` next to `settle`; keep `settle`'s
   output byte-identical (no behaviour change, verified by existing tests).
5. Re-export `legalMoves`, `lowestLegalMove`, `thoi2Counts` from `index.ts`.
6. Tests:
   - `A-2-3`, `2-3-4`, `A-2-3-4-5` parse as straights with ranks 3, 4, 5.
   - `K-A-2`, `Q-K-A-2`, `A-2` rejected.
   - `Q-K-A` still valid, rank 14.
   - `canBeat`: `2-3-4` beats `A-2-3`; `3-4-5` beats `2-3-4`; `A-2-3` beats nothing
     of length 3; wrap straight cannot be beaten by a different length.
   - `legalMoves` on a lead returns singles + groups + runs; responding to a pair
     returns only higher pairs; responding to a single 2 includes the quad.
   - `lowestLegalMove` returns the lowest single when leading, `null` when no move
     beats the trick.
   - `thoi2Counts` is `[]` for ăn trắng and báo sâm hands, and matches the +5/2
     arithmetic otherwise.
   - `lowestLegalMove` is used unchanged inside a báo sâm hand: a non-declarer
     timeout auto-plays and therefore resolves the sâm as failed. Add a test that
     pins this down as intended, not as an accident.
     <!-- Updated: Validation Session 1 - timeout applies in sâm hands too -->
   - The existing "timeout while responding auto-passes" case
     (`tests/reducer-turn-flow.test.ts:128`) is rewritten in phase 2, not kept.

## Success Criteria

- [x] `pnpm --filter @samloc/rules test` passes, including new cases.
- [x] `A-2-3` and `2-3-4` playable; `K-A-2` rejected with "Bộ bài không hợp lệ".
- [x] `lowestLegalMove` returns a play for any hand that has one, `null` otherwise.
- [x] `settle()` results unchanged for every pre-existing test.
- [x] `packages/rules/src/*` each stay under 200 lines.

## Risk Assessment

- **Rank-space collision** between wrap and normal straights would silently
  corrupt comparisons. Mitigated by the `length + 1` vs `length + 2` argument
  above and an explicit test per length 3–5.
- **Sảnh rồng (ăn trắng)** still uses its own raw-rank check, so a 10-card wrap
  run is *not* an instant win. Intentional — out of scope, noted in phase 5 docs.
- **Enumeration blow-up** is bounded: ≤10 cards, straights capped at length 10.

## Security Considerations

None new — the rules engine stays pure and server-validated; the client hint uses
the same functions but the server re-validates every play.

## Next Steps

Phase 2 consumes `lowestLegalMove` for timeouts and `thoi2Counts` for events.
