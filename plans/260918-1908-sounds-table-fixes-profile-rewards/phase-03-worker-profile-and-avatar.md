---
phase: 3
title: "Worker: profile and avatar"
status: completed
priority: P1
effort: "5h"
dependencies: []
---

# Phase 3: Worker: profile and avatar

## Goal

Let a user change their display name and upload a 128×128 JPEG avatar, store
both in D1, and carry the avatar version through the WebSocket chain so every
`SeatView` can render it.

## Context

- `apps/worker/migrations/0001_init.sql` — `users` has `display_name` only.
  D1 supports `ALTER TABLE … ADD COLUMN`; BLOB columns bind and read as
  `ArrayBuffer`.
- `apps/worker/src/routes-auth.ts` — register / login / me each build the
  `AuthUser` JSON by hand (`id, username, displayName, budget`); the new
  `avatarVer` field must be added in all three places.
- `apps/worker/src/sessions.ts:8-12,28-38` — `SessionUser` and
  `getSessionUser()` select `display_name`; add `avatar_ver`.
- `apps/worker/src/routes-ws.ts:36-43` — identity travels in `x-*` headers
  set by the Worker; `apps/worker/src/room-do.ts:47-63` reads them into `Who`
  and `apps/worker/src/room-do-actions.ts:83,87` writes them to the seat on
  join / rejoin (`display_name` is already refreshed on rejoin, so a nickname
  change shows the next time the user opens a room).
- `apps/worker/src/room-do-store.ts:36-49` — seats schema plus the guarded
  `ALTER TABLE seats ADD COLUMN budget_base` pattern for live rooms.
- `apps/worker/src/room-do-view.ts:35-52` — `SeatView` mapping; `ResultRow`
  keeps `seat`/`name` only (the client looks the avatar up from `seats`).
- `apps/worker/src/validation.ts` — parsers returning `{ok, value|error}` with
  Vietnamese messages; 61 lines.
- `apps/worker/src/index.ts:20-22` — `/api/*` is behind `authMiddleware`
  except `PUBLIC_API_PATHS`; `<img>` requests are same-origin so the `sid`
  cookie (SameSite=Lax) is sent and the avatar route can stay authenticated.
- No image processing library runs on Workers: the browser does the crop and
  resize (Phase 5); the server only enforces size and JPEG magic bytes.

## Files to Create / Modify

- Create: `apps/worker/migrations/0002_profile_avatar.sql`
- Create: `apps/worker/src/routes-profile.ts`
- Create: `apps/worker/tests/profile.test.ts`
- Modify: `apps/worker/src/validation.ts`
- Modify: `apps/worker/src/sessions.ts`
- Modify: `apps/worker/src/routes-auth.ts`
- Modify: `apps/worker/src/index.ts`
- Modify: `apps/worker/src/routes-ws.ts`
- Modify: `apps/worker/src/room-do.ts`
- Modify: `apps/worker/src/room-do-actions.ts`
- Modify: `apps/worker/src/room-do-store.ts`
- Modify: `apps/worker/src/room-do-view.ts`
- Modify: `apps/worker/src/ws-types.ts`
- Modify: `apps/worker/tests/room-do-view.test.ts`

## Tasks & Steps

1. **Migration** — `0002_profile_avatar.sql`:
   ```sql
   ALTER TABLE users ADD COLUMN avatar_blob BLOB;
   ALTER TABLE users ADD COLUMN avatar_ver INTEGER;
   ```
   Apply locally with `/db-reset` (`wrangler d1 migrations apply samloc-db --local --persist-to ../web/.wrangler/state`).
2. **Validation** — `validation.ts`: add
   `AVATAR_MAX_BYTES = 64 * 1024` and
   `parseAvatarBytes(input: ArrayBuffer): ParseResult<ArrayBuffer>` — reject
   `byteLength === 0` or `> AVATAR_MAX_BYTES` ("Ảnh phải nhỏ hơn 64 KB"),
   reject when the first three bytes are not `FF D8 FF` ("Ảnh phải là JPEG").
3. **Session user** — `sessions.ts`: `SessionUser` gains
   `avatarVer: number | null`; `getSessionUser()` selects
   `u.avatar_ver AS avatarVer`.
4. **Auth responses** — `routes-auth.ts`: add a local
   `userJson(user: { id; username; displayName; avatarVer }, budget)` helper
   and use it in register (`avatarVer: null`), login (`user.avatar_ver`) and
   me (`c.var.user.avatarVer`). `UserRow` gains `avatar_ver: number | null`.
