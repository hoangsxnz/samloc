---
phase: 6
title: "Docs and verification"
status: completed
priority: P3
effort: "45m"
dependencies: [1, 2, 3, 4, 5]
---

# Phase 6: Docs and verification

## Overview

Update the project docs for the new room-code format, the emoji message pair
and the new components, then run the full verification pass.

## Related Code Files

- Modify: `docs/codebase-summary.md` — `room-code.ts` line (digits), new components (`card-flight`, `emoji-bar`, `emoji-bubble`), WebSocket contract (`emoji` in `ClientMsg`/`ServerMsg`), `me-chip` description (timer in avatar)
- Modify: `docs/design-guidelines.md` — only if it states the card-face pip layout, the fan track origin or the room-code alphabet; otherwise leave it
- Modify: `docs/project-changelog.md` — one entry per shipped item (create the file if the repo does not have it yet; check first)
- Read for context: `docs/game-rules.md` (no change expected — no rule changed)

## Implementation Steps

1. Grep the docs for `ABCDEFGHJKLMNPQRSTUVWXYZ`, `mã phòng`, `TimerRing` and
   `FAN_TRACK_LEFT`, and fix every stale statement.
2. Add the `emoji` frames to the "WebSocket Contract" section of
   `docs/codebase-summary.md`, and note that reactions are ephemeral
   (not in `RoomView`, not persisted).
3. Add the three new components to the component table.
4. Changelog entry covering: 6-digit codes (**breaking**: old codes 404),
   card/timer overlap fix, timer merged into own avatar, fly-to-centre
   animation, larger opponent card back, heart pip fix, emoji reactions.
5. Run the full gate: `pnpm typecheck`, then `pnpm test`, then the production
   bundle command listed in `docs/runbook.md`.
6. Manual smoke in `pnpm dev` with two browser profiles: create room (6-digit
   code) → join → ready → start → play with a full hand (check both bottom
   overlaps) → observe the flight animation both ways → send emoji both ways →
   finish a hand → next hand.

## Success Criteria

- [ ] `pnpm typecheck`, `pnpm test` and the production bundle command all pass
- [ ] `docs/codebase-summary.md` contains no stale alphanumeric-code or standalone-ring statement
- [ ] Two-client smoke test passes end to end
- [ ] Changelog documents the breaking room-code change

## Risk Assessment

- Docs drift is the only real risk; the code-level risks are covered per phase.
