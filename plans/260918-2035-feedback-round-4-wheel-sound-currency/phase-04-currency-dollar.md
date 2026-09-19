---
phase: 4
title: "Currency: $10,000 everywhere"
status: done
priority: P1
effort: "30m"
dependencies: []
---

# Phase 4: Currency: `$10,000` everywhere

## Goal

Every money string reads `$10,000` (`$` prefix, comma grouping), deltas read
`+$500` / `−$500`, and the wheel wedge labels use the same grouping
(`1,000`, `10,000`).

## Context

- `apps/web/src/lib/format-money.ts` — `formatMoney()` returns
  `${value.toLocaleString('vi-VN')}đ`; `formatMoneyDelta()` puts the sign in
  front. Every money string in the web app goes through these two
  (`me-chip`, `opponent-seat`, `lobby-screen`, `home-screen`, `checkin-card`,
  `wheel-modal`, `result-row`, `hand-result-modal`), so no call site changes.
- `apps/worker/src/rewards.ts:11-20` — `WHEEL_SEGMENTS[].label` strings
  `'1.000'`, `'2.000'`, `'4.000'`, `'10.000'`; the comment on line 10 says
  "≈ 950 đ per spin". `apps/worker/tests/rewards.test.ts` does not assert
  labels.
- `apps/web/src/components/wheel-modal.svelte:82` — `class:long={w.label.length > 6}`
  keeps working: `10,000` is 6 chars like `10.000`.
- Not money, leave as is: `"Tiền 1 lá"` segmented control (`50/100/200/500`)
  and `"${settings.stakePerLa} / lá"` in `waiting-screen.svelte`.
- `docs/codebase-summary.md:131` documents "vi-VN grouping with `đ`".

## Files to Modify

- `apps/web/src/lib/format-money.ts`
- `apps/worker/src/rewards.ts`
- `docs/codebase-summary.md` (line 131)

## Tasks & Steps

1. `format-money.ts`:
   ```ts
   /** Money is stored in whole units and shown as `$10,000`; every screen goes through here. */
   export function formatMoney(value: number): string {
     return `$${value.toLocaleString('en-US')}`;
   }
   export function formatMoneyDelta(value: number): string {
     return `${value >= 0 ? '+' : '−'}${formatMoney(Math.abs(value))}`;
   }
   ```
2. `rewards.ts`: labels `'1,000'`, `'2,000'`, `'4,000'`, `'10,000'`; comment
   "expected value ≈ $950 per spin".
3. `docs/codebase-summary.md:131`: "`$` prefix with en-US grouping (`$10,000`)".
4. `grep -rn "đ\b\|[0-9]đ" apps/web/src` — only Vietnamese words remain
   (`đăng nhập`, `đền bài`, …), no money.

## Verification

- `pnpm typecheck && pnpm test` (worker tests cover `pickSegment`, unaffected).
- `pnpm dev`: home budget chip `Ngân sách: $10,000`; check-in card
  `+$1,000 mỗi ngày`; wheel wedges `200 … 10,000`, spin result `+$1,000 🎉`;
  table seats and me-chip `$10,000`; result rows `+$300` / `−$300` and totals.
- Seat/me-chip widths unchanged (`$10,000` is as wide as `10.000đ`).

## Todo

- [x] `formatMoney` / `formatMoneyDelta` emit `$` + en-US grouping
- [x] Wheel labels regrouped with commas
- [x] Docs line updated
- [x] Visual pass over home, lobby, table, result, wheel
