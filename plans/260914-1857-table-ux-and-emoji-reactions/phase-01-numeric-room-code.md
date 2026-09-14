---
phase: 1
title: "Numeric room code"
status: completed
priority: P1
effort: "45m"
dependencies: []
---

# Phase 1: Numeric room code

## Overview

Room codes become 6 digits (`000000`–`999999`). Generation, validation, the
6-box entry field and the tests all switch from the 32-symbol alphanumeric
alphabet to digits only.

## Requirements

- Functional: `generateRoomCode()` returns 6 digits, uniformly distributed.
  `isRoomCode()` accepts exactly `/^[0-9]{6}$/`. The code input accepts digits
  only, shows a numeric keypad on mobile, and still auto-advances and pastes.
- Non-functional: no bias in the random mapping; existing 5-attempt insert
  retry stays the only collision defence (1 000 000 codes vs a 3-open-room cap
  per host — collision probability stays negligible).

## Architecture

`apps/worker/src/room-code.ts` is the single source of truth for the alphabet;
`routes-rooms.ts` and `routes-ws.ts` only call it. Rejection sampling must be
re-tuned: with a 10-symbol alphabet, `byte % 10` is biased for bytes 250–255,
so the ceiling moves from 224 to **250** (`Math.floor(256 / 10) * 10`).

## Related Code Files

- Modify: `apps/worker/src/room-code.ts` — alphabet, ceiling, `isRoomCode()`
- Modify: `apps/worker/tests/room-code.test.ts` — digit assertions, letter rejection, distribution over 10 symbols
- Modify: `apps/web/src/components/code-input.svelte` — digit filter, `inputmode="numeric"`, `pattern="[0-9]*"`, aria-label wording
- Read for context: `apps/worker/src/routes-rooms.ts:26-44`, `apps/worker/src/routes-ws.ts:25-26`

## Implementation Steps

1. `room-code.ts`: `const ALPHABET = '0123456789'`, `REJECTION_CEILING = 250`.
   Update the comment above the ceiling to state the real reason (256 % 10 = 6
   → bytes ≥ 250 would over-represent digits 0–5).
2. `isRoomCode()`: keep the length check, replace the alphabet check with a
   digit check (`/^[0-9]{6}$/.test(value)` or `every((ch) => ALPHABET.includes(ch))`
   — either is fine, keep it one expression).
3. `code-input.svelte`:
   - `onInput` / `onPaste` filter: `.replace(/[^0-9]/g, '')`, drop `.toUpperCase()`.
   - input attrs: `inputmode="numeric"`, `pattern="[0-9]*"`, remove
     `autocapitalize="characters"`, keep `maxlength="1"`.
   - CSS: drop `text-transform: uppercase` (no longer meaningful).
   - `aria-label`: `Chữ số ${index + 1} của mã phòng`.
4. Tests in `room-code.test.ts`:
   - length 6 and every char in `0-9`
   - `isRoomCode('123456')` true; `isRoomCode('12345')`, `isRoomCode('1234567')`,
     `isRoomCode('ABC234')`, `isRoomCode('12345A')` all false
   - 10 000-draw distribution: every digit 0–9 appears, no digit takes more
     than ~15 % of the drawn characters (the old test's shape, retuned)
5. Leave the `.toUpperCase()` calls in `routes-rooms.ts:89`, `routes-ws.ts:25`
   and `lib/router.svelte.ts:12-13` alone — they are no-ops on digits and
   touching them is out of scope.

## Success Criteria

- [ ] `pnpm --filter @samloc/worker test` passes with the new room-code tests
- [ ] Creating a room in `pnpm dev` yields a 6-digit code; the waiting screen shows it
- [ ] Typing that code in the lobby joins the room; typing a letter is ignored by the input
- [ ] `pnpm typecheck` clean

## Risk Assessment

- **Old codes 404.** Accepted by the user. Rooms created before deploy, and
  the room codes listed in "phiên gần đây", stop resolving. Mitigation: none
  requested; deploy when no room is live.
- **Collision rate rises** from 32^6 (1.07e9) to 1e6. With ≤3 open rooms per
  host the insert-retry loop (5 attempts) is still overwhelmingly sufficient;
  no code change needed, but do not lower `MAX_INSERT_ATTEMPTS`.
