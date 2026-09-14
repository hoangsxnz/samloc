---
title: "Numeric room code, table UX fixes and emoji reactions"
description: >-
  Six user-reported changes to the shipped table UI: 6-digit room codes, fix
  cards covering the timer and "Bỏ lượt", my timer merged into my avatar,
  fly-to-centre play animation, larger opponent card backs, non-overlapping
  heart pips, and emoji reactions between players.
status: completed
priority: P1
branch: "main"
tags: [web, worker, ui, svelte, ws]
blockedBy: []
blocks: []
created: "2026-09-14T12:02:56.896Z"
createdBy: "ck:plan"
source: skill
---

# Numeric room code, table UX fixes and emoji reactions

## Overview

Six changes requested on the shipped app (`plans/260914-1317-sam-loc-online`, `plans/260914-1722-budget-and-table-ui-compaction`):

1. Room code = 6 digits, no letters.
2. Cards overlap the turn timer and the "Bỏ lượt" button when the hand is full; my timer moves into my avatar like opponents'.
3. Cards fly from the player to the centre when played.
4. Opponent card-back token slightly larger.
5. ♥/♦ corner pip and centre pip touch on card faces.
6. Player interaction: emoji reactions.

### Locked decisions (user-confirmed 2026-09-14)

| Decision | Choice | Consequence |
|---|---|---|
| Room code compat | Hard cut: `isRoomCode()` accepts 6 digits only | Existing alphanumeric codes in `room_sessions` become 404 — open rooms and history join links break. User accepted. |
| Interaction scope | **Emoji only**, no text chat | User asked for "chat tổng" in the original message, then chose emoji-only when the trade-off was presented. Free-text chat is out of scope for this plan. |
| Fly animation | Both my plays and opponents' plays | Opponent cards fly from their avatar, mine from the fan. |

### Constraint carried from the previous plan

`260914-1722` deliberately *shrank* opponent seat elements so the seat column
(top 48) does not collide with the top bar (bottom ~42) or the centre stack
(top 150). Phase 2 grows the card back again and must keep the column bottom
edge above y=150 in the 844×390 design frame.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Numeric room code](./phase-01-numeric-room-code.md) | Completed |
| 2 | [Card face and opponent card size](./phase-02-card-face-and-opponent-card-size.md) | Completed |
| 3 | [Bottom layout and timer in avatar](./phase-03-bottom-layout-and-timer-in-avatar.md) | Completed |
| 4 | [Card fly-to-centre animation](./phase-04-card-fly-to-centre-animation.md) | Completed |
| 5 | [Emoji reactions](./phase-05-emoji-reactions.md) | Completed |
| 6 | [Docs and verification](./phase-06-docs-and-verification.md) | Completed |

Phases 1, 2 and 5 are independent. Phase 4 depends on phase 3 (both edit
`lib/table-layout.ts`). Phase 6 runs last.

## Dependencies

- No cross-plan blockers. Supersedes the opponent-seat sizing choice made in
  `260914-1722` phase 2 (user-requested reversal, see constraint above).
