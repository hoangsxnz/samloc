---
title: "Sâm Lốc Online"
description: "Private-group Sâm Lốc card game: pnpm monorepo, shared TS rules engine, Cloudflare Worker + Durable Object realtime, Svelte 5 landscape web client."
status: in-progress
priority: P1
effort: 30h
branch: "main"
tags: [game, cloudflare, durable-objects, svelte, typescript, websocket]
blockedBy: [260914-1722-budget-and-table-ui-compaction]
blocks: []
created: "2026-09-14T07:15:42.746Z"
createdBy: "ck:plan"
source: skill
---

# Sâm Lốc Online

## Overview

Browser card game (Sâm Lốc, house rules in `docs/game-rules.md`) for a private friend group of ≤20 people.
Single Cloudflare Worker serves the Svelte SPA, the `/api/*` auth+lobby endpoints, and `/ws/:code` realtime.
One Durable Object (`RoomDO`) per room owns authoritative game state; clients never mutate state and never
see opponents' hands. All game logic lives in `packages/rules` — pure TypeScript, zero deps, unit-tested
against every bullet of `docs/game-rules.md`, and imported by both the DO (authoritative) and the web app
(selection validity hints only).

Scope guards: 2–5 players, room settings limited to player count / turn timer / stake per lá. No bots,
no chat, no OAuth, no service worker, no card image assets. Landscape-only, Vietnamese UI.

