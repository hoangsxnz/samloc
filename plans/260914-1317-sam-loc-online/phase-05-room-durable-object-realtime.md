---
phase: 5
title: "Room Durable Object realtime"
status: completed
effort: "5h"
priority: P1
dependencies: [phase-03, phase-04]
---

# Phase 5: Room Durable Object realtime

Context: `docs/tech-stack.md` §Constraints; `docs/wireframe/03-room-waiting.html`, `04-game-table.html`; `plans/reports/researcher-260914-1317-cloudflare-durable-objects-websocket-d1-report.md` §1, §2, §8

## Overview

`RoomDO` — one Durable Object per room code, the single source of truth for a room: seat list, settings,
current `RulesState`, turn alarm, per-player snapshot filter. Clients send intents; the DO validates each
through `applyAction` and pushes a filtered snapshot to every socket, so opponents' hands never leave it.

## Requirements

**Functional** — `GET /ws/:code` upgrades to WebSocket after the Worker validates the `sid` cookie. Seats are assigned in join order and stay stable for the room's life, so a rejoin restores the same seat. **The host is dynamic, never persisted:** always the lowest-numbered seat with `connected = 1`, so an ungraceful host disconnect hands control over with no reassignment step.
The host starts the hand once every seated player is ready and there are ≥2 seats, and may change settings while waiting (broadcast to all, written back to `room_sessions`). **On `start`, seats with `connected = 0` are dropped before dealing** — they are told nothing and re-join a free seat on return; during `playing` a disconnected seat stays and its turns auto-play on timeout.
The turn timer uses the room setting 15/20/30 s, default 20. On hand end the DO writes one `hand_results` row per seat to D1 and holds it until `nextHand`. The last seat leaving closes the room.
**Non-functional** — WebSocket Hibernation (`ctx.acceptWebSocket`) so an idle room costs nothing; DO persistence only through `ctx.storage.sql.exec`, never `storage.get/put`; a snapshot after every accepted action, no event replay, no delta protocol; `apps/worker/src/room-do*.ts` ≤200 lines each.

## Architecture

**DO SQLite tables** — created idempotently in the constructor. No `host_user_id` column: the host is derived, so there is no stale value to reconcile after a crash.
```sql
CREATE TABLE IF NOT EXISTS room (          -- status: waiting | playing | hand-end
  id  INTEGER PRIMARY KEY CHECK (id = 1), code TEXT NOT NULL, hand_no INTEGER NOT NULL DEFAULT 0,
  max_players INTEGER NOT NULL, turn_seconds INTEGER NOT NULL, stake_per_la INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting', state_json TEXT, result_json TEXT,
  turn_deadline INTEGER                    -- epoch ms, NULL when no timer is armed
);
CREATE TABLE IF NOT EXISTS seats (         -- seat 0..4, join order == turn order
  seat INTEGER PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
  ready INTEGER NOT NULL DEFAULT 0, connected INTEGER NOT NULL DEFAULT 0,
  total_la INTEGER NOT NULL DEFAULT 0 );   -- running session total
```

**WebSocket message types** — `apps/worker/src/ws-types.ts`, imported verbatim by the client in phases 6/7
```ts
export interface RoomSettings { maxPlayers: number; turnSeconds: number; stakePerLa: number }
export type ClientMsg = { seq: number } & (
  | { type: 'join' | 'start' | 'declareSam' | 'pass' | 'nextHand' | 'leave' }
  | { type: 'ready'; value: boolean } | { type: 'settings'; settings: RoomSettings }
  | { type: 'play'; cards: string[] });
export interface SeatView {       // isHost = lowest-numbered seat with connected === true
  seat: number; userId: string; name: string; ready: boolean; connected: boolean; isHost: boolean;
  cardCount: number; passed: boolean; bao1: boolean; totalLa: number; }
export interface TrickEntry { seat: number; cards: string[] }
export interface ResultRow {      // cards = remaining cards, revealed at hand end only
  seat: number; name: string; cards: string[]; cong: boolean; deltaLa: number; totalLa: number; }
export interface HandResult {     // headline is Vietnamese, e.g. "Tuấn Báo Sâm thành công"
  handNo: number; winnerSeat: number | null; nextLeadSeat: number; rows: ResultRow[]; headline: string;
  kind: 'normal' | 'an-trang' | 'sam-success' | 'sam-fail' | 'den-bai'; }
export interface RoomView {       // hand = your cards only; trick = this trick, newest last
  code: string; status: 'waiting' | 'playing' | 'hand-end'; settings: RoomSettings; handNo: number;
  youSeat: number; youAreHost: boolean; seats: SeatView[]; hand: string[]; trick: TrickEntry[];
  phase: 'sam-window' | 'playing' | 'ended' | null; turnSeat: number | null; samSeat: number | null;
  turnDeadline: number | null; canDeclareSam: boolean; result: HandResult | null; }
export type ServerMsg =            // GameEvent is re-exported from @samloc/rules
  | { type: 'snapshot'; ack: number; view: RoomView } | { type: 'event'; event: GameEvent }
  | { type: 'error'; ack: number; msg: string };
```

