---
phase: 5
title: "Verify and docs"
status: completed (manual matrix pending)
priority: P2
effort: "2h"
dependencies: [1, 2, 3, 4]
---

# Phase 5: Verify and docs

## Overview

Full verification pass and the documentation updates the rule changes force —
two lines in `docs/game-rules.md` were confirmed house rules and are now
deliberately reversed by the user.

## Requirements

- `pnpm typecheck && pnpm test` green from a clean state.
- Manual multi-client pass covering every feedback item.
- `docs/game-rules.md`, `docs/codebase-summary.md` and
  `docs/project-changelog.md` reflect the new behaviour.

## Related Code Files

- Modify: `docs/game-rules.md`
- Modify: `docs/codebase-summary.md`
- Modify: `docs/project-changelog.md`

## Implementation Steps

1. `pnpm typecheck && pnpm test` at the repo root; fix anything red before moving on.
2. `pnpm dev` manual matrix (two browser profiles minimum, three for the result
   screen):
   - play `A-2-3`, `2-3-4`; attempt `K-A-2` and see it refused;
   - let a responder's timer expire while they hold a beating combo → auto-play;
   - same during a báo sâm hand → the sâm resolves as failed;
   - tap one outlined card on your turn → the whole combo is selected;
   - finish a trick by passes → cards stay until the next lead;
   - play `5-4-3` in that click order → table shows `3-4-5`;
   - hand ends with a 2 in a loser's hand → thối 2 tag, then the delayed modal;
   - join a running room from a third account → spectator, then dealt in;
   - money figures on seats and in the result rows;
   - emoji with the bar open; colour presets; guest exit from the result screen.
3. `docs/game-rules.md`:
   - Combinations: straights are `3…A`, **plus** the low forms `A-2-3` and
     `2-3-4…` where 2 counts as the lowest rank; `K-A-2` stays invalid; order is
     `A-2-3 < 2-3-4 < 3-4-5` (confirmed 2026-09-14, supersedes the earlier line).
   - Turn flow: on timeout every player auto-plays their lowest legal move and
     passes only when they have none (supersedes "if responding → auto-pass").
     This holds in a báo sâm hand too: a non-declarer who times out blocks the
     sâm, and the declarer pays (confirmed 2026-09-15).
   - Note that sảnh rồng (ăn trắng) still requires a `3…A` run — a low run is not
     an instant win.
   - Add: a player may join a room mid-session; they spectate the current hand and
     are dealt in on the next one, and seats are ready by default.
4. `docs/codebase-summary.md`: new modules (`legal-moves.ts`, `budget.ts`,
   `hand-order.ts`, `format-money.ts`, `table-theme.svelte.ts`), the new
   `trick_json` shape and the `budget_base` seat column.
5. `docs/project-changelog.md`: one entry per feedback item, grouped.
6. Commit as `feat(web,worker,rules): ...` — no plan/phase references in messages.

## Success Criteria

- [x] `pnpm typecheck` clean.
- [x] `pnpm test` green (rules + worker).
- [ ] Every row of the manual matrix observed working. — **not run**: needs two browser profiles against `pnpm dev`.
- [x] Docs updated, including the two superseded rule lines.
- [x] No file over 200 lines among the files touched by this plan.

## Risk Assessment

- **Rule doc drift** is the main hazard: two lines were previously marked
  "confirmed" and are now reversed on the user's explicit instruction. Both edits
  must say so, or a later reader will treat the change as a regression.

## Security Considerations

Re-check before shipping: no secrets in the diff, `worker-configuration.d.ts` not
committed.

## Next Steps

Ship, then `/ck:journal` for the session record.
