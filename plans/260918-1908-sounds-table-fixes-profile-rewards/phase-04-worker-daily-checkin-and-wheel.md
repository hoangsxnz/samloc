---
phase: 4
title: "Worker: daily check-in and wheel"
status: completed
priority: P1
effort: "3h"
dependencies: [3]
---

# Phase 4: Worker: daily check-in and wheel

## Goal

Credit coins for one check-in a day and up to five wheel spins a day, with
the limits and the prize draw enforced on the server and the coins folded
into the derived budget.

## Context

- `apps/worker/src/budget.ts` — `budgetFor()` = `STARTING_BUDGET` + Σ
  `hand_results.delta_la × room_sessions.stake_per_la`. Adding a second sum
  keeps the budget derived (no stored balance to drift); it is called on
  `/api/me`, login and the WS upgrade, so grants show everywhere at once.
- `apps/worker/src/routes-rooms.ts` — reference for a route file that reads
  `c.var.user` and D1 with parameterised queries.
- Day boundary: the friend group is in Vietnam (UTC+7, no DST); the key is
  computed on the server so a client clock cannot claim tomorrow's reward.
- Concurrency: the check-in uniqueness and the spin cap are both enforced by
  the database in one statement each, so two parallel requests cannot double
  credit.
- Depends on Phase 3 only for migration numbering (`0003`) and the shared
  `index.ts` mount.

## Files to Create / Modify

- Create: `apps/worker/migrations/0003_coin_grants.sql`
- Create: `apps/worker/src/rewards.ts`
- Create: `apps/worker/src/routes-rewards.ts`
- Create: `apps/worker/tests/rewards.test.ts`
- Modify: `apps/worker/src/budget.ts`
- Modify: `apps/worker/src/index.ts`

## Tasks & Steps

1. **Migration** — `0003_coin_grants.sql`:
   ```sql
   CREATE TABLE coin_grants (
     id         TEXT PRIMARY KEY,
     user_id    TEXT NOT NULL REFERENCES users(id),
     kind       TEXT NOT NULL CHECK (kind IN ('checkin', 'wheel')),
     amount     INTEGER NOT NULL,
     day        TEXT NOT NULL,          -- YYYY-MM-DD in UTC+7
     created_at INTEGER NOT NULL
   );
   CREATE INDEX idx_coin_grants_user_day ON coin_grants(user_id, day, kind);
   CREATE UNIQUE INDEX idx_coin_grants_checkin ON coin_grants(user_id, day) WHERE kind = 'checkin';
   ```
2. **Pure rules** — `rewards.ts`:
   ```ts
   export const CHECKIN_AMOUNT = 1_000;
   export const WHEEL_SPINS_PER_DAY = 5;
   export interface WheelSegment { amount: number; weight: number; label: string }
   export const WHEEL_SEGMENTS: readonly WheelSegment[] = [
     { amount: 200,    weight: 30, label: '200' },
     { amount: 400,    weight: 22, label: '400' },
     { amount: 600,    weight: 16, label: '600' },
     { amount: 1_000,  weight: 13, label: '1.000' },
     { amount: 2_000,  weight: 9,  label: '2.000' },
     { amount: 4_000,  weight: 5,  label: '4.000' },
     { amount: 10_000, weight: 2,  label: '10.000' },
     { amount: 0,      weight: 3,  label: 'Chúc may mắn' },
   ]; // weights sum to 100; expected value ≈ 950 đ per spin
   const DAY_OFFSET_MS = 7 * 60 * 60 * 1000;
   /** Calendar day in Vietnam (UTC+7): the reward resets at midnight local time, not UTC. */
   export function dayKey(nowMs: number): string   // new Date(nowMs + DAY_OFFSET_MS).toISOString().slice(0, 10)
   /** `random` in [0, 1): walks the cumulative weights; the last segment absorbs rounding. */
   export function pickSegment(random: number): number
   export function randomUnit(): number   // crypto.getRandomValues(new Uint32Array(1))[0] / 2**32
   ```
