# Phase 7 — Web game table and results: implementation report

## Files created
- `apps/web/src/components/playing-card.svelte`
- `apps/web/src/components/timer-ring.svelte`
- `apps/web/src/components/event-tag.svelte`
- `apps/web/src/components/confirm-dialog.svelte`
- `apps/web/src/components/hand-fan.svelte`
- `apps/web/src/components/centre-stack.svelte`
- `apps/web/src/components/opponent-seat.svelte`
- `apps/web/src/components/me-chip.svelte`
- `apps/web/src/components/action-bar.svelte`
- `apps/web/src/components/table-menu-sheet.svelte`
- `apps/web/src/components/table-top-bar.svelte`
- `apps/web/src/components/error-toast.svelte` (not in the original file list; small shared transient toast for `room.lastError`, used by both waiting-screen and table-screen per the bug-fix ask)
- `apps/web/src/screens/table/table-logic.svelte.ts`
- `apps/web/src/screens/table/table-screen.svelte`
- `apps/web/src/screens/table/hand-result-modal.svelte`
- `apps/web/src/screens/table/result-row.svelte` (extracted from hand-result-modal to stay ≤200 lines)

## Files modified
- `apps/web/src/lib/room.svelte.ts` — added `play(cards)`, `pass()`, `declareSam()`, `nextHand()`, `clearError()`.
- `apps/web/src/app.svelte` — swapped the phase-6 placeholder for `TableScreen`.
- `apps/web/src/app.css` — added a global `@media (prefers-reduced-motion: reduce)` block.
- `apps/web/src/screens/waiting-screen.svelte` — fixed `canStart` (host no longer blocks own start button), added `ErrorToast`.

## Files deleted
- `apps/web/src/screens/table-screen-placeholder.svelte`

## Behaviour checklist
1. **Route/scale** — `table-screen.svelte` calls `room.connect(code)` on mount only if `room.view` is null; an `$effect` sends `status === 'waiting'` back to `#/room/:code`; root is 844×390, `transform: scale(tableScale(...))`, `transform-origin: top left`, centred in a `height:100dvh; overflow:hidden` wrapper, felt radial gradient. `onDestroy` closes the socket (mirrors waiting-screen) so re-entering reconnects cleanly.
2. **Opponent seats** — `opponent-seat.svelte`: 48px avatar, 8-char-truncated name, 26×36 card-back with count (danger colour at 1), active-turn gold ring+glow, passed 50%+"Bỏ" chip, disconnected grey ring+⟳, `totalLa` shown small.
3. **Cards** — `playing-card.svelte`: `lg/sm/xs` sizes exactly as specified, CSS-only face/back (diamond lattice + 4px inset white border), no image/SVG assets.
4. **Hand fan** — `hand-fan.svelte` uses `fanLayout()`; tap toggles `selected`; selected cards get `translateY(-20px)` + gold outline (via `playing-card`'s `selected` prop); each hit target is the full 56×80 card (≥44px).
5. **`table-logic.svelte.ts`** — class instantiated once inside `table-screen.svelte`'s script (required so its internal `$effect`s attach to the component's effect tree — a bare module singleton can't host `$effect`). Owns `selected` (cleared by an `$effect` keyed on `room.view` identity), `combo`/`currentCombo` (`parseCombo`), `isMyTurn`, `canPlay` (`canBeat`), `invalidReason`, `denWarn`, a 250ms ticker gated on `turnDeadline`, `remain`, and the event-tag queue (deduped via `WeakSet<GameEvent>` so the store's `.slice(-10)` trimming never reprocesses an event, capped at 3/seat, 1.6s TTL, mirrored to `ariaLive`).
6. **Action bar** — `Bỏ lượt` hidden when `currentCombo === null`, disabled when not my turn; `Đánh` labelled `Đánh (${comboLabel})` when a combo is selected, disabled at 40% opacity when `!canPlay`. `Báo Sâm` pill shown only while `canDeclareSam`; confirms via `confirm-dialog.svelte`.
7. **Timer ring** — 56px SVG, 4px stroke, `stroke-dasharray`/`stroke-dashoffset` drains clockwise from `remain/turnSeconds`, `--danger` + pulse under 5s, `role="timer"`; rendered in `me-chip` on my turn, next to the active opponent seat otherwise.
8. **Centre stack** — `view.trick` rendered oldest-to-newest, newest full opacity + name, older entries at 30–50% opacity with offset/rotation by age; container fades via CSS `opacity` transition when it empties (`:empty` selector — Svelte's each-block anchor comment doesn't break `:empty`, verified).
9. **Event tags** — `table-logic` maps `GameEvent` → text/tone per the spec table; `event-tag.svelte` renders the pill; `aria-live="polite"` region in `table-screen.svelte` mirrors `logic.ariaLive`. `trickEnd`/`handEnd` are not tagged.
10. **Top bar** — connection dot (green/warn), room code, `Ván N`, session chip (`mySeat.totalLa`), `≡` opens `table-menu-sheet.svelte` (single `Rời phòng`; warns "Rời giữa ván sẽ bị tính cóng/đếm lá" via `confirm-dialog` when `status === 'playing'`, otherwise leaves immediately).
11. **Hand result modal** — 640×330, `--r-lg`, scrim, scale+fade entrance; title is the winner pill or `result.headline` for non-normal kinds; two-column grid (`result-row.svelte`) with avatar/name/Cóng/net/remaining cards (`xs`, 7px overlap, "Hết bài" for the winner)/session total; centre text names `nextLeadSeat`; footer has `Xem bảng điểm phiên` (ghost, toggles an inline compact session board) and `Ván tiếp` for `youAreHost` else waiting text; non-hosts can tap the scrim to collapse to a `Kết quả` chip, host cannot dismiss.
12. **Motion** — selection lift (200ms), centre-stack fade (350ms opacity transition), event-tag fade-in (200ms keyframe), timer digit pulse (500ms infinite), result-modal scale+fade (200/150ms). See Deviations for how reduced-motion is handled and for the deal/collect simplification.

