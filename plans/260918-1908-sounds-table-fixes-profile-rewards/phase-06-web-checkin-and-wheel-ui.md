---
phase: 6
title: "Web: check-in card and wheel UI"
status: completed
priority: P1
effort: "4h"
dependencies: [4, 5]
---

# Phase 6: Web: check-in card and wheel UI

## Goal

Show today's check-in and the lucky wheel on the Home screen, credit the
budget on screen immediately, and animate the wheel to the server-chosen
segment.

## Context

- Phase 4 endpoints: `GET /api/rewards` → `{ day, checkedIn, spinsLeft, checkinAmount, segments }`,
  `POST /api/checkin` → `{ amount, budget }` (409 when done),
  `POST /api/spin` → `{ segment, amount, spinsLeft, budget }` (429 when out).
  Segment labels come from the server so the wheel and the draw table never
  diverge.
- Phase 5 leaves `home-screen.svelte` with an empty right column
  (`.home-rewards`).
- `apps/web/src/lib/session.svelte.ts#setUser` is how the header budget
  updates; `formatMoney` / `formatMoneyDelta` in `lib/format-money.ts`.
- `docs/design-guidelines.md` §5 motion: enter easing
  `cubic-bezier(.2,.8,.2,1)`, `prefers-reduced-motion` disables motion.
- Modals in this app are `position: fixed` overlays with a `.scrim-backdrop`
  button and a `.panel` (`confirm-dialog.svelte`, `table-menu-sheet.svelte`).

## Files to Create / Modify

- Create: `apps/web/src/lib/wheel.ts`
- Create: `apps/web/src/components/checkin-card.svelte`
- Create: `apps/web/src/components/wheel-modal.svelte`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/screens/home-screen.svelte`

## Tasks & Steps

1. **API** — `api.ts`: `RewardsInfo` and `WheelSegmentView { amount; label }`
   types; `rewards: () => req<RewardsInfo>('/api/rewards')`,
   `checkin: () => req<{ amount: number; budget: number }>('/api/checkin', { method: 'POST' })`,
   `spin: () => req<{ segment: number; amount: number; spinsLeft: number; budget: number }>('/api/spin', { method: 'POST' })`.
2. **`wheel.ts`** (pure) —
   - `segmentPath(index, count, radius)` → SVG `d` for one wedge centred at the origin, wedge 0 starting at 12 o'clock and going clockwise.
   - `labelPosition(index, count, radius)` → `{ x, y, angle }` at 62 % of the radius on the wedge bisector.
   - `rotationFor(index, count, previousRotation)` → final rotation in degrees that puts wedge `index`'s bisector under the top pointer, always ≥ `previousRotation + 5 × 360` so every spin turns at least five times and never rewinds.
3. **`checkin-card.svelte`** — props `{ checkedIn: boolean; amount: number; onchecked: (budget: number) => void }`.
   `.panel` with title `Điểm danh hàng ngày`, line `+{formatMoney(amount)} mỗi ngày`, primary button
   `Nhận {formatMoney(amount)}` → `api.checkin()` → `onchecked(budget)`; then the
   button becomes disabled `Đã điểm danh hôm nay ✓`. A 409 flips to the done
   state too (someone tapped twice on two tabs). Busy state disables the button.
4. **`wheel-modal.svelte`** — props `{ segments: WheelSegmentView[]; spinsLeft: number; onspun: (r: { amount; spinsLeft; budget }) => void; onclose }`.
   - Layout: fixed overlay, `.panel` 560×340 centred: left the SVG wheel (280 px, 8 wedges alternating `--surface-2` / `--felt-light` fills, gold `stroke` lines, labels 13 px/700, a gold triangle pointer fixed at the top), right the copy: `Vòng quay may mắn`, `Còn {spinsLeft} lượt hôm nay`, primary `Quay` (disabled when `spinsLeft === 0` or spinning), result line, ghost `Đóng`.
   - Spin: call `api.spin()` first; on 429 show `Hết lượt quay hôm nay` and set `spinsLeft = 0`; on success set `rotation = rotationFor(segment, …)` on the `<g>` with `transition: transform 4s cubic-bezier(.17,.67,.12,.99)`; on `transitionend` show `+{formatMoney(amount)} 🎉` or `Chúc may mắn lần sau` and call `onspun`. Under `prefers-reduced-motion` skip the transition and show the result at once.
   - `Đóng` and the scrim are disabled while spinning so the result is always seen.
5. **Home** — `home-screen.svelte`: on mount `api.rewards()` into local
   state; right column renders `<CheckinCard>` and a `.panel` with
   `Vòng quay may mắn`, `Còn {spinsLeft}/5 lượt` and a secondary `Quay ngay`
   button opening `<WheelModal>`. `onchecked` / `onspun` update
   `session.user.budget` via `setUser({ ...session.user, budget })`, and
   `spinsLeft` / `checkedIn` locally. When `api.rewards()` fails show one
   muted line `Không tải được phần thưởng` instead of the two panels.
   Two-column grid `1fr 1fr`, gap `--sp-4`, both columns fit 390 px height
   without scrolling (wheel panel is a button, not the wheel itself).

## Verification

- `pnpm typecheck`
- `pnpm dev`: Home shows the check-in card enabled and `Còn 5/5 lượt`. Tap `Nhận 1.000 đ` → header budget +1.000, button disabled. Reload → still disabled.
- `Quay ngay` → modal; `Quay` → wheel spins ≥ 5 turns for ~4 s and stops with the wedge whose label matches the returned `amount` under the pointer; result line and budget update; `Còn 4 lượt`. Five spins → button disabled; a sixth attempt via curl returns 429.
- Landscape 844×390 and 360 px tall: no vertical scroll on Home, modal fits.
- With `prefers-reduced-motion: reduce` (DevTools rendering panel) the result appears immediately.
- All new files ≤ 200 lines.

## Todo

- [x] `api.rewards / checkin / spin`
- [x] `wheel.ts` geometry and `rotationFor`
- [x] `checkin-card.svelte`
- [x] `wheel-modal.svelte` with SVG wheel, spin transition, result copy
- [x] Home right column wired; budget updates via `setUser`

## Success Criteria

Verification passes; the wedge under the pointer always matches the server
amount; nothing about the prize is decided client-side.

## Risk

- `transitionend` does not fire if the tab is hidden mid-spin; add a 4.3 s fallback timer that shows the result if the event has not arrived.
- Label overflow: `Chúc may mắn` on a 280 px wheel — use 11 px for that wedge or a two-line `<tspan>`; check visually.