3. **Budget** — `budget.ts`: one query with a numbered bind:
   ```sql
   SELECT
     (SELECT COALESCE(SUM(h.delta_la * r.stake_per_la), 0)
        FROM hand_results h JOIN room_sessions r ON r.code = h.room_code
       WHERE h.user_id = ?1)
   + (SELECT COALESCE(SUM(amount), 0) FROM coin_grants WHERE user_id = ?1) AS net
   ```
   Update the doc comment: "…plus every coin grant (daily check-in, wheel)".
4. **Routes** — `routes-rewards.ts` (`rewardRoutes`):
   - `GET /rewards` → `{ day, checkedIn, spinsLeft, checkinAmount, segments: [{ amount, label }] }` from
     `SELECT kind, COUNT(*) AS n FROM coin_grants WHERE user_id = ? AND day = ? GROUP BY kind`.
   - `POST /checkin` → `INSERT INTO coin_grants … ('checkin', 1000, day)`; catch the
     unique-constraint error (`message` contains `UNIQUE`) → 409
     `{ error: 'Hôm nay đã điểm danh rồi' }`; success → `{ amount, budget }` via `budgetFor`.
   - `POST /spin` → `pickSegment(randomUnit())`, then one atomic statement:
     ```sql
     INSERT INTO coin_grants (id, user_id, kind, amount, day, created_at)
     SELECT ?1, ?2, 'wheel', ?3, ?4, ?5
      WHERE (SELECT COUNT(*) FROM coin_grants WHERE user_id = ?2 AND kind = 'wheel' AND day = ?4) < ?6
     ```
     `meta.changes === 0` → 429 `{ error: 'Hết lượt quay hôm nay' }`; success →
     `{ segment, amount, spinsLeft, budget }` (`spinsLeft` recounted after the insert).
   - `index.ts`: `app.route('/api', rewardRoutes)`.
5. **Tests** — `tests/rewards.test.ts`:
   - `dayKey(Date.UTC(2026, 8, 18, 16, 59, 59))` → `2026-09-18`; `…17, 0, 0` → `2026-09-19`.
   - weights sum to 100; `pickSegment(0)` → 0; `pickSegment(0.9999)` → 7; `pickSegment(0.30)` → 1 (boundary goes to the next segment).
   - 20 000 draws with a seeded LCG: each segment's share within ±2 points of its weight.
   - `WHEEL_SEGMENTS.length === 8` and exactly one `amount === 0`.

## Verification

- `pnpm --filter @samloc/worker typecheck && pnpm --filter @samloc/worker test`
- `/db-reset`, `pnpm dev`, logged-in cookie:
  ```
  curl -b sid=… localhost:5173/api/rewards
  curl -b sid=… -X POST localhost:5173/api/checkin      # 200 {amount:1000,budget:11000}
  curl -b sid=… -X POST localhost:5173/api/checkin      # 409
  for i in 1 2 3 4 5 6; do curl -s -b sid=… -X POST localhost:5173/api/spin; echo; done   # 5×200, then 429
  curl -b sid=… localhost:5173/api/me                   # budget = 10000 + 1000 + Σ spins
  ```
- Two `POST /spin` fired concurrently (`curl … & curl … & wait`) with 4 spins used → exactly one 200.

## Todo

- [x] `0003_coin_grants.sql` applied locally
- [x] `rewards.ts` constants, `dayKey`, `pickSegment`, `randomUnit`
- [x] `budgetFor` includes grants
- [x] `GET /rewards`, `POST /checkin`, `POST /spin` mounted
- [x] `rewards.test.ts` green

## Success Criteria

Limits hold under the curl sequence above, including the concurrent spin;
`/api/me` budget reflects grants immediately.

## Risk / Security

- The prize is drawn server-side from `crypto.getRandomValues`; the client only animates to the returned index.
- A user with two sessions still shares one `user_id`, so limits are per account, not per device.
- Changing segment weights later needs no migration: `amount` is stored per grant.
