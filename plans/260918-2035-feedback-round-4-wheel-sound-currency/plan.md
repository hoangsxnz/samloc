---
title: "Feedback round 4: played-card name, wheel on phone, sound on touch, smaller result board, $ currency"
description: "Five small web fixes from play-testing on a phone: drop the player name under the played combo, fix the lucky-wheel modal layout on phone Safari, make sound cues unlock from touch input, shrink the post-hand result board, and show money as $10,000."
status: done
priority: P1
effort: 3h
branch: main
tags: [bugfix, frontend, ui]
blockedBy: []
blocks: []
created: 2026-09-19
---

# Feedback round 4: played-card name, wheel on phone, sound on touch, smaller result board, $ currency

## Overview

Play-testing on a phone (landscape Safari, `samloc.daylahoangson.workers.dev`)
produced five pieces of feedback. All five are web-only apart from the wheel
wedge labels, which live in the worker. No rules, wire types or D1 changes.

| # | Feedback | Cause found while scouting | Phase |
|---|----------|----------------------------|-------|
| 1 | Bỏ tên user dưới lá bài đang được đánh | `centre-stack.svelte` renders `.trick-who` under the newest combo | 1 |
| 2 | Giảm size bảng kết quả sau ván | `.result-modal` is `min(820px, 100vw - 32px)` — the whole phone screen | 1 |
| 3 | Chưa có sound | `app.svelte` unlocks audio on `pointerdown` `{ once: true }`; a touch `pointerdown` is not an activation-triggering event, so `AudioContext.resume()` stays `suspended` forever on phones | 2 |
| 4 | Sửa màn hình vòng quay trên điện thoại | `.wheel` is sized with `height: 100%` + `aspect-ratio` inside an `auto` grid column; phone Safari resolves that column to ~0 and the 300px SVG paints over the copy column (screenshot) | 3 |
| 5 | Đổi đơn vị tiền tệ từ ₫ sang $ | `format-money.ts` emits `10.000đ`; wheel labels in `rewards.ts` are `1.000` style | 4 |

Decisions taken with the user before planning:

- Money renders as **`$10,000`** (`$` prefix, `en-US` grouping); deltas as
  `+$500` / `−$500`; wheel wedge labels become `1,000` / `2,000` / `10,000`
  (no `$` on the wedge).
- The result board shrinks **one notch**: max width 640px, title one size
  smaller, tighter rows and 40px footer buttons. Losers' remaining cards stay
  visible.

Non-goals: no change to the rules engine, wire types, D1, the orientation
lock, or the sound clips themselves.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | No player name under the played combo in the centre of the table | P2 |
| 2 | Result board ≤ 640px wide, visibly smaller on a phone, no vertical scroll for 2–5 players at 844×390 | P1 |
| 3 | Sound cues audible on Android Chrome and iOS Safari after the first tap (ringer on) | P1 |
| 4 | Wheel modal on phone landscape: wheel on the left, copy and buttons on the right, nothing overlapping | P1 |
| 5 | Every money string in the app reads `$10,000` style; wheel labels match | P1 |

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Table: drop the played-card name, shrink the result board](./phase-01-web-table-name-and-result-size.md) | Done |
| 2 | [Sound: unlock from touch input](./phase-02-web-sound-unlock-on-touch.md) | Done |
| 3 | [Wheel modal: explicit wheel size on phone](./phase-03-web-wheel-modal-phone-layout.md) | Done |
| 4 | [Currency: `$10,000` everywhere](./phase-04-currency-dollar.md) | Done |

Phases are independent (disjoint files); run in any order or together.

## File ownership

| Phase | Files |
|-------|-------|
| 1 | `apps/web/src/components/centre-stack.svelte`, `apps/web/src/screens/table/table-surface.svelte`, `apps/web/src/screens/table/hand-result-modal.svelte`, `apps/web/src/screens/table/result-head.svelte`, `apps/web/src/screens/table/result-row.svelte` |
| 2 | `apps/web/src/lib/sound.svelte.ts`, `apps/web/src/app.svelte`, `docs/codebase-summary.md` (line 126 only) |
| 3 | `apps/web/src/components/wheel-modal.svelte` |
| 4 | `apps/web/src/lib/format-money.ts`, `apps/worker/src/rewards.ts`, `docs/codebase-summary.md` (line 131 only) |

## Success Criteria

- [x] Centre stack shows only cards; `nameFor` / `seats` prop removed from `centre-stack.svelte`.
- [x] Result modal: `width: min(640px, calc(100vw - 32px))`, title `--fs-lg`, footer buttons 40px; 2, 4 and 5-player results fit at 844×390 without scrolling.
- [ ] After one tap on a touch device the `AudioContext` is `running`; cues play on Android Chrome and iOS Safari with the ringer on; desktop mouse and keyboard still unlock.
- [x] Wheel modal at 844×390 and 667×375: wheel ≤ 300px on the left, copy column on the right, no overlap; spin still lands on the server wedge.
- [x] `formatMoney(10000) === '$10,000'`, `formatMoneyDelta(-500) === '−$500'`; wheel labels `200 … 10,000`; no `đ` left in `apps/web/src` or wheel labels.
- [x] `pnpm typecheck && pnpm test` pass.

## Verification (whole plan)

```bash
pnpm typecheck && pnpm test
grep -rn "đ\b\|[0-9]đ" apps/web/src --include=*.svelte --include=*.ts   # expect no money strings
pnpm dev --host   # then open on a real phone in landscape: table, result, wheel, sound
```

Chrome device emulation (iPhone 12 landscape 844×390, iPhone SE 667×375 with
touch) covers phases 1, 3 and 4. Phase 2 needs a real phone or emulated touch
to observe the activation rule.

## Risks

- **iOS ringer switch**: Web Audio is silenced by the silent switch even when
  unlocked. If sound is still missing after phase 2 with the ringer on, the
  follow-up is to play cues through `HTMLAudioElement` instead of
  `AudioContext`. Out of scope here.
- The wheel bug was only seen on phone Safari; Chrome emulation may not
  reproduce the collapsed column. Phase 3 is verified by explicit sizing, not
  by reproducing the bug.

<!-- slug: feedback-round-4-wheel-sound-currency -->
