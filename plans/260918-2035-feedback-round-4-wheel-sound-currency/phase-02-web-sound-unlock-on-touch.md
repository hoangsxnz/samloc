---
phase: 2
title: "Sound: unlock from touch input"
status: done
priority: P1
effort: "45m"
dependencies: []
---

# Phase 2: Sound: unlock from touch input

## Goal

Sound cues play on phones: the `AudioContext` is resumed from an input event
that actually grants user activation, and the unlock keeps retrying until the
context is `running`.

## Cause

`apps/web/src/app.svelte:20` does
`document.addEventListener('pointerdown', () => sound.unlock(), { once: true })`.
Per the HTML "activation triggering input event" list, `pointerdown` only
counts when `pointerType === 'mouse'`; for touch the qualifying events are
`pointerup`, `touchend` and `click`. So on Android Chrome and iOS Safari the
first tap calls `ctx.resume()` without activation, the context stays
`suspended`, `play()` returns early on `ctx.state !== 'running'`, and because of
`{ once: true }` nothing ever tries again. Desktop testing with a mouse passed,
which is why this shipped. The clips are deployed and served (`/sounds/*.mp3`
return 200 on the live site), so assets are not the problem.

## Context

- `apps/web/src/lib/sound.svelte.ts:45-55` — `unlock()`: creates the context
  once, calls `resume()`, kicks off decoding; a second call only resumes.
- `apps/web/src/lib/sound.svelte.ts:57-65` — `play()` requires
  `ctx.state === 'running'`. iOS also has an `interrupted` state after a call
  or tab switch; a later tap must be able to resume from it.
- `apps/web/src/app.svelte:19` — the orientation lock also hangs off
  `pointerdown` `{ once: true }`; leave it alone (out of scope).
- `docs/codebase-summary.md:126` describes "unlocked on the first pointerdown".

## Files to Modify

- `apps/web/src/lib/sound.svelte.ts`
- `apps/web/src/app.svelte`
- `docs/codebase-summary.md` (line 126)

## Tasks & Steps

1. `sound.svelte.ts`: make `unlock()` cheap to call repeatedly — early-return
   when `this.#ctx?.state === 'running'`; otherwise create the context on the
   first call (and start decoding then), and call `void ctx.resume()` on every
   call. Update the class doc comment: unlock runs from `pointerup` / `keydown`,
   the events that grant user activation on touch devices, and stays attached
   so an `interrupted` context on iOS resumes on the next tap.
2. `app.svelte`: replace the `pointerdown` sound line with persistent
   listeners (no `{ once: true }`):
   ```ts
   const unlock = () => sound.unlock();
   document.addEventListener('pointerup', unlock);
   document.addEventListener('keydown', unlock);
   ```
   `pointerup` fires for mouse, touch and pen, and is activation-triggering
   for every pointer type; `keydown` covers keyboard-only use. Add
   `touchend` only if a real iOS device still does not resume (older WebKit
   dispatched touch before pointer events); note the result in the commit.
3. `docs/codebase-summary.md:126`: "unlocked on the first pointerdown" →
   "unlocked from `pointerup`/`keydown` (activation-granting on touch), retried
   until the context is running".

## Verification

- `pnpm typecheck && pnpm test`.
- `pnpm dev --host`, open on a real phone (ringer on, volume up), log in, join
  a room, start a hand: shuffle cue plays; play a combo: play cue; the ≡ menu
  toggle "Âm thanh: Tắt" silences, "Bật" restores.
- Chrome desktop with device toolbar in touch mode: temporarily
  `console.log` `ctx.state` after `resume()` resolves, tap once → `running`.
  Remove the log before committing.
- Desktop with mouse and keyboard-only (Tab + Enter) still unlock.

## Todo

- [x] `unlock()` idempotent, resumes on every call, early-returns when running
- [x] `app.svelte` listens on `pointerup` + `keydown`, not once
- [x] Docs line updated
- [ ] Heard on a real phone with ringer on
