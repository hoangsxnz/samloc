---
title: "Cook: feedback round 4 — phone wheel, touch sound, result board, $ currency"
date: 2026-09-19
summary: "Implemented all four phases of plans/260918-2035-feedback-round-4-wheel-sound-currency; verified with typecheck, tests and Playwright; real-phone sound check pending"
---

## What happened

Executed `plans/260918-2035-feedback-round-4-wheel-sound-currency` (four independent
phases, disjoint files) in one pass; 13 files, +52/−49.

- Phase 1: `centre-stack.svelte` lost `nameFor()`, the `seats` prop and `.trick-who`;
  `table-surface.svelte` no longer passes seats. Result board: `.result-modal` 640px,
  `.result-grid` `minmax(220px, 1fr)`, footer buttons 40px / `--fs-sm`, title `--fs-lg`,
  rows `4px 8px` with `-14px` card overlap.
- Phase 2: `sound.svelte.ts` `unlock()` early-returns when the context is `running`,
  creates the context once and calls `resume()` on every other call; `app.svelte` listens
  on `pointerup` + `keydown` without `{ once: true }`. Cause: a touch `pointerdown` is not
  an activation-triggering event, so `resume()` never left `suspended` on phones.
- Phase 3: `wheel-modal.svelte` sizes the SVG and its grid column from
  `--wheel: min(300px, calc(100dvh - 72px))`; panel height is content-driven with a
  `100dvh - 24px` cap.
- Phase 4: `formatMoney()` emits `$` + en-US grouping; wheel labels `1,000` … `10,000`.

Verification: `pnpm typecheck` 0 errors, 167 tests pass. Playwright against `pnpm dev`:
home shows `$10,200` / `+$1,000`; wheel at 844×390 and 667×375 is 300px on the left with
the copy column beside it and no internal scroll; `HandResultModal` was mounted directly
via `import('/@id/svelte')` + `import('/src/screens/table/hand-result-modal.svelte')`
with fake rows (card ids are `RANK` + uppercase `S|C|D|H`).

## Finding during verification

With the winner's celebrate line, 5 players at 844×390 overflowed `.result-grid` by 11px
(211 vs 200). The plan's 4px row padding was not enough; dropping `.result-cards` height
32px → 28px (the 32px `card-xs` still sits inside the row padding) brought it to 199/199
with no scrollbar. Added to phase 1 beyond the plan's listed steps.

## Decision

Hooked `AudioContext` through `page.addInitScript` to confirm one context and one
`resume()` on the first `pointerup`, then early-returns. Headless Chromium grants
activation on any gesture, so the touch-specific rule cannot be reproduced there; the
real-phone checkbox stays open in phase 2 and the plan's success criteria.

`docs/design-guidelines.md:106` and `docs/project-changelog.md` still described the
`pointerdown` unlock and `đ` money, so both were updated alongside `codebase-summary.md`.

`ak journal create` failed on this repo with `journals: rename: invalid argument` (the
NTFS mount rejects the CLI's temp-file rename; `sed -i` prints the same class of warning);
this entry was written directly.

## Next steps

- Open `pnpm dev --host` on a real phone: confirm the shuffle / play cues with the ringer
  on, and the wheel layout in Safari.
- Commit as `fix(web,worker): ...` and deploy.
