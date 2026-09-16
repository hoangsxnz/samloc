---
phase: 4
title: "Web — result screen and table options"
status: completed
priority: P2
effort: "4h"
dependencies: [2]
---

# Phase 4: Web — result screen and table options

## Overview

Result modal: every player's remaining cards visible at once without scrolling,
the "đang chờ" line laid out horizontally, money instead of ±lá, and an exit
button for guests. Plus a table colour picker and the spectator state for a
player who joined mid-hand.

## Requirements

Functional:
- With 5 players the result modal shows all rows and all remaining cards without
  an internal scrollbar at the reference 844×390 frame.
- "Đang chờ chủ phòng bắt đầu ván mới…" renders on one horizontal line.
- Every player — host or guest — has a "Rời phòng" button on the result screen.
- Result rows show `deltaMoney` and `moneyAfter`; the lá figure moves to a
  secondary position (remaining-card count stays as cards).
- The table menu offers a felt colour choice (4 presets), persisted per device.
- A player who joined while a hand was running sees "Bạn sẽ vào ván sau" and no
  action buttons.

Non-functional:
- No layout regression at the 0.82 minimum table scale.
- Colour choice is local-only: no protocol change, no server state.

## Architecture

**Result grid (feedback 13).** `.result-grid` is a 2-column grid of cards inside a
330 px modal, so 3+ players overflow. Changes:

- Modal height becomes `auto` with `max-height: calc(100dvh - 32px)`.
- `result-row.svelte` compacts to one line: avatar, name (+ Cóng), money delta,
  remaining cards, session money — the cards sit in a `flex-wrap: nowrap` strip
  with a tighter negative margin (`-10px`) at `size="xs"`.
- Grid becomes `grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))` so
  2 players get two columns and 5 players get a denser 2×3 with no scroll.
- `.result-next` and `.result-waiting` move into a single footer row with
  `white-space: nowrap`; the vertical stacking came from `.result-waiting` being
  a narrow flex item, so it gets `flex: 1 1 auto` + nowrap instead of `flex: 1`.

**Guest exit (feedback 14).** The footer always renders "Rời phòng"
(`variant="danger"`, calls `room.leave()`); the host additionally gets "Ván tiếp".
The existing collapse-on-scrim behaviour stays for reviewing the table.

<!-- Updated: Validation Session 1 - no thối 2 / cóng breakdown line -->
No per-row breakdown of thối 2 / cóng: the user chose the floating table tag
alone, and the row space is needed for five players. "Cóng" keeps its existing
inline marker next to the name.

**Money rows (feedback 2).** Use `deltaMoney` / `moneyAfter` from phase 2 with
`formatMoney` from phase 3. Keep the ± sign and the success/danger colouring on
the delta; `moneyAfter` stays muted.

**Table colour (feedback 4).** `apps/web/src/lib/table-theme.svelte.ts` holds a
rune-backed `felt` preference persisted in `localStorage` (`samloc.felt`), with
presets `green` (current), `blue`, `burgundy`, `charcoal`. Each preset is a triple
of `--felt`, `--felt-dark`, `--felt-light`; the table root sets them inline from
the preset, so nothing else in the theme moves. The picker is a row of swatches
in `table-menu-sheet.svelte`.

**Spectator (feedback 7, client half).** When `view.youSeat >= 0` and
`view.hand.length === 0` while `view.status === 'playing'` and the seat is not in
the dealt set (`cardCount === 0` and `phase !== 'ended'`), the table screen shows
a "Bạn sẽ vào ván sau" banner and hides the action bar and the "Xếp bài"
button. The
waiting-screen redirect already sends a late joiner to `#/table/:code` because the
room status is `playing`.

## Related Code Files

- Modify: `apps/web/src/screens/table/hand-result-modal.svelte` (layout, footer, exit)
- Modify: `apps/web/src/screens/table/result-row.svelte` (compact row, money)
- Modify: `apps/web/src/components/table-menu-sheet.svelte` (colour swatches)
- Modify: `apps/web/src/screens/table/table-screen.svelte` (felt vars, spectator banner)
- Create: `apps/web/src/lib/table-theme.svelte.ts`

## Implementation Steps

1. Compact `result-row.svelte` to a single line and re-tune the card strip.
2. Rework `.result-grid` / modal sizing; check 2, 3, 4 and 5 rows at scale 0.82.
3. Fix the footer: horizontal "đang chờ" line, always-present "Rời phòng",
   host-only "Ván tiếp".
4. Swap the result numbers to money via `formatMoney`.
5. Add `table-theme.svelte.ts` + swatch row in the menu sheet; apply the CSS vars
   on `.table-root`.
6. Add the spectator banner and hide the action controls for a spectator.
7. Manual pass with `pnpm dev`: 3-player room, finish a hand, check the modal at a
   short viewport; join a 4th player mid-hand and confirm the banner then the
   next-hand deal.

## Success Criteria

- [x] 5-player result modal shows all rows and cards with no internal scrollbar.
- [x] The waiting line reads horizontally.
- [x] A guest can leave the room directly from the result screen.
- [x] Result rows show money; the colour picker persists across a reload.
- [x] A mid-hand joiner sees the spectator banner and is dealt in next hand.

## Risk Assessment

- **Dense modal on a short viewport**: the modal is `position: fixed` outside the
  scaled table, so it uses real pixels — `max-height` plus the compact rows keep
  it inside a 390 px-tall viewport; verify at the 0.82 scale case.
- **localStorage unavailable** (private mode): reads are wrapped in try/catch and
  fall back to `green`.

## Security Considerations

None: the colour preference is device-local and never reaches the server.

## Next Steps

Phase 5 verifies the whole set and updates the rule doc + changelog.
