---
phase: 8
title: "Deploy docs and smoke test"
status: in-progress
effort: "2h"
priority: P1
dependencies: [phase-07]
---

# Phase 8: Deploy docs and smoke test

Context: `docs/deployment.md`, `docs/game-rules.md`,
`plans/reports/researcher-260914-1317-cloudflare-durable-objects-websocket-d1-report.md` §5, §9

## Overview

Ship the Worker to Cloudflare, apply the D1 migration remotely, then run a scripted multi-device smoke
test that exercises every house rule that unit tests cannot reach (real sockets, real reconnects, real
timers). Close out the two rule readings flagged in phase 3 and update the project docs.

## Requirements

**Functional**
- `https://samloc.<account>.workers.dev` serves the SPA, `/api/*` and `/ws/*` from a single Worker.
- Remote D1 `samloc-db` carries the phase-4 schema; register/login work against it.
- A 4-player hand plays to settlement across at least two physical phones on mobile networks.
- Every checklist item below is executed and recorded pass/fail with the tester's name.

**Non-functional**
- One Worker, one D1 database, one DO namespace. No custom domain (optional, out of scope).
- Deploy is a single command from a clean checkout: `pnpm deploy`.

## Architecture

**Deploy pipeline**
```
pnpm build                      # apps/web -> apps/web/dist
wrangler deploy                 # apps/worker, uploads dist as Static Assets + RoomDO + D1 binding
```
`wrangler.jsonc` from phase 1, with the real `database_id` and
`"assets": { "directory": "../web/dist", "not_found_handling": "single-page-application",
"run_worker_first": ["/api/*", "/ws/*"] }`. Routing precedence: `/api/*` and `/ws/*` reach the Hono app,
everything else is served from `dist`, unknown paths fall back to `index.html` so hash routes resolve.

**What is NOT in this phase:** CI, staging environment, monitoring, backups. Single-environment,
manual deploy is deliberate for a ≤20-person private app.

## Related Code Files

**Create**
- `docs/runbook.md` — deploy, rollback, reset-a-room, reset-a-password, read D1 procedures

**Modify**
- `apps/worker/wrangler.jsonc` — real `database_id`, final `compatibility_date`
- `docs/deployment.md` — replace the placeholder URL with the real one; record the local-dev path
  actually chosen in phase 1 (`@cloudflare/vite-plugin` or the wrangler proxy fallback)
- `docs/tech-stack.md` — record any deviation (PBKDF2 iteration count, rules dist fallback)
- `docs/game-rules.md` — record the confirmed đền bài and chặt chồng readings, and that a blocked báo sâm
  hands the next lead to the blocker
- `README.md` — create if absent: what it is, `pnpm i`, `pnpm dev`, `pnpm deploy`

**Delete** — nothing. (`docs/wireframes/*.png` are the approved screenshots of `docs/wireframe/*.html`; keep both.)

## Implementation Steps

1. `pnpm --filter @samloc/worker exec wrangler login` (browser, no card required).
2. `wrangler d1 create samloc-db` if it does not exist remotely; copy the `database_id` into
   `wrangler.jsonc` and commit it.
3. `wrangler d1 migrations apply samloc-db --remote`; verify with
   `wrangler d1 execute samloc-db --remote --command "SELECT name FROM sqlite_master WHERE type='table'"`
   — expect `users`, `sessions`, `room_sessions`, `hand_results`.
4. `pnpm -r typecheck && pnpm -r test && pnpm build` — all green before any deploy.
5. `pnpm deploy`. Record the printed `workers.dev` URL.
6. Open the URL on desktop: register two accounts in two profiles, create a room, join, start a 2-player
   hand, play it to the result modal. This is the gate for step 7.
7. Run the smoke checklist below with 3–4 people on real phones, at least two on mobile data.
8. Record results in `plans/260914-1317-sam-loc-online/reports/` and fix any failures before closing the plan.
9. Update the docs listed above, then `git commit` with a conventional message.

## Smoke Checklist (execute in order, record pass/fail)

**Platform**
1. SPA loads at `/`; a hard refresh on `#/lobby` still loads (SPA fallback works).
2. `GET /api/health` returns JSON, not `index.html`.
3. Register, logout, login again — the session survives a full browser restart (30-day cookie).
4. Cookie is `HttpOnly; Secure; SameSite=Lax` (check devtools Application tab).

**Lobby and room**
5. Create a room with each of the three settings at a non-default value; the waiting screen shows them.
6. A wrong code shows "Không tìm thấy phòng" inline.
7. Host changes settings while waiting; all clients update within a second.
8. `Bắt đầu` is disabled until every seat is ready and there are ≥2 seats.
9. The host taps `Rời phòng` in the waiting room; ♛ moves to the next connected seat. Force-quitting the
   host's browser does the same within one snapshot.

**Gameplay — one rule per line**
10. First hand: the lowest-card holder leads. Second hand: the previous winner leads.
11. A pass locks the player out; they are skipped until the trick ends.
12. Trick ends when all others pass; the last player to play leads next.
13. An equal-rank play is rejected with a Vietnamese error and no state change.
14. A 4-card straight cannot beat a 3-card straight.
15. `K-A-2` and `A-2-3` are rejected as straights.
16. A tứ quý beats a single 2 → `Chặt 2 +15` tag; the 2's owner is charged 15 in the result.
17. Chặt chồng: a bigger tứ quý → `Chặt chồng +30`, paid by the previous cutter.
18. A tứ quý cannot beat a pair, a triple or a straight.
19. Báo 1 auto-announces when a player drops to one card (red back + tag).
20. Đền bài: the seat before a báo-1 player leads a non-highest single and the báo-1 player wins on it —
    the offender pays every loser's amount.
