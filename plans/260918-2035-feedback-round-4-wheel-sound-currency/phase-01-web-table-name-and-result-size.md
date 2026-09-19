---
phase: 1
title: "Table: drop the played-card name, shrink the result board"
status: done
priority: P1
effort: "45m"
dependencies: []
---

# Phase 1: Table: drop the played-card name, shrink the result board

## Goal

The centre stack shows only the played cards, and the post-hand result board is
one notch smaller (640px max, smaller title, tighter rows, 40px buttons) while
still fitting 2–5 players on a phone in landscape without scrolling.

## Context

- `apps/web/src/components/centre-stack.svelte:13-15, 35` — `nameFor(seat)` and
  `<span class="trick-who">` under the newest `.trick-row`; `.trick-who` style
  at lines 88-93. `seats` is only used for the name.
- `apps/web/src/screens/table/table-surface.svelte:80` —
  `<CentreStack trick={view.trick} seats={view.seats} />`.
- `apps/web/src/screens/table/hand-result-modal.svelte:84-93` — `.result-modal`
  `width: min(820px, calc(100vw - 32px))`; `.result-grid` at 106-111 uses
  `minmax(240px, 1fr)`; `.result-foot :global(.btn)` at 126-130 keeps the
  shared 48px height.
- `apps/web/src/screens/table/result-head.svelte:35-38` — `h1` is `--fs-xl`.
- `apps/web/src/screens/table/result-row.svelte` — row padding `6px 8px`,
  `.result-cards :global(.card-xs)` overlap `-12px` (24px cards: ten cards =
  132px wide).
- Tokens (`apps/web/src/app.css`): `--fs-lg: 18px`, `--fs-xl: 22px`,
  `--sp-2: 8px`; `.btn-ghost` is already 40px.

## Files to Modify

- `apps/web/src/components/centre-stack.svelte`
- `apps/web/src/screens/table/table-surface.svelte`
- `apps/web/src/screens/table/hand-result-modal.svelte`
- `apps/web/src/screens/table/result-head.svelte`
- `apps/web/src/screens/table/result-row.svelte`

## Tasks & Steps

1. `centre-stack.svelte`: delete the `{#if isNewest}<span class="trick-who">…`
   line, `nameFor()`, the `seats` prop (and `SeatView` import), and the
   `.trick-who` rule.
2. `table-surface.svelte:80`: drop `seats={view.seats}` from `<CentreStack>`.
3. `hand-result-modal.svelte`:
   - `.result-modal`: `width: min(640px, calc(100vw - 32px))`.
   - `.result-grid`: `grid-template-columns: repeat(auto-fit, minmax(220px, 1fr))`
     (two columns at 640px; 5 players become 3 rows).
   - `.result-foot :global(.btn)`: add `height: 40px; font-size: var(--fs-sm);`.
   - Update the auto-fit comment to describe the new 2-column packing.
4. `result-head.svelte`: `.result-head h1 { font-size: var(--fs-lg); }`.
5. `result-row.svelte`: `padding: 4px 8px`; card overlap `-14px` so ten cards
   are 114px wide and fit the narrower column.
6. Run `pnpm dev`, play a hand to `hand-end` with 2 and with 4–5 players
   (open extra tabs), check the modal at 844×390 device emulation.

## Verification

- `pnpm typecheck` (unused `seats` prop / import would fail the Svelte check).
- Visual, 844×390 and 1280×720: no name under the centre combo; result modal
  is 640px wide, title smaller, buttons 40px; 5-player result shows without a
  scrollbar in `.result-grid`; ten remaining cards do not overflow their row.
- The "Kết quả" collapsed chip and the host/non-host footer are unchanged.

## Todo

- [x] Centre stack name removed, `seats` prop gone
- [x] Result modal 640px, `--fs-lg` title, 40px footer buttons, 220px columns
- [x] Result row tighter (4px padding, -14px card overlap, 28px card strip so 5 players fit)
- [x] Visual check 2 / 4 / 5 players at 844×390
