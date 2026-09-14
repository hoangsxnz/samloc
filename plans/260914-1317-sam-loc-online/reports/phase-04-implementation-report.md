# Phase 4 — Worker auth and D1 — implementation report

## Files created
- `apps/worker/migrations/0001_init.sql` — users, sessions, room_sessions, hand_results tables + indexes (wrangler's own naming, 4-digit not the phase file's `000001`, per team-lead deviation note)
- `apps/worker/src/validation.ts` (61 lines) — `parseUsername`, `parseDisplayName`, `parsePassword`, `parseRoomSettings`, all returning `{ ok, value } | { ok, error }` with Vietnamese messages
- `apps/worker/src/auth.ts` (55 lines) — PBKDF2-SHA256 100k iterations, 16-byte salt, hex encode/decode, `hashPassword`/`verifyPassword`, `crypto.subtle.timingSafeEqual` with XOR fallback (feature-detected via `typeof`)
- `apps/worker/src/room-code.ts` (25 lines) — `generateRoomCode` (rejection sampling, ceiling 224 for the 32-symbol alphabet), `isRoomCode`
- `apps/worker/src/sessions.ts` (56 lines) — `createSession`, `getSessionUser`, `deleteSession`, cookie helpers via `hono/cookie` (`sid`, HttpOnly, Secure, Lax, 30-day maxAge)
- `apps/worker/src/auth-middleware.ts` (16 lines) — resolves `sid` → user, 401 Vietnamese on miss, `c.set('user', user)`
- `apps/worker/src/routes-auth.ts` (95 lines) — register/login/logout/me, identical 401 message for unknown user vs wrong password, `totalLa` sum
- `apps/worker/src/routes-rooms.ts` (137 lines) — create room (3-open-room cap → 429, 5 insert retries on PK conflict), room lookup, recent sessions with player names
- `apps/worker/vitest.config.ts` — see deviation below
- `apps/worker/tests/auth.test.ts` (74 lines, 12 cases) — hash/verify round trip, wrong password, salt uniqueness, all four validators
- `apps/worker/tests/room-code.test.ts` (38 lines, 7 cases incl. 10k-draw scan) — length/alphabet/no-ambiguous-char checks

## Files modified
- `apps/worker/src/index.ts` — mounts `authRoutes`/`roomRoutes` under `/api`, applies `authMiddleware` to `/api/*` except register/login/health, added `app.onError` returning a Vietnamese 500
- `apps/worker/wrangler.jsonc` — untouched (kept `database_id: "local"` per deviation instructions, no login available)
- `apps/worker/package.json` — `test` script: `vitest run --passWithNoTests` → `vitest run`

