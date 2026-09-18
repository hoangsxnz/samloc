---
phase: 5
title: "Web: Home, profile screen, avatar everywhere"
status: completed
priority: P1
effort: "6h"
dependencies: [1, 2, 3]
---

# Phase 5: Web: Home, profile screen, avatar everywhere

## Goal

Land on a Home screen after login with "Chơi" and "Hồ sơ" buttons, add a
profile screen that changes the nickname and uploads a browser-resized
avatar, and render the avatar wherever an initial is shown today.

## Context

- `apps/web/src/lib/router.svelte.ts` — hash router with
  `ScreenName = 'login' | 'lobby' | 'room' | 'table'`; `parse()` maps the
  hash head. `apps/web/src/app.svelte:22-27` redirects authed users away from
  login (`go('#/lobby')`) and `login-screen.svelte:54` goes to `#/lobby`
  after login/register.
- `apps/web/src/lib/api.ts` — `req<T>` sets `content-type: application/json`
  by default but spreads `init.headers` over it, so a JPEG upload passes its
  own header and a `Blob` body. `AuthUser` has no `avatarVer` yet.
- Initials are computed locally in six places: `opponent-seat.svelte:21-23`,
  `me-chip.svelte:21-23`, `seat-row.svelte:11-13`, `result-row.svelte:12-14`,
  `hand-result-modal.svelte:24-26` (winner pill, moved to `result-head.svelte`
  in Phase 2) and `lobby-screen.svelte:49`.
- Active-turn seats replace the initial with the countdown digits
  (`opponent-seat.svelte:38`, `me-chip.svelte:38`); the avatar image must
  give way to the digits the same way.
- `apps/web/src/components/text-field.svelte` — 16 px input used by login;
  `apps/web/src/components/app-button.svelte` — primary/secondary/danger/ghost.
- `docs/design-guidelines.md` §7: lobby/login are 2–3 column landscape
  layouts with `.screen` padding; Home and Profile follow the same shell.
- Line budget: `opponent-seat.svelte` 176, `lobby-screen.svelte` 168; the
  avatar swap adds ≤ 6 lines each.

## Files to Create / Modify

