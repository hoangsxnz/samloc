# Phase 6 — Web shell login lobby waiting — implementation report

## Files created

Lib (`.svelte.ts` where runes are used):
- `apps/web/src/lib/router.svelte.ts` — hash router, `route` state, `go()`, `initRouter()`
- `apps/web/src/lib/api.ts` — `req<T>`, `api.{register,login,logout,me,recentSessions,createRoom,findRoom}`, `ApiError`
- `apps/web/src/lib/session.svelte.ts` — `session` state, `bootstrap()`, `setUser()`
- `apps/web/src/lib/ws-client.svelte.ts` — `WsClient` class (renamed from planned `ws-client.ts`, see Deviations)
- `apps/web/src/lib/room.svelte.ts` — `RoomStore` class, `room` singleton, `ready/start/updateSettings/leave`
- `apps/web/src/lib/orientation.svelte.ts` — `orientation` state, `requestLandscapeLockOnce()`

Components:
- `orientation-overlay.svelte`, `app-button.svelte`, `text-field.svelte`, `segmented-control.svelte`,
  `code-input.svelte`, `seat-row.svelte`
- `settings-edit-sheet.svelte` — new, not in the original file list (see Deviations)

Screens:
- `login-screen.svelte`, `lobby-screen.svelte`, `lobby-create-room.svelte`, `lobby-recent-sessions.svelte`,
  `waiting-screen.svelte`, `table-screen-placeholder.svelte`

## Files modified

- `apps/web/src/app.svelte` — shell: orientation overlay, reconnect banner, router switch, session bootstrap,
  auth redirect `$effect`, first-pointer landscape-lock attempt
- `apps/web/src/app.css` — added full typography/spacing/radius token set (§2–3 of design guidelines) and a
  `@layer components` block (`.screen`, `.centered-screen`, `.btn*`, `.panel`, `.input`, `.chip`, `.form-error`)
- `index.html` — unchanged (fonts, manifest, `lang="vi"`, `viewport-fit=cover` already present from phase 1)

Per-screen/component layout CSS lives in each file's own scoped `<style>` block rather than in `app.css`,
so `app.css` stays limited to the shared design-system layer as the architecture section specifies
("shared component classes ... so screens stay markup-only").

## Wireframe annotation coverage

- **01-login**: 3-card CSS fan hero hidden under 340px viewport height (`@media (max-height:339px)`); tab
  toggle (Đăng nhập/Tạo tài khoản) switches fields and primary label; register adds Tên hiển thị + Nhập lại
  mật khẩu; one `aria-live="polite"` error slot that clears on retype; 44px/16px inputs; safe-area padding
  via the shared `.screen` class.
- **02-lobby**: 56px header (avatar initial, name, gold `Tổng` chip bound to `session.user.totalLa`, 44×44
  logout); create-room panel with exactly 3 segmented settings (34px visual pill / 44px tap target); 6-box
  code grid (3×2, auto-advance, uppercase, paste-all); "Không tìm thấy phòng" inline error; recent-sessions
  column scrolls independently, tabular-nums net score in `--success`/`#f87171`, tap opens a read-only score
  panel, open sessions show "Vào lại"; only "Tạo phòng" is a primary (gold) button.
- **03-room-waiting**: room code at `--fs-3xl`/`.18em` tracking; Web Share API with `{text: code}` (no URL),
  clipboard fallback, "Đã chép ✓" for 1.5s; settings chips are a button, disabled for non-hosts, opens
  `settings-edit-sheet.svelte` for the host which sends `{type:'settings'}`; seat list shows ♛ from
  `seat.isHost` (never computed client-side), gold border + "Bạn" for self, Sẵn sàng/Chưa sẵn sàng/⟳ Mất kết
  nối, dashed empty seats padded to `settings.maxPlayers`; host sees disabled-until-ready `Bắt đầu`, others see
  the Sẵn sàng/Huỷ sẵn sàng toggle; danger `Rời phòng` sends `{type:'leave'}` and routes to `#/lobby`;
  `view.status === 'playing'` routes to `#/table/:code`.
- Reconnect banner: 30px `--warn` bar in `app.svelte`, shown whenever a room/table route is active, a
  snapshot has already arrived (`room.view !== null`), and `room.ws.connected === false`.
- Orientation overlay: `matchMedia('(orientation: portrait)')`-driven, mounted once in `app.svelte`, shown on
  every screen; `screen.orientation.lock('landscape')` attempted once on first `pointerdown`, wrapped in
  try/catch plus a `.catch()` on the returned promise.

