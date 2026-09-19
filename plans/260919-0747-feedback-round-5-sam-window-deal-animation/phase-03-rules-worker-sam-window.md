---
phase: 3
title: "Rules + worker: sâm window closes on everyone's decision or a 15 s deadline"
status: completed
priority: P1
effort: "2h"
dependencies: []
---

# Phase 3: Rules + worker: sâm window closes on everyone's decision or a 15 s deadline

## Goal

Nobody can play the first card while the sâm window is open. Each seat
decides with `declineSam` or `declareSam`; the window closes the moment every
seat has decided, or when the server deadline (15 s after the deal: 5 s for
the client deal animation + 10 s to decide) fires.

## Cause

`packages/rules/src/reducer-play.ts:49` — `if (next.phase === 'sam-window') next.phase = 'playing';`
The leader's first play closes the window, and `beginHand`
(`room-do-hand.ts:31-50`) arms the ordinary `turn_seconds` timer straight
away, so on a fast leader the other seats never get to press "Báo Sâm".

## Context

- `packages/rules/src/state.ts` — `RulesState`, `Action`, `applyAction` switch;
  `buildHand` creates the state in `sam-window`.
- `packages/rules/src/reducer-sam.ts` — `applyDeclareSam` (lowest seat wins,
  declarer takes the lead).
- `packages/rules/src/reducer-play.ts:95-102` — `applyTimeout` auto-plays; the
  alarm calls it with `state.turnSeat`.
- `packages/rules/tests/state-test-helpers.ts` — `makeState` builds a
  `playing` state; `reducer-sam.test.ts` uses `SAM_WINDOW` overrides and plays
  straight out of the window in five tests.
- `apps/worker/src/room-do-hand.ts` — `beginHand` → `armAlarm(turn_seconds)`;
  `commitStep` re-arms after every accepted action; `onAlarm` applies
  `timeout` for `state.turnSeat`.
- `apps/worker/src/ws-types.ts` — `ClientMsg` simple types, `SeatView`,
  `RoomView.canDeclareSam`; `ws-parse.ts` `SIMPLE_TYPES`;
  `room-do-actions.ts` routes `declareSam | pass`.
- `apps/worker/src/room-do-view.ts:57-62` — `canDeclareSam`.
- `docs/game-rules.md:39` — the Báo Sâm rule.

## Files to Modify

- `packages/rules/src/state.ts`, `packages/rules/src/reducer-sam.ts`, `packages/rules/src/reducer-play.ts`
- `packages/rules/tests/reducer-sam.test.ts`, `packages/rules/tests/state-test-helpers.ts`
- `apps/worker/src/ws-types.ts`, `apps/worker/src/ws-parse.ts`, `apps/worker/src/room-do-actions.ts`, `apps/worker/src/room-do-hand.ts`, `apps/worker/src/room-do-view.ts`
- `apps/worker/tests/room-do-view.test.ts`
- `docs/game-rules.md`

## Tasks & Steps

### Rules engine

1. `state.ts`: add `export type SamChoice = 'declare' | 'decline';` and
   `samDecisions: { seat: number; choice: SamChoice }[]` to `RulesState` with
   the comment `/** One entry per seat that pressed Báo Sâm or Huỷ báo; the window closes when every seat is here. */`;
   initialise `[]` in `buildHand`; export `SamChoice` from `index.ts`. Add `'declineSam'` to the
   `declareSam | pass | timeout` action union and route it to
   `applyDeclineSam` in `applyAction`.
2. `reducer-sam.ts`:
   - Add private helpers `decided(state, seat)` (reads
     `state.samDecisions ?? []` — rooms dealt before this deploy have no
     field) and `closeWindowIfDecided(next)`: when
     `next.samDecisions.length >= next.players.length` set `next.phase = 'playing'`.
   - `applyDeclareSam`: after the existing checks, reject a seat already
     decided with `'Bạn đã quyết định rồi'`; push `{ seat, choice: 'declare' }`;
     call `closeWindowIfDecided`. A declarer overridden by a lower seat keeps
     its `'declare'` entry — its decision is spent and the badge stays honest.
   - New `applyDeclineSam(state, seat)`: phase must be `sam-window`
     (`'Chỉ huỷ báo trước khi lá bài đầu tiên được đánh'`), seat must exist,
     seat must not already be decided (`'Bạn đã quyết định rồi'`); clone, push
     `{ seat, choice: 'decline' }`, `closeWindowIfDecided`, no events.
