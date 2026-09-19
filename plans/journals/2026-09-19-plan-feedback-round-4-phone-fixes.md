---
title: "Plan: feedback round 4 — played-card name, wheel on phone, sound on touch, result board size, $ currency"
date: 2026-09-19
summary: "Planned five phone-feedback fixes; scouting found the sound and wheel root causes before any code change"
---

## What happened

Play-testing on a phone produced five feedback items. Scouting for the plan at
`plans/260918-2035-feedback-round-4-wheel-sound-currency/` found two real root causes:

- **No sound on phones**: `apps/web/src/app.svelte` unlocks the `AudioContext` on
  `pointerdown` with `{ once: true }`. A touch `pointerdown` is not an
  activation-triggering input event (only mouse `pointerdown`, any `pointerup`,
  `touchend`, `click`, `keydown` are), so `resume()` never leaves `suspended` and the
  once-listener never retries. Desktop mouse testing passed, which hid it. The MP3s are
  live (`/sounds/*.mp3` return 200).
- **Wheel modal broken on phone Safari**: `.wheel` is `height: 100%` + `aspect-ratio: 1`
  in an `auto` grid column; the percentage is indefinite during track sizing, the column
  collapses to ~0 and the 300px SVG paints over the copy column.

The other three are straightforward CSS/markup edits (drop `.trick-who` in
`centre-stack.svelte`, shrink `.result-modal` to 640px, `formatMoney` → `$10,000`).

## Decision

- Money format `$10,000` (en-US grouping, `$` prefix); wheel labels `1,000`-style
  without `$`. Confirmed with the user.
- Result board shrinks one notch (640px, `--fs-lg` title, 40px buttons); losers' cards
  stay visible. Confirmed with the user.
- Sound fix listens on `pointerup` + `keydown` persistently; the iOS ringer-switch
  limitation of Web Audio is recorded as a risk, not fixed here.

## Next steps

`/ak:cook plans/260918-2035-feedback-round-4-wheel-sound-currency/plan.md`, then verify
sound and the wheel on a real phone with `pnpm dev --host`.
