---
phase: 3
title: Action bar label docs and verification
status: completed
priority: P2
effort: 45m
dependencies:
  - 1
  - 2
---

# Phase 3: Action bar label docs and verification

## Overview

Make the play button read plainly `Đánh`, sync `docs/` with the new budget field and seat/timer geometry, then run the whole-repo verification (typecheck, build, worker tests, browser pass) covering phases 1–3.

## Requirements

- Functional: the primary action button text is always `Đánh`, regardless of the selected combo.
- Non-functional: `docs/design-guidelines.md` and `docs/codebase-summary.md` describe the shipped UI (no stale `Tổng: N lá`, no floating ring, no `Đánh (combo)`).

## Architecture

No structural change. `comboLabel` in `apps/web/src/lib/card-view.ts` is still used by `screens/table/table-logic.svelte.ts:93` (the "Không chặt được …" hint), so it stays; only the import in `action-bar.svelte` goes away.

## Related Code Files

- Modify: `apps/web/src/components/action-bar.svelte`
- Modify: `docs/design-guidelines.md`
- Modify: `docs/codebase-summary.md`
- Read only: `apps/web/src/lib/card-view.ts` (confirm `comboLabel` has other consumers before touching it — do not delete it)

## Implementation Steps

1. `action-bar.svelte` — delete the `playLabel` derived and the `comboLabel` import; render the literal:
   ```svelte
   <button type="button" class="btn btn-primary bar-btn bar-play" disabled={!canPlay} onclick={onplay}>Đánh</button>
   ```
   Keep the `Combo` type import only if `combo` prop remains in `Props`. The `combo` prop is now unused inside the component: remove it from `Props` and from the `<ActionBar combo={logic.combo} …>` call in `table-screen.svelte` so svelte-check does not warn. `canPlay` already encodes "a valid combo is selected".
2. `docs/design-guidelines.md`:
   - Line 74 (**Seat (opponent)**) → 40 px avatar, name 12 px, card-back 22×30 with 13 px digits and the session lá total beside it in one row, seat width 80. Active turn: gold border + 48 px arc around the avatar with the remaining seconds in place of the initial; under 5 s arc and digits `--danger`, digits pulse.
   - Line 76 (**Timer ring**) → "56 px with digits in the me-chip; 48 px arc-only variant wrapped around the active opponent avatar (`size`/`stroke`/`digits` props)". Remove "Displayed next to the active seat".
   - Line 107 (layout) → top seats at y 48 (x 200 from each edge; 2-player top-centre), side seats at y 120 (x 44).
   - Action bar / Đánh mention, if any, → label is `Đánh` only.
   - Add one line under the lobby section: header chip shows `Ngân sách: 10.000` (money budget, `vi-VN` thousands separator).
3. `docs/codebase-summary.md`:
   - Line 101: `session` state: user, budget (was totalLa).
   - Line 118: `timer-ring.svelte` — add "size-parametric; arc-only mode for opponent avatars".
   - Auth route contract mention (if present): `/api/register|login|me` return `budget`.
4. Verification, in order:
   ```bash
   pnpm -r typecheck
   pnpm --filter @samloc/worker test
   pnpm build
   ```
   then the browser pass from phase 2 step 6 plus: select a valid combo → button reads `Đánh`; return to the lobby → header shows the budget.
5. Write `plans/260914-1722-budget-and-table-ui-compaction/reports/implementation-260914-budget-and-table-ui-compaction-report.md` (short: what changed, screenshots' findings, commands run + results, unresolved questions).

## Success Criteria

- [ ] Button text is exactly `Đánh` with 0, 1, or a valid selection; disabled state unchanged
- [ ] `grep -rn "comboLabel" apps/web/src/components/action-bar.svelte` returns nothing; `comboLabel` still exported and used elsewhere
- [ ] `pnpm -r typecheck`, `pnpm --filter @samloc/worker test` (26 passing), `pnpm build` all green
- [ ] Docs updated: no remaining `Tổng:`/`totalLa` in `docs/` for the auth user, seat/timer geometry matches phase 2
- [ ] Implementation report written

## Risk Assessment

- **Removing the `combo` prop** touches `table-screen.svelte`; if the user later wants the combo name back (e.g. as a tooltip), it is one prop and one derived away. Low risk.
- **Docs drift** — `docs/wireframe/*.html` still show the old seat geometry; they are historical spec artefacts and are not updated here (note this in the report).
