# PM status — Sâm Lốc Online — 2026-09-14 16:20

## Plan
`plans/260914-1317-sam-loc-online/` — status `in-progress` (7 of 8 phases completed).

| Phase | Status | Criteria | Notes |
|---|---|---|---|
| 1 Monorepo scaffold | completed | 6/6 | Vite + `@cloudflare/vite-plugin` dev; TS pinned to 6.x for svelte-check |
| 2 Rules: cards/combos | completed | 5/5 | 47 tests |
| 3 Rules: state/settle | completed | 4/4 | 48 tests; `buildHand` added for explicit-hand tests |
| 4 Worker auth + D1 | completed | 4/4 | vitest node pool (workers pool lacks `./config`); local D1 state under `apps/web/.wrangler` |
| 5 Room DO realtime | completed | 6/6 | Node WS smoke: join/ready/start, hidden hands, alarm auto-play, two tabs, host migration, full hand → D1 rows, leave → `closed_at` |
| 6 Web shell | completed | 7/8 | Open: dev-server-restart reconnect check |
| 7 Table + results | completed | 6/7 | Open: 360 px-tall viewport check (verified at 430 px only) |
| 8 Deploy + smoke | in-progress | 2/6 | README, runbook, deployment/tech-stack docs done. Blocked on `wrangler login` |

## Verification
- `pnpm -r typecheck` 0 errors; `pnpm -r test` 121/121; `pnpm build` green; all source files ≤200 lines.
- Browser walkthrough (Playwright, 900×430 + 390×844): login → register → lobby → create room →
  waiting room live with bot player → start → table (fan, timer, centre stack, validation hints) →
  legal play → hand to result modal → `Ván tiếp` → hand 2 → ≡ menu mid-hand warning → leave → lobby
  session row `-700`, `Tổng: -7 lá` → portrait overlay. Screenshots in `reports/screenshots/`.

## Fixes applied from reviews / walkthrough
- Reviewer H1: seat compaction at hand-end desynced `HandResult` seats → compact only while waiting; new joiners append after the highest seat.
- Vietnamese display name in `x-user-name` header → URL-encoded through the Worker→DO hop.
- Room never closed when everyone left mid-hand → close on abandon; idle-close alarm 60 s after hand-end with nobody connected.
- Waiting screen `Bắt đầu` permanently disabled (host counted as not-ready) → fixed.
- Socket closed on waiting→table transition (reconnect banner on table) → idempotent `room.connect`, shell disconnects on lobby/login.
- Lobby code grid overflowed (inputs' intrinsic width) → 3×2 grid; `Tổng` chip stale → refresh `/api/me` on lobby mount; host row label "Chủ phòng".

## Web review (reports/code-review-web-app-report.md) — dispositions
- C1 table screen dead-end when the socket never connects → "Về sảnh" button rendered outside the `{#if view}` branch, with a failure message.
- C2 opponents derived by `(youSeat + k) % n` broke on seat gaps (only possible at hand-end after a leave) → `seatsAfter()` derives order from the real seat list; used by `opponentSlots` and the đền bài warning.
- H3/H4 reconnect banner never gave up → `WsClient.failed` after 10 attempts; banner switches to "Không kết nối lại được" + "Về sảnh".
- M `room.connect` only on mount → `$effect` keyed on the route code in both room screens.
- H5 fan hit area < 44 px → **accepted**: 10 cards on the fixed 308 px track average 31 px of exposed width; cards are 80 px tall. Widening one card's hit area can only steal from its neighbour.

## Accepted, not fixed
- Soft TOCTOU on the 3-open-room cap (private group).
- Fire-and-forget `storage.setAlarm/deleteAlarm` (DO output gate covers it).
- No deal/collect flight animation (pure flourish; informational motions implemented).

## Next
1. User: `pnpm --filter @samloc/worker exec wrangler login`, `wrangler d1 create samloc-db`, paste id, `migrations apply --remote`, `pnpm deploy`.
2. Run phase-8 smoke checklist on real phones; record in `reports/`.
3. Commit (nothing committed yet — repo has no commits).

## Unresolved questions
- Whether registration should stay open (plan decision: yes, revisit post-launch).
