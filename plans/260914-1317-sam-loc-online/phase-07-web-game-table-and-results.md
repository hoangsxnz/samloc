---
phase: 7
title: "Web game table and results"
status: completed
effort: "6h"
priority: P1
dependencies: [phase-05, phase-06]
---

# Phase 7: Web game table and results

Context: `docs/design-guidelines.md` §4–§7, `docs/wireframe/04-game-table.html`,
`docs/wireframe/05-hand-result.html` (their annotation `<ol>` lists are the spec)

## Overview

The playing surface: felt table, four opponent seats, CSS-drawn cards, the 10-card fan, timer ring,
centre stack, action bar, per-seat event tags, and the hand-result modal. The screen renders `RoomView`
and nothing else — no local game state, no optimistic mutation. `packages/rules` is used purely to grey
out the `Đánh` button when the selection cannot beat the current combo.

## Requirements

**Functional** — absolute 844×390 table layout scaled with `transform: scale()` for shorter viewports. Seat
layout by player count: 5 → 2 top + 1 each side; 4 → 2 top + 1 side; 3 → 2 top; 2 → 1 top-centre. Tap to
select/deselect cards (selected rise 20 px with a gold outline, no drag). The `Đánh` label reflects the
selection ("Đánh (Đôi 9)") and is disabled at 40 % when the combo cannot beat; `Bỏ lượt` is hidden while
leading. The `Báo Sâm` pill appears only in the sâm window, disappears for everyone on the first card
played, and opens the confirm dialog "Báo Sâm? Thua đền 20 lá/người". The timer ring drains from
`settings.turnSeconds` (15/20/30 s, default 20) and turns `--danger` with pulsing digits under 5 s.
Per-seat event tags cover chặt 2, chặt chồng, báo sâm, báo 1, ăn trắng and đền bài, and a warning line
reads "Có thể phải đền bài" when the local player leads a non-highest single while the next seat holds one
card. The `≡` menu offers `Rời phòng` only. The result modal opens on `status === 'hand-end'`, with
`Ván tiếp` for `youAreHost` and waiting text for everyone else.

**Non-functional** — every component ≤200 lines, with `table-screen.svelte` delegating to sub-components and
`table-logic.svelte.ts`; `prefers-reduced-motion` honoured (no deal/collect animation, fades ≤100 ms, no
pulse); card hit areas ≥44 px wide though the visible strip is 28 px; no image or SVG card assets.

## Architecture

**Component tree** — `table-screen.svelte` only composes; all derived state lives in `table-logic.svelte.ts`.
```
table-screen.svelte                 // route #/table/:code, composition + scale only
├─ table-top-bar.svelte             // connection dot, code, ván N, session chip, ≡ menu
├─ opponent-seat.svelte  × n-1      // avatar, name, card-back count, turn ring, passed, báo 1, ⟳
├─ centre-stack.svelte              // trick combos, newest on top, older at 30–50 %
├─ me-chip.svelte                   // own avatar + timer-ring + selection validity line
├─ hand-fan.svelte                  // 10-card arc, selection state
├─ action-bar.svelte                // Bỏ lượt / Đánh / Báo Sâm pill
├─ event-tag.svelte                 // per-seat pill, 1.6 s
├─ table-menu-sheet.svelte          // ≡ -> "Rời phòng" only
└─ hand-result-modal.svelte         // wireframe 05
playing-card.svelte                 // shared: size variant, face/back, rank + suit glyph
```

**`table-logic.svelte.ts`** owns every derived value, so no component recomputes game state:
```ts
let selected   = $state<string[]>([]);            // card ids, cleared on every snapshot
let tags       = $state<{ seat: number; text: string; tone: string; id: number }[]>([]);
let now        = $state(Date.now());              // 250 ms ticker, only while it is someone's turn
const combo    = $derived(parseCombo([...selected].sort(byRank)));
const canPlay  = $derived(isMyTurn && combo !== null && canBeat(currentCombo, combo));
const remain   = $derived(Math.max(0, ((view?.turnDeadline ?? 0) - now) / 1000));
```
`view.turnDeadline` is server epoch ms; the ring is pure presentation and never gates the action — the
DO's alarm is the only authority on timeout.

**Seat geometry** (design reference 844×390, from `docs/design-guidelines.md` §7). Seat slots rotate so
the local player is always bottom-left: opponents fill `[top-left, top-right, left, right]` in
`(youSeat + k) mod n` order for `k = 1..n-1`.

| Element | Position |
|---|---|
| Top bar | y 0–44, x inset `max(40px, env(safe-area-inset-*))` |
| Top seats | y 42, x 290 from each edge |
| Side seats | y 130, x 44 from each edge |
| Centre stack | 240×100 at y 150–250, no frame |
| Me chip + timer | x 40, y 306 |
| Hand track | x 262–570, base card top 312 |
| Action bar | right `max(40px, safe-area-right)`, bottom `max(20px, safe-area-bottom)` |

