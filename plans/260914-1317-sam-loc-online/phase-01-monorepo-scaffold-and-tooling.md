---
phase: 1
title: "Monorepo scaffold and tooling"
status: completed
effort: "2h"
priority: P1
dependencies: []
---

# Phase 1: Monorepo scaffold and tooling

Context: `docs/tech-stack.md`, `plans/reports/research-svelte-260914-1415-svelte5-vite-tailwind-monorepo-report.md`

## Overview

Stand up the pnpm 10 workspace with three packages and make `pnpm -r typecheck`, `pnpm -r test`,
`pnpm build` and `wrangler dev` all run green on hello-world content. No game logic, no UI, no auth.
This phase exists so every later phase has a working verify command from step one.

## Requirements

**Functional**
- Workspace `packages/rules`, `apps/worker`, `apps/web` resolvable via `workspace:*`.
- `apps/worker` and `apps/web` both import a symbol from `@samloc/rules` **as TypeScript source** and typecheck.
- `wrangler dev` boots with a `RoomDO` stub class, a D1 binding, and static assets from `apps/web/dist`.
- `vite dev` (via `@cloudflare/vite-plugin`) serves the SPA and proxies `/api/*` + `/ws/*` to the worker runtime.

**Non-functional**
- TypeScript strict everywhere; no `any` in scaffolded files.
- Every file ≤200 lines; kebab-case filenames.
- Zero runtime deps in `packages/rules`.

## Architecture

```
samloc/
├── package.json            # private, type: module, workspace scripts
├── pnpm-workspace.yaml     # packages: apps/*, packages/*
├── tsconfig.base.json      # strict, ES2023, moduleResolution: bundler
├── packages/rules/         # @samloc/rules — exports "." -> ./src/index.ts
├── apps/worker/            # @samloc/worker — wrangler.jsonc, Hono, RoomDO
└── apps/web/               # @samloc/web — Vite + Svelte 5 + Tailwind v4
```

Data flow established here (empty but wired): browser → `/api/*` and `/ws/*` hit the Worker first
(`run_worker_first`), everything else falls through to Static Assets with SPA fallback.
Both `apps/worker` and `apps/web` consume `@samloc/rules` source; pnpm symlinks it, Vite and Wrangler
transpile the `.ts` directly.

**Source-consumption fallback (decide in step 7, not later):** if `wrangler dev`/`wrangler deploy`
refuses to resolve `./src/index.ts` from the workspace link, add `tsconfig.build.json` +
`"build": "tsc -p tsconfig.build.json"` to `packages/rules`, switch `exports` to
`{ ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } }`, and add
`"prebuild"`/`"predeploy"` hooks in `apps/worker`. Do not ship both paths.

## Related Code Files

**Create**
- `package.json`, `pnpm-workspace.yaml`, `.npmrc`, `.gitignore`, `.editorconfig`, `tsconfig.base.json`
- `packages/rules/package.json`, `packages/rules/tsconfig.json`, `packages/rules/vitest.config.ts`
- `packages/rules/src/index.ts` (exports `RULES_VERSION = '1'` placeholder)
- `packages/rules/tests/smoke.test.ts`
- `apps/worker/package.json`, `apps/worker/tsconfig.json`, `apps/worker/wrangler.jsonc`
- `apps/worker/src/index.ts` (Hono app, `GET /api/health`), `apps/worker/src/room-do.ts` (stub DO)
- `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/index.html`
- `apps/web/src/main.ts`, `apps/web/src/app.svelte`, `apps/web/src/app.css`
- `apps/web/public/manifest.webmanifest`

**Modify / Delete** — none.

## Implementation Steps

1. `cd /mnt/01DAC8DEA845E9E0/disk3/samloc && corepack use pnpm@10` and `node -v` (expect v24.x).
2. Write `pnpm-workspace.yaml`:
   ```yaml
   packages:
     - "apps/*"
     - "packages/*"
   ```
3. Root `package.json`: `private: true`, `type: "module"`, `packageManager: "pnpm@10.33.0"`,
   `engines.node: ">=24"`, scripts:
   `dev` → `pnpm --filter @samloc/web dev`; `build` → `pnpm --filter @samloc/web build`;
   `typecheck` → `pnpm -r typecheck`; `test` → `pnpm -r test`;
   `deploy` → `pnpm build && pnpm --filter @samloc/worker deploy`.
4. `tsconfig.base.json`: `"strict": true`, `"noUncheckedIndexedAccess": true`, `"target": "ES2023"`,
   `"module": "ESNext"`, `"moduleResolution": "bundler"`, `"verbatimModuleSyntax": true`,
   `"isolatedModules": true`, `"skipLibCheck": true`.
5. `packages/rules/package.json`: name `@samloc/rules`, `type: module`, no `dependencies`,
   `"exports": { ".": "./src/index.ts" }`, scripts `typecheck: tsc --noEmit`, `test: vitest run`.
   devDeps: `typescript`, `vitest`. `vitest.config.ts` → `test: { environment: 'node', globals: true }`.