**Connection flow and message handling** — the DO trusts the `x-user-*` headers because only the Worker reaches
it; a browser cannot set them on a stub call. Sockets are tagged with the user id, so a second tab from one
account is legitimate and both get snapshots. `hostSeat(seats)` = lowest seat with `connected = 1`.
```
Worker /ws/:code: getSessionUser(DB, sid) -> 401 if miss; SELECT settings FROM room_sessions -> 404; then
  env.ROOM.get(idFromName(code)).fetch(req, { headers: { 'x-user-id', 'x-user-name', 'x-room-code',
    'x-max-players', 'x-turn-seconds', 'x-stake' } })
RoomDO.fetch: ensureRoom(headers); pair = new WebSocketPair()     // first call seeds the `room` row
  ctx.acceptWebSocket(pair[1], [userId]); pair[1].serializeAttachment({ userId, name })   // tag=userId
  return 101 + pair[0]
webSocketMessage(ws, raw): { userId, name } = ws.deserializeAttachment()
  takeToken(ws) or reply { type:'error', msg:'Thao tác quá nhanh' } and drop     // 10/s, burst 20
  msg = parse(raw); reject unknown type / missing seq with { type:'error', ack: 0 }
  switch (msg.type):
    join     -> upsert seat (reuse userId's seat; reject when full and unseated), connected = 1
    ready    -> only while status='waiting'; set ready
    settings -> host only, status='waiting', phase-4 whitelist, write back to room_sessions
    start    -> host only, status='waiting', all ready; drop connected=0 seats, need >=2 -> beginHand()
    nextHand -> host only, status='hand-end' -> beginHand()
    leave    -> removeSeat while waiting/hand-end; while playing keep the seat at connected = 0 so timeouts
                auto-play and settlement counts it; no seats left -> closeRoom()
    declareSam | play | pass -> requireSeat -> applyAction(state, { ...action, seat }); on error send
                { type:'error', ack: msg.seq, msg } to that socket alone and skip the snapshot, else
                persist, broadcast events, armAlarm().  Accepted messages end with snapshotAll()
webSocketClose / webSocketError(ws): drop ws from the bucket map, set connected = 0 for that seat only
  when ctx.getWebSockets(userId).length === 0 afterwards, then snapshotAll()
```

**Hand lifecycle and alarm scheduling** — re-reading `turn_deadline` inside `alarm()` makes a late or duplicate alarm a no-op, guarding a fired alarm racing a just-accepted play.
```
beginHand(): seed = crypto.getRandomValues(new Uint32Array(1))[0]
             { state, events } = createHand(seatCount, handNo + 1, seed,
                                            handNo === 0 ? undefined : lastNextLeadSeat)
             persist state_json, status='playing', result_json=NULL, hand_no += 1
             broadcast events; snapshotAll(); armAlarm()
             if (state.phase === 'ended') endHand()   // ăn trắng resolves instantly
armAlarm():  status !== 'playing' -> deleteAlarm(), turn_deadline = NULL; else turn_deadline =
             Date.now() + turn_seconds * 1000 and ctx.storage.setAlarm(turn_deadline)
alarm():     reload room; if status !== 'playing' return
             if (Date.now() + 250 < turn_deadline) { setAlarm(turn_deadline); return }   // stale
             { state, events } = applyAction(state, { type:'timeout', seat: state.turnSeat })
             persist; broadcast; snapshotAll(); armAlarm(); if ended -> endHand()
endHand():   deltas = settle(state); UPDATE seats SET total_la = total_la + delta   (per seat)
             nextLeadSeat = state.winnerSeat ?? state.blockerSeat      // blocked sâm: blocker leads
             build HandResult (headline, rows with remaining cards and cóng flags); deleteAlarm()
             status='hand-end'; result_json = JSON; turn_deadline = NULL
             ctx.waitUntil(env.DB.batch(insert hand_results per seat)); snapshotAll()
closeRoom(): ctx.waitUntil(env.DB.prepare('UPDATE room_sessions SET closed_at=? WHERE code=?')
               .bind(Date.now(), code).run()); deleteAlarm(); ctx.storage.deleteAll()
```