3. `reducer-play.ts`:
   - `applyPlay`: replace the `sam-window → playing` line with
     `if (state.phase === 'sam-window') return fail(state, 'Chờ mọi người quyết định báo sâm');`
     (place it right after the `ended` check).
   - `applyTimeout`: before the turn check add
     `if (state.phase === 'sam-window') { const next = cloneState(state); next.phase = 'playing'; return { state: next, events: [] }; }`
     with a comment that the deadline closes the window without playing.
     Note `turnSeat` is already the declarer or the lead, so nothing else moves.
4. Tests (`reducer-sam.test.ts`): add `samDecisions: []` to `makeState`'s
   defaults in `state-test-helpers.ts` and a helper
   `closeWindow(state) => step(state, { type: 'timeout', seat: state.turnSeat }).state`.
   Insert `s = closeWindow(s)` before the first `play` in the five tests that
   play out of `SAM_WINDOW`. Add tests:
   - `play` in the window errors and returns the same state object;
   - `declineSam` from every seat closes the window (`phase === 'playing'`,
     `turnSeat` unchanged);
   - `declareSam` by seat 2, `declineSam` by 0 and 1 → closes with `samSeat 2`, `turnSeat 2`;
   - a declined seat cannot declare; `declineSam` twice errors; `declineSam` in `playing` errors;
   - `timeout` in the window closes it, plays nothing, emits no events;
   - `declineSam` from a seat already overridden as declarer is rejected as decided.

### Worker

5. `ws-types.ts`: add `'declineSam'` to the simple `ClientMsg` union; add
   `samChoice: SamChoice | null` to `SeatView` (import the type from
   `@samloc/rules` and re-export it like `GameEvent`;
   `/** This seat's sâm decision while the window is open; null until it presses. */`).
   Keep `canDeclareSam`.
6. `ws-parse.ts`: add `'declineSam'` to `SIMPLE_TYPES`.
7. `room-do-actions.ts`: extend the `case 'declareSam': case 'pass':` group
   with `case 'declineSam':`.
8. `room-do-view.ts`: in the seat map compute
   `samChoice: (state?.samDecisions ?? []).find((d) => d.seat === s.seat)?.choice ?? null`
   (the `?? []` guards rooms dealt before this deploy).
9. `room-do-hand.ts`:
   - `const SAM_WINDOW_SECONDS = 15;` with the comment
     `/** Deal animation (~5 s) plus 10 s for every seat to press Báo Sâm or Huỷ báo. */`
   - `beginHand`: `armAlarm(host, SAM_WINDOW_SECONDS)` instead of `turn_seconds`.
   - `commitStep`: `if (res.state.phase !== 'sam-window') armAlarm(host, room.turn_seconds);`
     — a declare/decline inside the window keeps the window deadline; the step
     that closes it (last decision or the alarm's `timeout`) arms the turn
     timer.
   - `onAlarm` needs no change: `timeout` for `turnSeat` now closes the window.
10. `apps/worker/tests/room-do-view.test.ts`: extend the existing fixture with
    `samDecisions` and assert `samChoice` for a declared, a declined and an
    undecided seat.
11. `docs/game-rules.md:39`: append to the Báo Sâm bullet: "The window opens
    after the deal; every seat presses Báo Sâm or Huỷ báo. The first card can
    be played only once every seat has decided or 15 s have passed (server
    deadline; the client shows 10 s after its deal animation). Huỷ báo is
    final for the hand."

## Verification

- `pnpm --filter @samloc/rules exec vitest run tests/reducer-sam.test.ts`
- `pnpm typecheck && pnpm test` (rules 118 → ~126 tests, worker 49 → ~50)
- `grep -rn "sam-window" packages/rules/src apps/worker/src` shows the new
  checks and no leftover `next.phase = 'playing'` inside `applyPlay`.
