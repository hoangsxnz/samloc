---
phase: 1
title: "Web: table layout fixes"
status: completed
priority: P1
effort: "3h"
dependencies: []
---

# Phase 1: Web: table layout fixes

## Goal

Move the Báo 1 marker into the opponent avatar, seat 4-player tables at
0 / 90 / 180 / 270, and scatter played combos inside a fixed box at the centre.

## Context

- `apps/web/src/lib/table-layout.ts:8-13` — `SLOTS_BY_COUNT[4]` is
  `['top-left', 'top-right', 'right']`; `SLOT_POSITIONS.left/right` sit at `top: 120`.
- `apps/web/src/components/opponent-seat.svelte:50-54` — the persistent
  `Báo 1` pill is rendered below the count row; top seats start at y 48 and
  the pill ends near y 160, overlapping `.centre-stack` (top 150).
- `apps/web/src/screens/table/table-tags.svelte.ts:22-23` — the `bao1`
  event also spawns a floating tag under the seat (`.opp-tag-queue`, `top: 100%`).
- `apps/web/src/components/centre-stack.svelte:15-22` — `ageStyle()` offsets
  older rows alternately; the newest row is always dead-centre.
- `apps/web/src/components/card-flight.svelte` — the flight lands at
  `left:50%; top:200px` (`CENTRE_POINT`), so a scattered landing spot needs the
  offset passed in.
- `docs/design-guidelines.md` §4 "Seat (opponent)" and §7 layout table
  describe the current positions; update in Phase 7.

## Files to Create / Modify

- Create: `apps/web/src/lib/trick-scatter.ts`
- Modify: `apps/web/src/lib/table-layout.ts`
- Modify: `apps/web/src/components/opponent-seat.svelte`
- Modify: `apps/web/src/screens/table/table-tags.svelte.ts`
- Modify: `apps/web/src/components/centre-stack.svelte`
- Modify: `apps/web/src/components/card-flight.svelte`
- Modify: `apps/web/src/screens/table/table-surface.svelte`

## Tasks & Steps

1. **4-player seats** — `table-layout.ts`: set `SLOTS_BY_COUNT[4]` to
   `['left', 'top-centre', 'right']` (clockwise from me at the bottom). Move
   `SLOT_POSITIONS.left` / `.right` to `top: 148` so the side column
   (~105 px tall) is centred on the table's y 200; the 5-player layout keeps
   using the same slots and simply spreads further. Update the comment on
   `SLOT_POSITIONS`. `slotOrigin()` needs no change.
2. **Báo 1 badge** — `opponent-seat.svelte`: delete the
   `{:else if seat.bao1}` pill branch. Inside `.opp-avatar-wrap` add
   `{#if seat.bao1}<span class="opp-bao1" aria-label="Còn 1 lá">1</span>{/if}`:
   `position:absolute; top:-3px; right:-3px; width:18px; height:18px;
   border-radius:50%; background:var(--danger); color:#fff; font:700 11px/18px;
   border:2px solid var(--felt-dark); z-index:1`. Keep the `⟳` and `Bỏ` tags.
   The red card-back at `cardCount === 1` already exists and stays.
3. **No floating Báo 1 tag** — `table-tags.svelte.ts`: in `#push`, when
   `event.type === 'bao1'` set `this.ariaLive = 'Báo 1'` and return before
   creating a tag (the badge is the visual). Remove the `bao1` case from
   `tagFor` so it returns `null` for it.
4. **Scatter helper** — create `trick-scatter.ts`:
   ```ts
   export const SCATTER_BOX = { width: 120, height: 60 }; // px, centred on CENTRE_POINT
   export const SCATTER_MAX_ROT = 12; // degrees
   export interface Scatter { dx: number; dy: number; rot: number }
   /** FNV-1a over `${seat}:${cards}` so every client and every snapshot places a combo identically. */
   export function scatterFor(seat: number, cards: readonly string[]): Scatter
   ```
   Derive three unit values from the 32-bit hash (bits 0–9, 10–19, 20–29),
   map to `dx ∈ [-60, 60]`, `dy ∈ [-30, 30]`, `rot ∈ [-12, 12]`.
5. **Centre stack** — `centre-stack.svelte`: drop `ageStyle`; for every row
   compute `scatterFor(entry.seat, entry.cards)` and style
   `transform: translate(-50%, -50%) translate(dx px, dy px) rotate(rot deg)`.
   Keep opacity by age: newest 1, then `max(0.3, 0.5 - (age - 1) * 0.08)`;
   give the newest row `z-index: 1`. The `.trick-who` label moves with its row.
   Keep the `trick-land` fade-in.
6. **Flight lands on the spot** — `card-flight.svelte`: add props
   `landDx`, `landDy`, `landRot` (default 0) and end the `card-fly` keyframe
   at `translate(-50%, -50%) translate(var(--ldx), var(--ldy)) rotate(var(--lrot))`
   with the `from` frame keeping the origin offset. `table-surface.svelte`:
   compute `const landing = $derived(logic.flight ? scatterFor(logic.flight.seat, logic.flight.cards) : null)`
   and pass `landDx/landDy/landRot` plus the existing `dx/dy` (origin
   relative to the centre; the landing offset is applied on top).

## Verification

- `pnpm typecheck`
- `pnpm dev`, open two browsers as 4 players: opponents sit left / top / right; with 5 players the extra two sit top-left / top-right and nothing overlaps the centre stack.
- Play until someone has 1 card: the red "1" badge sits on the avatar's top-right; no pill under the seat; the aria-live region still announces "Báo 1".
- Play several combos: each lands on a different spot inside the 120×60 box, the flight ends exactly where the combo rests, reconnect (reload) shows the same spots.
- `find apps/web/src -name '*.svelte' -o -name '*.ts' | xargs wc -l | awk '$1 > 200'` prints nothing.

## Todo

- [x] `SLOTS_BY_COUNT[4]` → left / top-centre / right; side slots at top 148
- [x] Báo 1 badge on avatar; pill removed
- [x] `bao1` event is aria-live only
- [x] `trick-scatter.ts` with FNV-1a and box constants
- [x] centre-stack uses scatter; opacity by age kept
- [x] card-flight lands on the scattered spot
- [x] Visual check with 4 and 5 players

## Success Criteria

All Verification bullets pass and every touched file stays ≤ 200 lines.

## Risk

- Scatter box vs. 5-card straights: a `sm` 5-card row is 44 + 4×24 = 140 px wide; with `dx = ±60` it can reach x 302 ± 130, still inside the 240 px stack column plus a small margin, and never under a seat (top seats end at y ~160, side seats start at x 44 + 80). If a clash shows in the visual check, shrink `SCATTER_BOX.width` to 100.
