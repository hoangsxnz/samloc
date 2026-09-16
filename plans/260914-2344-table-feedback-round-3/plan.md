---
title: "Table feedback round 3: rules, late join, money, hints, result screen"
description: >-
  Fifteen user-reported changes on the shipped game: low straights (A-2-3 /
  2-3-4), thối 2 tags, money instead of ±lá, everyone auto-plays on timeout,
  played cards staying on the table, mid-session join, sorted combo display,
  auto-ready, play hints + hand re-sort, flat hand row, emoji bubble z-order,
  table colour presets, and a compact result screen with a guest exit button.
status: completed
priority: P1
branch: "main"
tags: [rules, worker, web, ui, ws]
blockedBy: []
blocks: []
created: "2026-09-14T16:54:24.161Z"
createdBy: "ck:plan"
source: skill
---

# Table feedback round 3: rules, late join, money, hints, result screen

## Overview

Fifteen feedback items on the shipped app. Grouped by layer so each phase owns a
disjoint file set: rules engine → worker → web table → web result/options → verify.

Decisions confirmed by the user (2026-09-14):

- **Money** = real budget (10.000 start + Σ lá×stake from D1), not session-only lá.
- **Thối 2** = floating tag on the offender's seat when the hand ends.
- **Low straights**: 2 counts as lowest → `A-2-3 < 2-3-4 < 3-4-5`. `K-A-2` stays illegal.
- **Timeout**: *everyone* auto-plays their lowest legal move, not just the leader.

Feedback → phase map:

| # | Feedback | Phase |
|---|----------|-------|
| 1 | No thối 2 announcement | 2 |
| 2 | Show money left, drop ±lá | 2, 3, 4 |
| 3 | Emoji bubble hidden behind the emoji button | 3 |
| 4 | Table colour options | 4 |
| 5 | Played cards not visible / result modal too fast | 2, 3 |
| 6 | Timeout must auto-play for everyone | 1, 2 |
| 7 | Late joiner can only spectate | 2, 4 |
| 8 | Combo shown in click order (543 not 345) | 2 |
| 9 | Auto-ready on join | 2 |
| 10 | Play hints + re-sort hand button | 1, 3 |
| 11 | Allow A-2-3 / 2-3-4, forbid K-A-2 | 1, 5 |
| 12 | Flat hand row instead of an arc | 3 |
| 13 | Result screen: vertical text, cards need scrolling | 4 |
| 14 | No exit button for guests on the result screen | 4 |

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Rules engine — low straights and legal moves](./phase-01-rules-engine-low-straights-and-legal-moves.md) | Completed |
| 2 | [Server — timeout / trick / late join / money](./phase-02-server-timeout-trick-late-join-money.md) | Completed |
| 3 | [Web — hand fan / hints / emoji / money](./phase-03-web-hand-fan-hints-emoji-money.md) | Completed |
| 4 | [Web — result screen and table options](./phase-04-web-result-screen-and-table-options.md) | Completed |
| 5 | [Verify and docs](./phase-05-verify-and-docs.md) | Completed |

## Validation Log

### Session 1 — 2026-09-15

#### Verification Results
- Claims checked: 24 | Verified: 22 | Failed: 1 | Unverified: 1
- Tier: Full (5 phases)
- Failure: `packages/rules/tests/reducer-turn-flow.test.ts:128` — the test
  "timeout while responding auto-passes" asserts exactly the behaviour phase 2
  reverses. It must be rewritten, not merely supplemented. Recorded in phase 2.
- Unverified: `ALTER TABLE seats ADD COLUMN` on Durable Object SQLite storage.
  Plan uses a guarded try/catch; `PRAGMA table_info(seats)` is the alternative if
  the duplicate-column error turns out not to be catchable.
- Root cause confirmed for "played cards not showing": `room-do-hand.ts:78`
  resets the trick to `[]` on `trickEnd`, so the winning combo disappears the
  moment the last opponent passes.

#### Decisions
1. **Timeout in a báo sâm hand** — auto-play applies to everyone, including
   non-declarers. Accepted consequence: an absent player can auto-block a sâm,
   making the declarer pay 20 lá per player. Chosen for consistency.
2. **Hints** — gold outline on cards that belong to a legal play; no dimming.
   Tapping a highlighted card selects the whole suggested combo, not just the
   card. No separate "Gợi ý" button; "Xếp bài" stays.
3. **Result delay** — 1.8 s, tap anywhere to show immediately.
4. **Result rows** — no thối 2 / cóng breakdown line; the floating table tag is
   enough, and the row space is needed for 5 players.

#### Whole-Plan Consistency Sweep
- Re-read `plan.md` and all five phase files after propagation.
- Reconciled: hint design in phase 3 (outline + combo tap, "Gợi ý" button
  removed), the rewritten timeout test in phases 1–2, the sâm consequence in
  phases 1, 2 and 5, `buildHandResult` signature in phase 2, and the explicit
  "no breakdown line" note in phase 4.
- Unresolved contradictions: none.

## Dependencies

- Phase 2 depends on phase 1 (`lowestLegalMove`, `thoi2Counts`, wrap straights).
- Phase 3 depends on phases 1–2 (`legalMoves` for hints, `money` in `SeatView`).
- Phase 4 depends on phase 2 (`ResultRow` money fields, late-join spectator state).
- Phase 5 runs last.
- No cross-plan blockers: `plans/260914-1317-sam-loc-online`,
  `plans/260914-1722-budget-and-table-ui-compaction` and
  `plans/260914-1857-table-ux-and-emoji-reactions` are all completed.
