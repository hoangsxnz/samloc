---
phase: 6
title: "Web shell login lobby waiting"
status: completed
effort: "4h"
priority: P1
dependencies: [phase-01]
---

# Phase 6: Web shell login lobby waiting

Context: `docs/design-guidelines.md`, `docs/wireframe/01-login.html`, `02-lobby.html`,
`03-room-waiting.html` (the annotation `<ol>` at the bottom of each file is the spec),
`plans/reports/research-svelte-260914-1415-svelte5-vite-tailwind-monorepo-report.md`

## Overview

The Svelte 5 app shell and the three pre-game screens, pixel-faithful to the wireframes: design tokens,
landscape lock overlay, hash router, API client, session store, and the reconnecting WebSocket wrapper
that phase 7 reuses. The waiting screen is the first live WebSocket consumer.

## Requirements

**Functional**
- `#/login` — login/register toggle, inline validation errors, no email, no OAuth (wireframe 01 notes 2–3).
- `#/lobby` — header with avatar, name, `Tổng` chip bound to `me.totalLa`, logout; create-room panel with
  exactly three settings; 6-box join-code grid; scrollable recent-sessions column (wireframe 02 notes 1–5).
- `#/room/:code` — room code display, share/copy, read-only settings chips (host may edit), seat list with
  ♛ on the seat whose `isHost` is true, ready states, host `Bắt đầu` vs player `Sẵn sàng`, and `Rời phòng`.
- Portrait overlay "Xoay ngang máy để chơi" on every screen.
- Unauthenticated navigation redirects to `#/login`; `#/login` while authenticated redirects to `#/lobby`.

**Non-functional**
- Svelte 5 runes only (`$state`, `$derived`, `$effect`); no stores from `svelte/store`.
- Every component ≤200 lines, kebab-case filenames.
- All visible strings Vietnamese with correct diacritics; inputs ≥16 px to block iOS zoom.
- Tap targets ≥44 px; `aria-live="polite"` on every inline error.

## Architecture

**Screen flow**
```
#/login --login/register--> #/lobby --POST /api/rooms--> #/room/:code --start--> #/table/:code (phase 7)
                                  \--GET /api/rooms/:code (valid)--^
```

**Router** (`src/lib/router.svelte.ts`) — hand-rolled, ~40 lines:
```ts
export const route = $state({ name: 'login' as ScreenName, params: {} as Record<string,string> });
// listens to hashchange + load; patterns: '#/login' '#/lobby' '#/room/:code' '#/table/:code'
export function go(hash: string): void;   // sets location.hash
```
`app.svelte` switches on `route.name` and renders one screen component. No nested routes, no guards
beyond a single `$effect` that redirects based on `session.user`.

**API client** (`src/lib/api.ts`)
```ts
async function req<T>(path: string, init?: RequestInit): Promise<T>   // credentials: 'include'
export const api = {
  register, login, logout, me,                  // -> AuthUser
  recentSessions,                               // -> RecentSession[]
  createRoom(settings), findRoom(code),
};
export class ApiError extends Error { status: number }   // message is the server's Vietnamese `error`
```

**Session store** (`src/lib/session.svelte.ts`) — `user = $state<AuthUser|null>(null)`,
`loading = $state(true)`, `bootstrap()` calls `api.me()` once on mount and swallows 401.

**WebSocket client** (`src/lib/ws-client.ts`) — reused unchanged by phase 7:
```ts
export class WsClient {
  connected = $state(false);
  connect(code: string): void;         // new WebSocket(`${wsBase}/ws/${code}`)
  send(msg: Omit<ClientMsg,'seq'>): number;   // assigns and returns seq
  close(): void;
  onSnapshot: (v: RoomView) => void;
  onEvent:    (e: GameEvent) => void;
  onError:    (msg: string, ack: number) => void;
}
```
Reconnect: exponential backoff 500 ms → 30 s, cap 10 attempts, reset on open; re-send `{type:'join'}`
on every open so the DO replies with a fresh snapshot. A `visibilitychange` listener reconnects
immediately when the tab becomes visible, because iOS drops background sockets after ~30 s.
`wsBase` = `location.origin.replace(/^http/, 'ws')`.