**Hand fan maths** (`hand-fan.svelte`) — 10 cards of 56×80 on a 308 px track, step 28 px, rotation
−10° → +10° in 2.2° steps, vertical offset following the arc (outer cards +12 px). With fewer than 10 cards
the step stays 28 px and the track re-centres: `startX = 262 + (308 - (56 + 28 * (count - 1))) / 2`.

**Event tag mapping** (`GameEvent` → pill)

| Event | Text | Tone |
|---|---|---|
| `chat2` (chong: false) | `Chặt 2 +15` | gold |
| `chat2` (chong: true) | `Chặt chồng +{amount}` | gold, double-chevron |
| `baoSam` | `Báo Sâm!` | danger |
| `bao1` | `Báo 1` | warn |
| `anTrang` | `Ăn trắng` | info |
| `denBai` | `Đền bài` | danger |

`trickEnd` and `handEnd` drive animation, not tags: `trickEnd` fades the centre stack over 350 ms. The
**đền bài warning** is derived locally and is advisory only:
```ts
const nextSeatCards = seatAfterMe?.cardCount ?? 0;
const denWarn = $derived(
  isMyTurn && currentCombo === null && selected.length === 1 && nextSeatCards === 1 &&
  rankOf(selected[0]) < rankOf(view.hand[view.hand.length - 1])
);
```

## Related Code Files

**Create** — `src/screens/table/{table-screen.svelte,table-logic.svelte.ts}` and
`src/screens/table/hand-result-modal.svelte`; `src/components/` gains `table-top-bar`, `opponent-seat`,
`centre-stack`, `me-chip`, `timer-ring`, `hand-fan`, `action-bar`, `event-tag`, `table-menu-sheet`,
`playing-card` and `confirm-dialog` (all `.svelte`); `src/lib/card-view.ts` (`rankLabel`, `suitGlyph`,
`suitColour`, `comboLabel` → "Đôi 9", "Sảnh 5-6-7", "Tứ quý K", "Sám cô 4"); `src/lib/table-layout.ts`
(seat slot assignment, fan geometry, table scale factor).

**Modify** — `src/lib/room.svelte.ts` (add `play(cards)`, `pass()`, `declareSam()`, `nextHand()`),
`src/app.svelte` (register `#/table/:code`, replacing the phase-6 placeholder), `src/app.css` (card
face/back classes and the `@media (prefers-reduced-motion: reduce)` block). **Delete** — the phase-6
placeholder table screen, if one was created as a separate file.

## Implementation Steps

1. `playing-card.svelte`: props `{ id?: string; back?: boolean; size: 'lg'|'sm'|'xs'; count?: number }`,
   sized `lg` 56×80, `sm` 44×62, `xs` 24×32. Face = rank top-left (22 px/700) with the suit glyph beneath
   (18 px) and a 32 px centre glyph, coloured by `card-view.ts`. Back = `--card-back` with the CSS diamond
   lattice and a 4 px inner white border; `count` renders centred in white 15 px/700 for `opponent-seat`.
2. `table-layout.ts`: `opponentSlots(youSeat, seatCount)` returning slot names in the order above, and
   `tableScale(viewportHeight)` = `clamp(viewportHeight / 390, 0.82, 1)`.
3. `table-logic.svelte.ts` then `table-screen.svelte`: the logic module owns `selected`, `tags`, the ticker
   and every `$derived`, clearing `selected` in an `$effect` on each snapshot; the screen only wires the
   room store and applies `transform: scale(tableScale)` with `transform-origin: top left` on an 844×390
   absolutely positioned root at `height: 100dvh; overflow: hidden`.
4. `opponent-seat.svelte`: 48 px avatar with the name initial, name at 14 px/600 truncated to 8 chars, one
   card-back with the count beneath. Active turn → 3 px gold ring + `0 0 0 6px rgba(212,175,55,.25)`; passed
   → 50 % opacity + "Bỏ" chip; `cardCount === 1` → the back turns `--danger` with "1"; disconnected → grey
   ring + ⟳.
5. `timer-ring.svelte`: 56 px circle, 4 px stroke, `stroke-dasharray` drained from `remain / turnSeconds`
   clockwise. Under 5 s: `--danger` stroke and a 500 ms digit pulse. `role="timer"`.
6. `centre-stack.svelte`: render `view.trick` newest-last; newest at full opacity with the player name
   (11 px, `--text-muted`) beneath, older entries at 30–50 % opacity with a small offset and ±5–7° rotation.
   Fade the whole stack over 350 ms when `view.trick` empties.
7. `hand-fan.svelte`: absolute positioning per the fan maths; tap toggles membership in `selected`;
   invisible 44 px-wide hit area per card; selected cards get `translateY(-20px)` and a gold outline.