**Snapshot filter** — `room-do-view.ts` builds one `RoomView` per socket: `hand` only for that socket's seat,
`cardCount` for the rest, host flags from `hostSeat(seats)`, `result.rows[].cards` only at hand end. It is the
only reader of `players[*].hand`.

## Related Code Files

**Create** — under `apps/worker/src`: `ws-types.ts` (types above); `room-do.ts` (class, storage bootstrap,
`fetch`, `webSocketMessage`, `webSocketClose`, `alarm`, token-bucket map); `room-do-actions.ts` (message
switch, `beginHand`, `endHand`, `closeRoom`); `room-do-view.ts` (`buildView`, `buildHandResult`, `hostSeat`);
`room-do-store.ts` (typed `ctx.storage.sql.exec` wrappers); `routes-ws.ts` (upgrade handler); plus
`apps/worker/tests/room-do-view.test.ts`.

**Modify** — `apps/worker/src/index.ts` (mount `routes-ws`, re-export `RoomDO`), `apps/worker/wrangler.jsonc` (confirm the `v1` `new_sqlite_classes` migration names `RoomDO`). **Delete** — the phase-1 stub body of `room-do.ts` (replaced, not removed).

## Implementation Steps

1. Write `ws-types.ts` first — phases 6 and 7 import it, so it is the contract to freeze. Then
   `room-do-store.ts`: `ensureSchema(ctx)`, `getRoom`, `setRoom(patch)`, `listSeats`, `upsertSeat`,
   `setSeat(seat, patch)`, `removeSeat(seat)`, `addTotals(deltas)` — all via `ctx.storage.sql.exec` with
   bound parameters, results read as `[...cursor]` and cast to a row interface.
2. `room-do.ts` (routing only; logic lives in step 3): the constructor calls `ensureSchema` and creates
   `#buckets = new Map<WebSocket, { tokens: number; ts: number }>()`; `fetch` seeds the room row from the
   `x-*` headers then upgrades with `acceptWebSocket(ws, [userId])`, attaching `{ userId, name }`.
   `takeToken(ws)` refills at 10 tokens/s capped at 20 and returns false when empty; a refused message gets
   one `{type:'error', msg:'Thao tác quá nhanh'}` and is dropped, and losing the map to hibernation only
   resets the limiter to full. Close/error follow `getWebSockets(userId).length === 0` above.
3. `room-do-actions.ts`: the message switch plus `beginHand`, `endHand`, `closeRoom`, `armAlarm`; host-only
   actions compare the caller's seat with `hostSeat(seats)`, and `settings` writes back to `room_sessions`
   in `ctx.waitUntil` so a D1 hiccup never blocks the snapshot.
4. `room-do-view.ts`: `hostSeat`, `buildView`, `buildHandResult`, with `cong: row.played === 0` and headlines `"<tên> thắng"`, `"<tên> Báo Sâm thành công"`, `"<tên> Báo Sâm thất bại"`, `"Ăn trắng: Sảnh rồng"`, `"<tên> đền bài"`.
5. `routes-ws.ts`: validate `Upgrade: websocket`, resolve the session user, load settings from D1, forward to
   the stub with the `x-*` headers, 401/404 as plain text before upgrading. `broadcast(events)` sends one
   `{type:'event'}` frame per event to every `ctx.getWebSockets()` socket; `snapshotAll()` gives each socket
   its own `{type:'snapshot', ack}`, `ack` = the triggering `seq` or `0` for alarm/close snapshots.
