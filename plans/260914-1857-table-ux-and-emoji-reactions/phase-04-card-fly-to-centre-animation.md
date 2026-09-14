---
phase: 4
title: "Card fly-to-centre animation"
status: completed
priority: P2
effort: "2h"
dependencies: [3]
---

# Phase 4: Card fly-to-centre animation

## Overview

When any player plays, the played cards fly from that player's position into
the centre stack instead of appearing there instantly. Applies to my own plays
(origin: the hand fan) and to opponents' plays (origin: their avatar).

## Requirements

- Functional: a transient copy of the played combo animates from the source
  point to the centre stack over ~260ms; the real centre-stack row fades in as
  the flight lands, so no duplicate card is visible mid-flight.
- Non-functional: pure CSS transform/opacity (no layout thrash); no animation
  under `prefers-reduced-motion: reduce`; a fast second play must not leave a
  stale flight on screen; zero server changes.

## Architecture

Trigger source is the snapshot itself: every accepted play produces a new
`view.trick` entry. `TableLogic` watches the newest entry and publishes a
`flight` value; `table-screen.svelte` maps the flight's seat to a design-frame
origin and renders a `card-flight.svelte` layer.

```
snapshot → view.trick[last] changes
   → TableLogic.flight = { id, seat, cards }        (auto-cleared after 300ms)
   → table-screen: origin = originFor(flight.seat)  (fan centre | opponent avatar)
   → <CardFlight cards dx dy />   CSS: translate(dx,dy) scale(.85) → translate(0,0) scale(1)
```

Origins in the 844×390 frame (new exports in `lib/table-layout.ts`):

| Source | Point |
|---|---|
| Centre stack (target) | `(TABLE_WIDTH / 2, 200)` — `.centre-stack` top 150 + half of its 100px height |
| My hand | `(FAN_TRACK_LEFT + FAN_TRACK_WIDTH / 2, FAN_BASE_TOP + 40)` |
| Opponent slot | left-anchored: `(left + SEAT_WIDTH / 2, top + 20)`; right-anchored: `(TABLE_WIDTH - right - SEAT_WIDTH / 2, top + 20)` |

Dedupe key: `${trick.length}:${entry.seat}:${entry.cards.join(',')}`. Reconnect
snapshots repeat the same trick array, so an identical key must not re-fire.

## Related Code Files

- Create: `apps/web/src/components/card-flight.svelte` — absolutely positioned flying combo
- Modify: `apps/web/src/lib/table-layout.ts` — `CENTRE_POINT`, `FAN_ORIGIN`, `slotOrigin(slot)`
- Modify: `apps/web/src/screens/table/table-logic.svelte.ts` — `flight` state + trick-change effect
- Modify: `apps/web/src/screens/table/table-screen.svelte` — origin lookup, mount `<CardFlight>`
- Modify: `apps/web/src/components/centre-stack.svelte` — land-in animation on `.newest`
- Read for context: `apps/web/src/components/playing-card.svelte`, `apps/web/src/lib/orientation.svelte.ts` (reduced-motion precedent in `app.css`)

## Implementation Steps

1. `table-layout.ts`: export `CENTRE_POINT = { x: TABLE_WIDTH / 2, y: 200 }`,
   `FAN_ORIGIN = { x: FAN_TRACK_LEFT + FAN_TRACK_WIDTH / 2, y: FAN_BASE_TOP + 40 }`
   and `slotOrigin(slot: SeatSlot): { x: number; y: number }` derived from
   `SLOT_POSITIONS` (handles the `right`-anchored slots). Keep it a pure
   function — it is unit-testable if a test is ever wanted.
2. `card-flight.svelte`: props `{ cards: string[]; dx: number; dy: number }`.
   Markup = the same `.trick-cards` row as `centre-stack.svelte` (PlayingCard
   `size="sm"`, `-20px` overlap) inside a wrapper positioned at
   `left: 50%; top: 150px; height: 100px;` with
   `--dx/--dy` custom properties and:
   ```css
   animation: card-fly 260ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
   @keyframes card-fly {
     from { transform: translate(-50%, -50%) translate(var(--dx), var(--dy)) scale(0.85); opacity: 0.9; }
     to   { transform: translate(-50%, -50%) scale(1); opacity: 1; }
   }
   ```
   Wrap the whole component in `@media (prefers-reduced-motion: reduce) { … display: none }`
   or guard the mount in `table-screen` — pick the guard, it avoids rendering
   entirely (see step 4).
3. `table-logic.svelte.ts`:
   - `flight = $state<{ id: number; seat: number; cards: string[] } | null>(null)`
   - `#lastTrickKey: string | null`, `#flightTimer`
   - `$effect` reads `room.view?.trick`, computes the key from the newest entry;
     if the key changed and is non-null, bump an id, set `flight`, clear any
     pending timer, and `setTimeout(() => (this.flight = null), 300)`.
   - Clear the timer in the existing teardown `$effect`.
   - Skip entirely when `window.matchMedia('(prefers-reduced-motion: reduce)').matches`.
4. `table-screen.svelte`:
   - Build `originFor(seat)`: `seat === view.youSeat ? FAN_ORIGIN : slotOrigin(slotOf(seat))`
     using the already-computed `opponentSlots(...)` result (extend the existing
     `opponentSeats` derivation to keep the raw `slot`, so the mapping is not
     computed twice). Fall back to `CENTRE_POINT` for an unknown seat.
   - Render after `<CentreStack>`:
     ```svelte
     {#if logic.flight}
       {#key logic.flight.id}
         <CardFlight cards={logic.flight.cards}
                     dx={origin.x - CENTRE_POINT.x} dy={origin.y - CENTRE_POINT.y} />
       {/key}
     {/if}
     ```
5. `centre-stack.svelte`: give `.trick-row.newest` a 260ms
   `opacity 0 → 1` mount animation (`animation: trick-land 260ms ease-out both`)
   so the landing card and the real row do not both show during the flight.
   Wrap in the reduced-motion media query already used in `app.css` style
   (`@media (prefers-reduced-motion: reduce) { animation: none; }`).
6. Manual check: 2-player and 5-player rooms; my play, opponent play from each
   of the 5 slots, and two plays in quick succession (no stuck ghost).

## Success Criteria

- [ ] My played combo visibly travels from the fan area to the centre
- [ ] An opponent's combo travels from their avatar to the centre, correct direction for all 5 slots
- [ ] No duplicated static card visible during the flight
- [ ] Rapid consecutive plays leave no stale flight layer
- [ ] Reconnect (socket drop → resnapshot) does not replay an old flight
- [ ] Nothing animates with `prefers-reduced-motion: reduce`
- [ ] `pnpm typecheck` clean

## Risk Assessment

- **Re-fire on reconnect** is the main correctness trap; the dedupe key must be
  compared against the previous key, not against "have I seen this ever"
  (a legitimate identical replay of the same combo cannot happen twice in a row
  within one trick, so last-key comparison is sufficient and simpler).
- The flight layer sits inside `.table-root`, which carries a CSS `transform`
  scale; `position: absolute` inside it is correct (the existing components do
  the same). Do not use `position: fixed` here.
