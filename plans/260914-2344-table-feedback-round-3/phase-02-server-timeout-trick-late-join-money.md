---
phase: 2
title: "Server — timeout / trick / late join / money"
status: completed
priority: P1
effort: "6h"
dependencies: [1]
---

# Phase 2: Server — timeout / trick / late join / money

## Overview

Six server-side changes: timeout auto-plays for every seat, a finished trick
stays on the table until the next lead, trick cards are stored sorted, thối 2 is
announced as an event, a player may join a room that is already playing (seated
for the next hand), seats are ready by default, and every seat carries its real
money balance instead of ±lá.

## Requirements

Functional:
- On timeout, the seat plays `lowestLegalMove`; it passes only when no legal move
  exists (never when leading, since leading always has one).
- A trick that everyone passed on stays visible until the winner leads the next
  combo; the client no longer sees the table blank out mid-hand.
- `TrickEntry.cards` are stored ascending by rank, so `5-4-3` reads as `3-4-5`
  for every viewer.
- At hand end, every seat that pays thối 2 gets a `thoi2` event with its count and
  lá amount.
- `join` is accepted while the room is `playing` or `hand-end` (up to
  `max_players`); the new seat spectates the current hand and is dealt in on the
  next one.
- A newly added seat is `ready = 1`; the host only presses "Bắt đầu".
- `SeatView.money` and `ResultRow` money fields replace the lá totals in the UI
  contract; `totalLa` stays on the wire for the session board.

Non-functional:
- No new D1 tables. One extra D1 read per socket upgrade.
- No Durable Object schema migration that breaks a live room (see Architecture).

## Architecture

**Timeout (feedback 6).** `applyTimeout` in `packages/rules/src/reducer-play.ts`
becomes: `const move = lowestLegalMove(player.hand, state.trick.combo); return
move ? applyPlay(state, seat, move) : applyPass(state, seat);`. Leading keeps its
current behaviour by construction (the lowest legal move while leading is the
lowest single). Responding now plays instead of passing whenever the seat holds
anything that beats the trick.

> Note: this reverses the "responding → auto-pass" line in `docs/game-rules.md`;
> the user asked for it explicitly on 2026-09-14. Phase 5 updates the doc.

<!-- Updated: Validation Session 1 - sâm hands get no exception -->
No exception for báo sâm hands: a non-declarer who times out auto-plays and thus
blocks the sâm, and the declarer pays 20 lá per player. Confirmed by the user on
2026-09-15 in favour of consistency.

The existing test `packages/rules/tests/reducer-turn-flow.test.ts:128`
("timeout while responding auto-passes") asserts the old behaviour and must be
**rewritten** into two cases: responding with a beating combo → auto-play the
lowest one; responding with nothing that beats → auto-pass.

**Trick retention (feedback 5).** `trick_json` changes from `TrickEntry[]` to
`{ entries: TrickEntry[]; closed: boolean }`. `nextTrick` becomes:

- a `trickEnd` event → keep `entries`, set `closed: true` (was: reset to `[]`);
- a play while `closed` → start a fresh list with just that entry, `closed: false`;
- otherwise append as today.

`parseTrick` tolerates the legacy array shape (`Array.isArray(parsed) ? { entries:
parsed, closed: false } : parsed`) so a room that is mid-hand across a deploy does
not crash. `buildView` keeps sending `trick: entries` — `RoomView` is unchanged
except for the new money fields, so the client needs no extra branch.

**Sorted combos (feedback 8).** Sort with `sortHand` from `@samloc/rules` when the
entry is created in `nextTrick`. Storing sorted (rather than sorting on the
client) also fixes the flight animation and the result modal in one place.

**Thối 2 events (feedback 1).** Add `{ type: 'thoi2'; seat: number; count: number;
amount: number }` to `GameEvent` in `packages/rules/src/state.ts`. `endHand` calls
`thoi2Counts(state)` and broadcasts one event per paying seat *before* the
snapshot that flips the room to `hand-end`, so the tag is already floating while
the client's result-modal delay (phase 3) runs.

**Late join (feedback 7).** `handleJoin` drops the `status === 'playing'` refusal
and only keeps the capacity check. Consequences, all already safe:

- `buildView`: `state.players[seat]` is `undefined` for a seat beyond the dealt
  set → `cardCount: 0`, `hand: []`. The client shows a spectator banner (phase 4).
- `applyGameAction`: a spectator's seat is never `turnSeat`, so any action is
  rejected by the existing checks.
- `settle` / `addTotals`: `deltas` is indexed by the dealt seats only; the extra
  seat gets nothing.
- `handleStart` already runs `removeDisconnectedSeats` + `compactSeats` before
  `beginHand`, so the spectator is dealt in on the next hand.
- Capacity: `seats.length >= room.max_players` still refuses, so ≤5 seats hold.

**Auto-ready (feedback 9).** `RoomStore.addSeat` inserts `ready = 1`. The waiting
screen keeps its toggle so a player can un-ready deliberately. `resetReady()` at
deal time is unchanged — it runs after `handleStart` has already validated, and
the re-ready happens through the next join/ready message.

> Check while implementing: with `resetReady()` firing at each deal, everyone is
> un-ready at `hand-end`. `handleStart` only enforces readiness when
> `status === 'waiting'`, so "Ván tiếp" is unaffected. If a room ever returns to
> `waiting`, re-set ready on the seats that are still connected.

**Money (feedback 2).** `budgetFor` moves out of `routes-auth.ts` into
`apps/worker/src/budget.ts` (exported `STARTING_BUDGET` + `budgetFor`), imported
by `routes-auth.ts` and `routes-ws.ts`. The WS upgrade route resolves the user's
budget and passes it as `x-budget`; `RoomDO.fetch` puts it in the socket
attachment (`Who.budget`); `handleJoin` stores it on the seat as `budget_base`
when the seat is created.