## Deviations from the phase file

1. **`ws-client.ts` → `ws-client.svelte.ts`.** The file's own architecture snippet declares
   `connected = $state(false)` as a class field, which only reacts correctly in a `.svelte.ts` file. The
   phase's own risk table flags this exact mismatch ("Runes in `.svelte.ts` files silently do nothing if the
   extension is wrong"). Kept the `.ts` extension would have made the reconnect banner never update.
   `room.svelte.ts` imports it as `./ws-client.svelte`.
2. **Added `src/components/settings-edit-sheet.svelte`**, not in the original "Create" list. Inlining the
   host's settings-edit sheet (3 segmented controls + save/cancel) into `waiting-screen.svelte` pushed that
   file past the 200-line hard limit; extracting it also keeps `waiting-screen.svelte` markup-focused. It's
   used nowhere else.
3. **Distributive `Omit`.** `ClientMsg` is a discriminated union; a plain `Omit<ClientMsg, 'seq'>` collapses
   it to the common-keys-only shape (a known TS gotcha), so `{type:'ready', value}` etc. failed to type-check
   against `WsClient.send`. Added a local `DistributiveOmit<T,K>` conditional type in `ws-client.svelte.ts` —
   no change to the imported `ws-types.ts` contract itself.
4. `text-field.svelte`'s `autocomplete` prop is typed as `HTMLInputAttributes['autocomplete']` (from
   `svelte/elements`) instead of a bare `string`, since svelte-check rejects a generic string against the
   input's `FullAutoFill` union.
5. `settings-edit-sheet.svelte` snapshots the incoming `settings` prop into local draft state via
   `untrack(() => …)` to silence the (correct) `state_referenced_locally` warning — the draft is intentionally
   a one-time copy for editing, not a live mirror.

## Verification

- `pnpm --filter @samloc/web typecheck`: 296 files, 0 errors, 0 warnings.
- `pnpm -r typecheck`: rules, worker, web all exit 0.
- `pnpm build`: client + worker bundles built, no unresolved-import warnings.
- `find apps/web/src -type f | xargs wc -l`: largest file is `app.css` at 170 lines; all `.svelte`/`.ts` files
  ≤160 lines.
- `grep -rn "TODO\|lorem\|placeholder" apps/web/src`: only the intentional `table-screen-placeholder.svelte`
  filename/import; no user-facing TODOs or English filler text.
- `pnpm dev` (background) + curl: `GET /` returns the SPA shell (200); `GET /api/health` returns
  `{"ok":true,...}`. Phase 4's auth/room routes are already live, so the full HTTP flow was smoke-tested with
  curl: register → 200 with `totalLa:0`, `GET /api/me` with the session cookie → 200, `POST /api/rooms` → 200
  with a 6-char code, `GET /api/rooms/:code` → `{exists:true,...}`, `GET /api/sessions` → `{sessions:[]}`.
  Dev server was killed afterward.
- The WebSocket route (`/ws/:code`, phase 5) was also mounted in `index.ts` by the time of this report, but a
  full browser-based two-client waiting-room walkthrough was not run — Node's built-in `WebSocket` doesn't
  support a custom `Cookie` header for the upgrade request, and a deeper harness felt out of scope for this
  phase's own file ownership. Correctness of `WsClient`/`room.svelte.ts` against `ws-types.ts` is verified at
  the type level (svelte-check) and by code read-through against the phase-5 contract; phase 7's own
  end-to-end pass (or a manual browser check) should confirm the live two-client flow.

## Unresolved questions

- None blocking. The two-client live-room walkthrough (register in two browsers, join by code, see both seat
  lists update, close host's tab and watch ♛ move) is listed as a success criterion but requires a browser,
  not just curl; recommend a manual pass once phase 5's WebSocket surface is finalized.

**Status:** DONE_WITH_CONCERNS
**Summary:** All phase-6 files created/modified per spec; svelte-check (0/0), `pnpm -r typecheck`, and `pnpm build` all pass; HTTP auth/room flow smoke-tested live against phase-4's worker via curl.
**Concerns/Blockers:** Live two-browser WebSocket walkthrough (seat lists updating, host migration) not exercised — verified only via type-checking against the final `ws-types.ts` contract and code read-through, since scripting a cookie-bearing WS handshake from this shell wasn't practical and phase 5 was still landing concurrently.
