---
title: "Cook: feedback round 5 — sâm window with Huỷ báo, deal animation, session money chip"
date: 2026-09-19
summary: "Executed all five phases of plans/260919-0747-feedback-round-5-sam-window-deal-animation as five commits; verified with typecheck, 175 tests and a three-player Playwright run"
---

## What happened

Committed the round-4 working tree first (`69345f6`), then one commit per phase:

- Phase 1 ("drop the session board…"): `hand-result-modal.svelte` lost the board, the
  ghost button and its own `collapsed` state; `table-screen.svelte` owns `resultCollapsed`
  and passes `onshowresult` down to `table-top-bar.svelte`, which renders the gold
  "Kết quả" chip inside the scaled bar next to the session chip. The session chip reads
  `formatMoneyDelta(totalLa × stakePerLa)`, green or red.
- Phase 2: profile grid `260px minmax(0, 360px)` + `justify-content: center`; eight wedge
  fills inline on the `<path>`; `lucky-wheel.mp3` (4.34 s, 55 KB, peak −0.4 dB) cut from
  the untracked WAV with ffmpeg; `wheel` sound key; `sound.play('wheel')` on the
  non-reduced spin path.
- Phase 3: `RulesState.samDecisions`, `declineSam` action, `applyDeclineSam`, play rejected
  in the window, `timeout` closes the window without playing. Worker arms 15 s at the deal
  and only re-arms `turn_seconds` once the phase leaves `sam-window`; `SeatView.samChoice`.
  Seven new rules tests, one new view test; two existing tests that played straight out of
  the window now call `closeWindow()` first.
- Phase 4: `room.handStartedAt` stamped when the cue list has `shuffle`; new
  `DealSchedule` class, `deck-stack.svelte`, `deal-flight.svelte`; the surface slices my fan
  and the opponent counts with `dealtFor(seat)` while dealing.
- Phase 5: decision row in `action-bar.svelte` ("Báo sâm? Ns" + Huỷ báo + Báo Sâm),
  badges in `opponent-seat.svelte`, "Đã huỷ báo / Đã báo Sâm" in `me-chip.svelte`,
  `isMyTurn` and the `turn` cue gated on `phase !== 'sam-window'`.

Verification: `pnpm typecheck` 0 errors; rules 125 and worker 50 tests pass. A Playwright
script with three headless contexts (844×390) registered users through `/api/register`,
started a 3-player room and checked every item in the plan's verification lists, including
the deal on the first hand after "Bắt đầu" (the socket is already open, so the transition
waiting → playing is a real cue, not a primed first snapshot), the deal on "Ván tiếp",
a mid-window reload, reduced motion, the early close on the last decision and the ~15 s
deadline close.

## Decisions and deviations

- `table-logic.svelte.ts` reached 225 lines with the plan's deal additions, so the schedule
  lives in `screens/table/deal-schedule.svelte.ts` as `DealSchedule` (`logic.deal`).
- `canDeclareSam` is also false once the seat has decided. The plan kept it unchanged; the
  one-line guard keeps the wire flag honest for any future reader.
- `DealSchedule.start()` falls back to the first seated player when `turnSeat` is null
  (`RoomView.turnSeat` is nullable; the rules state always has a lead).
- The "Sẵn sàng" button in the waiting room is already toggled on for a freshly joined
  seat (`addSeat` inserts `ready = 1`); the test script had to use exact button matching.
  Pre-existing behaviour, untouched.
- `.orca/` in the working tree is a tool directory and was left out of every commit.

## Open

- Real phone: confirm the deal animation and the shuffle clip end together, and that the
  10 s countdown reads sensibly after the ~5 s deal on a slow connection.
- `plans/journals/…-plan-feedback-round-5…` and this journal are uncommitted alongside the
  plan directory; commit with `docs:` when ready.