21. Báo Sâm success: every other player pays 20 lá, no card counting.
22. Báo Sâm failure: the declarer pays 20 lá to each player, nobody else owes anything, no chặt transfer is
    recorded, and the seat that blocked the sâm leads the next hand.
23. Ăn trắng at deal: the sâm window never opens; each other player pays 20 lá.
24. Thối 2: a loser holding two 2s is charged +10 on top of their card count.
25. Cóng: a loser who never played is charged 15 flat plus thối 2.
26. Hand net values sum to zero across all players in the result modal.
27. Session totals accumulate correctly across three consecutive hands.

**Rooms, limits and abuse**
28. The last player leaving a room makes the lobby show that session as closed (`closed_at` set).
29. Creating a 4th open room returns "Bạn đang có 3 phòng mở".
30. Starting with one player disconnected deals only to the players still connected.
31. Two tabs on one account show one seat, and closing one tab keeps the seat connected.
32. Holding a button down to spam messages yields "Thao tác quá nhanh" and the room stays responsive.

**Timers and connectivity**
33. An idle turn auto-passes at the configured timer; auto-plays the lowest single when leading.
34. Backgrounding the app for 60 s on iOS and returning reconnects without a reload.
35. Airplane mode for 20 s shows the reconnect banner; disabling it restores the same seat and hand.
36. Force-quitting and reopening the browser restores the seat via the session cookie.
37. `Rời phòng` mid-hand warns first, then leaves; the seat is still counted at settlement.

**Layout**
38. Portrait shows the rotate overlay on all five screens.
39. The table renders without clipping on a 390 px-tall and a 360 px-tall viewport.
40. No UI overlaps the notch or the home indicator in either landscape orientation.
41. All text is Vietnamese with correct diacritics; Be Vietnam Pro loads (not a fallback).

**Persistence**
42. `wrangler d1 execute samloc-db --remote --command "SELECT * FROM hand_results ORDER BY created_at DESC LIMIT 10"`
    shows one row per seat per hand, summing to zero per hand.
43. `GET /api/sessions` lists the room with the correct hand count and net score, and `GET /api/me` returns
    a `totalLa` matching the lobby chip.

## Success Criteria

- [x] `pnpm -r typecheck && pnpm -r test && pnpm build` green on a clean `pnpm i`
- [x] `pnpm run deploy` succeeds and https://samloc.samloc-worker.workers.dev serves the SPA (2026-09-14)
- [x] Remote D1 has all four tables and a non-empty `users` table after registration (3 users, 2 hand_results after bot run)
- [ ] All 43 checklist items pass, or each failure has a fix committed and the item re-run
- [x] `docs/deployment.md`, `docs/tech-stack.md`, `docs/game-rules.md`, `README.md`, `docs/runbook.md` updated
- [ ] Plan status flipped to completed: `ck plan check 8`

## Risk Assessment

| Risk | L×I | Mitigation |
|---|---|---|
| `run_worker_first` behaves differently in production than in `vite dev`, so `/api/*` returns `index.html` | M×H | Checklist item 2 catches it immediately; fallback is explicit `routes` entries per `docs/deployment.md` |
| Remote D1 migration diverges from the local one | M×H | Only ever apply through `wrangler d1 migrations apply`; never hand-edit remote tables |
| Free-plan limits hit during the smoke test (100k Worker + DO requests/day) | L×M | ≤20 users and a few hundred frames per hand leave orders of magnitude of headroom; check the dashboard after the test |
| A confirmed rule reading still feels wrong to real players | L×M | Items 17, 20 and 22 exercise them on the table; any change is localised to `settle.ts` / `reducer-play.ts` plus their named tests |
| Deploy overwrites a live room mid-hand (DO restart drops in-memory state) | M×M | `RulesState` is persisted in DO SQLite after every action, so a restart resumes from storage; verify by deploying once during an open room |
| iOS Safari refuses the landscape lock | H×L | Known and accepted; the rotate overlay is the designed fallback (item 32) |

**Rollback:** `wrangler rollback` restores the previous Worker version in seconds. The D1 schema is
additive, so a Worker rollback needs no database change. Document both in `docs/runbook.md`.

## Security Considerations

- Confirm no secrets are committed: `git grep -nE "(password|secret|token|api[_-]?key)\s*[:=]"` reviewed by hand.
- `.dev.vars`, `.wrangler/`, `.env*` are gitignored (phase 1) — re-verify before the first push.
- Confirm the production cookie carries `Secure` (it will, since `workers.dev` is HTTPS-only).
- Anyone with an account and a room code can join a room; that is the accepted model for a private group.
  If it becomes a problem, the next step is a host-approval gate, not a new auth system.
- Leave rate limiting out for now. Revisit only if `/api/login` sees unexpected traffic in the dashboard.

## Next Steps

Plan complete. Post-launch candidates, none committed: session score board across rooms, spectator mode,
host kick, and a Cloudflare Access rule in front of `/api/register` to stop outside sign-ups.