- Create: `apps/web/src/components/avatar.svelte`
- Create: `apps/web/src/lib/avatar-resize.ts`
- Create: `apps/web/src/screens/home-screen.svelte`
- Create: `apps/web/src/screens/profile-screen.svelte`
- Modify: `apps/web/src/lib/router.svelte.ts`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/app.svelte`
- Modify: `apps/web/src/screens/login-screen.svelte`
- Modify: `apps/web/src/screens/lobby-screen.svelte`
- Modify: `apps/web/src/components/opponent-seat.svelte`
- Modify: `apps/web/src/components/me-chip.svelte`
- Modify: `apps/web/src/components/seat-row.svelte`
- Modify: `apps/web/src/screens/table/result-row.svelte`
- Modify: `apps/web/src/screens/table/hand-result-modal.svelte`
- Modify: `apps/web/src/screens/table/result-head.svelte`
- Modify: `apps/web/src/screens/table/table-surface.svelte` (two prop lines)

## Tasks & Steps

1. **Routes** — `router.svelte.ts`: `ScreenName` += `'home' | 'profile'`;
   `parse()` maps `home` → home, `profile` → profile; the empty hash stays
   `login` (the auth guard forwards it). `app.svelte`: authed on login →
   `go('#/home')`; the `room.disconnect()` effect also covers `home` and
   `profile`; render `HomeScreen` / `ProfileScreen` in the switch.
   `login-screen.svelte`: `go('#/home')` after login and register.
2. **API and session** — `api.ts`: `AuthUser.avatarVer: number | null`;
   `updateProfile: (input: { displayName: string }) => req<AuthUser>('/api/me', { method: 'PATCH', body })`;
   `uploadAvatar: (blob: Blob) => req<{ avatarVer: number }>('/api/me/avatar', { method: 'PUT', headers: { 'content-type': 'image/jpeg' }, body: blob })`;
   `avatarUrl(userId, avatarVer)` helper → `/api/avatars/${userId}?v=${avatarVer}`.
3. **`avatar.svelte`** — props `{ name: string; userId: string; avatarVer: number | null; size?: number }`
   (default 40). Renders `<img class="avatar-img" src={avatarUrl(...)} alt="" draggable="false">`
   when `avatarVer !== null`, else `<span class="avatar-initial">{initial(name)}</span>`;
   root is `display:block; width/height: size; border-radius:50%; overflow:hidden; background: var(--surface-2)`,
   `img { width:100%; height:100%; object-fit:cover }`. No border: each
   consumer keeps its own ring (`--line`, gold when active). An `onerror` on
   the image flips a local `broken` state back to the initial.
4. **Swap the initials** —
   - `opponent-seat.svelte`: inside `.opp-avatar`, `{#if active}{Math.ceil(remain)}{:else}<Avatar name={seat.name} userId={seat.userId} avatarVer={seat.avatarVer} size={36} />{/if}`; delete the local `initial()`. Keep the Báo 1 badge from Phase 1 outside the Avatar.
   - `me-chip.svelte`: add props `userId`, `avatarVer`; same digits-or-avatar pattern; `table-surface.svelte` passes `mySeat.userId` / `mySeat.avatarVer` (two prop lines; this is the only edit to that file in this phase).
   - `seat-row.svelte`: replace `.seat-avatar` content with `<Avatar … size={36} />`.
   - `result-row.svelte`: new props `userId: string`, `avatarVer: number | null`; `hand-result-modal.svelte` passes `seats.find((s) => s.seat === row.seat)` values (`''` / `null` when the seat left).
   - `result-head.svelte`: winner pill uses `<Avatar … size={28} />`; needs `winner: SeatView | null` instead of `winnerName` (modal already derives the seat).
   - `lobby-screen.svelte`: header uses `<Avatar name userId avatarVer size={36} />` from `session.user` and gains a `⌂` icon button (`aria-label="Trang chủ"`, `go('#/home')`) left of the logout button.
5. **`avatar-resize.ts`** — `resizeAvatar(file: File): Promise<Blob>`:
   `createImageBitmap(file, { imageOrientation: 'from-image' })`, centre-crop
   to a square, draw into a 128×128 canvas, `toBlob('image/jpeg', 0.85)`;
   if the blob exceeds 64 KB retry at quality 0.7, then reject with
   `'Ảnh quá lớn'`. Reject non-image files (`!file.type.startsWith('image/')`)
   with `'Chọn một tệp ảnh'`.
6. **`home-screen.svelte`** — `.screen` shell, refreshes `api.me()` on mount
   like the lobby. Left column: `<Avatar size={72}>`, display name, username
   (muted), `Ngân sách: …` chip, logout icon. Buttons stacked under it:
   `Chơi ngay` (primary, `go('#/lobby')`) and `Hồ sơ` (secondary,
   `go('#/profile')`). Right column is an empty `<section class="home-rewards">`
   grid area that Phase 6 fills; in this phase the left column spans the width.
7. **`profile-screen.svelte`** — header row: ghost `← Trang chủ` button.
   Body in two columns:
   - Avatar column: `<Avatar size={96}>`, hidden `<input type="file" accept="image/*" capture="user">`, secondary button `Đổi ảnh` that clicks the input; on change → `resizeAvatar` → `api.uploadAvatar` → `setUser({ ...session.user, avatarVer })`; shows `Đang tải…` while busy and a `.form-error` on failure.
   - Name column: `<TextField label="Tên hiển thị" bind:value>` prefilled from `session.user.displayName`, primary `Lưu` disabled while unchanged or busy; on success `setUser(user)` and a green `Đã lưu` line for 1.5 s; server error text from `ApiError.message`.
   Both screens keep every file ≤ 200 lines; split the avatar column into
   `profile-avatar-picker.svelte` if the profile screen crosses it.

## Verification

- `pnpm typecheck`
- `pnpm dev`: login → lands on `#/home`; `Chơi ngay` → lobby; `⌂` → home; `Hồ sơ` → profile.
- Change the name to `Tèo`, reload: header shows `Tèo`; open a waiting room in a second browser: seat row shows `Tèo`.
- Upload a 3000×4000 phone photo: preview swaps within a second, Network tab shows a `PUT /api/me/avatar` body ≤ 64 KB; reload keeps it; the other browser's seat row, table seat, me-chip and result row all show the photo; on the active turn the digits replace the photo.
- Upload a `.txt` renamed to `.jpg`: error `Chọn một tệp ảnh` or the server's `Ảnh phải là JPEG`, no crash.
- Delete the avatar row's `avatar_ver` in D1 (or use a fresh account): initials render as before.

## Todo

- [x] `home` / `profile` routes; login lands on Home
- [x] `AuthUser.avatarVer`, `updateProfile`, `uploadAvatar`, `avatarUrl`
- [x] `avatar.svelte` with image/initial fallback
- [x] Initials replaced in opponent-seat, me-chip, seat-row, result-row, result-head, lobby header
- [x] `avatar-resize.ts` (bitmap crop → 128 JPEG ≤ 64 KB)
- [x] `home-screen.svelte` with Chơi ngay / Hồ sơ
- [x] `profile-screen.svelte` with nickname save and avatar upload

## Success Criteria

Verification passes; no file over 200 lines; no `{@html}`; the table still
scales and lays out identically with initials.

## Risk

- `createImageBitmap` with `imageOrientation` is unsupported on older Safari (< 15); fall back to `createImageBitmap(file)` when the options form throws — modern iOS strips EXIF rotation on capture anyway.
- HEIC from an iPhone: Safari decodes it into the bitmap, so the upload is still JPEG; Chrome on Android never produces HEIC. Nothing extra needed.
- Avatar `<img>` requests go through `authMiddleware` (one D1 session lookup each) and are cached immutable per version, so a table of five triggers at most five lookups per version.
