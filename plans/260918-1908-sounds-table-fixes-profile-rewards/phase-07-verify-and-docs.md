---
phase: 7
title: "Verify and docs"
status: completed
priority: P1
effort: "2h"
dependencies: [1, 2, 3, 4, 5, 6]
---

# Phase 7: Verify and docs

## Goal

Prove the whole round works end to end on `pnpm dev`, keep the docs truthful,
and leave the repo ready to deploy (remote migrations pending).

## Context

- `CLAUDE.md`: run `pnpm typecheck && pnpm test` before reporting done;
  commit to `main` with conventional commits scoped like `feat(web,worker): …`.
- `docs/codebase-summary.md` lists every file, endpoint, D1 table and the
  WS contract; `docs/design-guidelines.md` §4 and §7 describe seat positions
  and the centre stack; `docs/deployment.md` lists the D1 tables and the
  remote migration step; `docs/project-changelog.md` is the release log.
- `.claude/skills/deploy-samloc` pre-flight asks before
  `wrangler d1 migrations apply samloc-db --remote`; two new migrations
  (`0002`, `0003`) must be applied there before the next deploy.
- `.claude/skills/db-reset` for local migration application.

## Files to Create / Modify

- Modify: `docs/codebase-summary.md`
- Modify: `docs/design-guidelines.md`
- Modify: `docs/deployment.md`
- Modify: `docs/project-changelog.md`

## Tasks & Steps

1. **Gates** — `pnpm typecheck && pnpm test`; then
   `find apps packages -path '*/node_modules' -prune -o \( -name '*.ts' -o -name '*.svelte' \) -print | xargs wc -l | awk '$1 > 200 && $2 != "total"'`
   must print nothing.
2. **End-to-end smoke** (two browsers, 4 accounts where needed):
   1. Register → Home → check-in → wheel spin → budget matches `/api/me`.
   2. Profile: rename + upload avatar; the other browser sees both in the waiting room.
   3. 4-player room: seats left / top / right; play a hand: `shuffle`, `play`, `turn` cues; scattered combos; Báo 1 badge; hand end → `win` on one client, `lose` on the others, 💕 line on the winner's modal.
   4. Mute in the ≡ menu; reload; still muted.
   5. Join a room with a 5th player mid-session: `join` cue on the others.
3. **Docs** —
   - `codebase-summary.md`: worker routes (`routes-profile.ts`, `routes-rewards.ts`, `rewards.ts`, `budget.ts` note), D1 schema (`users.avatar_blob/avatar_ver`, `coin_grants`), DO `seats.avatar_ver`, `SeatView.avatarVer`, new web files (`sound.svelte.ts`, `sound-cues.ts`, `trick-scatter.ts`, `avatar.svelte`, `avatar-resize.ts`, `wheel.ts`, `checkin-card.svelte`, `wheel-modal.svelte`, `home-screen.svelte`, `profile-screen.svelte`, `result-head.svelte`), router screens, updated line counts and test counts.
   - `design-guidelines.md`: §4 Seat — Báo 1 is an 18 px red badge on the avatar; §4 Centre stack — combos scatter inside a 120×60 box with ±12° rotation, deterministic per combo; §7 — 4-player slots left / top-centre / right, side seats at y 148; new Home and Profile screen layouts; sound cue list and mute location.
   - `deployment.md`: D1 table list adds `coin_grants` and the `users` avatar columns; step 3 notes migrations `0002`/`0003` must be applied remotely before deploying this round.
   - `project-changelog.md`: one entry for this round.
4. **Commits** — one per phase already landed (`fix(web): …`, `feat(web): sounds…`, `feat(worker): profile and avatar`, `feat(worker): daily check-in and lucky wheel`, `feat(web): home, profile and avatars`, `feat(web): check-in card and wheel`, `docs: …`). Push per `CLAUDE.md` (switch `gh` account for the push only).

## Verification

- `pnpm typecheck && pnpm test` green; line-limit scan empty.
- Every smoke step above observed.
- `git status` clean; `git log --oneline -8` shows the phase commits.

## Todo

- [x] Typecheck, tests, line-limit scan
- [x] Smoke steps 1–5
- [x] Four docs updated and checked against source
- [x] Commits pushed (see report below)

## Success Criteria

Plan success criteria in `plan.md` all checked; docs describe the shipped
behaviour, not the plan.

## Deploy note

Not part of this plan: run `/deploy-samloc` after the user confirms the
remote migrations; a deploy evicts live rooms.
