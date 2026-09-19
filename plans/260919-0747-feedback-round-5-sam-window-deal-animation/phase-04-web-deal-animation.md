---
phase: 4
title: "Table: deal animation for the length of the shuffle clip"
status: completed
priority: P1
effort: "1.5h"
dependencies: []
---

# Phase 4: Table: deal animation for the length of the shuffle clip

## Goal

For the first ~4.6 s of every hand a face-down deck sits in the centre and
one card at a time flies to each seat in turn; my fan and the opponents'
card counts fill in as cards land, reaching the full hand when the shuffle
clip ends.

## Context

- `apps/web/public/sounds/shuffle.mp3` is 4.608 s (`ffprobe`). The clip is
  played from `room.svelte.ts:31-35` via `soundCuesFor(prev, next)`, whose
  `handStarted()` is the exact "new hand" signal (status `playing` with a new
  `handNo`). Timing is a fixed constant, not the audio `ended` event: sound
  may be muted or locked, and the animation must still run.
- `apps/web/src/components/card-flight.svelte` flies a combo *into* the
  centre (`--dx/--dy` origin → landing offset); the deal needs the reverse
  direction, a face-down card and a per-card key. A separate 40-line
  component is cleaner than adding a `reverse` flag.
- `apps/web/src/components/playing-card.svelte` renders a back with
  `back={true}` (`size="sm"` is 40×56 approximately; check `.card-sm`).
- `apps/web/src/lib/table-layout.ts` — `CENTRE_POINT`, `FAN_ORIGIN`,
  `slotOrigin(slot)`, `seatsAfter(seat, seats)`; `table-surface.svelte:50-57`
  already maps a seat to its flight origin (`flightOrigin`).
- `apps/web/src/screens/table/table-logic.svelte.ts` — `#syncFlight` shows the
  priming pattern (first snapshot after mount never animates).
- `centre-stack.svelte` is invisible while `trick` is empty, so the deck can
  occupy the same 240×100 box at `top: 150px`.
- Reduced motion: `prefersReducedMotion()` helper exists in `table-logic`.

## Files

- Modify: `apps/web/src/lib/room.svelte.ts`
- Modify: `apps/web/src/screens/table/table-logic.svelte.ts`
- Create: `apps/web/src/components/deck-stack.svelte`
- Create: `apps/web/src/components/deal-flight.svelte`
- Modify: `apps/web/src/screens/table/table-surface.svelte`

## Tasks & Steps

1. **Hand-start signal** (`room.svelte.ts`): add
   `handStartedAt = $state<number | null>(null)` and set it to `Date.now()`
   inside `onSnapshot` when the cue list contains `'shuffle'` (compute the
   cues once into a local). Reset to `null` in `connect()` / `disconnect()`.
   Because the first snapshot after `connect()` produces no cues, a reload
   mid-deal never animates — matches the flight priming rule.
2. **Deal schedule** (`table-logic.svelte.ts`):
   - Constants `DEAL_MS = 4600` (comment: length of `shuffle.mp3`) and
     `CARDS_PER_SEAT = 10`.
   - State `dealt = $state(0)` (cards dealt so far, over all seats) and
     `dealing = $derived(this.dealt > 0 && this.dealt < this.dealTotal)`;
     `dealTotal = $derived((room.view?.seats.filter(s => s.cardCount > 0).length ?? 0) * CARDS_PER_SEAT)`.
   - `dealOrder: number[] = $derived.by(...)` — seats with cards, clockwise
     from `room.view.turnSeat` (`[turnSeat, ...seatsAfter(turnSeat, seatNumbers)]`).
   - `$effect` on `room.handStartedAt`: when it changes to a non-null value
     and reduced motion is off, set `dealt = 1` and start
     `setInterval(() => dealt++, DEAL_MS / dealTotal)`; clear the interval
     when `dealt >= dealTotal` (set `dealt = dealTotal`) and on teardown.
     Under reduced motion leave `dealt = 0` (no animation, full hand at once).
   - Helpers: `dealtFor(seat): number` = cards landed at that seat so far
     (`Math.floor((dealt - idx - 1) / n) + 1` clamped to `0..10`, where
     `idx = dealOrder.indexOf(seat)`, `n = dealOrder.length`);
     `currentDealSeat: number | null` = `dealOrder[(dealt - 1) % n]` while dealing.
3. **`deck-stack.svelte`** (new, ~30 lines): absolute box at the centre
   (`top: 150px; left: 50%; transform: translateX(-50%); width: 240px; height: 100px`),
   three `PlayingCard back size="sm"` stacked with 2 px offsets and a slight
   shadow so it reads as a pile. Fades out over 200 ms when unmounted is not
   required; Svelte's default unmount is fine.
4. **`deal-flight.svelte`** (new, ~40 lines): props `dx`, `dy` (target offset
   from the centre, design px). One `PlayingCard back size="sm"` at the centre
   animated `translate(0,0) → translate(var(--dx), var(--dy)) scale(0.6)` with
   `opacity 1 → 0.2` over `260ms` (same easing as `card-flight`), `pointer-events: none`,
   `aria-hidden`.
5. **`table-surface.svelte`**:
   - `{#if logic.dealing}<DeckStack />{/if}` next to `CentreStack`.
   - `{#if logic.dealing && logic.currentDealSeat !== null}{#key logic.dealt}<DealFlight dx={target.x - CENTRE_POINT.x} dy={target.y - CENTRE_POINT.y} />{/key}{/if}`
     where `target` is `FAN_ORIGIN` for my seat or `slotOrigin(slot)` for an
     opponent — extract the existing `flightOrigin` seat→point lookup into a
     small `originFor(seat)` function and reuse it for both.
   - `HandFan hand={logic.dealing ? logic.orderedHand.slice(0, logic.dealtFor(view.youSeat)) : logic.orderedHand}`.
   - Opponent seat: pass
     `seat={logic.dealing ? { ...opp.seatView, cardCount: logic.dealtFor(opp.seatView.seat) } : opp.seatView}`.
   - Keep `table-surface.svelte` under 200 lines; if it crosses, move the
     origin helper into `table-layout.ts` as `seatOrigin(youSeat, seat, seats)`.
6. Interplay with phase 5: expose `logic.dealing` — phase 5 hides the
   Huỷ báo / Báo Sâm buttons while it is true.

## Verification

- `pnpm typecheck`
- `pnpm dev`, two browsers, host presses "Ván tiếp": deck appears at the
  centre, cards fly alternately to each seat, my fan grows one card at a time
  (selection stays disabled — it is not my turn yet), opponent counts climb
  to 10, deck disappears at ~4.6 s together with the end of the shuffle clip.
- Reload one browser mid-deal: the full hand shows at once, no deck.
- DevTools → Rendering → "prefers-reduced-motion: reduce": no deck, no flights.
- 5-player room: 50 flights in 4.6 s (≈ 92 ms apart) stays smooth on a phone.
