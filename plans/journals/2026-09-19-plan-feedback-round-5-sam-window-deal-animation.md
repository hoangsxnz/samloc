---
title: "Plan: feedback round 5 — sâm window with Huỷ báo, deal animation, session money chip, wheel colours and sound"
date: 2026-09-19
summary: "Planned seven phone play-testing items into five phases; two decisions taken with the user (sâm window = 10 s after the deal animation, wheel clip cut to the 4 s spin)"
---

## What happened

Planned round 5 of phone play-testing feedback at
`plans/260919-0747-feedback-round-5-sam-window-deal-animation/` (5 phases, ~7 h).

Scouting findings that shaped the plan:

- `packages/rules/src/reducer-play.ts:49` closes the sâm window on the first
  play; nothing waits for the other seats, and `beginHand` arms the ordinary
  turn timer at the deal. That is the "leader plays before anyone can declare"
  bug.
- The collapsed "Kết quả" chip (`hand-result-modal.svelte`) is
  `position: fixed; right: 40px` — the same corner as the ≡ button in
  `table-top-bar.svelte`.
- The session badge shows `totalLa`; the money swing is
  `totalLa × settings.stakePerLa`, already in the view, so no wire change.
- `lucky-wheel.wav` is 15 s / 4 MB, peak −11.5 dB (other cues peak at 0 dB);
  the spin is 4 s. `shuffle.mp3` is 4.608 s — the deal animation length.
- `opponent-seat.svelte` is 185 lines; the plan reuses its `.opp-tag` slot for
  the Huỷ báo badge to stay under 200.

## Decision

- Sâm window: server deadline `SAM_WINDOW_SECONDS = 15` (≈5 s deal animation
  + 10 s to decide); the client shows Huỷ báo / Báo Sâm and a ≤10 s countdown
  after its deal animation. The window closes early when every seat has
  decided. Huỷ báo is final for the hand. Rules state gains
  `samDecisions: { seat, choice }[]`; `SeatView.samChoice` carries the badge;
  new `declineSam` client message.
- Wheel clip: trim to 4.3 s with fade, +9 dB, MP3; the WAV is not committed.
- Deal animation is client-only, keyed off the same `handStarted` transition
  that fires the shuffle cue; a fixed 4.6 s timer, never the audio `ended`
  event (audio may be muted).

## Next steps

- Commit the uncommitted round-4 working tree first, then
  `/ak:cook plans/260919-0747-feedback-round-5-sam-window-deal-animation/plan.md`.
- Phases 1–3 are independent; then 4, then 5 (5 needs the phase-3 wire types).

`ak journal create` failed on this mount (`journals: rename: invalid argument`),
so the file was written directly.
