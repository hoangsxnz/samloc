# Red-team review: RoomDO lifecycle, reconnection, and cross-phase flow

Reviewer role: Failure Mode Analyst + Flow Tracer.
Scope: plan.md, phase-01..08, docs/game-rules.md, docs/tech-stack.md, docs/deployment.md.

## Finding 1: No recovery path when the host disconnects ungracefully

- **Severity:** Critical
- **Location:** Phase 5, section "Connection flow and message handling" / "Related Code Files", `phase-05-room-durable-object-realtime.md:98`, `:146-147`
- **Flaw:** Host-crown reassignment is wired only to the explicit `leave` message: `leave -> drop the seat while waiting (mark disconnected while playing), reassign host` (line 98). `webSocketClose`/`webSocketError` (lines 146-147) only `set connected = 0 for that seat and re-snapshot` — no host reassignment logic runs there. `start`, `settings`, and `nextHand` are all gated on `userId === room.host_user_id` (Security Considerations, line 190).
- **Failure scenario:** Host's phone battery dies, or they lose signal, or the browser crashes — the socket closes without ever sending `{type:'leave'}`. The room permanently loses its only actor who can call `start` (if still `waiting`), `settings`, or `nextHand` (if a hand just ended). Every other seated player is locked out indefinitely; the only remedy is an out-of-band admin action via the phase-8 `docs/runbook.md` "reset-a-room" procedure, which doesn't exist yet and isn't specified.
- **Evidence:** `phase-05-room-durable-object-realtime.md:98` "leave -> drop the seat while waiting (mark disconnected while playing), reassign host"; `:146-147` "webSocketClose/webSocketError set connected = 0 for that seat and re-snapshot"; `:190` "host-only actions (start, settings, nextHand) additionally check userId === room.host_user_id". Phase 8's smoke checklist item 9 only tests the voluntary case: "Host leaves the waiting room; the crown moves to the next seat" (`phase-08-deploy-docs-and-smoke-test.md:92`) — the ungraceful-disconnect path is never exercised.
- **Suggested fix:** Reassign host on `webSocketClose`/`webSocketError` too (same "next connected seat, else next seat" rule used for `leave`), or add a grace-period timer (e.g. one `turnSeconds` cycle) after which a disconnected host's crown auto-transfers to the next connected seat.

## Finding 2: Duplicate/overlapping sockets for one user cause false "disconnected" status

- **Severity:** High
- **Location:** Phase 6 "WebSocket client", `phase-06-web-shell-login-lobby-waiting.md:82-84`; Phase 5 "Connection flow", `phase-05-room-durable-object-realtime.md:93`, `:146-147`
- **Flaw:** The reconnect wrapper re-sends `{type:'join'}` on every socket open and additionally reconnects immediately on `visibilitychange` (lines 82-84), on top of its own exponential-backoff retry loop. `join` on the DO side is keyed only by `userId`, not by connection identity (`join -> upsert seat (reuse userId's seat...), connected = 1`, line 93), and `webSocketClose` unconditionally sets `connected = 0` for the seat (lines 146-147) with no check for whether a newer socket for the same seat is already live.
- **Failure scenario:** A user backgrounds the tab; iOS silently drops the socket after ~30s. On foreground, `visibilitychange` opens a new socket and sends `join` (seat marked `connected=1`). The stale old socket's TCP teardown/`close` event can arrive afterward (browsers do not guarantee close-before-new-open ordering across a dead connection), running `webSocketClose` for that same seat and flipping `connected` back to `0`. Every other player now sees that seat as "Mất kết nối" (`opponent-seat.svelte`, `phase-07-web-game-table-and-results.md:138`) even though the user is fully connected and playing normally — a stuck stale status with no self-correcting event, since no future `connected=1` write happens until their next voluntary reconnect cycle.
- **Evidence:** `phase-06-web-shell-login-lobby-waiting.md:82-84` "re-send {type:'join'} on every open... A visibilitychange listener reconnects immediately when the tab becomes visible, because iOS drops background sockets after ~30 s"; `phase-05-room-durable-object-realtime.md:93` "join -> upsert seat (reuse userId's seat; reject when full and unseated), connected = 1"; `:146-147` "webSocketClose/webSocketError set connected = 0 for that seat".
- **Suggested fix:** Track connections per seat as a count/set rather than a boolean, or stamp each socket attachment with a monotonic connection id and have `webSocketClose` only clear `connected` if the closing socket is still the seat's *current* attachment.

## Finding 3: `room_sessions.closed_at` is never written — lobby "open/closed" state is permanently stale

