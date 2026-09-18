---
title: "Game sounds, table layout fixes, profile/avatar, daily check-in and lucky wheel"
description: >-
  Six sound cues (shuffle, play, join, your turn, win with the "Mừng cậu chủ
  thắng lớn 💕" line, lose), three table fixes (Báo 1 badge on the avatar,
  4-player seats at 0/90/180/270, scattered played cards), a Home screen with
  profile management (nickname + uploaded avatar), daily check-in coins and a
  5-spins-a-day lucky wheel.
status: completed
priority: P1
effort: 27h
branch: "main"
tags: [web, worker, ui, ws, database, feature]
blockedBy: []
blocks: []
created: 2026-09-18
---

# Game sounds, table layout fixes, profile/avatar, daily check-in and lucky wheel

## Overview

Feedback round 4 on the shipped game. Grouped by layer so each phase owns a
disjoint file set and the two worker phases land before the screens that call
them. Phases 1 and 2 are web-only and independent of the rest.

Decisions confirmed by the user (2026-09-19):

- **Avatar** = uploaded photo (not a preset gallery). Cropped and resized in the
  browser to 128×128 JPEG, stored as a BLOB in D1, served by the Worker. No R2.
- **Home screen** after login: avatar, name, budget, "Chơi" → lobby, "Hồ sơ" →
  profile, daily check-in card, lucky-wheel button.
- **Rewards**: check-in +1.000 đ/day; wheel segments 200 / 400 / 600 / 1.000 /
  2.000 / 4.000 / 10.000 / "Chúc may mắn" (0); 5 spins a day; day boundary is
  UTC+7.
- **Win/lose sounds**: win when I am `winnerSeat`; lose on every other hand end
  where I was dealt in. Spectators hear neither.

- **Mute toggle** in the table ≡ menu (`localStorage` `samloc.sound`).
- **Wheel weights** 30 / 22 / 16 / 13 / 9 / 5 / 2 / 3 % (expected ≈ 950 đ per spin).
- **Clips**: win = Bomman 8:30–8:34, lose = first 5 s of the second video; the
  user prepares all six MP3s (Epidemic Sound is licence-gated).

Assumptions (not asked, cheap to reverse):

- Coins from check-in and the wheel are a new `coin_grants` table folded into
  `budgetFor()`, so the budget stays a derived value (10.000 + hands + grants)
  and nothing can drift.

Feedback → phase map:

| # | Feedback | Phase |
|---|----------|-------|
| 1 | Sounds: xáo bài, đánh bài, người mới vào bàn, đến lượt, win, lose | 2 |
| 2 | Win line "Mừng cậu chủ thắng lớn 💕" | 2 |
| 3 | "Báo còn 1 lá" too close to the played cards → move into the avatar | 1 |
| 4 | 4-player seats at 0 / 90 / 180 / 270 | 1 |
| 5 | Played cards scattered inside a fixed box at the table centre | 1 |
| 6 | Nickname + avatar, profile screen, Home with Profile / Play buttons | 3, 5 |
| 7 | Daily check-in for coins | 4, 6 |
| 8 | Lucky wheel, tiered coins, 5 spins/day | 4, 6 |

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Table fixes visible on `pnpm dev` with 4 and 5 players | P1 |
| 2 | Six sound cues fire exactly once per event, respect the mute toggle, never throw when a file is missing | P1 |
| 3 | Profile: nickname change and avatar upload persist and show on every seat, row and header | P1 |
| 4 | Check-in once a day and wheel ≤ 5 spins a day, enforced server-side, credited into the budget | P1 |
| 5 | `pnpm typecheck && pnpm test` green; docs updated | P1 |

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Web: table layout fixes](./phase-01-web-table-layout-fixes.md) | Completed |
| 2 | [Web: sounds and the win line](./phase-02-web-sounds-and-win-line.md) | Completed |
| 3 | [Worker: profile and avatar](./phase-03-worker-profile-and-avatar.md) | Completed |
| 4 | [Worker: daily check-in and wheel](./phase-04-worker-daily-checkin-and-wheel.md) | Completed |
| 5 | [Web: Home, profile screen, avatar everywhere](./phase-05-web-home-profile-avatar.md) | Completed |
| 6 | [Web: check-in card and wheel UI](./phase-06-web-checkin-and-wheel-ui.md) | Completed |
| 7 | [Verify and docs](./phase-07-verify-and-docs.md) | Completed |

Dependencies: 1 and 2 are independent of each other. 3 → 4 (shared migration numbering and
`index.ts` mounts). 1, 2, 3 → 5 (5 edits files 1 and 2 touch). 4 and 5 → 6. Everything → 7.

## Architecture

