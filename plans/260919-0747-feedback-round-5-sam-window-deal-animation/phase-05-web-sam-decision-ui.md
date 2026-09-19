---
phase: 5
title: "Table: Huỷ báo / Báo Sâm decision UI and seat badges"
status: completed
priority: P1
effort: "1.5h"
dependencies: [3, 4]
---

# Phase 5: Table: Huỷ báo / Báo Sâm decision UI and seat badges

## Goal

After the deal animation every seat sees "Huỷ báo" and "Báo Sâm" with a 10 s
countdown; a seat's choice shows as a badge at its position on every client;
the leader's turn UI (ring, "Lượt của bạn", enabled "Đánh", `turn` cue)
starts only when the window closes.

## Context

- Phase 3 wire types: `ClientMsg 'declineSam'`, `SeatView.samChoice`,
  `RoomView.phase === 'sam-window'`, `turnDeadline` (15 s from deal),
  `canDeclareSam`.
- `apps/web/src/lib/room.svelte.ts` — `declareSam()` sends `{ type: 'declareSam' }`.
- `apps/web/src/lib/sound-cues.ts:30-32` — `turn` fires on
  `turnSeat === youSeat`; during the window the leader is already `turnSeat`,
  so today the cue would fire at the deal.
- `apps/web/src/screens/table/table-logic.svelte.ts` — `isMyTurn`, `remain`
  (seconds to `turnDeadline`, ticking every 250 ms), `moves` gated on
  `isMyTurn`, phase 4's `dealing`.
- `apps/web/src/components/action-bar.svelte` — `canDeclareSam` renders the
  gold `.sam-pill`; `table-screen.svelte:26-29,79-87` confirms Báo Sâm in a
  `ConfirmDialog`.
- `apps/web/src/components/opponent-seat.svelte:48-52` — the `.opp-tag` slot
  shows `⟳` (offline) or `Bỏ` (passed); the file is 185 lines, so reuse this
  slot rather than adding a new styled element. Its `active` prop drives the
  ring and countdown digits.
- `apps/web/src/components/me-chip.svelte:47-54` — `.me-label` shows
  "Lượt của bạn" / "Chờ lượt" with a `small` sub-line.
- `apps/web/src/screens/table/table-surface.svelte` — wires all of the above.

## Files to Modify

- `apps/web/src/lib/room.svelte.ts`
- `apps/web/src/lib/sound-cues.ts`
- `apps/web/src/screens/table/table-logic.svelte.ts`
- `apps/web/src/components/action-bar.svelte`
- `apps/web/src/components/opponent-seat.svelte`
- `apps/web/src/components/me-chip.svelte`
- `apps/web/src/screens/table/table-surface.svelte`
- `apps/web/src/screens/table/table-screen.svelte`

## Tasks & Steps

1. `room.svelte.ts`: add `declineSam(): void { this.ws.send({ type: 'declineSam' }); }`
   next to `declareSam()`.
2. `sound-cues.ts`: `myTurn` and `wasMyTurn` additionally require
   `phase !== 'sam-window'`, so the `turn` cue fires when the window closes.
   (Pure function — add a case to a small `sound-cues` test if one exists;
   `apps/web` has no tests, so verify by ear.)
3. `table-logic.svelte.ts`:
   - `inSamWindow = $derived(room.view?.phase === 'sam-window')`.
   - `isMyTurn` becomes `turnSeat === youSeat && !inSamWindow`; `moves`,
     `canPlay`, `denWarn` inherit the gate.
   - `samRemain = $derived(Math.max(0, Math.min(10, remain)))` — the server
     deadline is 15 s; showing at most 10 keeps the countdown honest after the
     ~5 s deal (network skew of a few hundred ms is invisible at 1 s digits).
   - `showSamDecision = $derived(inSamWindow && !this.dealing && mySeat?.samChoice == null && mySeat.cardCount > 0)`
     (a spectator has no cards and no say).
   - `decline(): void { room.declineSam(); }`.
