# Code review: budget and table UI compaction

Reviewed working tree (repo has no commits yet, so read files directly against plan.md + 3 phase files, no `git diff` available).

## Scope
apps/worker/src/routes-auth.ts, apps/web/src/lib/api.ts, apps/web/src/screens/lobby-screen.svelte,
apps/web/src/components/timer-ring.svelte, apps/web/src/components/opponent-seat.svelte,
apps/web/src/lib/table-layout.ts, apps/web/src/components/action-bar.svelte,
apps/web/src/screens/table/table-screen.svelte, docs/design-guidelines.md, docs/codebase-summary.md.

## Findings

### (a) Success criteria — all 3 phases
- Phase 1: `budgetFor` matches spec exactly (routes-auth.ts:17-30, 62, 88, 101); `AuthUser.budget` (api.ts:5); lobby chip `Ngân sách: {formatBudget(...)}` (lobby-screen.svelte:52) with `toLocaleString('vi-VN')`. Met.
- Phase 2: `TimerRing` size/stroke/digits props with `$derived` radius/circumference, `{#if digits}` wrapper — matches spec verbatim (timer-ring.svelte:1-21). `opponent-seat.svelte` markup/styles match spec (avatar-wrap 40px, arc 48/stroke3/digits=false, opp-count-row, deleted `.opp-timer`). `table-layout.ts` SEAT_WIDTH=80 and SLOT_POSITIONS match spec. Geometry check (arithmetic, not visual): top-left x200-280 / top-right x564-644 both clear centre stack (x302-542); top-centre x382-462 clears centre stack y-range (seat bottom ~141 < stack top 150); side seats x44-124/y120-213 clear me-chip (y306). Global `box-sizing: border-box` confirmed at apps/web/src/app.css:85, validating plan's "sizes are outer sizes" assumption. Met.
- Phase 3: action-bar.svelte renders literal `Đánh` unconditionally (line 28), no `comboLabel` import in that file; `comboLabel` still exported from card-view.ts and consumed by table-logic.svelte.ts:93. Docs updated (design-guidelines.md §"Seat (opponent)", "Timer ring", §7 layout line, lobby chip line; codebase-summary.md lines 38, 101) — no stale `Tổng:`/`totalLa` for AuthUser remains. Met.

### (b) Regression check — no breakage found
- `me-chip.svelte:31` calls `<TimerRing {remain} {turnSeconds} />` with no size/stroke/digits — uses new defaults (56/4/true), unchanged visual per plan.
- `opponentSlots`/`SLOT_POSITIONS` consumed only by table-screen.svelte, correctly passed through.
- Grepped all of apps/web/src and apps/worker/src for `totalLa`: every remaining hit is the per-room `SeatView.totalLa` (opponent-seat.svelte:39, hand-result-modal.svelte:59, result-row.svelte:35, table-top-bar.svelte:20, room-do-view.ts, ws-types.ts) — the field the plan says must stay untouched. No stale `AuthUser.totalLa` reference anywhere.

### (c) Public contract changes
`/api/register`, `/api/login`, `/api/me` now return `budget: number`, drop `totalLa` — intentional per plan, only consumer (lobby-screen.svelte) updated. No other route/response shape changed.

### (d) SQL correctness (SQLite/D1)
`budgetFor` query: `hand_results h JOIN room_sessions r ON r.code = h.room_code`. `hand_results.room_code` has `REFERENCES room_sessions(code)` (migrations/0001_init.sql) and the only write path (room-do-hand.ts:124) always follows room creation (routes-rooms.ts), so a hand_results row with no matching room_sessions row cannot occur in practice — inner join is safe, `COALESCE(SUM(...), 0)` correctly handles users with zero hands. Integer multiplication `delta_la * stake_per_la` is fine in SQLite (no overflow risk at these magnitudes).

### (e) Svelte 5 correctness
`$derived` usage in timer-ring.svelte (centre, radius, circumference, fraction, dash, danger) and opponent-seat.svelte (displayName, posStyle, danger) is correct — all pure derivations, no side effects. `class:danger` / `class:active` shorthand correct (local `const danger`/prop `active` in scope). No obvious runtime-warning triggers (no unguarded prop mutation, no reactive loops).

### (f) Verification commands (re-run, not just trusted)
- `pnpm -r typecheck` → green, 0 errors/warnings (svelte-check: 311 files, 0 errors).
- `pnpm --filter @samloc/worker test` → 26/26 passing.
- `pnpm build` → both worker and client bundles built successfully.

## Minor / informational (non-blocking)

1. **`currentCombo` prop kept, not removed** — plan step (phase-03 step 1) said "the combo prop is now unused inside the component: remove it". Actual `action-bar.svelte` keeps `currentCombo: Combo | null` (renamed from a prior `combo`) because it's still needed to conditionally render the "Bỏ lượt" button (`{#if currentCombo !== null}`), which the plan's assumption missed. This is the correct call — removing it would break "Bỏ lượt" visibility — and the plan itself hedged with "Keep the Combo type import only if combo prop remains in Props." Not a defect; flagging only because it diverges from the plan's literal step text.
2. **No automated test coverage for `budgetFor`/register/login/me** — the worker test suite (`tests/auth.test.ts`, `room-code.test.ts`, `room-do-view.test.ts`) is unit-level only (validation/hashing/pure functions); no integration test exercises the D1-backed auth routes before or after this change. This is a pre-existing gap in the repo's test strategy, not a regression, and the plan's own verification step only calls for manual curl + existing 26 tests, consistent with that pattern. Noting for awareness, not requesting a fix.
3. Side-seat tag-queue vs Báo Sâm pill clearance is documented in the plan itself as a ~1px margin (tag queue to ≈265, pill starts 266) — geometry only, not independently re-verified visually (no browser session in this review); plan explicitly marks the top-centre/centre-stack graze as "accepted" cosmetic risk.

## Unresolved questions
None blocking. Items 1-3 above are informational only.