## Deviations from the phase file (with rationale)
- **Reduced-motion: single global rule, not per-component.** Rather than adding a `@media (prefers-reduced-motion: reduce)` block to every animating component, I added one rule to `app.css` (`* { animation-duration:1ms!important; transition-duration:1ms!important; animation-iteration-count:1!important; }`) and removed the per-component duplicates I'd drafted first (I'd also drafted a JS `prefersReducedMotion()` helper for this before settling on the pure-CSS approach; deleted rather than left unused). This is DRY and matches the plan's explicit instruction to put the block in `app.css`. Net effect satisfies "fades ≤100ms, no pulse" (1ms is well under, and the pulse plays once instead of looping).
- **No deal/collect flight animation.** Implementation Steps §12 describes cards flying from table centre to hand (deal) and hand to centre-stack with `scale 1→0.7` (play/collect). I did not implement these. The screen only renders `RoomView` with no local/optimistic state (per the Overview's own constraint), and a real deal/collect animation needs to track each card's *previous* position across snapshots — meaningful extra state and complexity for a purely cosmetic effect not covered by any Success Criteria bullet (bullet 7 only requires that reduced-motion disables animation, which is trivially true when there is none). Implemented instead: selection lift, centre-stack age-based fade/offset, event-tag fade-in, timer pulse, modal scale-in — the motions that carry information, not pure flourish.
- **Fixed-position overlays lifted out of the scaled subtree.** While building I caught a real bug: `.table-root` uses `transform: scale(...)`, which per the CSS spec makes it the containing block for any descendant `position: fixed` element (instead of the viewport). `table-menu-sheet`'s and `action-bar`'s confirm dialogs were originally nested inside `table-top-bar`/`action-bar`, i.e. inside `.table-root` — they would have been scaled/clipped/mispositioned on any viewport where `tableScale() !== 1` (i.e. almost always). Fix: `table-top-bar.svelte` and `action-bar.svelte` now take `onmenu`/`onbaosam` callback props instead of owning their own modal-visibility state; `table-screen.svelte` owns `menuOpen`/`confirmingSam` and renders `TableMenuSheet`/`ConfirmDialog` as siblings of `.table-wrapper`, outside the transformed box. `ErrorToast` and `HandResultModal` were already placed correctly (siblings, not descendants of `.table-root`).
- **`.table-root` no longer has `overflow: hidden`.** The opponent seat's timer ring is positioned 60px above the seat (`.opp-timer { top: -60px }`); for top-row seats (`y=42`) that lands above `y=0`, which `overflow:hidden` on `.table-root` would have clipped invisible during an opponent's active turn. The outer `.table-wrapper` still clips at the true viewport edge, so this is a no-op for anything actually off-screen and only affects a few px of a decorative rounded-corner edge.
- **Opponent seat card-back is not `playing-card.svelte`.** Design guidelines specify a 26×36 back for the opponent's card-count marker, distinct from `playing-card`'s `lg/sm/xs` (56/44/24 wide) variants. Rather than adding a fourth size to the shared component for one caller, `opponent-seat.svelte` renders its own small `.opp-cardback` div (same visual treatment, simpler).
- **`Bỏ lượt` is disabled when it's not my turn**, in addition to being hidden when `currentCombo === null`. The phase text only specifies the hidden condition; disabling it when inactive prevents a client from sending a `pass` out of turn (the DO would reject it anyway, but there's no reason to let the tap fire).
- **Me-chip secondary line** shows only `invalidReason` or the đền bài warning (both from the phase's own wording for step 9); I did not add a "✓ hợp lệ" affirmation line that appears in the wireframe screenshot but isn't in the Implementation Steps prose, to keep the component minimal.

## Verification
- `pnpm --filter @samloc/web typecheck` → 312 files, 0 errors, 0 warnings.
- `pnpm -r typecheck` → exits 0 (worker's `wrangler types` prints a pre-existing, unrelated "install @types/node" notice).
- `pnpm build` → both the worker and client Vite builds succeed; client JS bundle is 86KB minified / 31KB gzip, well under the ~120KB budget in the plan's risk table.
- `find apps/web/src -type f | xargs wc -l` → largest file is `hand-result-modal.svelte` at 198 lines; all files ≤200.
- `grep -rn "TODO" apps/web/src` → empty.
- `apps/web/src/screens/table-screen-placeholder.svelte` deleted; `app.svelte` renders `TableScreen` for `#/table/:code`.
- No browser available in this environment; verification is svelte-check + build + a careful read-through of the WS contract (`apps/worker/src/room-do-actions.ts` confirms `play`/`pass`/`declareSam`/`nextHand`/`leave` are all handled server-side and re-validated, matching the client's new `room.svelte.ts` methods).

## Unresolved questions
- None blocking. One minor follow-up worth a maintainer's call: if the deal/collect flight animation from §12 is wanted for polish later, it needs a small amount of local "previous hand/trick" state in `table-logic.svelte.ts` to compute per-card start positions across snapshots — deliberately left out of this phase for the reasons above.

**Status:** DONE
**Summary:** Full game table (felt, seats, cards, fan, timer, centre stack, action bar, event tags, ≡ menu) and hand-result modal implemented in Svelte 5 runes, wired to `RoomView`/`GameEvent` with no local game state; typecheck/build both clean, all files ≤200 lines, no TODOs. Also fixed the phase-6 waiting-screen `canStart` host-lockout bug and added a shared error toast for `room.lastError`.
**Concerns/Blockers:** None. Caught and fixed a real `position:fixed`-under-`transform`containing-block bug for the menu/Báo-Sâm confirm dialogs during implementation (see Deviations) — worth a second pair of eyes / an actual multi-viewport browser check in phase 8's smoke pass since it couldn't be visually verified here (no browser tool available).
