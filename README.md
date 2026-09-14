# Sâm Lốc Online

Browser card game (Sâm Lốc, house rules in `docs/game-rules.md`) for a private group of friends.
One Cloudflare Worker serves the Svelte 5 web app, the `/api/*` auth and lobby endpoints, and
`/ws/:code` realtime rooms backed by one Durable Object per room. Landscape only, Vietnamese UI.

## Layout

| Package | What |
|---|---|
| `packages/rules` | Pure TypeScript rules engine (cards, combos, reducer, settlement). Zero deps, fully unit-tested. |
| `apps/worker` | Hono API, D1 auth/sessions/history, `RoomDO` Durable Object with WebSocket Hibernation. |
| `apps/web` | Vite + Svelte 5 + Tailwind v4 SPA. Hash router, five screens. |

## Requirements

Node 24, pnpm 10, a Cloudflare account with Workers and D1 (free tier is enough).

## Develop

```bash
pnpm install
pnpm --filter @samloc/worker exec wrangler d1 migrations apply samloc-db --local --persist-to ../web/.wrangler/state
pnpm dev            # http://localhost:5173 — SPA, API, WebSocket and local D1/DO in one server
pnpm -r typecheck
pnpm -r test
```

The dev server is Vite with `@cloudflare/vite-plugin`, so the Worker, Durable Object and D1 run
locally inside the same process. Local D1 state lives under `apps/web/.wrangler/state`; apply
migrations there (the command above) or run `pnpm dev` once first.

## Deploy

```bash
pnpm --filter @samloc/worker exec wrangler login
pnpm --filter @samloc/worker exec wrangler d1 create samloc-db      # first time only; paste the id into apps/worker/wrangler.jsonc
pnpm --filter @samloc/worker exec wrangler d1 migrations apply samloc-db --remote
pnpm run deploy
```

`pnpm run deploy` builds the web app and deploys the Worker with the built assets. See
`docs/deployment.md` and `docs/runbook.md`.