**Room store** (`src/lib/room.svelte.ts`) — owns one `WsClient`, exposes
`view = $state<RoomView|null>(null)`, `events = $state<GameEvent[]>([])` (trimmed to the last 10),
`lastError = $state<string|null>(null)`, and thin `ready()/start()/updateSettings()/leave()` wrappers.
`leave()` sends `{type:'leave'}`, closes the socket and routes to `#/lobby`. Phase 7 adds
`play()/pass()/declareSam()/nextHand()` to the same store.

**Design tokens** (`src/app.css`) — `:root` holds every variable from `docs/design-guidelines.md` §1–§3
verbatim (`--felt`, `--gold`, `--fs-3xl`, `--sp-4`, `--r-card`, …). Tailwind `@theme` mirrors only the
colours that need utility classes (`--color-felt`, `--color-gold`, `--color-surface`). Shared component
classes (`.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.panel`, `.input`, `.chip`) live in an
`@layer components` block so screens stay markup-only.

## Related Code Files

**Create**
- `src/lib/router.svelte.ts`, `src/lib/api.ts`, `src/lib/session.svelte.ts`,
  `src/lib/ws-client.ts`, `src/lib/room.svelte.ts`, `src/lib/orientation.svelte.ts`
- `src/components/orientation-overlay.svelte`, `src/components/app-button.svelte`,
  `src/components/text-field.svelte`, `src/components/segmented-control.svelte`,
  `src/components/code-input.svelte`, `src/components/seat-row.svelte`
- `src/screens/login-screen.svelte`, `src/screens/lobby-screen.svelte`, `src/screens/waiting-screen.svelte`
- `src/screens/lobby-create-room.svelte`, `src/screens/lobby-recent-sessions.svelte`

**Modify**
- `src/app.svelte` — shell: orientation overlay + router switch + session bootstrap
- `src/app.css` — full token set and component layer
- `index.html` — confirm the fonts link, manifest link, `lang="vi"`, `viewport-fit=cover`

**Delete** — none.

## Implementation Steps

1. Port `docs/design-guidelines.md` §1–§3 into `src/app.css` `:root`, then add the `@layer components`
   block with `.btn` (48 px tall, `--r-md`, weight 600) and its four variants, `.panel`, `.input`
   (44 px, 16 px font, visible label), `.chip`, plus `.screen` (padding
   `max(40px, env(safe-area-inset-left/right))`, `height: 100dvh`).
2. `orientation.svelte.ts`: `isPortrait = $state(false)` driven by `matchMedia('(orientation: portrait)')`;
   `orientation-overlay.svelte` renders the full-screen rotate prompt. Mount it once in `app.svelte`.
   Attempt `screen.orientation.lock('landscape')` inside a `try/catch` on the first pointer event.
3. `router.svelte.ts` per Architecture; `app.svelte` renders `{#if route.name === 'login'}…`.
4. `api.ts` + `session.svelte.ts`; `app.svelte` calls `bootstrap()` in `onMount` and shows nothing until
   `loading === false`.
5. `login-screen.svelte` (wireframe 01): left hero column with a CSS three-card fan, hidden below 340 px
   viewport height; right column form with the Đăng nhập / Tạo tài khoản toggle. Register mode adds a
   "Tên hiển thị" field and "Nhập lại mật khẩu", and switches the primary label. Client-side checks mirror
   phase 4's validators (username 3–20 lowercase alnum/underscore, display name 1–20 chars, password ≥6,
   passwords match); server errors render in the same `aria-live` slot. On success set `session.user` and
   `go('#/lobby')`.
6. `lobby-screen.svelte` (wireframe 02): 56 px header (avatar initial, display name, gold `Tổng` chip
   reading `session.user.totalLa`, 44×44 logout) over a three-column body.
   - `lobby-create-room.svelte`: three `segmented-control.svelte` rows — số người 2/3/4/5,
     thời gian lượt 15/20/30 s, tiền 1 lá 50/100/200/500. Visual height 34 px with a 44 px hit area.
     `Tạo phòng` is the only primary button on the screen; on success `go('#/room/'+code)`.
   - `code-input.svelte`: six boxes in a 3×2 grid, auto-advance, force uppercase, accept a pasted
     6-char code into all boxes at once. `Vào phòng` is secondary; a miss shows
     "Không tìm thấy phòng" inline.
   - `lobby-recent-sessions.svelte`: one row per session (code, players, hand count, net score in
     tabular-nums, `--success` / `#f87171`), scrolls inside its column. An open session shows `Vào lại`.
     Tapping a row opens a read-only score panel.