## Deviations
1. **No `wrangler d1 create`** — skipped per instructions; `database_id` stayed `"local"`.
2. **Migration filename** — used wrangler's own `0001_init.sql` (via `wrangler d1 migrations create`) instead of the phase file's `000001_init.sql`; explicitly permitted.
3. **`vitest.config.ts` uses plain `defineConfig({ test: { environment: 'node' } })`, not `defineWorkersConfig`.** The installed `@cloudflare/vitest-pool-workers@0.22.0` has no `"./config"` export at all (its `exports` map only has `.`, `./types`, `./codemods/vitest-v3-to-v4` — confirmed by reading the package's `package.json`), so `defineWorkersConfig` cannot be imported from this version. This is a hard incompatibility, not a boot failure, so the node-environment fallback (explicitly pre-approved for this exact situation) was used. All three test suites are pure functions (WebCrypto PBKDF2, `crypto.getRandomValues`, string validation) and Node 24's global WebCrypto covers them; 19/19 tests pass.
4. **Local D1 state directory mismatch (the flagged unknown).** `wrangler d1 migrations apply --local`, run from `apps/worker`, persists to `apps/worker/.wrangler/state/v3/d1`. The Cloudflare Vite plugin, run via `pnpm dev` (`apps/web`'s `vite` with `cloudflare({ configPath: '../worker/wrangler.jsonc' })`), persists to **`apps/web/.wrangler/state/v3/d1`** — a different directory even though both point at the same `wrangler.jsonc`. First register attempt 500'd with a silent D1 "no such table" failure (`app.onError` swallows the underlying error message by design — no stack traces — so this took a `sqlite3 .tables` check on both DB files to diagnose). Fixed by re-running the migration with `--persist-to ../web/.wrangler/state` from `apps/worker`. **Report note for phase 5/6/8:** local dev must apply migrations to the `apps/web/.wrangler` tree (or run `pnpm dev` once to create it, then apply with `--persist-to`), not the plain `apps/worker/.wrangler` tree produced by `wrangler dev` alone.

## curl verification (all via `pnpm dev` on :5173, dev server killed afterward)
| Call | Result |
|---|---|
| `POST /api/register` (son / Sơn / matkhau1) | 200, `Set-Cookie: sid=...; HttpOnly; Secure; SameSite=Lax`, `totalLa: 0` |
| `GET /api/me` with cookie | 200, echoes user + `totalLa: 0` |
| `GET /api/me` without cookie | 401 `{"error":"Phiên đăng nhập đã hết hạn"}` |
| `POST /api/register` duplicate username | 409 `{"error":"Tên đăng nhập đã tồn tại"}` |
| `POST /api/rooms` ×4 (same user) | 200, 200, 200, then 429 `{"error":"Bạn đang có 3 phòng mở"}` |
| `GET /api/rooms/:code` (created code, with cookie, upper+lower) | 200 `{"exists":true,...,"closed":false}` |
| `GET /api/rooms/ZZZZZZ` (nonexistent) | 200 `{"exists":false}` |
| `GET /api/sessions` | 200 `{"sessions":[]}` (no hand_results yet, correct) |
| `POST /api/logout` then `GET /api/me` | 200 `{"ok":true}`, then 401 |
| `POST /api/login` correct / wrong password / unknown user | 200 / 401 identical message / 401 identical message |

## Automated checks
- `pnpm --filter @samloc/worker test` — 2 files, 19 tests, all pass
- `pnpm -r typecheck` — packages/rules, apps/worker, apps/web all exit 0
- `wrangler d1 migrations apply samloc-db --local` (from `apps/worker`, default persist path) — applied once, second run reports "No migrations to apply!" (idempotent)
- `find apps/worker/src apps/worker/tests apps/worker/migrations -type f | xargs wc -l` — largest file is `routes-rooms.ts` at 137 lines, all ≤200

## Unresolved questions
- None blocking. The D1 persist-directory split (worker vs. web `.wrangler` trees) is a local-dev-only quirk of the Cloudflare Vite plugin; phase 8 (deploy) uses `--remote` so it won't recur there, but whoever writes onboarding docs for local dev should apply migrations against `apps/web/.wrangler/state` (or run `pnpm dev` once first) rather than the `apps/worker/.wrangler` tree.

**Status:** DONE
**Summary:** Auth (register/login/logout/me), sessions, room-code, validation, and rooms/sessions routes implemented and wired into `apps/worker/src/index.ts`; 19 unit tests pass, monorepo typecheck is clean, D1 migration applies idempotently, and the full curl acceptance flow (register/me/duplicate/429-room-cap/room-lookup/sessions/logout/login) returns the exact contracts from the phase spec.
**Concerns/Blockers:** None blocking. Two deviations from the phase file were required and are pre-approved by the task brief: `vitest.config.ts` uses plain `defineConfig({ environment: 'node' })` because the installed `@cloudflare/vitest-pool-workers@0.22.0` has no `./config` export at all; and local D1 state lives under `apps/web/.wrangler`, not `apps/worker/.wrangler`, when running via `pnpm dev` (Cloudflare Vite plugin) — documented above for phase 5/6/8.
