# Deployment — Cloudflare Workers

Target: one Worker serving the static Svelte build (Workers Static Assets) + `/api/*` (Hono) +
`/ws/:code` (Durable Object WebSocket). Config lives in `apps/worker/wrangler.jsonc`.

## Resources (all free tier)
- Worker `samloc` — `assets` (`../web/dist/client`, SPA fallback, `run_worker_first: ["/api/*", "/ws/*"]`),
  `durable_objects.bindings` `ROOM → RoomDO`, `d1_databases` `DB → samloc-db`.
- D1 `samloc-db` — `users` (with `avatar_blob` / `avatar_ver`), `sessions`, `room_sessions`, `hand_results`, `coin_grants` (`apps/worker/migrations/`).
- Durable Object class `RoomDO` (SQLite-backed, `new_sqlite_classes` migration `v1`).

## Steps
1. `pnpm --filter @samloc/worker exec wrangler login` (browser, no card).
2. `pnpm --filter @samloc/worker exec wrangler d1 create samloc-db` → paste the `database_id` into `wrangler.jsonc`.
3. `pnpm --filter @samloc/worker exec wrangler d1 migrations apply samloc-db --remote` — run again before every deploy that adds a migration; `0002_profile_avatar.sql` and `0003_coin_grants.sql` must be applied remotely before deploying the profile / rewards round.
4. `pnpm run deploy` — builds `apps/web` then runs `wrangler deploy` against the config Vite emitted
   at `apps/web/dist/samloc/wrangler.json` (the Cloudflare Vite plugin resolves the Worker bundle,
   the assets directory and the bindings there).
5. URL: https://samloc.samloc-worker.workers.dev (custom domain optional). D1 `samloc-db` lives in region APAC.

Deployment status (2026-09-14): not yet deployed; `wrangler login` has not been run on the build machine.

## Local dev
`pnpm dev` runs Vite with `@cloudflare/vite-plugin` on http://localhost:5173. The Worker, `RoomDO`
and D1 all run in-process (workerd), so the SPA, `/api/*` and `/ws/*` share one origin — no proxy.
Local D1 state is under `apps/web/.wrangler/state`; apply migrations with
`--local --persist-to ../web/.wrangler/state` from `apps/worker`. The plain `wrangler dev` fallback
(port 8787 + Vite proxy) was not needed.

## Limits to watch
- Free plan: 100k Worker requests/day, DO 100k requests/day, WS messages count as requests when not hibernated. Fine for ≤20 users.
- CPU time 10 ms/request on free plan: the rules engine is pure and cheap; PBKDF2 runs in native WebCrypto.