6. `apps/worker/tests/room-do-view.test.ts`: build a fake room, seats and `RulesState`, then assert
   `buildView(..., forSeat: 1)` reports `seats[0].cardCount === 10`, its `hand` holds only seat 1's cards, no
   foreign card ids appear, and `hostSeat` skips a disconnected seat 0 for a connected seat 1.
7. Verify with `pnpm -r typecheck && pnpm -r test`, then `pnpm dev`, drive two tabs through register → create
   room → join → ready → start, idle a turn for `turnSeconds`, and kill the host tab to watch `isHost` move.

## Success Criteria

- [x] `pnpm -r typecheck` and `pnpm -r test` exit 0; two tabs on one code see each other in `seats`
- [x] Starting a hand deals 10 cards; each tab's `hand` holds only its own cards and tab A's WS frames carry
      zero card ids belonging to tab B
- [x] An idle turn auto-passes (or auto-leads the lowest single) once, `turnSeconds` in; an illegal `play`
      errors to that socket only; reopening a closed tab restores the seat and hand after `join`
- [x] Killing the host tab moves `isHost` to the next connected seat in one snapshot; two tabs as one user
      keep a single seat and closing one leaves `connected = 1`
- [x] `start` with one seat disconnected deals to the remaining seats only; the last seat leaving sets
      `room_sessions.closed_at` and wipes DO storage
- [x] Hand end writes one `hand_results` row per seat (`wrangler d1 execute samloc-db --local`)

## Risk Assessment

| Risk | L×I | Mitigation |
|---|---|---|
| Research claims SQLite DOs have no `storage.get/put` — **doubtful**, and its `sql.exec` return shape (`{success,error}`) is likely wrong; it returns a cursor | H×M | Plan uses `sql.exec` exclusively either way, so the `get/put` claim is moot. Wrap every call in `room-do-store.ts` and fix the result handling in one file after the first `wrangler dev` run |
| Alarm races an accepted play and double-advances the turn, or hibernation drops the attachment and loses socket identity, or `closeRoom` wipes storage under a straggler socket | M×H | `alarm()` re-reads `turn_deadline` and re-arms when stale. `serializeAttachment` runs at accept time before any await, with step 7's tab-reopen check as the guard. `closeRoom` only fires with zero seats left, and a late `join` re-seeds the room row from the `x-*` headers |
| `env.DB` write at hand end fails and blocks the snapshot, or WS frames eat the 100k/day free limit | L×M | `ctx.waitUntil` the D1 batch — `seats.total_la` is authoritative for live play and D1 is history only. Snapshot-per-action with ≤5 sockets is ~200 frames/hand, so thousands of hands/day fit |
| **Accepted, not mitigated:** DO `seats.total_la` and D1 `hand_results` can drift if a D1 write fails; separately, `ws-types.ts` could drift from the client | M×L | D1 is history only and the live board reads `seats.total_la`, so a drifted lobby row is cosmetic and self-corrects on the next room. The client imports `ws-types.ts` from `@samloc/worker/ws-types` via a workspace path export, never a copy |

**Rollback:** revert `room-do*.ts` and `routes-ws.ts`, restore the phase-1 stub. D1 tables survive; clear local DO state with `rm -rf apps/worker/.wrangler/state`.

## Security Considerations

- Identity comes from the `sid` cookie at the Worker, never the WebSocket payload. A client cannot spoof
  `seat` or `userId`: the DO takes both from the socket attachment on every action, and host-only actions
  compare the caller's seat with `hostSeat(seats)`. `buildView` is the single per-player filter, so any new
  field reading `players[*].hand` goes through it, guarded by `room-do-view.test.ts`.
- Every action is re-validated by `applyAction`, so a hacked client cannot play a card it does not hold, and
  `seq` is an echo for request matching only, never trusted for ordering or replay. Anyone with a room code
  and an account can join; accepted for a private group, capped at `max_players`. The 10 msg/s token bucket
  caps what one socket costs the room; it is an abuse brake, not an auth control, and may reset on hibernation.

## Next Steps

Phase 6 binds the waiting screen to `youAreHost` and the "Rời phòng" button; phase 7 consumes `ws-types.ts`.
