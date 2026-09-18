---
phase: 2
title: "Web: sounds and the win line"
status: completed
priority: P1
effort: "4h"
dependencies: []
---

# Phase 2: Web: sounds and the win line

## Goal

Play six sound cues from room snapshot transitions, add a mute toggle, and
show "Mừng cậu chủ thắng lớn 💕" in the result modal when I won.

## Context

- There is no `deal` or `play` `GameEvent` (`packages/rules/src/state.ts:63-69`);
  hand start and every play are visible only as snapshot changes
  (`handNo`, `status`, `trick`). `table-logic.svelte.ts#syncFlight` already
  detects a new trick entry by comparing a `length:seat:cards` key — the cue
  detector uses the same idea, but on `prev → next` snapshots so it lives
  outside the table screen (the join sound must also fire on the waiting screen).
- `apps/web/src/lib/room.svelte.ts:26-28` — `ws.onSnapshot` is the single
  place every snapshot passes through; `this.view` still holds the previous
  snapshot at that moment.
- `apps/web/src/app.svelte:16` registers a one-shot `pointerdown` listener for
  the landscape lock; the audio unlock rides the same gesture.
- `apps/web/src/components/table-menu-sheet.svelte` hosts the felt swatches:
  the sound toggle goes next to them, persisted like `table-theme.svelte.ts`
  (`localStorage`, try/catch).
- `apps/web/src/screens/table/hand-result-modal.svelte` is at 199 lines: the
  header must move into its own component before the celebration line is added.
- Result timing: `table-screen.svelte` shows the modal 1.8 s after hand end.
  The win/lose sound plays at hand end (when the last combo is revealed), the
  line appears with the modal.
- Autoplay policy: iOS Safari only plays audio from an `AudioContext` that was
  resumed inside a user gesture; `new Audio().play()` outside a gesture is
  unreliable there. Use Web Audio with decoded buffers.

## Files to Create / Modify

- Add (user-supplied, committed): `apps/web/public/sounds/shuffle.mp3`, `play.mp3`, `join.mp3`, `turn.mp3`, `win.mp3`, `lose.mp3`
- Create: `apps/web/src/lib/sound.svelte.ts`
- Create: `apps/web/src/lib/sound-cues.ts`
- Create: `apps/web/src/screens/table/result-head.svelte`
- Modify: `apps/web/src/lib/room.svelte.ts`
- Modify: `apps/web/src/app.svelte`
- Modify: `apps/web/src/components/table-menu-sheet.svelte`
- Modify: `apps/web/src/screens/table/hand-result-modal.svelte`
- Modify: `apps/web/src/screens/table/table-screen.svelte`

## Tasks & Steps

1. **Audio assets (user task, before or in parallel with the code)** — place
   six mono MP3s (≤ 5 s each except `win`/`lose` which may run ~5 s, 96 kbps)
   in `apps/web/public/sounds/`:

   | File | Source |
   |---|---|
   | `shuffle.mp3` | https://www.epidemicsound.com/sound-effects/tracks/5930ade2-8fc5-40e8-bf5b-4ac26e5b59c8/ |
   | `play.mp3` | https://www.epidemicsound.com/sound-effects/tracks/3635a0d7-2078-408b-86d9-29b89619bec0/ |
   | `join.mp3` | https://www.epidemicsound.com/sound-effects/tracks/d09c867f-6830-4e92-addc-532c7c551a46/ |
   | `turn.mp3` | https://www.epidemicsound.com/sound-effects/tracks/ae2ef60a-b88b-4f2b-838e-d59cee17d63d/ |
   | `win.mp3` | Bomman clip 8:30–8:34 — https://www.youtube.com/watch?v=Q48KZ83IPYw |
   | `lose.mp3` | first 5 s of https://www.youtube.com/watch?v=yJxCdh1Ps48 |

   Epidemic Sound downloads need the user's account (keep the licence for the
   account). Convert / trim with:
   ```
   ffmpeg -i in.wav -ac 1 -b:a 96k shuffle.mp3
   yt-dlp -x --audio-format mp3 --download-sections "*8:30-8:34" -o win.%(ext)s "https://www.youtube.com/watch?v=Q48KZ83IPYw"
   yt-dlp -x --audio-format mp3 --download-sections "*0:00-0:05" -o lose.%(ext)s "https://www.youtube.com/watch?v=yJxCdh1Ps48"
   ffmpeg -i win.mp3 -ac 1 -b:a 96k -af "afade=t=out:st=3.5:d=0.5" win-trimmed.mp3
   ```
   The code must not depend on the files existing: a 404 leaves that cue silent.
