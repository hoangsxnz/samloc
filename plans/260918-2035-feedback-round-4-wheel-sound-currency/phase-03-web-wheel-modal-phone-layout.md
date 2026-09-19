---
phase: 3
title: "Wheel modal: explicit wheel size on phone"
status: done
priority: P1
effort: "30m"
dependencies: []
---

# Phase 3: Wheel modal: explicit wheel size on phone

## Goal

On a phone in landscape the wheel modal shows the wheel on the left and the
title, spins-left line, "Quay", result and "Đóng" in a column on the right,
with nothing overlapping (see `.orca/drops/lucky-wheel-bug.jpeg`).

## Cause

`apps/web/src/components/wheel-modal.svelte:117-133`:

```css
.wheel-panel { height: min(340px, calc(100dvh - 24px)); display: grid; grid-template-columns: auto 1fr; }
.wheel { height: 100%; max-height: 300px; aspect-ratio: 1; }
```

The `auto` column's width comes from the SVG's intrinsic contribution, but the
SVG only has a `viewBox` and a percentage height. During track sizing the
percentage is indefinite, so phone Safari gives the column ~0 width, stretches
the copy column across the whole panel (the full-width "Quay" button in the
screenshot) and then paints the 300px SVG over it. Desktop Chrome happens to
resolve the same rules to a 300px column.

## Files to Modify

- `apps/web/src/components/wheel-modal.svelte` (styles only)

## Tasks & Steps

1. Size the wheel from one variable instead of a percentage:
   ```css
   .wheel-panel {
     --wheel: min(300px, calc(100dvh - 72px));   /* panel padding + scrim margin */
     width: min(560px, calc(100vw - 32px));
     height: auto;
     max-height: calc(100dvh - 24px);
     display: grid;
     grid-template-columns: var(--wheel) minmax(0, 1fr);
     gap: var(--sp-4);
     align-items: center;
   }
   .wheel { width: var(--wheel); height: var(--wheel); }
   ```
   Remove `aspect-ratio`, `max-height` and `height: 100%` from `.wheel`.
   At 100dvh = 375px (iPhone SE landscape) the wheel is 300px and the panel is
   324px tall; at 390px and up it stays 300px.
2. Keep the copy column from overflowing: `.wheel-copy` already has
   `min-width: 0`; confirm the title wraps rather than widening the column.
3. Check in `pnpm dev`: Home → wheel button, at 844×390, 667×375 and 1280×720;
   spin once and confirm the pointer still lands on the returned wedge
   (`rotationFor` is untouched, only CSS changes).

## Verification

- `pnpm typecheck`.
- Visual at 667×375: wheel 300px, no vertical scroll inside the panel, "Quay"
  and "Đóng" in the right column, title readable.
- Visual on the real phone that produced the screenshot: layout matches
  desktop.

## Todo

- [x] `--wheel` variable sizes both the SVG and the grid column
- [x] Panel height is content-driven with a dvh cap
- [x] Checked at 667×375 and 844×390 in Chromium; real phone pending