- **Severity:** High
- **Location:** Phase 4 schema, `phase-04-worker-auth-and-d1.md:57`, `:88`, `:90`, `:94`; Phase 5 Overview, `phase-05-room-durable-object-realtime.md:28`
- **Flaw:** `room_sessions.closed_at` is defined (`closed_at INTEGER -- NULL while the room is open`, line 57), read by `GET /api/rooms/:code` (`{ exists, ..., closed }`, line 90) and by `GET /api/sessions`'s query (`SELECT r.code, r.stake_per_la, r.closed_at, ...`, line 94) to populate the recent-sessions `open` flag (line 88). Phase 5 states "An empty room closes" (line 28) but this is DO-internal behavior — no Implementation Step in phase 4 (routes-rooms.ts) or phase 5 (room-do-actions.ts) ever issues an `UPDATE room_sessions SET closed_at = ...` against D1. `room-do-store.ts`'s function list (`getRoom, setRoom, listSeats, upsertSeat, setSeat, addTotals`, phase-05 lines 142-143) only touches DO SQLite, never D1's `room_sessions` table.
- **Failure scenario:** Every room a player has ever created or joined shows as "open" forever in `GET /api/sessions`'s `open` field and in `GET /api/rooms/:code`'s `closed` field, even years after the group stopped playing in it and the RoomDO itself considers it "closed." Any UI/UX built on top of `closed`/`open` (e.g. "Vào lại" reopen affordance in `lobby-recent-sessions.svelte`, phase-06 line 142) behaves incorrectly for every room, not as an edge case.
- **Evidence:** as quoted above.
- **Suggested fix:** When the DO's "empty room closes" path runs, have it call back to the Worker (or have the Worker itself set `closed_at` via a lightweight `POST /api/rooms/:code/close` triggered from `webSocketClose` when the DO's seat list is empty) so D1 and DO room-open state stay consistent.

## Finding 4: Lobby "cumulative score chip" has no backing API contract