**Reference docs:** `docs/game-rules.md`, `docs/tech-stack.md`, `docs/deployment.md`,
`docs/design-guidelines.md`, `docs/wireframe/01..05-*.html` (annotation lists are the UI spec).
**Research:** `plans/reports/researcher-260914-1317-cloudflare-durable-objects-websocket-d1-report.md`,
`plans/reports/research-svelte-260914-1415-svelte5-vite-tailwind-monorepo-report.md`.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Monorepo scaffold and tooling](./phase-01-monorepo-scaffold-and-tooling.md) | Completed |
| 2 | [Rules engine cards and combos](./phase-02-rules-engine-cards-and-combos.md) | Completed |
| 3 | [Rules engine game state and settlement](./phase-03-rules-engine-game-state-and-settlement.md) | Completed |
| 4 | [Worker auth and D1](./phase-04-worker-auth-and-d1.md) | Completed |
| 5 | [Room Durable Object realtime](./phase-05-room-durable-object-realtime.md) | Completed |
| 6 | [Web shell login lobby waiting](./phase-06-web-shell-login-lobby-waiting.md) | Completed |
| 7 | [Web game table and results](./phase-07-web-game-table-and-results.md) | Completed |
| 8 | [Deploy docs and smoke test](./phase-08-deploy-docs-and-smoke-test.md) | In progress (deployed to https://samloc.samloc-worker.workers.dev, remote D1 live, full hand verified by bot; 43-item device smoke checklist pending) |

## Progress — 2026-09-14

| Metric | Value |
|---|---|
| Success criteria checked | 42 / 46 |
| Unit tests | rules 95, worker 26, all passing |
| `pnpm -r typecheck`, `pnpm build` | green |
| Live verification | register → lobby → room → 2-player hand → result → hand 2 → leave, in a browser against the local Vite + workerd stack |
| Production | https://samloc.samloc-worker.workers.dev — health, register, room, full WS hand and D1 rows verified 2026-09-14 |
| Remaining | 43-item device smoke checklist on real phones (user action), then flip plan to completed |

Implementation reports: `reports/phase-04..07-implementation-report.md`; code reviews:
`reports/code-review-rules-and-worker-report.md`, `reports/code-review-web-app-report.md`;
browser screenshots: `reports/screenshots/`.

## Dependencies

Strictly sequential except phases 4 and 6, which may run in parallel (disjoint file ownership:
`apps/worker/**` vs `apps/web/**`) once phase 1 lands.

```
1 ──┬── 2 ── 3 ──┬── 5 ── 7 ── 8
    └── 4 ───────┘        │
    └── 6 ────────────────┘
```

| Phase | Blocked by | Owns (no other phase edits) | Effort |
|---|---|---|---|
| 1 | — | repo root, all package manifests | 2h |
| 2 | 1 | `packages/rules/src/{cards,combos,compare,instant-win,deal}.ts` | 3h |
| 3 | 2 | `packages/rules/src/{state,reducer-*,settle}.ts` | 5h |
| 4 | 1 | `apps/worker/src/{auth,sessions,auth-middleware,routes-*,room-code,validation}.ts`, `apps/worker/migrations/**` | 3h |
| 5 | 3, 4 | `apps/worker/src/room-do*.ts`, `apps/worker/src/ws-types.ts` | 5h |
| 6 | 1 | `apps/web/src/{app,router,lib,screens/{login,lobby,waiting}}` | 4h |
| 7 | 5, 6 | `apps/web/src/screens/table/**`, `apps/web/src/components/**`, `src/lib/{card-view,table-layout}.ts` | 6h |
| 8 | 7 | `wrangler.jsonc` env, `docs/*` updates | 2h |

**External:** Cloudflare account with Workers + D1 enabled (`wrangler login`, no card). Node 24, pnpm 10.

**Cross-cutting constraints (apply to every phase):** files ≤200 lines, kebab-case filenames,
TypeScript strict, YAGNI/KISS/DRY, Vietnamese UI strings with diacritics, no plan/finding references
in code comments, every phase ends with a green verify command.

## Red Team Review

### Session — 2026-09-14

**Findings:** 17 unique (24 raw from 4 reviewers) (14 accepted, 3 rejected)
**Severity breakdown:** 4 Critical, 5 High, 8 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---|---|---|---|
| 1 | `room_sessions.closed_at` is never written, so the lobby shows every room as open forever | Critical | Accept | phase-05 (`closeRoom`, `removeSeat`), phase-08 item 28 |
| 2 | Host was persisted, so an ungraceful host disconnect left the room unstartable | Critical | Accept | phase-05 (no `host_user_id`, `hostSeat`, `youAreHost`), phase-06, phase-07, phase-08 item 9 |
| 3 | A second socket from one account overwrote or stole the seat | Critical | Accept | phase-05 (`acceptWebSocket(ws, [userId])`, close rule), phase-08 item 31 |
| 4 | Disconnected seats were dealt into a hand and timed out every turn | Critical | Accept | phase-05 (drop `connected = 0` seats on `start`), phase-08 item 30 |
| 5 | Lobby "Tổng" chip had no data source | High | Accept | phase-04 (`GET /api/me` → `totalLa`), phase-06 header, phase-08 item 43 |
| 6 | No way to leave a room from either the waiting screen or the table | High | Accept | phase-06 waiting screen, phase-07 `≡` menu, phase-08 items 9 and 37 |
| 7 | An unbounded WebSocket could exhaust the room and the free-plan request budget | High | Accept | phase-05 (10 msg/s token bucket, Security), phase-08 item 32 |
| 8 | One account could create unlimited rooms | High | Accept | phase-04 (`POST /api/rooms` 429), phase-08 item 29 |
| 9 | Settings changed in the room never reached `room_sessions` | High | Accept | phase-05 (`settings` write-back in `waitUntil`) |
| 10 | `handEnd.winnerSeat` was non-nullable but a failed sâm has no winner | Medium | Accept | phase-03 (`winnerSeat: number \| null`) |
| 11 | Register had no display-name field, so `display_name` was the username | Medium | Accept | phase-04 (body, `parseDisplayName`, schema), phase-06 login screen |
| 12 | Chặt could still fire during a báo sâm hand, contradicting `settle` | Medium | Accept | phase-03 (`if (samSeat === null)` guard + named test) |
| 13 | `reducer-events.ts` was named in a risk row but never in the file list | Medium | Accept | phase-03 Related Code Files (optional overflow file) |
| 14 | `table-screen.svelte` owned all derived state and would exceed 200 lines | Medium | Accept | phase-07 (`table-logic.svelte.ts`) |
| 15 | After a failed báo sâm nobody was defined to lead the next hand | Medium | Accept | phase-03 (`blockerSeat`, named test), phase-05 (`nextLeadSeat`), phase-08 item 22 |
| 16 | Turn timer described as fixed 20 s while rooms configure 15/20/30 | Medium | Accept | phase-05 Requirements, phase-07 Requirements |
| 17 | Đền bài and chặt chồng readings were still open questions | Medium | Accept | phase-03 (confirmed decisions), phase-08 (items no longer ask the group) |
| R1 | DO `seats.total_la` can drift from D1 `hand_results` | Medium | Reject | phase-05 Risk row, accepted: D1 is history only |
| R2 | Add rate limiting to `/api/login` | Medium | Reject | phase-04 Risk row, accepted: out of scope for a private group |
| R3 | Close registration behind an invite | High | Reject | phase-04 Risk row; user decision, phase-08 keeps the post-launch note |

### Whole-Plan Consistency Sweep

Re-read plan.md and all 8 phase files, then grepped the terms the delta touches.

- **`host_user_id`** — survives only in the D1 schema (phase 4), now commented "creator only; the live host
  is dynamic", plus its index and the room-cap query. Phase 5 states outright that the DO table has no such
  column. Reconciled: D1 records who created the room, the DO derives who currently runs it.
- **`hostUserId`, `crown`, `dealer`** — zero occurrences. `RoomView.hostUserId` became `youAreHost`,
  `SeatView.isHost` carries the per-seat flag, the waiting screen renders ♛ from `seat.isHost`, and
  "dealer order first" is now "lowest seat number first" in phase 3.
- **`20 s`** — one occurrence left, phase 8 item 35, which is an airplane-mode duration, not the turn timer.
  Both places that describe the timer now say "room setting 15/20/30 s, default 20".
- **`nextLeadSeat` / `winnerSeat`** — `winnerSeat` is nullable in `RulesState`, in `handEnd` and in
  `HandResult`. Phase 5 computes `nextLeadSeat = winnerSeat ?? blockerSeat`; phase 3 defines `blockerSeat`
  and phase 7 renders `result.nextLeadSeat`. No non-nullable `winnerSeat: number` remains.
- **`confirm`** — every hit is now either the Báo Sâm confirm dialog, a wrangler config check, or the word
  "confirmed" describing a settled rule. No phase asks the group to adjudicate a rule any more.
- **`closed_at`** — written in exactly one place (phase 5 `closeRoom`) and read in three (phase 4 room cap,
  phase 4 recent sessions, phase 8 item 28). Producer and consumers agree.
- **Ownership** — the phases table above still holds: phase 7 now also owns `apps/web/src/screens/table/**`,
  which no other phase touches.

**0 unresolved contradictions.**