8. `action-bar.svelte`: `Bỏ lượt` (secondary, 96 px, hidden when leading) and `Đánh` (primary, 120 px, label
   from `comboLabel`, disabled at 40 % when `!canPlay`); the `Báo Sâm` pill floats above the bar only while
   `view.canDeclareSam` and opens `confirm-dialog.svelte`.
9. `me-chip.svelte`: own avatar, the timer ring on my turn, and a secondary line showing the invalid-combo
   reason ("Không chặt được Đôi 7") or the "Có thể phải đền bài" warning.
10. `event-tag.svelte` + the tag queue in `table-logic.svelte.ts`: push on `onEvent`, drop after 1.6 s,
    render under the involved seat, and mirror the text into a visually hidden `aria-live="polite"` region.
    `table-menu-sheet.svelte` opens from the `≡` in the top bar with a single `Rời phòng` action; during
    `playing` it first warns "Rời giữa ván sẽ bị tính cóng/đếm lá", then sends `{type:'leave'}` either way.
11. `hand-result-modal.svelte` (wireframe 05): 640×330, `--r-lg`, scrim 60 %, appearing 350 ms after the
    collect animation with `scale(.95→1)` + fade. The title carries the winner in a gold pill, swapped for
    `result.headline` on sâm/ăn trắng. Two-column grid of rows: avatar, name, `Cóng` label when `row.cong`,
    remaining cards as `xs` faces with 7 px overlap, hand net and session total; the winner's row reads
    "Hết bài". No itemised penalty breakdown. Footer: `Xem bảng điểm phiên` (ghost, left) and
    `Ván tiếp` (only when `view.youAreHost`; others see "Đang chờ chủ phòng bắt đầu ván mới…"). Centre text names
    the next leader from `result.nextLeadSeat`. Non-hosts can tap the scrim to shrink the modal to a
    `Kết quả` chip in the top corner; the host cannot dismiss it.
12. Motion: deal 300 ms per card staggered 40 ms (≤700 ms total), play 200 ms with `scale 1 → 0.7`, collect
    350 ms — all wrapped in a `@media (prefers-reduced-motion: reduce)` override leaving ≤100 ms fades.
13. Verify: `pnpm -r typecheck && pnpm build`, then `pnpm dev` with three tabs, playing one full hand to the
    result modal and on into the next hand.

## Success Criteria

- [x] `pnpm -r typecheck` (incl. `svelte-check`) and `pnpm build` exit 0; three tabs play a hand to
      completion with result-modal totals matching `settle()` and rows summing to zero
- [x] `Đánh` is disabled for every selection that `canBeat` rejects, and the label names the combo, while
      `Báo Sâm` shows only before the first card and vanishes for all tabs once a card is played
- [x] The timer ring reaches zero exactly when the server auto-passes, with no client-side double action
- [x] Chặt 2 shows `Chặt 2 +15` under the cutter's seat and chặt chồng shows `Chặt chồng +30`
- [x] `Ván tiếp` appears only for `youAreHost`; other tabs show the waiting text and advance with them
- [x] `Rời phòng` in the `≡` menu warns mid-hand and still leaves, and the seat is counted at settlement
- [ ] At 390 px and 360 px viewport height the table scales without overlap or clipping, and with
      `prefers-reduced-motion` forced on no card animates and nothing pulses

## Risk Assessment

| Risk | L×I | Mitigation |
|---|---|---|
| Client clock skew misdraws the timer | H×L | Ring is presentation only; on the first snapshot store `skew = view.turnDeadline - view.serverNow` if needed, otherwise accept ±1 s |
| Fan overlaps the me-chip or action bar at 2–3 players | M×M | Track is fixed at 262–570 px and re-centres by count; check both extremes in step 13 |
| Selection survives a snapshot and plays the wrong cards, or `parseCombo` drags the whole rules package into the bundle | M×H | `selected` is cleared by an `$effect` on every snapshot and the DO re-validates card ownership regardless. The rules import is tree-shaken ESM source; check `dist` stays under ~120 KB in step 13 |
| Result modal overflows with 5 players, or event tags pile up during a fast chặt chồng chain | M×L | Three rows with inner scroll, exactly as the wireframe prescribes; tag queue keyed by `id`, max 3 concurrent per seat, each expiring after 1.6 s |

**Rollback:** revert `apps/web/src/screens` and `src/components`; phase 6's shell still runs and the waiting screen simply has nowhere to navigate.

## Security Considerations

- The client renders `view.hand` only; opponents' card ids never arrive, so a devtools user gains nothing,
  and `result.rows[].cards` is filled by the server only at hand end, the one legitimate reveal.
- `canPlay` is a UX gate; every action is re-validated by the DO, so a patched client cannot cheat. Display
  names and `result.headline` render as text, with no `{@html}` on any server-supplied string.

## Next Steps

Phase 8 deploys and runs the multi-device smoke checklist.
