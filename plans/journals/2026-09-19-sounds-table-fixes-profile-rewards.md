---
title: "Sounds, table fixes, profile/avatar, check-in and wheel"
date: 2026-09-19
summary: "Round-4 feedback plan implemented end to end: 8 commits on main, verified with a bot-driven 4-player game"
---

## What happened

Executed `plans/260918-1908-sounds-table-fixes-profile-rewards` (7 phases) as one commit per phase plus a fix commit and a docs commit; pushed `8bdc71a..46ba7e9` to `hoangsxnz/samloc`.

- Web: Báo 1 badge on the avatar, 4-player seats left / top / right, hashed scatter for played combos (`lib/trick-scatter.ts`), Web Audio cue manager (`lib/sound.svelte.ts`) driven by a pure snapshot diff (`lib/sound-cues.ts`), mute toggle, 💕 win line (`result-head.svelte`), Home / Profile screens, `avatar.svelte` everywhere, check-in card and SVG lucky wheel.
- Worker: migrations `0002_profile_avatar.sql`, `0003_coin_grants.sql`; `routes-profile.ts`, `routes-rewards.ts`, `rewards.ts`; `budgetFor()` now adds coin grants; `avatarVer` carried through `x-avatar-ver` → DO seats → `SeatView`.
- Gates: `pnpm typecheck && pnpm test` green (118 + 49 tests), no source file over 200 lines.

## Findings

- D1 hands a BLOB column back as `number[]`, not `ArrayBuffer`. `new Response(number[])` produced an empty 200 body; wrapping in `new Uint8Array(row.avatar_blob)` fixed `GET /api/avatars/:userId`.
- The avatar `<img>` fallback was a boolean `broken` flag, so a newer upload after a failed load never retried. Replaced with `brokenVer` compared against `avatarVer`.
- A 62 px card row centred at y 200 with dy = −30 overlaps the top seats' count row (ends near y 143). `SCATTER_BOX.height` cut from 60 to 40.
- `capture="user"` on the avatar file input forces the camera on phones and hides the gallery; dropped so uploads can come from photos.
- Verification without a second browser identity: three Node bots (`ws` + `@samloc/rules` bundled with esbuild) joined the room and auto-played; a spy on `AudioBufferSourceNode.prototype.start` with tone MP3s of distinct durations proved the cue sequence (`shuffle, play…, turn…, win` / `lose`). Tone files were deleted afterwards; the real clips are the user's task.
- `ak journal create` fails on this mount with `journals: rename: invalid argument` (same filesystem quirk as `sed -i` permission warnings); this file was written directly.

## Decision

Kept the plan's design; the four deviations above are recorded in the plan's Execution Log.

## Next steps

- User adds the six MP3s to `apps/web/public/sounds/`.
- Apply `0002` / `0003` remotely before the next deploy (`wrangler d1 migrations apply samloc-db --remote`).
- Pre-existing cosmetic: the result modal footer clips "…cầm cái ván sau" when four rows push the footer; untouched.