6. `pnpm --filter @samloc/rules add -D typescript vitest`. Add `tests/smoke.test.ts` asserting
   `RULES_VERSION === '1'`. Run `pnpm --filter @samloc/rules test`.
7. `apps/worker`: `pnpm --filter @samloc/worker add hono @samloc/rules@workspace:*` and
   `-D wrangler @cloudflare/workers-types @cloudflare/vitest-pool-workers typescript`.
   `wrangler.jsonc`:
   ```jsonc
   {
     "name": "samloc",
     "main": "src/index.ts",
     "compatibility_date": "2026-09-01",
     "assets": { "binding": "ASSETS", "directory": "../web/dist",
                 "not_found_handling": "single-page-application",
                 "run_worker_first": ["/api/*", "/ws/*"] },
     "durable_objects": { "bindings": [{ "name": "ROOM", "class_name": "RoomDO" }] },
     "migrations": [{ "tag": "v1", "new_sqlite_classes": ["RoomDO"] }],
     "d1_databases": [{ "binding": "DB", "database_name": "samloc-db", "database_id": "local" }]
   }
   ```
   `src/index.ts` = Hono app with `GET /api/health` returning `{ ok: true, rules: RULES_VERSION }`,
   default export `{ fetch: app.fetch }`, plus `export { RoomDO } from './room-do';`.
   `src/room-do.ts` = `export class RoomDO extends DurableObject { async fetch() { return new Response('ok'); } }`.
   Run `pnpm --filter @samloc/worker exec wrangler types` to generate `worker-configuration.d.ts`.
8. `apps/web`: `pnpm --filter @samloc/web add -D vite @sveltejs/vite-plugin-svelte svelte
   @tailwindcss/vite tailwindcss @cloudflare/vite-plugin typescript svelte-check`.
   `vite.config.ts` → `plugins: [svelte(), tailwindcss(), cloudflare({ configPath: '../worker/wrangler.jsonc' })]`,
   `build.outDir: 'dist'`. `app.css` starts with `@import "tailwindcss";` plus an `@theme` block holding
   the palette tokens from `docs/design-guidelines.md` §1 (`--color-felt`, `--color-gold`, …).
   `index.html`: `viewport-fit=cover` meta, Be Vietnam Pro `css2` link (weights 400;600;700),
   `<link rel="manifest" href="/manifest.webmanifest">`, `lang="vi"`.
   `manifest.webmanifest`: `display: "fullscreen"`, `orientation: "landscape"`, `start_url: "/"`.
   `app.svelte` renders the app name only. Script `typecheck` → `svelte-check --tsconfig ./tsconfig.json`.
9. Verify: `pnpm -r typecheck && pnpm -r test && pnpm build`, then `pnpm dev` and open
   `http://localhost:5173/api/health` — must return JSON from the Worker, and `/` must serve the SPA.
10. If step 9's worker call fails to resolve `@samloc/rules`, apply the dist fallback from Architecture
    and re-run step 9. Record which path was taken at the top of `apps/worker/wrangler.jsonc` as a comment.

## Success Criteria

- [x] `pnpm -r typecheck` exits 0.
- [x] `pnpm -r test` exits 0 (1 smoke test).
- [x] `pnpm build` produces `apps/web/dist/index.html`.
- [x] `pnpm dev` serves the SPA at `/` and JSON at `/api/health` from the same origin.
- [x] `pnpm --filter @samloc/worker exec wrangler dev` boots with `RoomDO` + `DB` bindings listed, no errors.
- [x] No file in the repo exceeds 200 lines.

## Risk Assessment

| Risk | L×I | Mitigation |
|---|---|---|
| Wrangler cannot import workspace `.ts` (research flags this as unverified) | M×M | Step 10 dist fallback, decided in this phase so phases 2–5 never re-litigate it |
| `@cloudflare/vite-plugin` unstable with DO + D1 + WS together | M×H | Fallback documented in `docs/tech-stack.md`: `wrangler dev` on 8787 + Vite `server.proxy` for `/api` and `/ws` (`ws: true`) |
| `run_worker_first` accepts a boolean, not a glob array, in the installed Wrangler | M×M | Check `wrangler types` / schema error on first `wrangler dev`; fall back to explicit `routes` entries per `docs/deployment.md` |
| Tailwind v4 `@theme` token names collide with design-guideline CSS vars | L×L | Prefix Tailwind theme tokens with `--color-`; keep raw `--felt` etc. as plain CSS vars in `:root` |

**Rollback:** phase creates only new files; `git clean -fd` + `rm -rf node_modules` reverts fully.

## Security Considerations

- `.gitignore` must cover `.env*`, `.wrangler/`, `node_modules/`, `dist/`, `.dev.vars`.
- `database_id` placeholder only; the real id arrives in phase 8 and is not a secret but is committed knowingly.
- No secrets in `wrangler.jsonc`; anything sensitive later goes through `wrangler secret put`.

## Next Steps

Phase 2 (rules engine cards and combos) is unblocked immediately. Phase 4 (worker auth) and phase 6
(web shell) can start in parallel with phase 2 since they touch disjoint directories.