4. `action-bar.svelte`: replace the `canDeclareSam` pill with a decision
   row, rendered when a new prop `samDecision: { remain: number; canDeclare: boolean } | null`
   is non-null:
   ```
   <div class="sam-row">
     <span class="sam-count">Báo sâm? {Math.ceil(remain)}s</span>
     <button type="button" class="btn btn-secondary sam-decline" onclick={ondecline}>Huỷ báo</button>
     <button type="button" class="sam-pill" disabled={!canDeclare} onclick={onbaosam}>Báo Sâm</button>
   </div>
   ```
   `canDeclare` is `view.canDeclareSam` (false once a lower seat declared).
   Add `ondecline: () => void` to props; keep `onbaosam` (still confirmed in
   `table-screen.svelte`). Style `.sam-row` as a flex row with 8 px gap;
   `.sam-decline` 36 px high, `width: auto; padding: 0 14px`. Remove the
   standalone `canDeclareSam` prop and the old `{#if canDeclareSam}` branch.
   While the row is shown, "Đánh" and "Bỏ lượt" are already disabled
   (`isMyTurn` false).
5. `opponent-seat.svelte`: add prop `inSamWindow: boolean`. In the tag chain:
   `{#if !seat.connected}⟳{:else if inSamWindow && seat.samChoice === 'declare'}<span class="opp-tag sam">Báo Sâm</span>{:else if inSamWindow && seat.samChoice === 'decline'}<span class="opp-tag">Huỷ báo</span>{:else if seat.passed}Bỏ{/if}`.
   Add `.opp-tag.sam { color: var(--gold); border-color: var(--gold); }` only
   if `.opp-tag` has a border; otherwise colour only. Keep the file ≤ 200
   lines (currently 185): if the markup pushes it over, drop the `Báo Sâm`
   variant and rely on the existing transient "Báo Sâm!" event tag plus the
   `Huỷ báo` badge — the user asked for the latter.
   `active` for opponents comes from `table-surface`; pass
   `active={!logic.inSamWindow && view.turnSeat === seat}` so no ring shows
   during the window.
6. `me-chip.svelte`: add prop `samLabel: string | null`; the label line reads
   `isMyTurn ? 'Lượt của bạn' : (samLabel ?? 'Chờ lượt')`. `table-surface`
   passes `'Đã huỷ báo'` / `'Đã báo Sâm'` from `mySeat.samChoice` while
   `inSamWindow`, else `null`.
7. `table-surface.svelte`: pass `inSamWindow` to `OpponentSeat`, the `active`
   gate from step 5, `samLabel` to `MeChip`, and to `ActionBar`
   `samDecision={logic.showSamDecision ? { remain: logic.samRemain, canDeclare: view.canDeclareSam } : null}`
   plus `ondecline={() => logic.decline()}`. Remove the `canDeclareSam` prop.
8. `table-screen.svelte`: no change to the confirm flow; `declareSam()` still
   sends and closes the dialog. If the dialog is open when the window closes
   (deadline), the server rejects with the existing error toast — acceptable.

## Verification

- `pnpm typecheck && pnpm test`
- `pnpm dev`, three browsers (A leads):
  - after the deal all three see "Báo sâm? 10s", Huỷ báo, Báo Sâm; A's "Đánh"
    is disabled and no ring shows on anyone;
  - B presses Huỷ báo → "Huỷ báo" badge under B on A and C; B's own chip reads
    "Đã huỷ báo"; B's row disappears;
  - C presses Báo Sâm → confirm → "Báo Sâm" badge on C; A's row still shows
    with "Báo Sâm" enabled (lower seat may override);
  - A presses Huỷ báo → window closes at once: C's ring starts, C hears
    `turn`, C can play;
  - repeat with nobody pressing: at ~10 s the row disappears, A's ring starts
    with the full `turnSeconds`;
  - a play attempt through DevTools (`room.play([...])`) during the window
    returns the toast "Chờ mọi người quyết định báo sâm".
- Reduced motion: the row appears immediately after the snapshot (no deal
  animation); the countdown reads 10 for the first ~5 s, then counts down.
