---
phase: 4
title: "Worker auth and D1"
status: completed
effort: "3h"
priority: P1
dependencies: [phase-01]
---

# Phase 4: Worker auth and D1

Context: `docs/tech-stack.md`, `docs/deployment.md`, `docs/wireframe/01-login.html`, `02-lobby.html`,
`plans/reports/researcher-260914-1317-cloudflare-durable-objects-websocket-d1-report.md` §4, §7

## Overview

Everything the lobby needs before a socket opens: username/password accounts, D1-backed sessions in an
HttpOnly cookie, room creation with a 6-character code, and the recent-sessions list. No game logic and
no Durable Object work — phase 5 owns `/ws/:code`.

## Requirements

**Functional** — register / login / logout / me; recent room sessions with net score; create a room and look
one up. See the route table below for the exact contracts. All `/api/*` except register, login and health
require a valid session and otherwise return `401 { error }`.

**Non-functional** — PBKDF2-SHA256, 100 000 iterations, 16-byte random salt, 256-bit derived key, hex-encoded.
Session TTL 30 days; cookie `HttpOnly; Secure; SameSite=Lax; Path=/`. Room codes are 6 chars from
`ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no `I O 0 1`), uniform via `crypto.getRandomValues`. Error bodies are
`{ error: string }` with Vietnamese messages and no stack traces.

## Architecture

**D1 schema** — `apps/worker/migrations/000001_init.sql`
```sql
CREATE TABLE users (
  id            TEXT PRIMARY KEY,              -- crypto.randomUUID()
  username      TEXT NOT NULL UNIQUE,          -- lowercase, 3-20, [a-z0-9_]
  display_name  TEXT NOT NULL,              -- 1-20 chars, any Unicode, no control chars
  password_hash TEXT NOT NULL,                 -- 64 hex chars
  password_salt TEXT NOT NULL,                 -- 32 hex chars
  created_at    INTEGER NOT NULL               -- epoch ms
);
CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,                 -- crypto.randomUUID()
  user_id    TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE TABLE room_sessions (
  code          TEXT PRIMARY KEY,              -- 6 chars, uppercase
  host_user_id  TEXT NOT NULL REFERENCES users(id),   -- creator only; the live host is dynamic
  max_players   INTEGER NOT NULL,              -- 2..5
  turn_seconds  INTEGER NOT NULL,              -- 15 | 20 | 30
  stake_per_la  INTEGER NOT NULL,              -- 50 | 100 | 200 | 500
  created_at    INTEGER NOT NULL,
  closed_at     INTEGER                        -- NULL while the room is open
);
CREATE INDEX idx_room_sessions_host ON room_sessions(host_user_id, created_at DESC);
CREATE TABLE hand_results (
  id         TEXT PRIMARY KEY,
  room_code  TEXT NOT NULL REFERENCES room_sessions(code),
  hand_no    INTEGER NOT NULL, user_id TEXT NOT NULL REFERENCES users(id),
  delta_la   INTEGER NOT NULL,                 -- signed, sums to 0 per (room_code, hand_no)
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_hand_results_room ON hand_results(room_code, hand_no);
CREATE INDEX idx_hand_results_user ON hand_results(user_id, created_at DESC);
```
`hand_results` is written by the Durable Object in phase 5; this phase creates the table and the read query.

**Request flow** — `browser --cookie: sid--> Worker (Hono)`; `authMiddleware` runs
`SELECT user via sessions JOIN users WHERE sessions.id = ? AND expires_at > now`, answering a miss with
`401 { error: "Phiên đăng nhập đã hết hạn" }` and a hit with
`c.set('user', { id, username, displayName })` before the route handler touches D1 and returns JSON.

**Route contracts**

| Route | Body / Params | 200 response |
|---|---|---|
| `POST /api/register` | `{ username, displayName, password }` | `{ id, username, displayName, totalLa }` + `Set-Cookie` |
| `POST /api/login` | `{ username, password }` | same |
| `POST /api/logout` | — | `{ ok: true }` + cookie cleared |
| `GET /api/me` | — | `{ id, username, displayName, totalLa }` — `totalLa` feeds the lobby "Tổng" chip |
| `GET /api/sessions` | — | `{ sessions: [{ code, hands, netLa, netScore, stakePerLa, players: string[], open }] }` |
| `POST /api/rooms` | `{ maxPlayers, turnSeconds, stakePerLa }` | `{ code, maxPlayers, turnSeconds, stakePerLa }`; 429 `"Bạn đang có 3 phòng mở"` when the caller already hosts 3 rooms with `closed_at IS NULL` |
| `GET /api/rooms/:code` | path `code` | `{ exists, maxPlayers, turnSeconds, stakePerLa, closed }` |

`GET /api/sessions` query (20 most recent rooms):
```sql
SELECT r.code, r.stake_per_la, r.closed_at, COUNT(DISTINCT h.hand_no) AS hands,
       SUM(h.delta_la) AS net_la, MAX(h.created_at) AS last_at
FROM hand_results h JOIN room_sessions r ON r.code = h.room_code
WHERE h.user_id = ?1 GROUP BY r.code ORDER BY last_at DESC LIMIT 20;
```
Player names come from a second query over `hand_results` joined to `users` for those codes;
`netScore = net_la * stake_per_la` is computed in the Worker. `GET /api/me` and `POST /api/register` add
`totalLa = COALESCE(SUM(delta_la), 0) FROM hand_results WHERE user_id = ?` (0 for a fresh account).

**Password functions** (`src/auth.ts`)
```ts
const ITERATIONS = 100_000;
async function derive(password: string, saltHex: string): Promise<string>   // hex, 64 chars
export async function hashPassword(password: string): Promise<{ hash: string; salt: string }>
export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean>
```
`verifyPassword` compares with `crypto.subtle.timingSafeEqual` over the two hex byte arrays; if that API
is missing at runtime, fall back to a constant-time XOR loop over equal-length buffers.

## Related Code Files

**Create** — `apps/worker/migrations/000001_init.sql`; under `apps/worker/src`: `auth.ts` (PBKDF2 hash/verify,
hex helpers), `sessions.ts` (create/lookup/delete rows, cookie set/clear), `auth-middleware.ts` (populates
`c.var.user`), `routes-auth.ts` (register/login/logout/me), `routes-rooms.ts` (create room, lookup, recent
sessions), `room-code.ts` (`generateRoomCode`, `isRoomCode`), `validation.ts` (`parseUsername`,
`parseDisplayName`, `parsePassword`, `parseRoomSettings`); plus `apps/worker/tests/{auth,room-code}.test.ts`
and `apps/worker/vitest.config.ts` (`defineWorkersConfig` pointing at `wrangler.jsonc`).

**Modify** — `apps/worker/src/index.ts` (mount both route modules, apply the middleware to `/api/*` except
register/login), `apps/worker/wrangler.jsonc` (real `database_id`), `apps/worker/package.json`
(`@cloudflare/vitest-pool-workers`, `test` script). **Delete** — none.

## Implementation Steps

1. `pnpm --filter @samloc/worker exec wrangler d1 create samloc-db`; paste the id into `wrangler.jsonc`
   (local dev uses the local shim; the remote id is confirmed again in phase 8).
2. `wrangler d1 migrations create samloc-db init`, paste the schema above into the generated file, then
   `wrangler d1 migrations apply samloc-db --local`.
3. `src/validation.ts`: `parseUsername` lowercases, trims, tests `/^[a-z0-9_]{3,20}$/`; `parseDisplayName`
   trims and requires 1–20 characters, any Unicode, rejecting control chars via `/[\p{Cc}\p{Cf}]/u`;
   `parsePassword` requires length ≥6 and ≤72; `parseRoomSettings` whitelists `maxPlayers ∈ [2,5]`,
   `turnSeconds ∈ {15,20,30}`, `stakePerLa ∈ {50,100,200,500}`. Each returns a discriminated
   `{ ok: true, value } | { ok: false, error }` with a Vietnamese message.
4. `src/auth.ts`: implement `hashPassword` / `verifyPassword` per Architecture. 16-byte salt from
   `crypto.getRandomValues(new Uint8Array(16))`, hex via a shared `toHex`/`fromHex`.
5. `src/sessions.ts`: `createSession(db, userId)` inserts `{ id: crypto.randomUUID(), expires_at: now + 30d }`
   and returns the id; plus `getSessionUser(db, sid)` and `deleteSession(db, sid)`. Cookie helpers use
   `hono/cookie` with name `sid`, `httpOnly`, `secure`, `sameSite: 'Lax'`, `path: '/'`, `maxAge: 2592000`.
6. `src/auth-middleware.ts`: read `sid`, resolve the user, 401 on miss, `c.set('user', user)`. Type it
   through Hono's `Variables` generic so `c.var.user` is non-optional in guarded routes.
7. `src/routes-auth.ts`: register (validate username, display name and password → `SELECT 1 FROM users
   WHERE username=?` → 409 "Tên đăng nhập đã tồn tại" → insert → session → cookie), login (lookup →
   `verifyPassword` → 401 "Sai tên đăng nhập hoặc mật khẩu", the same message for both misses), logout,
   and me (which also runs the `totalLa` sum).
8. `src/room-code.ts`: `generateRoomCode()` draws 6 chars from the alphabet via
   `crypto.getRandomValues(new Uint8Array(6))` with rejection sampling (`byte < 224` → `% 32`) so the
   distribution stays uniform.
9. `src/routes-rooms.ts`: `POST /api/rooms` validates settings, rejects with 429 "Bạn đang có 3 phòng mở"
   when `SELECT COUNT(*) FROM room_sessions WHERE host_user_id = ? AND closed_at IS NULL` is already ≥3,
   then generates a code, retries up to 5 times on primary-key conflict, inserts `room_sessions` and
   returns the code. `GET /api/rooms/:code` uppercases and validates the shape before hitting D1.
   `GET /api/sessions` runs the two queries above.
10. `src/index.ts`: `app.use('/api/*', ...)` skipping `/api/register`, `/api/login`, `/api/health`.
11. Tests: `auth.test.ts` (hash/verify round trip, wrong password fails, two hashes of one password differ
    by salt, validation rejects bad usernames, display names, passwords and settings); `room-code.test.ts`
    (length 6, alphabet only, 10 000 draws produce no `I O 0 1`).
12. Verify: `pnpm --filter @samloc/worker test && pnpm -r typecheck`, then `pnpm dev` and exercise the
    flow with curl:
    ```bash
    H='content-type: application/json'
    curl -c j -X POST localhost:5173/api/register -H "$H" -d '{"username":"son","displayName":"Sơn","password":"matkhau"}'
    curl -b j localhost:5173/api/me
    curl -b j -X POST localhost:5173/api/rooms -H "$H" -d '{"maxPlayers":4,"turnSeconds":20,"stakePerLa":100}'
    ```

## Success Criteria

- [x] `pnpm --filter @samloc/worker test` passes (auth + room code suites) and `pnpm -r typecheck` exits 0
- [x] The curl sequence in step 12 returns 200/200/200 and the room code is 6 uppercase chars
- [x] `GET /api/me` without a cookie returns 401 with a Vietnamese `error`; a duplicate username returns
      409 not 500; a 4th open room returns 429; `GET /api/me` carries `totalLa`
- [x] `wrangler d1 migrations apply samloc-db --local` is idempotent on a second run

## Risk Assessment

| Risk | L×I | Mitigation |
|---|---|---|
| PBKDF2 100k iterations exceeds the free-plan 10 ms CPU budget | M×H | WebCrypto runs native, outside the JS CPU meter in practice; measure once in step 12. If login 500s, drop to 50 000 iterations and record the change in `docs/tech-stack.md` |
| `crypto.subtle.timingSafeEqual` absent in the installed workerd | M×L | Constant-time XOR fallback written in the same commit |
| D1 free-tier daily row limits unknown (research flags this) | L×M | Only auth and lobby reads hit D1; the game loop stays in DO SQLite. Revisit only if 429s appear |
| Room code collision, or session rows accumulating forever | L×L | 32^6 ≈ 1.07e9 codes with 5 insert retries on conflict; `idx_sessions_expires` plus delete-on-lookup for expired rows, no cron job |
| **Accepted, not mitigated:** no rate limit on `/api/login`, so an attacker with a username can grind passwords | L×M | Deliberately out of scope for a ≤20-person private app. Revisit only if the dashboard shows unexpected `/api/login` traffic |
| **Accepted, not mitigated:** registration stays open, so anyone reaching the URL can create an account | M×L | User decision. Phase 8 keeps the post-launch note about putting Cloudflare Access in front of `/api/register` if it becomes a problem |

**Rollback:** drop the four tables via a `000002` down-migration, revert `apps/worker/src`; `apps/web` untouched.

## Security Considerations

- Identical error text for unknown username and wrong password prevents user enumeration. The password is
  never logged, echoed or stored; only the hex hash and salt reach D1.
- Session id is 122 bits of entropy from `crypto.randomUUID()`; the cookie is HttpOnly so XSS cannot read
  it, and `SameSite=Lax` blocks cross-site POSTs — that is the CSRF control here, no token needed.
- All D1 access uses `.bind()` parameters, never string interpolation.
- `GET /api/sessions` filters on `c.var.user.id`; a user id is never accepted from the client, and room
  settings are whitelisted server-side rather than trusting the client's segmented control.

## Next Steps

Phase 5 adds `/ws/:code`, reusing `getSessionUser` to authenticate the upgrade and `room_sessions` to read the room's settings before handing off to `RoomDO`. Phase 6 consumes these endpoints from the SPA.
