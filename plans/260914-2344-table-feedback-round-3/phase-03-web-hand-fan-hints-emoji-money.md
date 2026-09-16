---
phase: 3
title: "Web — hand fan / hints / emoji / money"
status: completed
priority: P1
effort: "6h"
dependencies: [1, 2]
---

# Phase 3: Web — hand fan / hints / emoji / money

## Overview

Table-screen changes: the hand lies flat instead of arcing, playable cards light
up on your turn (one tap selects the whole combo) with a "Xếp bài" re-sort, the thối 2 tag
shows up, reaction bubbles stop disappearing behind the emoji button, seats show
money instead of ±lá, and the result modal waits until the last played cards have
been seen.

## Requirements

Functional:
- Hand cards sit in a straight horizontal row, evenly overlapped, no rotation.
- "Xếp bài" toggles between sort-by-rank (default, server order) and
  sort-by-group (combos clustered: quads, triples, pairs, runs, then singles).
- On your turn, cards that belong to at least one legal play get a gold outline.
  Nothing is dimmed, and nothing is highlighted off-turn.
- Tapping a highlighted card with an empty selection selects the whole cheapest
  legal combo containing it, not just that card.
- A `thoi2` event renders as a seat tag: "Thối 2 ×N (+M)".
- Reaction bubbles above my chip render above the emoji bar, never behind it.
- Each seat shows its money (`đ`, thousands-grouped); the ±lá figure is gone.
- When the hand ends, the result modal appears after a delay (default 1800 ms) so
  the last combo is visible; the delay is skipped if the player taps the table.

Non-functional:
- No new dependency; hint computation runs on the existing `@samloc/rules` import.
- Rune files keep the `.svelte.ts` extension; every file stays under 200 lines.

## Architecture

**Flat hand (feedback 12).** `fanLayout(count)` in `apps/web/src/lib/table-layout.ts`
keeps its step/centring maths but returns `top: FAN_BASE_TOP` and `rotate: 0` for
every card. `hand-fan.svelte` then only needs `left` and the selected lift; the
rotate term drops out of the transform. `FAN_ORIGIN` is unchanged.

**Hints (feedback 10).**
<!-- Updated: Validation Session 1 - outline + combo-on-tap, no dimming, no Gợi ý button -->
`TableLogic` gains:

```ts
readonly moves: string[][] = $derived.by(() =>
  this.isMyTurn ? legalMoves(room.view?.hand ?? [], this.currentCombo) : []);
readonly playableIds: Set<string> = $derived(new Set(this.moves.flat()));
```

`hand-fan.svelte` takes `playable: Set<string>` and outlines those cards in gold
(`box-shadow` ring, no opacity change). Nothing is dimmed — the user chose
outline-only.

`toggle(id)` becomes selection-aware so one tap plays a whole combo:

- selection empty and `id` is playable → select the first move in `moves` that
  contains `id` (moves are sorted cheapest-first from phase 1);
- selection empty and `id` is not playable → select just that card, so an illegal
  choice still gives the usual "Không chặt được …" feedback;
- selection non-empty → plain per-card toggle, so a combo can be refined by hand;
- tapping any selected card while the selection exactly equals a seeded combo
  clears the whole selection.

There is no separate "Gợi ý" button: the tap *is* the hint. "Xếp bài" stays, and
sits next to the action bar, left of "Bỏ lượt", so the bottom-right cluster keeps
its geometry.

**Hand ordering (feedback 10b).** A new `apps/web/src/lib/hand-order.ts` exports
`orderHand(hand, mode: 'rank' | 'group'): string[]`. Group mode buckets by rank
count descending (quad → triple → pair), then straight runs, then singles, each
bucket internally ascending. The display order is client-only: plays still send
the selected ids, which the server re-validates and sorts.

