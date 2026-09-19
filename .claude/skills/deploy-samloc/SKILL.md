---
name: deploy-samloc
description: Deploy Sâm Lốc Online to Cloudflare Workers, with pre-flight checks. Use when the user wants to ship, publish, or deploy the app.
disable-model-invocation: true
---

Deploy is a single Worker carrying the SPA assets, the Hono API, and the `RoomDO` Durable Object. Do the pre-flight checks before building — a failed deploy mid-way leaves a half-updated Worker.

## Pre-flight

1. `pnpm typecheck` — must pass. Do not deploy past type errors.
2. `pnpm test` — must pass. Do not skip or weaken a test to get through.
3. Confirm the user is logged in: `pnpm --filter @samloc/worker exec wrangler whoami`. If not, tell the user to run `! pnpm --filter @samloc/worker exec wrangler login` themselves — it opens a browser and cannot be done for them.
4. Check `apps/worker/wrangler.jsonc` has a real `database_id` for the `samloc-db` D1 binding. If it is empty or a placeholder, stop and tell the user to create the remote DB first:
   `pnpm --filter @samloc/worker exec wrangler d1 create samloc-db`
   then paste the returned `database_id` into `apps/worker/wrangler.jsonc`.
5. Confirm remote D1 migrations are applied:
   `pnpm --filter @samloc/worker exec wrangler d1 migrations apply samloc-db --remote`
   Ask the user before running this — it writes to the production database.

## Deploy

Run `pnpm run deploy` from the repo root. The `run` is required: bare `pnpm deploy` invokes pnpm's built-in deploy command and fails with `ERR_PNPM_NOTHING_TO_DEPLOY`.

This builds the web app first, which emits a generated Wrangler config inside the web build output at `samloc/wrangler.json`; the worker's deploy script targets that generated file rather than `apps/worker/wrangler.jsonc`. Never run `wrangler deploy` from `apps/worker` without building first — it will either fail on the missing config or ship stale assets.

## After

Report the deployed URL from the Wrangler output. Remind the user that WebSocket rooms are in-memory per Durable Object: a deploy evicts live rooms and drops players mid-game.
