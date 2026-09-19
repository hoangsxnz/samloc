---
phase: 1
title: "Result footer, session money chip, result chip in the top bar"
status: completed
priority: P1
effort: "1h"
dependencies: []
---

# Phase 1: Result footer, session money chip, result chip in the top bar

## Goal

The result footer reads "X cầm cái ván sau" in full, the top bar shows the
session money swing, and the collapsed "Kết quả" chip no longer sits on top
of the ≡ menu button.

## Context

- `apps/web/src/screens/table/hand-result-modal.svelte:19,45-53` — `showSessionBoard`,
  the `.session-board` block and the ghost "Bảng điểm phiên" button. Screenshot 1
  shows the status text squeezed between the button and "Rời phòng".
- `apps/web/src/screens/table/hand-result-modal.svelte:29-31,141-155` — the
  collapsed `.result-chip` is `position: fixed; top: 8px; right: max(40px, …)`.
  `table-top-bar.svelte:39-40,66-69` puts the ≡ button at the same corner
  (`right: max(40px, …)`, `margin-right: -8px`). Screenshot 2 shows the chip
  covering the button.
- `apps/web/src/components/table-top-bar.svelte:18` — `.session-chip` shows
  `totalLa` (`+11`). `RoomView.settings.stakePerLa` and `SeatView.totalLa` are
  both in the view, so the money swing is `totalLa * stakePerLa` — the same
  formula `room-do-view.ts:44` uses for `money`. No wire change.
- `apps/web/src/lib/format-money.ts` — `formatMoneyDelta` already renders
  `+$800` / `−$800`.
- `apps/web/src/screens/table/table-screen.svelte:60-68` — mounts the modal
  after `RESULT_DELAY_MS`; the `collapsed` state currently lives inside the modal.

## Files to Modify

- `apps/web/src/screens/table/hand-result-modal.svelte`
- `apps/web/src/components/table-top-bar.svelte`
- `apps/web/src/screens/table/table-screen.svelte`
- `apps/web/src/screens/table/table-surface.svelte`

## Tasks & Steps

1. **Remove the session board** in `hand-result-modal.svelte`: delete
   `showSessionBoard`, the `{#if showSessionBoard}` block, the ghost
   `AppButton`, the `.session-board` rule and the now-unused `formatMoney`
   import. Keep `.result-status` as the first footer child; it already has
   `flex: 1 1 auto` and right-aligns the text.
2. **Move the collapse state up.** In `hand-result-modal.svelte` replace the
   internal `collapsed` state with props `oncollapse: () => void`; `tapScrim()`
   calls `oncollapse()` for non-hosts. Delete the `{#if collapsed}` branch and
   the `.result-chip` rule. Remove the `collapsed` `$state` and the
   `result-chip` markup entirely — the chip moves to the top bar.
3. In `table-screen.svelte` add `let resultCollapsed = $state(false)`; reset it
   to `false` inside the existing `$effect` that resets `resultVisible` when
   the status leaves `hand-end` (a new hand must not start collapsed). Render
   the modal only when `resultVisible && !resultCollapsed`, passing
   `oncollapse={() => (resultCollapsed = true)}`. Pass
   `onshowresult={resultCollapsed ? () => (resultCollapsed = false) : null}`
   to `TableSurface`.
4. `table-surface.svelte`: add prop `onshowresult: (() => void) | null` and
   forward it to `TableTopBar`.
5. `table-top-bar.svelte`:
   - Add prop `onshowresult: (() => void) | null`. Render
     `<button type="button" class="result-chip" onclick={onshowresult}>Kết quả</button>`
     between the session chip and the menu button when it is non-null. Style:
     `height: 32px; padding: 0 14px; border-radius: var(--r-full); background: var(--gold); color: var(--on-gold); font-weight: 700; font-size: 13px; border: 0;`
     (the values the old chip used). The bar is inside the scaled `.table-root`,
     so no `position: fixed` and no safe-area maths are needed.
   - Replace the `+11` chip with the money swing:
     `{formatMoneyDelta(mySeat.totalLa * view.settings.stakePerLa)}`; import
     `formatMoneyDelta` from `../lib/format-money`. Colour the chip text
     `var(--success)` when ≥ 0 and `var(--danger)` when negative (`class:neg`).
     Keep `margin-left: auto` on it so the chip + result chip + menu stay
     right-aligned.

## Verification

- `pnpm typecheck`
- `pnpm dev`, play a hand to the end with two browsers at 844×390:
  - footer shows "<name> cầm cái ván sau" in full for the host and the
    "Đang chờ chủ phòng…" line for the guest, no "Bảng điểm phiên";
  - guest taps the scrim → chip "Kết quả" appears left of ≡; both open;
  - tapping the chip re-opens the modal; "Ván tiếp" from the host clears it;
  - top bar reads `+$800` / `−$800` matching the result rows' running totals.
- `grep -rn "Bảng điểm phiên\|totalLa" apps/web/src` returns only the
  top-bar multiplication and `result-row.svelte`.
