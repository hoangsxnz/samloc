---
phase: 1
title: Worker budget derivation and lobby chip
status: completed
priority: P2
effort: 45m
dependencies: []
---

# Phase 1: Worker budget derivation and lobby chip

## Overview

Replace the `totalLa` field of the auth responses with a derived money `budget` (10 000 baseline ± every settled hand × that room's stake) and show it in the lobby header chip instead of `Tổng: N lá`.

## Requirements

- Functional: a freshly registered user sees `10.000`; after a hand where they net −3 lá at stake 100 the lobby shows `9.700` on next `/api/me`.
- Functional: `/api/register`, `/api/login`, `/api/me` return `budget: number` and no longer return `totalLa`.
- Non-functional: no migration, no new table, no change to the DO write path (`room-do-hand.ts:124` insert stays as is).

## Architecture

```
users ──< hand_results (delta_la) >── room_sessions (stake_per_la)
                 │
   budget = 10000 + COALESCE(SUM(h.delta_la * r.stake_per_la), 0)   -- one query per auth response
                 │
   routes-auth.ts ──JSON {budget}──▶ api.ts AuthUser ──▶ session.svelte.ts ──▶ lobby-screen.svelte chip
```

The lobby already refreshes `/api/me` on mount (`lobby-screen.svelte:16`), so the budget updates when returning from a table without further wiring.

## Related Code Files

- Modify: `apps/worker/src/routes-auth.ts`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/screens/lobby-screen.svelte`
- Read only: `apps/worker/src/routes-rooms.ts` (reference for the `netScore` join), `apps/worker/migrations/0001_init.sql`

## Implementation Steps

1. `routes-auth.ts` — replace `totalLaFor` with `budgetFor`:
   ```ts
   const STARTING_BUDGET = 10_000;

   /** Money balance: everyone starts at STARTING_BUDGET; each settled hand moves it by lá × that room's stake. */
   async function budgetFor(db: D1Database, userId: string): Promise<number> {
     const row = await db
       .prepare(
         `SELECT COALESCE(SUM(h.delta_la * r.stake_per_la), 0) AS net
          FROM hand_results h JOIN room_sessions r ON r.code = h.room_code
          WHERE h.user_id = ?`,
       )
       .bind(userId)
       .first<{ net: number }>();
     return STARTING_BUDGET + (row?.net ?? 0);
   }
   ```
2. `routes-auth.ts` — in `/register` return `budget: STARTING_BUDGET`; in `/login` and `/me` return `budget: await budgetFor(...)`. Remove the `totalLa` key from all three responses.
3. `api.ts` — `AuthUser`: rename `totalLa: number` → `budget: number`.
4. `lobby-screen.svelte:49` — chip becomes:
   ```svelte
   <span class="chip lobby-chip">Ngân sách: {formatBudget(session.user?.budget ?? 0)}</span>
   ```
   with a local helper in the `<script>` block (single use, no new module):
   ```ts
   const formatBudget = (n: number) => n.toLocaleString('vi-VN'); // 10000 → "10.000"
   ```
5. `grep -rn totalLa apps/web/src/lib apps/web/src/screens/lobby-screen.svelte` must return nothing. `SeatView.totalLa` hits elsewhere are expected and stay.
6. Run `pnpm --filter @samloc/worker typecheck && pnpm --filter @samloc/web typecheck`.

## Success Criteria

- [ ] `curl` register on local wrangler dev returns `"budget":10000` and no `totalLa`
- [ ] `/api/me` for a user with hand results returns `10000 + Σ(delta_la × stake_per_la)` (verify against a `SELECT` on the local D1)
- [ ] Lobby header shows `Ngân sách: 10.000` for a new user
- [ ] `pnpm -r typecheck` green; existing worker tests (26) still pass

## Risk Assessment

- **Existing deployed users** — derived formula gives them 10 000 ± their history automatically; no backfill needed.
- **Stale client cache** — a client with the old bundle reads `user.totalLa` → `undefined ?? 0` → shows 0 until reload. Acceptable; the SPA is served by the same Worker deploy.
- **Rooms with no hand_results rows** contribute nothing; `COALESCE` keeps the sum at 0 for users who never played.