5. **Profile routes** — `routes-profile.ts` (`profileRoutes`, same Hono
   generics as `authRoutes`):
   - `PATCH /me` — body `{ displayName }` → `parseDisplayName`; `UPDATE users SET display_name = ? WHERE id = ?`; respond with the full `AuthUser` (call `budgetFor`).
   - `PUT /me/avatar` — require `content-type` starting with `image/jpeg`; `await c.req.arrayBuffer()` → `parseAvatarBytes`; `UPDATE users SET avatar_blob = ?, avatar_ver = ? WHERE id = ?` with `avatar_ver = Date.now()`; respond `{ avatarVer }`.
   - `GET /avatars/:userId` — `SELECT avatar_blob, avatar_ver FROM users WHERE id = ?`; 404 `{ error: 'Không có ảnh' }` when null; else `new Response(blob, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=31536000, immutable' } })`. The client always appends `?v=<avatarVer>`, so immutable caching is safe.
   - `index.ts`: `app.route('/api', profileRoutes)`.
6. **WS chain** — carry the version to the seat:
   - `routes-ws.ts`: `headers.set('x-avatar-ver', user.avatarVer === null ? '' : String(user.avatarVer))`.
   - `room-do.ts`: parse `x-avatar-ver` (`''` → `null`) into `Who.avatarVer: number | null` (optional field, like `budget`, for sockets accepted before this shipped).
   - `room-do-store.ts`: seats schema gains `avatar_ver INTEGER`; add the guarded `ALTER TABLE seats ADD COLUMN avatar_ver INTEGER` next to the `budget_base` one; `SeatRow.avatar_ver: number | null`; `SeatPatch` includes `avatar_ver`; `addSeat(userId, displayName, budgetBase, avatarVer)`.
   - `room-do-actions.ts`: rejoin `setSeat(mine.seat, { connected: 1, display_name: who.name, avatar_ver: who.avatarVer ?? null })`; first join passes `who.avatarVer ?? null` to `addSeat`.
   - `ws-types.ts`: `SeatView.avatarVer: number | null` (doc: "bump forces the client to refetch `/api/avatars/:userId`").
   - `room-do-view.ts`: map `avatarVer: s.avatar_ver`.
7. **Tests** —
   - `tests/profile.test.ts`: `parseAvatarBytes` accepts a 3-byte JPEG header padded to 1 KB, rejects empty, rejects 64 KB + 1, rejects a PNG header (`89 50 4E 47`).
   - `tests/room-do-view.test.ts`: add `avatar_ver` to the seat fixtures (one `null`, one number) and assert it reaches `SeatView.avatarVer`.

## Verification

- `pnpm --filter @samloc/worker typecheck && pnpm --filter @samloc/worker test`
- `/db-reset`, then `pnpm dev` and with the browser logged in:
  ```
  curl -b sid=… -X PATCH localhost:5173/api/me -H 'content-type: application/json' -d '{"displayName":"Tèo"}'
  curl -b sid=… -X PUT  localhost:5173/api/me/avatar -H 'content-type: image/jpeg' --data-binary @face.jpg
  curl -b sid=… -o /dev/null -w '%{http_code} %{content_type}\n' localhost:5173/api/avatars/<id>?v=1
  ```
  → 200 with the new name, `{ avatarVer }`, `200 image/jpeg`. A 70 KB JPEG → 400; a PNG → 400.
- Open a room: the WS snapshot's `seats[].avatarVer` equals the value from `/api/me`.
- `wc -l` on every touched worker file ≤ 200.

## Todo

- [x] `0002_profile_avatar.sql` applied locally
- [x] `parseAvatarBytes` + tests
- [x] `SessionUser.avatarVer`, `userJson` helper in auth routes
- [x] `routes-profile.ts`: PATCH /me, PUT /me/avatar, GET /avatars/:userId; mounted
- [x] `x-avatar-ver` → `Who` → seats `avatar_ver` → `SeatView.avatarVer`
- [x] `room-do-view.test.ts` fixtures updated

## Success Criteria

Verification passes; `SeatView` carries `avatarVer`; a room created before
this change still opens (guarded ALTER).

## Risk / Security

- Upload size is enforced from the decoded body length, not `content-length`, so a lying header cannot bypass the 64 KB cap.
- Magic-byte check only proves "starts like a JPEG"; the response is served with a fixed `image/jpeg` content type and never inlined as HTML, so a crafted file cannot execute.
- `avatar_ver` is a timestamp, not a counter, so two uploads in the same millisecond still differ from the previous version in practice; the client refetches on any change.
- D1 row size: 64 KB BLOB per user × ≤ 20 users is negligible.