2. **`sound.svelte.ts`** — `SoundKey = 'shuffle' | 'play' | 'join' | 'turn' | 'win' | 'lose'`,
   `SOUND_FILES: Record<SoundKey, string>` (`/sounds/<key>.mp3`). Class
   `SoundManager` (export `sound` singleton):
   - `enabled = $state(load())` from `localStorage` `samloc.sound` (`'off'` → false, default true), `set(enabled)` persists (try/catch like `table-theme.svelte.ts`).
   - `unlock()` — idempotent; creates the `AudioContext`, calls `resume()`, then starts fetching and `decodeAudioData` for the six files into a `Map<SoundKey, AudioBuffer | null>`; a failed fetch or decode stores `null`.
   - `play(key)` — no-op when `!enabled`, no context, or buffer `null`/not yet loaded; otherwise `BufferSource → destination`, `start()`. Overlapping plays are fine (new source each time).
   - The whole file stays under ~90 lines.
3. **`sound-cues.ts`** (pure, no runes) — `soundCuesFor(prev: RoomView, next: RoomView): SoundKey[]`:
   - `shuffle`: `next.status === 'playing' && (prev.status !== 'playing' || prev.handNo !== next.handNo)`.
   - `play`: `next.trick.length > 0` and `trickKey(next) !== trickKey(prev)` where `trickKey = length:seat:cards` of the last entry; suppressed when `shuffle` fires in the same snapshot.
   - `join`: some `next.seats[].userId` not present in `prev.seats` and `!== next.youSeat`'s user.
   - `turn`: `next.turnSeat === next.youSeat && next.youSeat >= 0 && (prev.turnSeat !== prev.youSeat || prev.handNo !== next.handNo)`.
   - `win` / `lose`: `next.status === 'hand-end' && next.result && (prev.status !== 'hand-end' || prev.result?.handNo !== next.result.handNo)`; `win` when `next.result.winnerSeat === next.youSeat`, else `lose` when `next.result.rows.some(r => r.seat === next.youSeat)` (spectators stay silent).
4. **Hook** — `room.svelte.ts`: in the constructor
   ```ts
   this.ws.onSnapshot = (view) => {
     const prev = this.view;
     this.view = view;
     if (prev) for (const key of soundCuesFor(prev, view)) sound.play(key);
   };
   ```
   Nothing on the first snapshot after `connect()` (a reconnect or a route
   change must not replay history).
5. **Unlock** — `app.svelte` `onMount`: add
   `document.addEventListener('pointerdown', () => sound.unlock(), { once: true })`
   next to the landscape-lock listener.
6. **Mute toggle** — `table-menu-sheet.svelte`: above "Rời phòng" add a
   row `<button type="button" class="btn btn-secondary" aria-pressed={sound.enabled} onclick={() => sound.set(!sound.enabled)}>{sound.enabled ? 'Âm thanh: Bật' : 'Âm thanh: Tắt'}</button>`.
7. **Win line** — create `result-head.svelte` with props
   `{ result: HandResult; winnerName: string; youWon: boolean }` holding the
   current `<header class="result-head">` markup and its styles
   (`.result-head`, `.result-winner`, `.result-winner-av`). Add
   `{#if youWon}<p class="result-celebrate">Mừng cậu chủ thắng lớn 💕</p>{/if}`
   under the title: `font-size: var(--fs-md); font-weight: 700; color: var(--gold); margin: 0; width: 100%`.
   `hand-result-modal.svelte`: add prop `youSeat: number`, replace the header
   with `<ResultHead {result} {winnerName} youWon={result.winnerSeat === youSeat} />`
   and delete the moved styles. `table-screen.svelte`: pass `youSeat={view.youSeat}`.

## Verification

- `pnpm typecheck`
- `pnpm dev` with two browsers, DevTools console open (no errors when a sound file is missing).
- Sequence: open waiting room in A, join with B → A hears `join`, B hears nothing. Start → both hear `shuffle`. Each play → both hear `play`. When the turn passes to me → `turn`. Hand end: winner hears `win`, the other hears `lose`; winner's modal shows the 💕 line, the loser's does not.
- Reload the table mid-hand: no sound on the first snapshot.
- Toggle "Âm thanh: Tắt" in the ≡ menu, reload: still off and no sounds play.
- `hand-result-modal.svelte` and `result-head.svelte` are both ≤ 200 lines.

## Todo

- [ ] Six MP3s in `apps/web/public/sounds/` (user — still to add)
- [x] `sound.svelte.ts`: Web Audio manager with unlock, enabled flag, silent on missing file
- [x] `sound-cues.ts`: pure transition detector
- [x] `room.svelte.ts` plays cues on every snapshot after the first
- [x] Unlock on first pointerdown in `app.svelte`
- [x] Mute toggle in the table menu
- [x] `result-head.svelte` with the celebration line; `youSeat` prop threaded from `table-screen`

## Success Criteria

Every Verification bullet passes; no cue fires twice for one event; the
app still runs with the `sounds/` folder empty.

## Risk

- `AudioContext` created before any gesture stays `suspended`; `unlock()` is only called from the pointerdown listener, and `play()` checks `ctx.state === 'running'` before starting a source.
- Reconnect after a long drop replays at most one `play`/`turn` cue (the diff is against the last seen snapshot). Acceptable; documented in the code comment.
