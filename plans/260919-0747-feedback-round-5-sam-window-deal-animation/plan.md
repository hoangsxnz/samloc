---
title: "Feedback round 5: sâm window with Huỷ báo, deal animation, session money badge, wheel colours and sound"
description: "Seven pieces of phone play-testing feedback: drop the session board button, show the session money swing in the top bar, centre the profile boxes, colour the wheel and give it a spin sound, stop the collapsed result chip covering the menu, animate the deal for the length of shuffle.mp3, and gate the first play behind an explicit Huỷ báo / Báo Sâm decision from every seat."
status: completed
priority: P1
effort: 7h
branch: main
tags: [bugfix, feature, frontend, backend, rules]
blockedBy: []
blocks: []
created: 2026-09-19
---

# Feedback round 5: sâm window with Huỷ báo, deal animation, session money badge, wheel colours and sound

## Overview

Seven items from play-testing on a phone. Five are web-only; the sâm change
touches the rules engine, the Durable Object and the wire types; the deal
animation is client-only but interacts with the sâm window timing.

| # | Feedback | Cause found while scouting | Phase |
|---|----------|----------------------------|-------|
| 1 | Bỏ hẳn "Bảng điểm phiên" (che tên người cầm cái ván sau) | `hand-result-modal.svelte:53-60` renders the ghost button first in `.result-foot`; on a phone the status text gets ellipsised | 1 |
| 2 | Badge +/− số lá → +/− số tiền trong phiên | `table-top-bar.svelte:18` shows `mySeat.totalLa`; the money swing is `totalLa × settings.stakePerLa`, already in the view | 1 |
| 5 | Chip "Kết quả" che nút menu khi kết thúc ván | `.result-chip` is `position: fixed; right: max(40px, …)` — the same x as the ≡ button in `table-top-bar.svelte` | 1 |
| 3 | Căn giữa box ảnh và box tên hiển thị | `profile-screen.svelte` grid is `260px 1fr` with a 360px `max-width` on the form: the pair is left-aligned | 2 |
| 4 | Vòng quay nhiều màu + sound khi quay | 8 wedges alternate two fills; no wheel sound key; `lucky-wheel.wav` is 15 s / 4 MB, quiet (peak −11.5 dB), spin is 4 s | 2 |
| 7 | Người cầm cái đánh trước khi người khác kịp báo sâm | `applyPlay` flips `sam-window` → `playing` on the first play; nothing waits for the other seats | 3 → 5 |
| 6 | 5 giây đầu ván: chồng bài ở giữa, chia về từng người hết `shuffle.mp3` (4.6 s) | No deal animation exists; `card-flight.svelte` only flies played combos into the centre | 4 |

Decisions taken with the user before planning:

- The **sâm window is 10 s after the deal animation**: the server deadline is
  15 s from the deal (`SAM_WINDOW_SECONDS = 15`), the client shows the
  Huỷ báo / Báo Sâm buttons and the countdown once its 4.6 s deal animation
  ends. Everyone, including the leader, must press one of the two; the window
  closes early when every seat has decided, otherwise at the deadline.
- The **wheel sound is cut to the 4 s spin**: trimmed to 4.3 s with a fade,
  +9 dB, encoded to MP3; the WAV is not committed.

Assumptions (state them again in the journal if they change):

- "Huỷ báo" is final for the hand: a seat that declined cannot declare
  afterwards. A declaring seat still counts as decided, and lower seats can
  still override it inside the window (existing rule).
- A seat that never presses anything (disconnected, distracted) simply waits
  out the deadline; nothing is auto-declined.
- Rooms already mid-hand when this deploys have a `state_json` without
  `samDecisions`; the readers default it to `[]`.

