---
title: Budget and table UI compaction
description: >-
  Replace lobby 'Tổng: N lá' with a money budget (10 000 on register, ± hand
  results × stake); merge opponent turn timer into the avatar; shrink opponent
  seat elements; plain 'Đánh' label.
status: completed
priority: P2
effort: 3h
branch: main
tags:
  - web
  - worker
  - ui
  - svelte
  - d1
blockedBy: []
blocks:
  - 260914-1317-sam-loc-online
created: '2026-09-14T10:24:44.925Z'
createdBy: 'ck:plan'
source: skill
---

# Budget and table UI compaction

## Overview

Four small user-requested changes to the shipped Sâm Lốc app (`plans/260914-1317-sam-loc-online` phases 4, 6, 7):

1. **Budget** — every player starts with 10 000 on first registration. The lobby header chip `Tổng: N lá` becomes the budget number.
2. **Opponent timer in avatar** — on the table, the remaining-time countdown of *other* players is drawn around/inside their avatar instead of a separate 56 px ring floating above the seat.
3. **Compaction** — opponent-seat elements shrink so nothing overlaps (the floating ring currently collides with the top bar at y 42 − 60).
4. **"Đánh" button** — label is always `Đánh`, never `Đánh (Sảnh 5)`.

### Key design decisions (locked)

| Decision | Choice | Why |
|---|---|---|
| Budget unit | Money: `10000 + Σ(hand_results.delta_la × room_sessions.stake_per_la)` | 10 000 lá is meaningless; stakes are 50–500/lá; `/api/sessions` already reports `netScore = netLa × stake` the same way |
| Storage | Derived in SQL, no schema change | Existing tables already hold every settled hand; no migration, no new write path, cannot drift |
| Field name | `AuthUser.budget` replaces `AuthUser.totalLa` in `/api/register`, `/api/login`, `/api/me` | Only consumer is `lobby-screen.svelte`; `SeatView.totalLa` (per-room lá) is untouched |
| Negative budget | Allowed, displayed as is | No gating was requested |
| Me-chip timer | Unchanged (keeps 56 px ring) | Request scoped to "các người chơi khác" |
| Table top bar ± chip | Unchanged (session lá) | Not requested |

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Worker budget derivation and lobby chip](./phase-01-worker-budget-derivation-and-lobby-chip.md) | Completed |
| 2 | [Opponent seat timer-in-avatar and compaction](./phase-02-opponent-seat-timer-in-avatar-and-compaction.md) | Completed |
| 3 | [Action bar label docs and verification](./phase-03-action-bar-label-docs-and-verification.md) | Completed |

Phases 1 and 2 touch disjoint files and can run in parallel. Phase 3 depends on both (final typecheck/build/visual pass + docs).

## Dependencies

- **Blocks** `260914-1317-sam-loc-online` phase 8 (43-item device smoke checklist): the checklist should be run against the compacted table UI, not the current one.
- No new packages. Worker tests: `pnpm --filter @samloc/worker test`; web has no unit tests — verification is `pnpm -r typecheck`, `pnpm build`, and a browser pass on the local Vite + workerd stack (see `docs/runbook.md`).

## Progress — 2026-09-14

All phases implemented and verified (typecheck, 121 tests, build, curl contract, 5-player browser pass). Report: `reports/implementation-260914-budget-and-table-ui-compaction-report.md`. Not yet committed (repo has no commits).

## Verification summary

| Check | Command / action |
|---|---|
| Types | `pnpm -r typecheck` green |
| Build | `pnpm build` green |
| Budget on register | `curl -c j -X POST /api/register …` → `"budget":10000`; after a settled hand `/api/me` budget moves by `delta_la × stake` |
| Table visual | 5-player room in browser: no opponent element overlaps top bar, centre stack, me-chip, or fan; active opponent shows arc + digits in avatar |
| Đánh label | Select a valid combo → button text is exactly `Đánh` |
