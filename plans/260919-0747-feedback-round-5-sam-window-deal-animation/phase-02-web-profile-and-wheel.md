---
phase: 2
title: "Profile centring, wheel colours and spin sound"
status: completed
priority: P2
effort: "1h"
dependencies: []
---

# Phase 2: Profile centring, wheel colours and spin sound

## Goal

The profile boxes sit centred as a pair, the lucky wheel has eight distinct
wedge colours, and a spin plays a 4 s sound clip through the existing
`sound` singleton.

## Context

- `apps/web/src/screens/profile-screen.svelte:70-82` — `.profile-cols` is
  `grid-template-columns: 260px 1fr` and `.profile-name` caps itself at
  `max-width: 360px`; the grid fills the width, so the pair hugs the left
  (screenshot 3). `.screen` already pads 40 px each side (`app.css:95`).
- `apps/web/src/components/wheel-modal.svelte:62-64,113-120` — wedges are
  `<path class="wedge" class:alt={i % 2 === 1}>` with two fills. Labels are
  `var(--text)` (near white) at 13 px / 700.
- `apps/web/src/lib/sound.svelte.ts` — `SoundKey` union, `SOUND_KEYS`,
  `SOUND_FILES`; `play(key)` is fire-and-forget and returns nothing, so a
  clip cannot be stopped. The wheel clip must therefore already be spin-length.
- `apps/web/public/sounds/lucky-wheel.wav` — 14.9 s, stereo 44.1 kHz, 4 MB,
  mean −38 dB / peak −11.5 dB (the other cues peak at 0 dB). Not tracked by git
  yet (`??` in `git status`). Spin is `SPIN_MS = 4000`, fallback 4300.
- `docs/design-guidelines.md:97` documents the wheel as "8 wedges alternating
  `--surface-2` / `--felt-light`".

## Files

- Modify: `apps/web/src/screens/profile-screen.svelte`
- Modify: `apps/web/src/components/wheel-modal.svelte`
- Modify: `apps/web/src/lib/sound.svelte.ts`
- Create: `apps/web/public/sounds/lucky-wheel.mp3`
- Delete: `apps/web/public/sounds/lucky-wheel.wav` (untracked; just remove it)
- Modify: `docs/design-guidelines.md` (wheel paragraph only)

## Tasks & Steps

1. **Profile**: change `.profile-cols` to
   `grid-template-columns: 260px minmax(0, 360px); justify-content: center;`
   and drop `max-width: 360px` from `.profile-name` (the column now bounds it).
   `align-content: center` stays for the vertical axis.
2. **Wheel colours**: in `wheel-modal.svelte` replace `class:alt` with a fill
   per wedge index: add
   `const WEDGE_FILLS = ['#b8232c', '#a8862a', '#1f6f8b', '#2e7d32', '#7b3fa0', '#c2410c', '#0f766e', '#6b4f1d'] as const;`
   and render `<path d={w.d} class="wedge" style="fill: {WEDGE_FILLS[i % WEDGE_FILLS.length] ?? WEDGE_FILLS[0]}" />`
   (`noUncheckedIndexedAccess` types the modulo index as `string | undefined`; the
   tuple's `[0]` is exact).
   Remove the `.wedge.alt` rule and the `fill` from `.wedge` (keep the gold
   stroke). Labels stay `var(--text)`; the list deliberately uses the darker
   gold (`--gold-dark`) and a dark orange so every fill keeps ≥ 3:1 against
   the white label without per-wedge label colours.
3. **Clip**: from the repo root run
   ```
   ffmpeg -y -i apps/web/public/sounds/lucky-wheel.wav -t 4.3 \
     -af "volume=9dB,afade=t=out:st=3.8:d=0.5" \
     -ac 1 -codec:a libmp3lame -q:a 5 apps/web/public/sounds/lucky-wheel.mp3
   rm apps/web/public/sounds/lucky-wheel.wav
   ffprobe -v error -show_entries format=duration -of default=nw=1 apps/web/public/sounds/lucky-wheel.mp3
   ```
   Expect `duration≈4.3` and a file well under 100 KB.
4. **Sound key**: in `sound.svelte.ts` add `'wheel'` to `SoundKey`,
   `SOUND_KEYS` and `SOUND_FILES` (`/sounds/lucky-wheel.mp3`). Update the doc
   comment count ("six cues" → "seven").
5. **Play on spin**: in `wheel-modal.svelte` import `sound` from
   `../lib/sound.svelte` and call `sound.play('wheel')` right after
   `rotation = rotationFor(...)` (the non-reduced-motion path only; the
   reduced path finishes instantly). The click that started the spin already
   unlocked audio via `pointerup`.
6. `docs/design-guidelines.md:97`: replace "8 wedges alternating
   `--surface-2` / `--felt-light`" with the eight-colour list and add "spin
   plays `/sounds/lucky-wheel.mp3` (4.3 s)".

## Verification

- `pnpm typecheck`
- `pnpm dev`: `#/profile` at 844×390 and 1280×720 — boxes centred as a pair;
  Home → wheel → Quay: eight colours, sound starts with the spin and ends
  before the result line appears; sound off in the ≡ menu silences it.
- `ls -la apps/web/public/sounds` shows `lucky-wheel.mp3` and no `.wav`.
