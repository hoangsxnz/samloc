# Code review: rules engine + worker (phases 2-5)

Scope: `packages/rules/src/*.ts`, `apps/worker/src/*.ts`, both test suites, `apps/worker/migrations/0001_init.sql`.
Both suites currently pass: `pnpm --filter @samloc/rules test` (95/95), `pnpm --filter @samloc/worker test` (26/26).
Review is read-only code tracing plus test-suite execution; no fixes applied.

## Critical
None found. No auth bypass, no card-hand leak in any `ServerMsg` path, no unbound loop, no unparameterized SQL.

## High

### H1. Leaving during `hand-end` compacts seats and desyncs the result view from the live seat table
`apps/worker/src/room-do-actions.ts:130-144` (`handleLeave`), `apps/worker/src/room-do-store.ts:119-124` (`compactSeats`), `apps/worker/src/room-do-hand.ts:100-107` (`endHand` writes `result_json`), `apps/worker/src/room-do-view.ts:75` (`buildView` passes `result` through unchanged).

`HandResult.rows[]` (`ResultRow.seat`) and `HandResult.nextLeadSeat` are computed once in `endHand()` from the seat numbering that was live *during the hand that just ended*, then persisted verbatim in `result_json` until the next `beginHand()` overwrites it. `handleLeave` explicitly removes+compacts seats whenever `room.status !== 'playing'` — which includes `'hand-end'` (per the phase-05 spec's own wording: "removeSeat while waiting/hand-end"). If any seat other than the highest-numbered one leaves while players are viewing the hand-end recap, `compactSeats()` shifts every higher seat down by one, but `result_json` (and hence every future `snapshotAll()` until `nextHand`) keeps the *old* seat numbers.

Concrete scenario: 4 seats (0-3), hand ends, seat 1 closes their tab and explicitly leaves (or the client sends `leave`) while everyone reviews the result screen. `compactSeats` renumbers old seat 2→1, old seat 3→2. The live `seats[]` array in the next `RoomView` now shows 3 seats with fresh numbering, but `result.rows[]` still carries `seat: 0..3` from the ended hand. Any consumer that joins the two arrays by `seat` (the natural way to place a result badge on a seat, which is exactly why both `SeatView` and `ResultRow` carry a `seat` field) will attribute one player's revealed cards/`deltaLa`/`totalLa` to a different, currently-seated player. `result.nextLeadSeat` is likewise stale and may not correspond to any current seat.

This is silent, not a crash — `youAreHost`/`youSeat`/card visibility remain correct because those are recomputed per-request; only the two arrays' `seat` epochs diverge. Actual gameplay (who leads next) is *not* affected because `next_lead_user_id` is resolved by user id (`room-do-hand.ts:38,101`), which is a good defensive design that avoids the more severe version of this bug — but the displayed result is wrong. Given this is a lá-stakes game, misattributing a settlement row to the wrong seat/player is a real trust problem, not cosmetic.

Not covered by `apps/worker/tests/room-do-view.test.ts` — no test exercises `compactSeats` interacting with an already-built `HandResult`.

Fix direction (not implemented, for the lead's awareness): either (a) block `compactSeats()` while `result_json` is still live (i.e. only compact on `nextHand`/`start`, never on a bare `leave` during `hand-end`), or (b) key `ResultRow` by `user_id` instead of `seat`, or (c) rebuild/renumber `result_json` at the same time seats are compacted.

## Medium

### M1. `POST /api/rooms` open-room cap has a TOCTOU race
`apps/worker/src/routes-rooms.ts:74-85`. The count query and the insert are two separate D1 round-trips with no transaction/lock between them. Two concurrent `POST /api/rooms` from the same account when they already host 2 open rooms can both read `count = 2`, both pass the `< 3` check, and both insert — ending with 4 open rooms instead of the documented cap of 3. Low real-world impact (soft cap on a private app, not a security boundary), but easily triggered by a double-click or a retried request.

### M2. Fire-and-forget storage writes swallow rejections
`apps/worker/src/room-do-hand.ts:29` (`armAlarm`: `void host.storage.setAlarm(deadline)`), `:108` and `:176-177` (`deleteAlarm`/`deleteAll` in `endHand`/`closeRoom`). None of these are awaited or `.catch()`-handled. Durable Object storage writes issued synchronously before a response/WS send are generally covered by the runtime's output gate, so this is likely not a durability bug in practice, but if `setAlarm` ever rejects (quota, transient error) the rejection becomes an unhandled promise rejection with no retry and no log — the turn timer would silently fail to arm, potentially stalling a hand until someone else's next action nudges it. Recommend `await`-ing and logging failures rather than `void`.

## Low / informational

### L1. `crypto.subtle.timingSafeEqual` is not a real Web Crypto API and the branch is dead code
`apps/worker/src/auth.ts:43-55`. `SubtleCrypto` has no `timingSafeEqual` method in any spec or in workerd; `typeof crypto.subtle.timingSafeEqual === 'function'` will evaluate `false` at runtime, so `verifyPassword` always falls through to the manual constant-time XOR loop. Functionally fine (the fallback is itself correct and constant-time given both hex strings are always the same fixed length), but the primary branch is unreachable and the comment is misleading. Worth a one-line fix or removing the dead branch so it doesn't look like coverage it doesn't have.

### L2. Hand-seed fallback to `Date.now()` is unreachable but non-CSPRNG if ever hit
`apps/worker/src/room-do-hand.ts:37`: `crypto.getRandomValues(new Uint32Array(1))[0] ?? Date.now()`. `Uint32Array(1)[0]` after `getRandomValues` is never `undefined` in practice, so this is defensive-only, but if it were ever exercised it would violate the documented requirement ("a guessable seed leaks every hand", phase-02 Security Considerations / phase-03 Security Considerations). Consider throwing instead of silently degrading to a guessable seed.

### L3. Abandoned mid-hand room stays alive longer than the idle-close window suggests
`apps/worker/src/room-do-hand.ts:139-143` combined with `room-do.ts:98-101`: `armIdleClose` no-ops whenever `room.status === 'playing'`, so a room where every socket disconnects mid-hand does **not** start its 60s idle-close countdown immediately. Traced through: the turn-timeout auto-play/auto-pass loop is bounded (the current leader always wins every trick since all others auto-pass, so the hand completes in at most ~10 turns), after which `endHand()` transitions to `'hand-end'` and `armIdleClose` then fires correctly. So this is not a permanent leak, just a longer-than-expected tail (up to `10 × turn_seconds` plus the 60s grace period) before a fully abandoned room closes. No action required unless idle-DO billing becomes a concern.

## Rule-correctness vs `docs/game-rules.md`
Traced every bullet in game-rules.md against `combos.ts`, `compare.ts`, `instant-win.ts`, `reducer-play.ts`, `reducer-sam.ts`, `reducer-events.ts`, `settle.ts`:
- Straight range 3..A, no wrap, no đôi thông: correct (`combos.ts:24-31`, guarded by the four negative straight tests).
- Quad beats single-2 only / bigger quad beats smaller quad / quad never beats pair/triple/straight: correct (`compare.ts:10-20`).
- Chặt 2 (15 flat) / chặt chồng (double-the-previous, chain resets at trick end, skipped entirely on a sâm hand): correct (`reducer-events.ts:13-27`, `reducer-play.ts:28-29` resets `lastCut`/`denWatch` in `endTrick`).
- Báo 1 (once per seat): correct (`reducer-events.ts:30-35`).
- Đền bài (leader holds strictly higher single, immediate next seat is at 1 card, fires only if that seat empties its hand on that exact play, disarmed the instant anyone else takes the trick): correct, including the subtlety that a `pass` by the watched seat does not fire it and is cleaned up by `endTrick` (`reducer-play.ts:23-31`, `reducer-events.ts:41-73`).
- Báo sâm: lowest-seat-wins on competing declarations, window closes on first play, any beating play by a non-declarer both must legitimately beat (validated by the normal `parseCombo`/`canBeat` path before the sâm branch runs) and ends the hand in failure with the blocker leading next: correct (`reducer-sam.ts`, `reducer-play.ts:43,51-54`).
- Settlement exclusivity (ăn trắng / báo sâm skip all card-count/thối-2/cóng/chặt logic; đền bài refunds losers and taxes the offender without touching the winner; offender still pays their own cards; chặt transfers apply on top): correct and matches the pseudocode in phase-03 almost line for line (`settle.ts`).
- Ăn trắng priority and seat-order ties: correct (`instant-win.ts`, `buildHand` scans seats in order and takes the first hit, `state.ts:118-126`).

No rule-correctness bugs found. This is the strongest part of the codebase — it reads like it was built directly from the phase-03 pseudocode.

## Worker/DO correctness and security
- Trust boundary: `x-user-id`/`x-user-name`/room headers are always overwritten via `Headers.set()` after cloning the inbound request headers (`routes-ws.ts:34-40`), so a client cannot forge identity even if it sends its own `x-user-id`. Seat is always derived server-side from the authenticated user id, never from client payload (`room-do-actions.ts:35,58-61`).
- Per-player filtering: `buildView` is the single reader of `state.players[*].hand` and only reveals the requesting user's own hand; confirmed by `room-do-view.test.ts`'s serialized-frame check that opponents' card ids never appear.
- No unhandled turn-alarm/accepted-play race: none of the synchronous message-processing paths (`webSocketMessage` → `handleMessage` → `applyGameAction`/`commitStep`) contain an `await` before the state mutation completes, and `onAlarm`'s only `await` (rescheduling a stale alarm) happens on a branch that performs no further mutation — so there is no window for an accepted play and a fired alarm to interleave mid-mutation within one DO instance.
- Hibernation: the in-memory rate-limit bucket Map is correctly scoped to the current isolate and is expected to reset on hibernation (documented in a comment), which is safe since a new isolate means fresh sockets and a fresh Map.
- Cookie/session/password handling matches phase-04 spec: PBKDF2-SHA256 100k iterations, 16-byte salt, 256-bit key; HttpOnly/Secure/SameSite=Lax/Path=/ cookie; identical error message for unknown-username vs wrong-password (no enumeration); all D1 access parameterized.
- Room code: 32-symbol alphabet, `256 % 32 === 0` so no bias even without the rejection-sampling guard, and the guard is present anyway; 6-char code space matches the documented ~1.07e9.
- ws-parse: length-capped (4096 bytes), card-id length-capped (≤3 chars), card-count-capped (≤10), type-checked before any field is trusted; unknown/malformed frames are dropped silently rather than crashing the DO.

## Coverage gaps found by scouting (not covered by named tests)
1. `handleLeave` during `'hand-end'` combined with `compactSeats()` — the H1 scenario above. No test in `room-do-view.test.ts` or elsewhere builds a `HandResult` and then compacts seats under it.
2. Concurrent `POST /api/rooms` hitting the open-room cap race (M1) — not testable at the unit level without a D1 integration harness; flagging for awareness only.
3. `reducer-sam.test.ts`/`reducer-chat-den.test.ts` do not cover a chặt-chồng chain longer than 3 cuts (15→30→60→120) or a chặt happening on a card that was itself won mid-trick (not led) — traced through the logic by hand above and found correct, but there's no regression test pinning the 4th-cut doubling.

## Positive observations
- The `next_lead_user_id` (keyed by user id, not seat) design in `room-do-hand.ts:38,101` is a deliberate, effective guard against the seat-renumbering hazard the plan called out — it avoids a much worse version of H1 where actual gameplay (not just the display) could hand the lead to the wrong player.
- The rules engine's adherence to the phase-03 pseudocode is exact; `settle()`'s `assertZeroSum` guard and the reducer's `structuredClone`/JSON-clone-per-call discipline make the "never mutates input" invariant easy to trust.
- Rate limiting, message shape validation, and the per-socket error-vs-broadcast split (`handleMessage`'s errors go only to the sender) all match the spec precisely.

## Unresolved questions for the team
- Is H1 (leave-during-hand-end compaction) acceptable as a known limitation given the phase-05 spec explicitly calls for `removeSeat` in that state, or should the fix direction in H1 be scheduled before shipping?
- M1's exact impact tolerance (is exceeding 3 open rooms briefly acceptable for this private app) is a product call, not flagged as broken by design intent.

**Status:** DONE_WITH_CONCERNS
**Summary:** Rules engine (phases 2-3) is correct against docs/game-rules.md with no bugs found; worker/DO (phases 4-5) has one High finding (stale result-row/seat correlation after a leave during hand-end) plus two Medium hardening items, no Critical/security issues.
**Concerns/Blockers:** H1 leave-during-`hand-end` seat compaction desyncs `HandResult.rows[].seat`/`nextLeadSeat` from the live `seats[]` table, misattributing settlement rows to the wrong player on the result screen — untested, reproducible in normal use, file:line in report.