Displayed money = `budget_base + total_la * stake_per_la`. No double counting:
a seat starts with `total_la = 0`, and `budget_base` is the D1 figure at that
moment, which already contains every hand written so far.

Seat schema: `budget_base INTEGER NOT NULL DEFAULT 0`. `CREATE TABLE IF NOT
EXISTS` will not add the column to a room created before the deploy, so
`ensureSchema` follows the create with a guarded
`ALTER TABLE seats ADD COLUMN budget_base INTEGER NOT NULL DEFAULT 0` wrapped in
try/catch (SQLite has no `ADD COLUMN IF NOT EXISTS`; a duplicate-column error is
the expected no-op). If that error turns out not to be catchable inside
`sql.exec`, fall back to `PRAGMA table_info(seats)` and only run the `ALTER` when
the column is missing.

Wire types:
- `SeatView`: add `money: number`, keep `totalLa`.
- `ResultRow`: add `deltaMoney: number` and `moneyAfter: number`, keep
  `deltaLa`/`totalLa` for the session board.
- `buildHandResult(state, seats, deltas, totals, stake)` — it already receives the
  seat rows, so `budget_base` comes from there; only the stake is a new argument.
  `deltaMoney = deltas[seat] * stake`,
  `moneyAfter = seat.budget_base + totals[seat] * stake`.

Hibernation note: a socket that was accepted before this deploy carries a `Who`
attachment without `budget`. Read it as `who.budget ?? 0` so an old socket cannot
throw; the value only matters when a *new* seat row is created.

## Related Code Files

- Modify: `packages/rules/src/reducer-play.ts` (timeout), `src/state.ts` (`thoi2` event)
- Create: `apps/worker/src/budget.ts`
- Modify: `apps/worker/src/routes-auth.ts` (use the shared helper)
- Modify: `apps/worker/src/routes-ws.ts` (budget lookup → `x-budget`)
- Modify: `apps/worker/src/room-do.ts` (`Who.budget`, attachment)
- Modify: `apps/worker/src/room-do-actions.ts` (late join, auto-ready, budget base)
- Modify: `apps/worker/src/room-do-hand.ts` (`parseTrick`, `nextTrick`, `endHand` events)
- Modify: `apps/worker/src/room-do-store.ts` (`budget_base`, schema guard)
- Modify: `apps/worker/src/room-do-view.ts` (`money`, result money fields)
- Modify: `apps/worker/src/ws-types.ts`
- Modify: `apps/worker/tests/room-do-view.test.ts`
- Create: `apps/worker/tests/room-do-trick.test.ts`

## Implementation Steps

1. `packages/rules`: rewrite `applyTimeout` on top of `lowestLegalMove`; add the
   `thoi2` variant to `GameEvent`.
2. `apps/worker/src/budget.ts`: move `STARTING_BUDGET` and `budgetFor` there;
   update `routes-auth.ts` to import them (no behaviour change).
3. `routes-ws.ts`: after the room lookup, `await budgetFor(c.env.DB, user.id)` and
   set `x-budget`. `room-do.ts`: read the header, store it in the attachment.
4. `room-do-store.ts`: add `budget_base` to `SeatRow`, the schema and `addSeat`
   (`ready = 1`, `budget_base = ?`); add the guarded `ALTER TABLE` in
   `ensureSchema`.
5. `room-do-actions.ts`: `handleJoin` no longer refuses `playing`; pass
   `who.budget` into `addSeat`.
6. `room-do-hand.ts`: new `trick_json` shape with legacy tolerance; `nextTrick`
   retention + `sortHand` on stored cards; `endHand` broadcasts `thoi2` events
   before the final `snapshotAll`.
7. `room-do-view.ts`: `money` per seat view; `buildHandResult` takes stake +
   budget bases and fills `deltaMoney` / `moneyAfter`.
8. `ws-types.ts`: the matching type changes, with comments describing the units.
9. Worker tests: trick retention across a `trickEnd`, sorted entry cards, money in
   `buildView`, spectator seat rendering as `cardCount: 0`.

## Success Criteria

- [x] `pnpm test` green (rules + worker).
- [x] A responding seat that holds a beating combo auto-plays at timeout; one that
      does not, passes.
- [x] The winning combo of a trick stays on the table until the next lead.
- [x] `TrickEntry.cards` are ascending regardless of click order.
- [x] A `thoi2` event reaches every client for each paying seat at hand end.
- [x] Joining a room whose status is `playing` seats the player as a spectator and
      the next deal includes them.
- [x] A fresh seat is `ready = 1`.
- [x] `SeatView.money` equals `budget_base + totalLa * stakePerLa`.

## Risk Assessment

- **Double-counted money** if `budget_base` were refreshed on a reconnect. It is
  written only when the seat row is created; a reconnect takes the `mine` branch.
- **D1 write lag**: `writeHandResults` runs in `waitUntil`, so a player who joins
  a second room within the same second may see a budget that is one hand stale.
  Self-corrects on the next join; acceptable.
- **Live rooms across deploy**: the legacy `trick_json` array shape and the
  guarded `ALTER TABLE` keep an in-flight room working.
- **Timeout now plays cards** — a stronger action than passing. It is what the
  user asked for; it can never be illegal because it comes from `legalMoves`.

## Security Considerations

- `x-budget` is set by the Worker on a stub call, like the existing identity
  headers; a browser cannot reach the Durable Object directly.
- Money is derived server-side only; the client never sends it.
- Late join does not widen visibility: `buildView` still fills `hand` for the
  requesting seat alone, and a spectator's `hand` is empty.

## Next Steps

Phase 3 renders `money`, the `thoi2` tag and the retained trick.
