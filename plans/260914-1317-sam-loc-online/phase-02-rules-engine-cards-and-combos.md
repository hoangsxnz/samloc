---
phase: 2
title: "Rules engine cards and combos"
status: completed
effort: "3h"
priority: P1
dependencies: [phase-01]
---

# Phase 2: Rules engine cards and combos

Context: `docs/game-rules.md` §Setup / §Combinations / §Beating / §Ăn trắng

## Overview

Pure, stateless half of `packages/rules`: card encoding, combo recognition, beating comparison,
instant-win (ăn trắng) detection, and deterministic dealing. No game state, no reducer, no scoring —
those are phase 3. Everything here is a pure function over plain data so both the Durable Object and
the Svelte client can call it.

## Requirements

**Functional**
- Encode/decode a card between a compact `CardId` string and `{ rank, suit }`.
- `parseCombo(cards)` recognises single / pair / triple / quad / straight, returns `null` otherwise.
- `canBeat(prev, next)` implements every line of `docs/game-rules.md` §Beating, including chặt heo.
- `hasInstantWin(hand)` returns the highest-priority ăn trắng kind or `null`.
- `createDeal(playerCount, seed)` deals 10 cards each, deterministic for a given seed.
- `lowestCardSeat(hands)` finds the first-hand leader (lowest rank, ♠ < ♣ < ♦ < ♥).

**Non-functional**
- Zero dependencies, no classes with mutable state, no `Date`/`Math.random` outside `createDeal`'s PRNG.
- Each module ≤200 lines. `parseCombo` must be O(n log n) at worst (hand ≤10 cards) — CPU budget is 10 ms.

## Architecture

**Card encoding**
- `rank: number` 3..15, where `11=J 12=Q 13=K 14=A 15=2`.
- `suit: number` 0..3 → `0=S(♠) 1=C(♣) 2=D(♦) 3=H(♥)`; suit order is used **only** for lowest-card
  tie-breaking and stable sorting, never for beating.
- `CardId = string` — rank label + suit letter: `"3S"`, `"10H"`, `"JD"`, `"AC"`, `"2S"`.
- Sort order: ascending by `rank`, then by `suit`.

**Interfaces**
```ts
export type CardId = string;
export interface Card { id: CardId; rank: number; suit: number }

export type ComboType = 'single' | 'pair' | 'triple' | 'quad' | 'straight';
export interface Combo { type: ComboType; rank: number; length: number } // rank = top rank

export function parseCombo(cards: CardId[]): Combo | null;
export function canBeat(prev: Combo | null, next: Combo): boolean;

export type InstantWinKind =
  | 'sanh-rong' | 'tu-quy-2' | 'dong-mau' | 'ba-sam-co' | 'nam-doi';
export function hasInstantWin(hand: CardId[]): InstantWinKind | null;

export interface Deal { hands: CardId[][]; leadSeat: number }
export function createDeal(playerCount: number, seed: number): Deal;
```

**`parseCombo` decision table** (input must contain no duplicate ids):

| Cards | Condition | Result |
|---|---|---|
| 1 | — | `single`, rank = card rank |
| 2 | equal ranks | `pair` |
| 3 | equal ranks | `triple` |
| 3 | consecutive, all ranks ≤ 14 | `straight`, rank = top |
| 4 | equal ranks | `quad` |
| 4..10 | consecutive, all ranks ≤ 14 | `straight`, rank = top |
| any | otherwise | `null` |

Straight constraints, verbatim from the house rules: ranks 3..A only (`rank ≤ 14`, so a 2 can never
appear), length ≥ 3, suits irrelevant, no wrap-around, so `K-A-2` and `A-2-3` are both `null`.
No đôi thông — three consecutive pairs is 6 cards of non-uniform rank and parses to `null`.