```
Browser (Svelte 5)                         Worker (Hono)                     D1
─────────────────                          ─────────────                     ──
Home ──── GET /api/rewards ───────────────▶ routes-rewards.ts ──────────────▶ coin_grants
      ─── POST /api/checkin, /api/spin ──▶   (day key UTC+7, weighted pick)   (user_id, kind, amount, day)
Profile ─ PATCH /api/me {displayName} ───▶ routes-profile.ts ──────────────▶ users.display_name
      ─── PUT /api/me/avatar (jpeg) ─────▶   (magic bytes, ≤ 64 KB)          users.avatar_blob, avatar_ver
<img src=/api/avatars/:id?v=ver> ────────▶ GET /api/avatars/:userId (cache immutable)

budgetFor() = 10.000 + Σ hand_results×stake + Σ coin_grants.amount   → /api/me, /ws upgrade, seats.budget_base

/ws/:code headers: + x-avatar-ver ──▶ RoomDO seats.avatar_ver ──▶ SeatView.avatarVer ──▶ <Avatar/> on seats/rows

room.svelte.ts onSnapshot(prev, next) ──▶ soundCuesFor(prev, next) ──▶ sound.play(key)
```

## Success Criteria

- [x] Báo 1 renders as a red badge on the opponent avatar; no pill or floating tag below the seat.
- [x] 4 players: opponents at left / top-centre / right; 2, 3 and 5 unchanged.
- [x] Each played combo lands at a deterministic scattered position inside a 120×40 box; the flight animation lands on the same spot.
- [x] Sounds: shuffle on hand start, play on every trick entry, join when a seat appears, turn when it becomes mine, win/lose at hand end; none on the first snapshot after connect; mute toggle persists.
- [x] Result modal shows "Mừng cậu chủ thắng lớn 💕" when I won.
- [x] Nickname change and avatar upload persist across reload and show in lobby, waiting room, table seats, me-chip and result rows.
- [x] Second check-in in a day returns 409; sixth spin returns 429; budget on `/api/me` includes grants.
- [x] Wheel animation lands on the server-chosen segment.
- [x] `pnpm typecheck && pnpm test` pass; all touched files ≤ 200 lines.

## Validation Log

### Session 1 — 2026-09-19 (before drafting)

- Avatar: **upload photo** (browser crop to 128×128 JPEG, D1 BLOB) over a preset gallery.
- Check-in and wheel live on a new **Home** screen after login; lobby unchanged apart from a ⌂ button.
- Rewards: check-in **+1.000**, wheel **200 → 10.000** with a 0 wedge.
- Sounds: win = I am `winnerSeat`; lose = every other hand end where I was dealt in.

### Session 2 — 2026-09-19 (after drafting)

- Mute toggle in the table menu: **yes**.
- Wheel weights 30/22/16/13/9/5/2/3: **confirmed**.
- Clips: win **8:30–8:34**, lose **0:00–0:05**; user prepares the files.

### Verification Results

- Claims checked: 12 file:line citations across phases 1, 2, 3, 5 (grep against source).
- Verified: 12 | Failed: 0 | Unverified: 0 (three line numbers corrected during the sweep).
- Tier: Full (7 phases).

### Whole-Plan Consistency Sweep

- Phase 5 depends on 1, 2, 3 because it edits `table-surface.svelte`, `hand-result-modal.svelte` and `result-head.svelte`, which phases 1 and 2 create or touch; recorded in frontmatter and the dependency line.
- `avatarVer` name used identically in `ws-types.ts`, `SessionUser`, `AuthUser`, `avatar.svelte` and the `x-avatar-ver` header.
- Reward amounts and weights appear once in `rewards.ts`; the client reads segment labels from `/api/rewards`.
- No unresolved contradictions.

<!-- slug: sounds-table-fixes-profile-rewards -->

## Execution Log

### 2026-09-19 — implemented (phases 1–7)

- All seven phases landed as one commit each on `main`; `pnpm typecheck && pnpm test` green (118 rules + 49 worker tests); no source file over 200 lines.
- Smoke on `pnpm dev` with three WebSocket bots: 4-player seats left / top / right, scattered combos, Báo 1 badge (aria-live "Báo 1", no pill/tag), cue sequence `shuffle, play…, turn…, win` on the winner and `…lose` on a loser, 💕 line on the winner only, mute persists across reload, check-in 409 on repeat, six spins → 5×200 then 429, concurrent spins → one 200 + one 429, avatar upload of a 3000×4000 JPEG → 128×128 ≤ 64 KB, PNG and 70 KB bodies rejected.
- Deviations from the plan: `SCATTER_BOX.height` is 40 (not 60) so a 62 px card row stays clear of the top seats' count row; the profile file input has no `capture="user"` so phones offer the gallery as well as the camera; D1 returns BLOBs as `number[]`, so the avatar route wraps it in a `Uint8Array`.
- Not done: the six MP3 clips (user-supplied); remote migrations `0002` / `0003` before the next deploy.