**Emoji z-order (feedback 3).** `EmojiBar` sits at `top: 248px` with `z-index: 20`
and is rendered *after* `MeChip` in `table-screen.svelte`, so at equal z-index it
paints over the bubbles rising from `.me-reactions` (`bottom: 100%` of a chip at
`top: 306px` → straight into the bar). Fix: move `.me-reactions` to the right of
my avatar (`left: 100%`, rising from the chip's own row) and give it
`z-index: 30`, above the bar. Opponent bubbles are unaffected.

**Money (feedback 2).** `apps/web/src/lib/format-money.ts` exports
`formatMoney(value)` reusing the lobby's formatting (`vi-VN` grouping + `đ`).
`opponent-seat.svelte` replaces `.opp-total` (`±totalLa`) with the money figure;
`me-chip.svelte` gains the same line under the name. Colour stays neutral — the
number is a balance, not a delta.

**Result delay (feedback 5a).** `table-screen.svelte` keeps a
`resultVisible = $state(false)` flag driven by an effect: when
`view.status === 'hand-end' && view.result`, start an 1800 ms timer; when the
status leaves `hand-end`, clear the timer and reset the flag. `HandResultModal`
renders only once `resultVisible` is true. A tap anywhere on the table during the
wait resolves the timer immediately. The winning combo is already in `view.trick`
(phase 2 keeps it there), so the wait shows real cards, not an empty felt.

## Related Code Files

- Modify: `apps/web/src/lib/table-layout.ts` (flat layout)
- Modify: `apps/web/src/components/hand-fan.svelte` (flat row, outlines)
- Modify: `apps/web/src/components/action-bar.svelte` ("Xếp bài" button)
- Modify: `apps/web/src/components/me-chip.svelte` (bubble position, money)
- Modify: `apps/web/src/components/opponent-seat.svelte` (money replaces ±lá)
- Modify: `apps/web/src/screens/table/table-logic.svelte.ts` (moves, combo tap, thối 2 tag)
- Modify: `apps/web/src/screens/table/table-screen.svelte` (result delay, wiring)
- Create: `apps/web/src/lib/hand-order.ts`, `apps/web/src/lib/format-money.ts`
- Modify: `apps/web/src/screens/lobby-screen.svelte` (use the shared formatter)

## Implementation Steps

1. Flatten `fanLayout`; simplify the transform in `hand-fan.svelte`; check a
   10-card hand still fits the 308 px track without covering the action bar.
2. Add `format-money.ts`, point the lobby chip at it, then swap the seat rows:
   `opponent-seat.svelte` and `me-chip.svelte` show money.
3. Add `hand-order.ts` and a `sortMode` state in `TableLogic`; render
   `orderHand(view.hand, sortMode)` instead of `view.hand`.
4. Add `moves` / `playableIds` and the selection-aware `toggle()` to
   `TableLogic`; pass `playable` into `hand-fan.svelte` and outline those cards.
5. Add the "Xếp bài" button to `action-bar.svelte` (disabled when the hand is
   empty).
6. Map the `thoi2` event in `tagFor()` → `{ text: 'Thối 2 ×N (+M)', tone: 'warn' }`.
7. Reposition `.me-reactions` and raise its z-index; verify against an open emoji
   bar.
8. Add the result-delay flag and the tap-to-skip handler in `table-screen.svelte`.
9. Verify manually with `pnpm dev`: two browser profiles, one room, play a trick
   out and watch the retained cards, the tags and the delayed modal.

## Success Criteria

- [x] Hand renders as a flat row; 10 cards do not overlap the action bar or the
      me-chip.
- [x] On your turn, playable cards carry a gold outline; off-turn no outlines.
- [x] Tapping an outlined card with an empty selection selects the whole combo,
      and the play button is immediately enabled.
- [x] Tapping a selected card of a seeded combo clears the selection.
- [x] "Xếp bài" regroups the hand and keeps selection consistent.
- [x] Thối 2 tag appears on the paying seat at hand end.
- [x] A reaction sent while the emoji bar is open is fully visible.
- [x] Seats show money; no ±lá anywhere on the table screen.
- [x] The last combo stays on the table ~1.8 s before the result modal.

## Risk Assessment

- **Hint cost**: `legalMoves` runs on every `$derived` recompute. With ≤10 cards
  it is microseconds; if profiling ever disagrees, gate it behind `isMyTurn`
  (already the case).
- **Combo tap vs manual play**: seeding a combo on the first tap must still let a
  player build a different combo by hand; the per-card toggle on a non-empty
  selection covers it, and needs a manual check.
- **Selection vs display order**: re-sorting must not clear a selection —
  `selected` holds ids, not indices, so it survives; covered by a manual check.
- **Delay vs a fast host**: if the host presses "Ván tiếp" during the delay, the
  status leaves `hand-end` and the effect clears the timer — the modal never
  flashes.

## Security Considerations

Hints are advisory only: the server still validates every play, so a tampered
client gains nothing.

## Next Steps

Phase 4 reworks the result modal itself and the room-level options.
