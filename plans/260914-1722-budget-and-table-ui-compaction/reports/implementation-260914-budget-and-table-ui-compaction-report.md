# Implementation report — budget and table UI compaction

Plan: `plans/260914-1722-budget-and-table-ui-compaction/plan.md`. All 3 phases done.

## Changes

| Area | File | Change |
|---|---|---|
| Worker | `apps/worker/src/routes-auth.ts` | `totalLaFor` → `budgetFor`: `10000 + COALESCE(SUM(delta_la × stake_per_la),0)` via JOIN `room_sessions`; `/api/register|login|me` return `budget`, drop `totalLa` |
| Web | `apps/web/src/lib/api.ts` | `AuthUser.totalLa` → `budget` |
| Web | `apps/web/src/screens/lobby-screen.svelte` | header chip `Ngân sách: 10.000` (`toLocaleString('vi-VN')`) |
| Web | `apps/web/src/components/timer-ring.svelte` | props `size` (56), `stroke` (4), `digits` (true); geometry now `$derived` |
| Web | `apps/web/src/components/opponent-seat.svelte` | 80 px column, 40 px avatar; active seat: 48 px arc-only ring wraps avatar, seconds replace the initial, red + pulse < 5 s; card-back 22×30 + lá total in one row; smaller name/pills |
| Web | `apps/web/src/lib/table-layout.ts` | `SEAT_WIDTH=80`; top seats x 200 / y 48, top-centre centred, side seats y 120 |
| Web | `apps/web/src/components/action-bar.svelte`, `screens/table/table-screen.svelte` | label is literal `Đánh`; unused `combo` prop removed (`currentCombo` kept — drives `Bỏ lượt`) |
| Docs | `docs/design-guidelines.md`, `docs/codebase-summary.md` | seat/timer/layout/lobby-chip/auth-contract text synced |

No migration. `SeatView.totalLa` (per-room lá) untouched. `comboLabel` still used by `table-logic.svelte.ts`.

## Verification

| Check | Result |
|---|---|
| `pnpm -r typecheck` | green (svelte-check 311 files, 0 errors) |
| `pnpm -r test` | 121/121 (rules 95, worker 26) |
| `pnpm build` | green |
| `POST /api/register` on local Vite+workerd | `{"budget":10000}`, no `totalLa`; `/api/me` same |
| Browser, 5 players (4 WS bots + host), 900×450 viewport | active right seat "24" in avatar with gold arc; active top seat "29"/"28" clear of top bar; card counts, `+0` totals, `⟳` pills render; centre stack card + name clear of all seats; `Bỏ lượt` + `Đánh` (plain) visible; me-chip unchanged. Screenshots: `screenshot-table-5-players-*.png` in this folder |
| Danger state | verified in DOM: `.opp-avatar.active` text `4`, class `danger` present (screenshot missed the 3 s window because of tool latency) |
| Code review | `code-review-260914-…-report.md`: no blocking findings |
| Tests report | `test-results-260914-…-report.md`: DONE |

## Notes

- Visual pass ran with Playwright (Chrome extension was not connected). Test accounts were throwaway users on the local dev DB (`vis*`, `bot*`), created via curl; the browser session logged in with a fetch to `/api/login` using those fixture credentials.
- Bot helper lives in the session scratchpad only (`table-bots.mjs`), not in the repo.
- `docs/wireframe/*.html` still show the old seat geometry (historical spec, left as is).
- Not checked at 2/3/4 players in the browser; geometry for those slots is a subset of the 5-player positions (top-centre only differs) and was checked arithmetically.

## Unresolved questions

- Repo has no commits yet; whole tree is untracked. Commit is the user's call.
- Digits replace the avatar initial during an opponent's turn (plan decision). If the user prefers keeping the initial, alternative is a small digit badge at the avatar corner.