**`canBeat` order of checks**
```
if (!prev) return true                               // leading, any valid combo
if (next.type === 'quad') {
  if (prev.type === 'single' && prev.rank === 15) return true          // chặt heo
  if (prev.type === 'quad') return next.rank > prev.rank               // chặt chồng
  return false                 // quad does NOT beat pairs/triples/straights/non-2 singles
}
if (next.type !== prev.type) return false
if (next.length !== prev.length) return false        // straights must match length
return next.rank > prev.rank                         // equal rank never beats
```

**`hasInstantWin` priority**, first match wins:
1. `sanh-rong` — 10 distinct consecutive ranks within 3..14 (only 3→Q, 4→K, 5→A are possible).
2. `tu-quy-2` — four cards of rank 15.
3. `dong-mau` — all 10 cards red (`suit ∈ {2,3}`) or all black (`suit ∈ {0,1}`).
4. `ba-sam-co` — ≥3 ranks with a count of exactly 3 or more (three triples inside 10 cards).
5. `nam-doi` — rank counts partition into 5 pairs (every rank count is exactly 2, 5 ranks).

**`createDeal`** — `mulberry32(seed)` PRNG, Fisher-Yates over a canonically ordered 52-card deck,
slice 10 per seat in seat order, sort each hand ascending, then compute `leadSeat` as the seat holding
the globally lowest `(rank, suit)` card. Remaining `52 - 10n` cards are discarded.

## Related Code Files

**Create**
- `packages/rules/src/cards.ts` — types, `RANK_LABELS`, `SUIT_LETTERS`, `toCard`, `toId`, `compareCards`, `sortHand`, `isTwo`, `buildDeck`
- `packages/rules/src/combos.ts` — `parseCombo`, internal `rankCounts`, `isConsecutive`
- `packages/rules/src/compare.ts` — `canBeat`, `lowestSingle(hand)`, `highestSingle(hand)`
- `packages/rules/src/instant-win.ts` — `hasInstantWin`
- `packages/rules/src/deal.ts` — `mulberry32`, `shuffle`, `createDeal`, `lowestCardSeat`
- `packages/rules/tests/cards.test.ts`, `combos.test.ts`, `compare.test.ts`, `instant-win.test.ts`, `deal.test.ts`

**Modify**
- `packages/rules/src/index.ts` — re-export the public surface above; drop the `RULES_VERSION` placeholder's sole-export status (keep the constant).

**Delete** — `packages/rules/tests/smoke.test.ts`.

## Implementation Steps

1. `cards.ts`: `RANK_LABELS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2']` indexed from rank 3;
   `SUIT_LETTERS = ['S','C','D','H']`. `toId({rank,suit})`, `toCard(id)` (parse trailing letter, rest is
   the rank label), `compareCards(a,b)` by rank then suit, `sortHand(ids)` returns a new array,
   `isTwo(id)` → `toCard(id).rank === 15`, `buildDeck()` → 52 ids in `(rank, suit)` order.
2. `combos.ts`: build a `Map<rank, count>`; branch on `cards.length` per the decision table.
   `isConsecutive(ranks)` sorts unique ranks and checks `max - min === len - 1 && unique.size === len && max <= 14`.
3. `compare.ts`: `canBeat` exactly as the pseudocode above. Add `lowestSingle(hand)` (first card of
   `sortHand`) and `highestSingle(hand)` (last card) — phase 3 and the client both need them.
4. `instant-win.ts`: evaluate the five predicates in priority order, return on the first hit.
5. `deal.ts`: `mulberry32`, `shuffle(deck, rng)` (in-place Fisher-Yates on a copy), `createDeal`,
   and `lowestCardSeat(hands)` used by `createDeal` and re-exported for phase 3.
6. Write the test files listed below, then `pnpm --filter @samloc/rules test`.
7. Update `packages/rules/src/index.ts` and run `pnpm -r typecheck`.

## Test Matrix (vitest, use these case names verbatim)