Non-goals: no change to settlement, D1 schema, the orientation lock, the
result board layout beyond removing the button, or the other five clips.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Result footer: no "Bảng điểm phiên"; "X cầm cái ván sau" fully readable on 844×390 | P1 |
| 2 | Top bar chip reads `+$800` / `−$800` (session swing), not `+11` | P1 |
| 3 | Collapsed "Kết quả" chip sits left of the ≡ button; both tappable | P1 |
| 4 | Profile: avatar box and name box centred as a pair on the screen | P2 |
| 5 | Wheel: 8 distinct wedge fills; a spin plays `wheel` for its 4 s | P2 |
| 6 | Rules: the first card cannot be played while the sâm window is open; the window closes when all seats decided or on timeout | P1 |
| 7 | Table: deck in the centre, one card flying to each seat in turn for ~4.6 s; fan and card counts fill in as cards land | P1 |
| 8 | Table: Huỷ báo / Báo Sâm buttons + 10 s countdown after the deal; "Huỷ báo" / "Báo Sâm" badge on every seat that decided | P1 |

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Result footer, session money chip, result chip in the top bar](./phase-01-web-result-footer-and-top-bar.md) | Completed |
| 2 | [Profile centring, wheel colours and spin sound](./phase-02-web-profile-and-wheel.md) | Completed |
| 3 | [Rules + worker: sâm window closes on everyone's decision or a 15 s deadline](./phase-03-rules-worker-sam-window.md) | Completed |
| 4 | [Table: deal animation for the length of the shuffle clip](./phase-04-web-deal-animation.md) | Completed |
| 5 | [Table: Huỷ báo / Báo Sâm decision UI and seat badges](./phase-05-web-sam-decision-ui.md) | Completed |

Run in order. Phases 1, 2 and 3 are independent of each other; 4 and 5 both
edit `table-logic.svelte.ts`, `table-surface.svelte` and `action-bar.svelte`
and 5 needs the wire types from 3. Commit the working tree from round 4 first
(`git status` shows it uncommitted) so each phase is its own commit.

## File ownership

| Phase | Files |
|-------|-------|
| 1 | `apps/web/src/screens/table/hand-result-modal.svelte`, `apps/web/src/components/table-top-bar.svelte`, `apps/web/src/screens/table/table-screen.svelte`, `apps/web/src/screens/table/table-surface.svelte` (one prop) |
| 2 | `apps/web/src/screens/profile-screen.svelte`, `apps/web/src/components/wheel-modal.svelte`, `apps/web/src/lib/sound.svelte.ts`, `apps/web/public/sounds/lucky-wheel.mp3` (new), `apps/web/public/sounds/lucky-wheel.wav` (delete), `docs/design-guidelines.md` (wheel paragraph) |
| 3 | `packages/rules/src/state.ts`, `packages/rules/src/reducer-sam.ts`, `packages/rules/src/reducer-play.ts`, `packages/rules/tests/reducer-sam.test.ts`, `packages/rules/tests/state-test-helpers.ts`, `apps/worker/src/ws-types.ts`, `apps/worker/src/ws-parse.ts`, `apps/worker/src/room-do-actions.ts`, `apps/worker/src/room-do-hand.ts`, `apps/worker/src/room-do-view.ts`, `apps/worker/tests/room-do-view.test.ts`, `docs/game-rules.md` |
| 4 | `apps/web/src/lib/room.svelte.ts`, `apps/web/src/screens/table/table-logic.svelte.ts`, `apps/web/src/components/deal-flight.svelte` (new), `apps/web/src/components/deck-stack.svelte` (new), `apps/web/src/screens/table/table-surface.svelte` |
| 5 | `apps/web/src/lib/room.svelte.ts`, `apps/web/src/lib/sound-cues.ts`, `apps/web/src/screens/table/table-logic.svelte.ts`, `apps/web/src/components/action-bar.svelte`, `apps/web/src/components/opponent-seat.svelte`, `apps/web/src/components/me-chip.svelte`, `apps/web/src/screens/table/table-surface.svelte`, `apps/web/src/screens/table/table-screen.svelte` |
| all | `docs/codebase-summary.md`, `docs/project-changelog.md` (one entry at the end) |

## Success Criteria

- [x] `hand-result-modal.svelte` has no session board, no `showSessionBoard`, no `formatMoney` import; the footer is status + Rời phòng (+ Ván tiếp).
- [x] Top bar chip shows `formatMoneyDelta(totalLa × stakePerLa)`; `+11` never appears.
- [x] With the result collapsed, the "Kết quả" chip and the ≡ button are both visible and tappable at 844×390.
- [x] Profile at 844×390 and 1280×720: the two boxes are centred horizontally as a pair.
- [x] Wheel wedges use 8 different fills with ≥ 3:1 contrast against the label; `wheel` cue plays on spin, stops with the spin; `lucky-wheel.mp3` ≤ 100 KB, ≤ 4.4 s; no `.wav` in `apps/web/public/sounds`.
- [x] Rules: `play` during `sam-window` errors; `declineSam` by every seat (or `declareSam` + declines) closes the window; `timeout` during the window closes it without playing a card; `declineSam` twice or after the window errors. Tests cover each.
- [x] Worker: `beginHand` arms a 15 s deadline; declare/decline steps keep that deadline; the alarm closes the window and re-arms `turn_seconds`.
- [x] Table: after "Ván tiếp" a deck appears in the centre and one face-down card flies to each seat in turn for ~4.6 s; my fan and opponent counts reach 10 as the last card lands; reduced motion skips it; a reload mid-deal shows the full hand at once.
- [x] Table: after the deal, "Huỷ báo" and "Báo Sâm" show with a 10 s countdown; a decided seat shows its badge on every client; the leader's "Đánh" stays disabled until the window closes; the `turn` cue fires when it closes, not at the deal.
- [x] `pnpm typecheck && pnpm test` pass; `docs/game-rules.md`, `docs/codebase-summary.md` and `docs/project-changelog.md` updated.

## Execution log (2026-09-19)

All five phases implemented and committed on `main`, one commit per phase after the
round-4 tree was committed first. `pnpm typecheck` clean; rules 125 / worker 50 tests
green. Playwright (three headless contexts at 844×390) confirmed: result footer,
`+$2,000` chip, "Kết quả" chip at x 677–756 with the ≡ button at 768–812; profile pair
centred at 422 / 640 px; eight wedge fills and a 4.3 s buffer started on spin; deck +
flights on both the first hand and "Ván tiếp", counts 6/6/6 at 2.6 s and 10/10/10 with
the decision row at 4.9 s; a reload shows the full hand at once; reduced motion shows
no deck; badges, "Đã huỷ báo" label, override rule, early close on the last decision,
deadline close at ~15 s, and the "Chờ mọi người quyết định báo sâm" toast.

Beyond the plan: `DealSchedule` split into `table/deal-schedule.svelte.ts` (the plan's
additions pushed `table-logic.svelte.ts` past 200 lines); `canDeclareSam` is also false
once the seat has decided, so the wire flag stays honest. A real-phone check of the
deal timing against the shuffle clip is still open.