7. `waiting-screen.svelte` (wireframe 03): connects `room.svelte.ts` to `#/room/:code` on mount.
   - Left column: room code at `--fs-3xl` with `.18em` tracking; `Chia sẻ mã` calls
     `navigator.share({ text: code })` (code string only, no URL) with a clipboard fallback;
     `Sao chép` swaps its label to "Đã chép ✓" for 1.5 s; settings chips read-only, tappable by the host
     to open an edit sheet that sends `{type:'settings'}`.
   - Right column: `seat-row.svelte` per seat — ♛ where `seat.isHost`, gold border + "Bạn" for yourself,
     Sẵn sàng / Chưa sẵn sàng / ⟳ Mất kết nối, dashed border for empty seats. Never compute the host on the
     client: it is whatever the server marked. Order is seat order and also the play direction.
   - Bottom of the left column: with `view.youAreHost` show `Bắt đầu` (disabled until every seat is ready
     and ≥2 seats), otherwise the `Sẵn sàng / Huỷ sẵn sàng` toggle in the same position. Beneath it a
     danger-secondary `Rời phòng` sends `{type:'leave'}` and routes back to `#/lobby`.
   - When `view.status === 'playing'`, `go('#/table/'+code)`. Phase 7 renders that route; until then it
     is an empty placeholder screen.
8. Reconnect banner: a 30 px `--warn` bar with "Mất kết nối, đang kết nối lại…" rendered by `app.svelte`
   whenever `room.ws.connected === false` and a room is active.
9. Verify: `pnpm -r typecheck && pnpm build`, then `pnpm dev` and walk the manual checklist below.

## Success Criteria

- [x] `pnpm -r typecheck` (includes `svelte-check`) exits 0
- [x] `pnpm build` emits `apps/web/dist` with no Vite warnings about unresolved imports
- [x] Register (with a display name) → lobby → create room → waiting screen works in one browser, and a
      second browser joins with the 6-character code with both seat lists updating live
- [x] Closing the host's browser moves ♛ to the next connected seat, and `Rời phòng` returns to the lobby
- [x] `Bắt đầu` stays disabled until all seats are ready and there are ≥2 seats
- [x] Rotating the device to portrait shows the rotate overlay on all three screens
- [ ] Killing the dev server shows the reconnect banner; restarting it reconnects without a page reload
- [x] Every string on screen is Vietnamese with diacritics; no `TODO` or English placeholder text

## Risk Assessment

| Risk | L×I | Mitigation |
|---|---|---|
| Phase 7 blocked if `ws-types.ts` is not final | M×H | Phase 6 imports the phase-5 types directly; if phase 5 has not landed, stub the file locally and delete the stub on merge |
| `navigator.share` unavailable (desktop Chrome, non-HTTPS) | H×L | Feature-detect; fall back to the clipboard copy path, which is already built |
| Tailwind v4 has no `orientation:` variant | M×L | Raw `@media (orientation: portrait)` in `app.css`, as the research report notes |
| Runes in `.svelte.ts` files silently do nothing if the extension is wrong | M×M | All stores use the `.svelte.ts` extension; a mismatch shows up as a non-reactive seat list in step 9 |
| 100dvh + iOS address bar jump | M×L | `100dvh` everywhere, `overflow: hidden` only on the table screen (phase 7) |

**Rollback:** `apps/web/src` is owned solely by phases 6–7; revert the directory and restore the
phase-1 `app.svelte`. Worker and rules packages are untouched.

## Security Considerations

- Session cookie is HttpOnly; the SPA never reads or stores a token. `credentials: 'include'` on every fetch.
- No `{@html}` anywhere — display names come from other users and must render as text only.
- Client-side validation is UX only; phase 4's server validators are authoritative.
- Share uses the bare room code, never a URL that could leak into a chat preview crawler.
- Do not persist the username or password in `localStorage`; the cookie is the only session artefact.

## Next Steps

Phase 7 adds `#/table/:code` and the result modal, reusing `ws-client.ts`, `room.svelte.ts`, the token
set and the button/chip component layer built here.