| File | Cases |
|---|---|
| `cards.test.ts` | `toId/toCard round-trips all 52 cards`; `sortHand orders 3S before 3C before 2H`; `isTwo is true only for rank 15` |
| `combos.test.ts` | `single: any one card parses`; `pair: 7H 7S parses; 7H 8S is null`; `triple: three 9s parse as triple rank 9`; `quad: four Ks parse as quad rank 13`; `straight: 3-4-5 parses length 3`; `straight: Q-K-A parses length 3 rank 14`; `straight: K-A-2 is null`; `straight: A-2-3 is null`; `straight: 2-3-4 is null`; `straight: mixed suits parse (suits irrelevant)`; `straight: 3-4-6 is null (gap)`; `straight: 3-3-4-5 is null (duplicate rank)`; `đôi thông 3-3-4-4-5-5 is null (no consecutive pairs in this game)`; `two cards of different rank are null` |
| `compare.test.ts` | `null prev: any combo may lead`; `higher single beats lower single`; `equal rank single cannot beat`; `single 2 beats single A`; `pair 8 beats pair 7`; `pair 7 cannot beat pair 7`; `straight must match length: 4-card straight cannot beat 3-card straight`; `straight 5-6-7 beats 3-4-5`; `different types never beat (pair vs single)`; `quad beats a single 2 (chặt heo)`; `quad does NOT beat a single A`; `quad does NOT beat a pair, triple or straight`; `bigger quad beats smaller quad (chặt chồng)`; `smaller quad cannot beat bigger quad` |
| `instant-win.test.ts` | `sảnh rồng 3..Q detected`; `sảnh rồng 5..A detected`; `tứ quý 2 detected`; `10 same colour detected (all red, all black)`; `3 triples detected`; `5 pairs detected`; `priority: hand with both tứ quý 2 and 5 pairs returns tu-quy-2`; `ordinary hand returns null` |
| `deal.test.ts` | `createDeal(4, 42) is deterministic across calls`; `createDeal deals 10 cards per player with no duplicates across hands`; `createDeal supports 2..5 players`; `leadSeat holds the lowest card (3S when dealt)`; `leadSeat falls back to the next lowest card when 3S is undealt` |

## Success Criteria

- [x] All test case names above exist and pass: `pnpm --filter @samloc/rules test`
- [x] `pnpm -r typecheck` exits 0
- [x] `packages/rules` has zero entries under `dependencies`
- [x] Every file in `packages/rules/src` ≤200 lines
- [x] `hasInstantWin` and `canBeat` are referenced from `src/index.ts`

## Risk Assessment

| Risk | L×I | Mitigation |
|---|---|---|
| `"10"` rank label breaks single-char id parsing | M×M | Parse the **suit** from the last char, rank from the prefix; covered by the round-trip test |
| `noUncheckedIndexedAccess` makes array access noisy | H×L | Use `for...of` and destructuring; avoid raw indexing outside `buildDeck` |
| Straight semantics drift from house rules during coding | L×H | The four negative straight tests (`K-A-2`, `A-2-3`, `2-3-4`, đôi thông) are the guard |
| `ba-sam-co` predicate accidentally matches a quad + triple | M×M | Count ranks with `count >= 3`; a quad legitimately contains a triple — accepted, matches house reading. Flag in Next Steps if the group disagrees |

**Rollback:** phase is additive inside `packages/rules`; revert the directory, restore `smoke.test.ts`.

## Security Considerations

- `createDeal` is seeded and deterministic **by design for tests**; the Durable Object must seed it from
  `crypto.getRandomValues` (phase 5), never from a client-supplied value. Note this on the `createDeal` docblock.
- No card data crosses a trust boundary in this phase; per-player filtering happens in phase 5.

## Next Steps

Phase 3 consumes `parseCombo`, `canBeat`, `hasInstantWin`, `createDeal`, `lowestSingle`, `highestSingle`.
Open question for the group: does `ba-sam-co` count a tứ quý as one of the three triples? Current answer: yes.