- **Severity:** Medium
- **Location:** Phase 6 Requirements and Architecture, `phase-06-web-shell-login-lobby-waiting.md:26`, `:133`, `:59-65`
- **Flaw:** The lobby header is specified to show a "cumulative score chip" (line 26, restated line 133), but the only score-bearing endpoints defined anywhere in phases 4-6 are `GET /api/sessions` (per-room `netLa`/`netScore` list, `phase-04-worker-auth-and-d1.md:88`) and the in-room WebSocket `SeatView.totalLa` (per-room running total, visible only after joining a specific room, `phase-05-room-durable-object-realtime.md:61`). Neither yields a single global number, and the `api.ts` contract (lines 59-65) exposes no method that could produce one (`register, login, logout, me, recentSessions, createRoom, findRoom`).
- **Failure scenario:** Whoever implements `lobby-screen.svelte` has to invent an aggregate (e.g., sum `recentSessions()` client-side, mixing stakes across rooms with different `stakePerLa`) that no other phase specified or tested — a plausible source of a wrong or nonsensical number shown before the first hand of a session is even played, and untested by phase 8's checklist (no smoke item covers it).
- **Suggested fix:** Either drop the chip (YAGNI, since `docs/game-rules.md:37` already says "Settlement is per hand; session board accumulates" per-room, not globally) or add an explicit contract (e.g. sum of `netLa * stakePerLa` across `recentSessions()`, computed client-side, spec'd once).

## Finding 5: Disconnected seats have no expiry or host-kick — one dead phone permanently shrinks room capacity

- **Severity:** Medium
- **Location:** Phase 5 Overview, `phase-05-room-durable-object-realtime.md:23-25`; Phase 8 Next Steps, `phase-08-deploy-docs-and-smoke-test.md:167`
- **Flaw:** "Seats are assigned in join order and stay stable for the room's life, so a rejoin restores the same seat" (lines 23-25) — there is no seat-expiry, no host-kick, and phase 8 explicitly defers "host kick" to "post-launch candidates, none committed" (line 167).
- **Failure scenario:** In a 4-5 player room (already capacity-constrained per `docs/game-rules.md:6`, 2-5 players), one player's phone dies mid-session and is never reconnected. Their seat is unrecoverable for the life of that room — no one can free the slot to let a 5th friend join, and if that stuck seat's owner was also the host, this compounds with Finding 1 into a fully dead room.
- **Evidence:** as quoted above.
- **Suggested fix:** At minimum, allow the host to force-vacate a `connected: false` seat while `status === 'waiting'` (cheap, no mid-hand complexity); explicitly document that mid-hand this is accepted as "abandon room, start a new one," since that's the actual escape hatch today.

## Finding 6: Two independent score ledgers (DO `seats.total_la` vs D1 `hand_results`) with no reconciliation

- **Severity:** Medium
- **Location:** Phase 5 "Hand lifecycle", `phase-05-room-durable-object-realtime.md:119-122`, Risk table `:181`; Phase 4 query, `phase-04-worker-auth-and-d1.md:93-98`
- **Flaw:** `endHand()` updates the DO-authoritative `seats.total_la` synchronously (line 119) and separately fire-and-forgets a D1 write of the same hand's deltas via `ctx.waitUntil(env.DB.batch(...))` (line 122). The risk table (line 181) accepts that a D1 failure leaves `seats.total_la` correct while D1 lacks that row, calling D1 "history only" — but `GET /api/sessions`'s `net_la` (used for the lobby's per-room net score, phase-04 lines 93-98) is computed *exclusively* from `hand_results`, so a single transient D1 error permanently and silently desyncs the number a player sees live in-room (`SeatView.totalLa`) from the number they see afterward in the lobby's recent-sessions list, with no logged error, no retry, and no way for a player to tell the two apart or trust either.
- **Failure scenario:** D1 has a momentary blip during exactly one `ctx.waitUntil` batch insert (network hiccup, D1 rate limit) — nothing surfaces to any client, `snapshotAll()` already ran before the promise settled (line 122 order: `waitUntil(...); snapshotAll()`), and the discrepancy is discovered only if a player manually cross-checks the two totals, or never.
- **Evidence:** as quoted above.
- **Suggested fix:** At minimum log failed D1 batches (even to `console.error`, visible in `wrangler tail`) so the discrepancy is debuggable; consider a periodic reconciliation read (`SUM(hand_results.delta_la) per room` vs `seats.total_la`) surfaced in `docs/runbook.md`.

## Finding 7: Flow-trace gap — no store primitive for the `leave` action's seat removal

- **Severity:** Low
- **Location:** Phase 5, `phase-05-room-durable-object-realtime.md:98`, `:142-144`
- **Flaw:** The message switch says `leave -> drop the seat while waiting` (line 98, implying a row delete), but `room-do-store.ts`'s exhaustive function list is `ensureSchema, getRoom, setRoom(patch), listSeats, upsertSeat, setSeat(seat, patch), addTotals(deltas)` (lines 142-144) — no delete/remove-seat primitive is specified, unlike every other seat mutation.
- **Failure scenario:** Not a runtime bug by itself, but a spec gap an implementer must silently fill; if they instead reuse `setSeat` to blank the row rather than deleting it (easier given the listed primitives), "drop the seat" silently becomes "leave a ghost seat with empty fields," changing `listSeats().length` semantics used by `start`'s `>=2 seats` check (line 96) and seat-count-based UI layout (`opponentSlots`, phase-07 line 69).
- **Evidence:** as quoted above.
- **Suggested fix:** Add `deleteSeat(seat)` explicitly to the phase-5 store function list to remove the ambiguity.

## Flow Trace (join → ready → start → deal → play/pass → timer → hand end → settle → D1 persist → next hand → leave/reconnect)

Traced across phases 3, 5, 7. Undefined/contradictory points found beyond the findings above:
- **join → ready → start**: well-defined, phase-05 lines 93-96, consistent with phase-06's waiting screen (lines 149-153) and phase-07's `RoomView.canDeclareSam`/`turnSeat` fields.
- **deal → sam-window → play**: phase-03's `createHand`/`applyAction` contract matches phase-05's `beginHand()` call signature (`createHand(seatCount, handNo + 1, seed, ...)`, phase-05:108) and phase-05's `phase === 'ended'` immediate-`endHand()` check (line 112) correctly handles the ăn trắng short-circuit described in phase-03 line 74. No gap.
- **timer**: `armAlarm`/`alarm` re-read `turn_deadline` from storage before acting (phase-05:113-118), which correctly no-ops stale/duplicate alarm deliveries (Cloudflare alarms are at-least-once). This part is sound.
- **hand end → settle → D1 persist**: covered by Finding 6 (two ledgers, no reconciliation) and Finding 3 (D1's `room_sessions.closed_at` never touched at any lifecycle point, not just at hand end).
- **next hand**: `beginHand()` clears `result_json` (phase-05:110) before the next deal; phase-07's result modal is keyed off `status === 'hand-end'` (phase-07:32) so there is no window where a stale result could double-render — consistent.
- **leave/reconnect**: covered by Findings 1, 2, 5, 7. Additionally, the reconnect contract never states what happens to a player's *selection state* (`selected` in `table-screen.svelte`) versus the mid-trick server state on a reconnect during their own turn with an active but not-yet-expired `turnDeadline` — phase-07 line 133 clears `selected` "in an `$effect` on every snapshot," which does cover the rejoin snapshot, so this is fine, not a gap.

**Status:** DONE
**Summary:** Seven findings, all file:line-cited and independently verified with grep against the plan text: one Critical (no host-abandonment recovery, deadlocks the room), two High (duplicate-socket connection-status flapping; `room_sessions.closed_at` never written, making lobby open/closed state permanently wrong), three Medium (unspecified lobby cumulative-score API; no seat expiry/host-kick permanently shrinking room capacity after one dead device; two unreconciled score ledgers between DO and D1), one Low (missing `deleteSeat` store primitive for the documented `leave` behavior). The alarm/timer race guard and the ăn trắng → sâm-window → hand-end pipeline are sound and need no changes.
**Concerns/Blockers:** None — all findings are fixable within the existing phase boundaries (mostly phase 5, one in phase 4/8) without restructuring the plan's phase dependency graph.
