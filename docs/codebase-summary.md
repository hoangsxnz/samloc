# Codebase Summary — Sâm Lốc Online

## Overview

Three-tier monorepo: `packages/rules` (shared rules engine), `apps/worker` (Cloudflare Workers + Durable Object + D1), `apps/web` (Svelte 5 frontend).

## Package Layout

### `packages/rules` (726 lines, pure game rules)

Shared TypeScript module, zero dependencies, used by both server (DO) and client (UI hints).

| File | Responsibility |
|---|---|
| `index.ts` | Public exports: types, action/event APIs, `RULES_VERSION` |
| `cards.ts` | Card type aliases and utilities |
| `combos.ts` | Combo type definitions (single/pair/triple/quad/straight) and parsing; straights read normally (3…A) or low (A-2-3, 2-3-4…), where a low straight's `rank` is the remapped top so it always sorts below a normal one |
| `legal-moves.ts` | `legalMoves()` / `lowestLegalMove()` — every legal play against a trick, cheapest first; drives the timeout auto-play and the client hint outlines |
| `compare.ts` | `canBeat()` — determines if one combo beats another per house rules |
| `deal.ts` | `dealCards()` — random 10-card deal and card pool utilities |
| `instant-win.ts` | `checkInstantWin()` — ăn trắng (龍/tứ quý 2/same color/3 triples/5 pairs) at hand start |
| `state.ts` | `RulesState` (turn order, hand state, player hands, phase) and player state shapes |
| `clone-state.ts` | Deep copy of `RulesState` (safety for rules mutations) |
| `reducer-play.ts` | `applyPlayAction()` — core turn logic (beat/pass/trick end); mutual recursion with reducers. `applyTimeout()` auto-plays `lowestLegalMove()` for every seat and passes only when nothing beats the trick |
| `reducer-sam.ts` | `applyDeclareSam()` — báo sâm (sam declaration) state transitions and settlement exclusivity |
| `reducer-events.ts` | Event generation (báo 1, chặt 2, chặt chồng, đền bài) piped through play/sam/settle |
| `settle.ts` | `settle()` — hand settlement: ăn trắng / báo sâm / card count / thối 2 / cóng / chặt transfers; includes `assertZeroSum()` safety check; `thoi2Counts()` reports the per-seat thối 2 breakdown for the hand-end announcement |

No I/O, no imports from Node/Cloudflare, state JSON-serializable (rules engine is used on server after every action and on client for UI hints only).

### `apps/worker` (1726 lines, backend)

Cloudflare Workers (Hono) + Durable Object + D1. One RoomDO instance per active room (SQLite-backed).

#### Web Routes (`src/routes-*.ts`, `src/index.ts`)

| File | Responsibility |
|---|---|
| `routes-auth.ts` | POST `/api/register`, `/api/login`, `/api/logout`; GET `/api/me` (session to user). `userJson()` builds the shared `AuthUser` shape (`id, username, displayName, avatarVer, budget`) |
| `routes-profile.ts` | PATCH `/api/me` (display name), PUT `/api/me/avatar` (≤ 64 KB JPEG body, magic-byte check, returns `{ avatarVer }`), GET `/api/avatars/:userId` (immutable, versioned by `?v=`) |
| `routes-rewards.ts` | GET `/api/rewards` (day key, `checkedIn`, `spinsLeft`, segment labels), POST `/api/checkin` (one per day, 409 after), POST `/api/spin` (server-side weighted draw, 5 per day, 429 after; the cap is enforced inside the INSERT) |
| `routes-rooms.ts` | POST `/api/rooms` (create, 3-open-room cap), GET `/api/rooms/:code`, `/api/sessions` (player history) |
| `routes-ws.ts` | GET `/ws/:code` → Durable Object stub; identity headers `x-user-id`, `x-user-name`, `x-budget`, `x-avatar-ver` |
| `index.ts` | Hono app: mounts routes, auth middleware, error handler |

#### Core Auth & Sessions (`src/auth*.ts`, `src/sessions.ts`)

| File | Responsibility |
|---|---|
| `auth.ts` | PBKDF2-SHA256 (100k iter, 16-byte salt), `hashPassword()`/`verifyPassword()` |
| `auth-middleware.ts` | Extracts session cookie → user, returns 401 if missing |
| `sessions.ts` | Session row generation, HttpOnly session cookie helpers |
| `validation.ts` | Input parsers: username, display name, password, room settings, avatar bytes (all return `{ok, value|error}` with Vietnamese messages) |
| `rewards.ts` | `CHECKIN_AMOUNT` 1 000, `WHEEL_SPINS_PER_DAY` 5, `WHEEL_SEGMENTS` (8 wedges, weights 30/22/16/13/9/5/2/3), `dayKey()` (UTC+7 calendar day), `pickSegment()`, `randomUnit()` |
| `room-code.ts` | 6-digit room codes (`[0-9]{6}`), rejection-sampling guard (ceiling 250), `generateRoomCode()`/`isRoomCode()` |
| `emoji.ts` | Emoji reaction allowlist: `EMOJI_KEYS`, `EmojiKey` type, `isEmojiKey()` validator |

#### Durable Object (Room State Machine) (`src/room-do*.ts`)

| File | Responsibility |
|---|---|
| `room-do.ts` | RoomDO class: WebSocket hibernation API, snapshot routing, rate limiting (10 msg/s, burst 20); `emojiAllowed()` cooldown tracking (1500ms per-seat, in-memory Map) and `broadcastEmoji()` |
| `room-do-store.ts` | Typed SQLite wrappers: schema creation, room/seat read-write (only place that writes SQL, fully parameterised) |
| `room-do-actions.ts` | `handleMessage()` dispatcher: join/ready/settings/start/nextHand/leave/play/pass/declareSam/emoji (with 1500ms per-seat cooldown) |
| `room-do-hand.ts` | Hand lifecycle: `beginHand()` (deal), `applyGameAction()` (play validation), `endHand()` (settlement, broadcasts one `thoi2` event per paying seat), `onAlarm()` (turn timeout), `closeRoom()` (cleanup), `armIdleClose()` (60s timeout after hand ends with no sockets) |
| `room-do-view.ts` | `buildView()` — per-socket snapshot with opponent hands hidden (`SeatView.money` = `budget_base` + `total_la` × stake); `buildHandResult()` — settlement display with `deltaMoney` / `moneyAfter` |
| `room-do-trick.ts` | `TrickLog` (`{ entries, closed }`), `parseTrick()` (tolerates the legacy bare-array shape), `nextTrick()` — a finished trick stays on the table until the next lead, entry cards stored ascending |
| `budget.ts` | `STARTING_BUDGET` + `budgetFor()` — D1 money balance = 10 000 + Σ hand results × stake + Σ `coin_grants.amount`; shared by the auth, profile and reward routes and the WS upgrade |

#### Durable Object SQLite Schema (`src/room-do-store.ts` inlined schema)

```
room (id=1)
  code, hand_no, max_players, turn_seconds, stake_per_la, status,
  state_json (RulesState), result_json (HandResult), trick_json (TrickLog: { entries, closed }),
  turn_deadline, next_lead_user_id (user id, not seat, guards against seat compaction bug)

seats (per room, SQLite-only, not persisted to D1)
  seat (0..n-1), user_id, display_name, ready (1 on insert), connected,
  total_la (hand results accumulate here),
  budget_base (D1 money balance when the seat was created; added by a guarded ALTER for live rooms),
  avatar_ver (copied from D1 on join/rejoin; guarded ALTER as well)
```

#### D1 (Cloud SQL) Schema (`migrations/0001_init.sql`, `0002_profile_avatar.sql`, `0003_coin_grants.sql`)

```
users (id, username UNIQUE, display_name, password_hash, password_salt, created_at,
       avatar_blob BLOB, avatar_ver INTEGER)
sessions (id, user_id FK, created_at, expires_at) with idx_sessions_expires
room_sessions (code PK, host_user_id FK, maxPlayers, turnSeconds, stakePerLa, created_at, closed_at)
  with idx_room_sessions_host (host lookup, recent-sessions ordering)
hand_results (id, room_code FK, hand_no, user_id FK, delta_la, created_at)
  with idx_hand_results_room (per-hand totals) and idx_hand_results_user (session board)
coin_grants (id, user_id FK, kind 'checkin'|'wheel', amount, day 'YYYY-MM-DD' in UTC+7, created_at)
  with idx_coin_grants_user_day and a partial UNIQUE (user_id, day) WHERE kind = 'checkin'
```

#### Tests (`tests/`)

| File | Scenarios |
|---|---|
| `auth.test.ts` | PBKDF2 round-trip, wrong password, salt uniqueness, all 4 validators |
| `room-code.test.ts` | 6-digit format validation, 10k-draw distribution |
| `emoji.test.ts` | Emoji key validation, allowlist enforcement |
| `profile.test.ts` | `parseAvatarBytes`: JPEG header accepted, empty / over-cap / PNG rejected |
| `rewards.test.ts` | `dayKey` rollover at UTC+7 midnight, segment weights, `pickSegment` boundaries and a 20k-draw distribution |
| `room-do-view.test.ts` | `buildView` / `buildHandResult`, including `SeatView.avatarVer` |

### `apps/web` (4950 lines, frontend)

Svelte 5 + Vite, landscape-only responsive design (844×390 design reference, scales to 360–430px height).

#### Core Libraries (`.svelte.ts` files host reactive state)

| File | Responsibility |
|---|---|
| `lib/session.svelte.ts` | `session` state: user (incl. `budget`, `avatarVer`); `bootstrap()` on app load; `setUser()` after login/register/profile changes |
| `lib/router.svelte.ts` | Hash router: `route` state, `go(path)`; screens `login`, `home`, `profile`, `lobby`, `room`, `table` |
| `lib/api.ts` | Fetch wrapper `req<T>`, named methods (register/login/logout/me/recentSessions/createRoom/findRoom/updateProfile/uploadAvatar/rewards/checkin/spin); `avatarUrl()` |
| `lib/ws-client.svelte.ts` | WebSocket wrapper: `connected` state, `send()` with JSON stringify, auto-reconnect on close; `onEmoji` callback for emoji frames |
| `lib/room.svelte.ts` | `RoomStore` singleton: `view`, `ws`, `lastError`, `reactions` (ephemeral, 1600ms TTL, cap 3/seat); plays `soundCuesFor(prev, next)` on every snapshot after the first; methods `join()`/`ready()`/`settings()`/`start()`/`play()`/`pass()`/`declareSam()`/`nextHand()`/`leave()`/`sendEmoji()`; `reactionsFor(seat)` helper |
| `lib/orientation.svelte.ts` | Landscape-lock detection and request on first pointer event |
| `lib/table-layout.ts` | Seat/card positioning math: `fanLayout()` (flat row of left offsets, no arc), `tableScale()`, opponent slots (4 players: left / top-centre / right); exports `Point`, `CENTRE_POINT`, `FAN_ORIGIN`, `slotOrigin()` with updated `FAN_TRACK_LEFT` 236 |
| `lib/trick-scatter.ts` | `scatterFor(seat, cards)` — FNV-1a hashed offset/rotation inside a 120×40 box so every client places a combo identically |
| `lib/sound.svelte.ts` | `sound` singleton: Web Audio player for the six cues (`/sounds/<key>.mp3`), unlocked from `pointerup`/`keydown` (activation-granting on touch), retried until the context is running, `enabled` persisted in `localStorage` `samloc.sound`; a missing file leaves that cue silent |
| `lib/sound-cues.ts` | `soundCuesFor(prev, next)` — pure snapshot diff → `shuffle` / `play` / `join` / `turn` / `win` / `lose` |
| `lib/avatar-resize.ts` | `resizeAvatar(file)` — bitmap decode, centre crop, 128×128 JPEG ≤ 64 KB |
| `lib/wheel.ts` | SVG wedge geometry (`segmentPath`, `labelPosition`) and `rotationFor()` (≥ 5 turns, lands the server-chosen wedge under the pointer) |
| `lib/card-view.ts` | Card rendering helpers: suit glyphs, rank labels, `comboLabel()` (renders a low straight as A-2-3) |
| `lib/format-money.ts` | `formatMoney()` / `formatMoneyDelta()` — `$` prefix with en-US grouping (`$10,000`), shared by lobby, seats and result rows |
| `lib/hand-order.ts` | `orderHand(hand, 'rank' \| 'group')` — display order behind the "Xếp bài" button; sets, then runs, then singles |
| `lib/table-theme.svelte.ts` | Device-local felt colour (4 presets, `localStorage` `samloc.felt`, green fallback); exposes the three `--felt*` vars for `.table-root` |
| `lib/emoji-glyphs.ts` | Emoji allowlist: `EMOJI_GLYPHS`, `EMOJI_ORDER`, `EMOJI_LABELS` (client-side only) |

#### Shared Components (`components/`)

Reusable UI primitives:
- `app-button.svelte` — primary/secondary/danger/ghost with 48px tap target
- `text-field.svelte` — 16px input (prevents iOS zoom), autocomplete prop
- `playing-card.svelte` — lg/sm/xs card faces (56×80 / 44×62 / 24×32) + card-back with lattice; pips anchored bottom-right
- `segmented-control.svelte` — 3-pill settings selector (turn seconds, player count, stake)
- `code-input.svelte` — 6-box room-code entry, numeric input, digits-only
- `timer-ring.svelte` — SVG stroke-dasharray timer, size-parametric (`size`/`stroke`/`digits`); arc-only mode wraps opponent avatar; pulses red under 5s, `role="timer"`
- `event-tag.svelte` — small pill (event: 흠/chặt/báo/etc., displays 1.6s)
- `confirm-dialog.svelte` — modal with two-button footer
- `error-toast.svelte` — transient error message (shared by waiting and table screens)
- `orientation-overlay.svelte` — full-screen "rotate to landscape" message on portrait orientation
- `avatar.svelte` — round photo (`/api/avatars/:id?v=`) or initial fallback; a failed load falls back per version
- `seat-row.svelte` — compact row for the waiting room: avatar, name, host crown, ready state
- `checkin-card.svelte` — daily check-in panel; 409 also flips to the done state
- `wheel-modal.svelte` — SVG lucky wheel (8 wedges, gold pointer), spins 4 s to the server's segment, 4.3 s fallback if `transitionend` is missed, instant under reduced motion
- `profile-avatar-picker.svelte` — file input + `resizeAvatar` + upload, busy and error states
- `table-top-bar.svelte` — game table header: connection dot, room code, hand number, menu button
- `table-menu-sheet.svelte` — game table ≡ menu: felt colour swatches, "Âm thanh: Bật/Tắt" toggle, "Rời phòng" with warning on leave-during-play
- `action-bar.svelte` — bottom-right: "Xếp bài" + "Bỏ lượt" + "Đánh" buttons, "Báo Sâm" pill
- `hand-fan.svelte` — flat 10-card row with tap-to-select, lift on select, gold outline on playable cards
- `centre-stack.svelte` — trick display: each combo rests on its hashed scatter spot (newest on top, older rows fade); newer tricks fade in over 260ms
- `opponent-seat.svelte` — 40px avatar (countdown digits replace the photo/initial on the active seat) with an 18px red Báo 1 badge, name, 28×38px card-back count, money, 48px TimerRing arc overlay, passed/disconnected states, emoji reactions
- `me-chip.svelte` — bottom-left: 40px avatar (countdown digits replace the initial on my turn), turn label, money or invalidReason/đền bài warning, 48px TimerRing arc overlay, emoji reactions rising to the right of the chip
- `settings-edit-sheet.svelte` — modal for host to adjust room settings during waiting
- `card-flight.svelte` — fly-to-centre play animation (260ms, lands on the combo's scatter spot, suppressed under prefers-reduced-motion)
- `emoji-bar.svelte` — 8-emoji reaction picker (top 248/left 40), closes on outside pointerdown
- `emoji-bubble.svelte` — emoji reaction bubble, rises and fades over 1600ms above a seat

#### Screens (`screens/`)

| File | Role |
|---|---|
| `login-screen.svelte` | Register/login tab toggle, input validation, error display, 3-card CSS fan hero |
| `home-screen.svelte` | Landing after login: avatar, name, budget, "Chơi ngay" / "Hồ sơ", check-in card and wheel launcher (budget updated via `setUser`) |
| `profile-screen.svelte` | Display-name form + avatar picker; "← Trang chủ" back |
| `lobby-screen.svelte` | Shell: create-room panel + recent-sessions list; header has ⌂ (home) and logout |
| `lobby-create-room.svelte` | Room creation form (3 setting pills + "Tạo phòng" button) |
| `lobby-recent-sessions.svelte` | Scrolling session list: room code, players, open indicator, net score with color (green/red) |
| `waiting-screen.svelte` | Pre-game: room code (shareable), seat list, ready toggle (or "Sẵn sàng/Chưa"), host-only start button, leave with warning |
| `table/table-screen.svelte` | Game table root: viewport scale, route guards, overlays, and the 1.8 s result-modal delay (tap anywhere to skip) |
| `table/table-surface.svelte` | Everything inside `.table-root`: seats, centre stack, flight, me-chip, emoji bar, hand fan, action bar or the "Bạn sẽ vào ván sau" spectator banner |
| `table/table-logic.svelte.ts` | Turn logic: `combo`/`currentCombo`, `canPlay`, `denWarn`, `moves`/`playableIds` (hints), combo-seeding `toggle()`, `sortMode`, timer countdown, `flight` state for play animation (last-trick-key driven, no replay on reconnect) |
| `table/table-tags.svelte.ts` | `TagQueue`: floating per-seat event tags (deduped, capped 3/seat, 1.6 s TTL) and the aria-live announcement; `bao1` is aria-live only (the avatar badge is the visual) |
| `table/hand-result-modal.svelte` | Post-hand result: `ResultHead`, auto-fit grid of players + cards/money, session board button, single-line footer with "Rời phòng" (everyone) and "Ván tiếp" (host only) |
| `table/result-head.svelte` | Title / headline, winner pill with avatar, and "Mừng cậu chủ thắng lớn 💕" when I won |
| `table/result-row.svelte` | Compact result row: avatar/name (+ Cóng), money delta, remaining cards, money after the hand |

#### Styling (`app.css`, `app.svelte`)

Global CSS: design tokens (palette, typography, spacing, radius), component classes (`.screen`, `.btn*`, `.panel`, `.input`, `.chip`, `.form-error`), `@media (prefers-reduced-motion: reduce)` block. Per-screen/component layout lives in each file's `<style>` block.

#### App Shell (`app.svelte`, `main.ts`, `index.html`)

- `app.svelte` — orientation overlay, reconnect banner (top, warn color), session bootstrap, router switch, first-pointer landscape-lock attempt and audio unlock; authed users land on `#/home`
- `main.ts` — Svelte app init
- `index.html` — viewport-fit, manifest, fonts (Be Vietnam Pro subset), lang="vi"

#### Tests

Rules engine tests in `packages/rules/tests/` cover all combos, comparisons, deals, instant-wins, turn flow, settlement. Worker tests in `apps/worker/tests/` cover auth, room-codes, emoji validation, avatar validation, rewards and the snapshot view. No browser-based tests (Vitest in Node environment; UI state verified by dev server).

## Data Flow

```
Browser WS → Worker /ws/:code
  ↓ (x-user-id/x-name headers)
RoomDO SQLite (live game state)
  ↓ (applyGameAction → rules engine → settle → D1 write)
D1 (persistent: users, sessions, room_sessions, hand_results, coin_grants)
  ↓
Per-socket snapshot (opponent hands hidden) + GameEvent broadcast
  ↓
Browser (WsClient → room.svelte.ts → components)
```

## WebSocket Contract

### ClientMsg (Client → Server)

```typescript
{ seq: number } & (
  | { type: 'join' | 'start' | 'declareSam' | 'pass' | 'leave' | 'nextHand' }
  | { type: 'ready'; value: boolean }
  | { type: 'settings'; settings: RoomSettings }
  | { type: 'play'; cards: string[] }
  | { type: 'emoji'; key: EmojiKey }
)
```

### ServerMsg (Server → Client)

```typescript
| { type: 'snapshot'; ack: number; view: RoomView }
| { type: 'event'; event: GameEvent }
| { type: 'emoji'; seat: number; key: EmojiKey }
| { type: 'error'; ack: number; msg: string }
```

**Emoji reactions:** Ephemeral, broadcast-only (not persisted in snapshot or D1). EmojiKey is one of 8 allowlisted ids: like, lol, sad, angry, fire, money, think, pray. Glyphs are client-side only. Per-seat cooldown: 1500ms.

**RoomView:** code, status (waiting/playing/hand-end), settings, handNo, youSeat, youAreHost, seats[], hand[] (your cards only), trick[], phase (sam-window/playing/ended), turnSeat, samSeat, turnDeadline, result (null until hand-end).

**SeatView:** seat, userId, name, ready, connected, isHost, cardCount, passed, bao1, totalLa, money, avatarVer (null without an avatar; the client fetches `/api/avatars/:userId?v=<avatarVer>`).

## Room Lifecycle

1. **join** — User enters via `/ws/:code` with authenticated headers. DO auto-creates room on first join. User added to seats if not already there (same user id = same seat, even if multiple browser tabs). `connected=1`, `ready=0`.

2. **ready** — Toggle `ready` flag in waiting state. Host becomes the lowest-numbered connected seat (never persisted).

3. **settings** — Host adjusts maxPlayers (2–5), turnSeconds (15/20/30), stakePerLa (50/100/200/500) in waiting state.

4. **start** — Host sends `start`. Compacts seat numbers to 0..n-1. Calls `beginHand()` → rules engine deals cards → status='playing' → sends GameEvent (deal) + snapshot. If the deal is an ăn trắng instant win, immediately `endHand()` and status='hand-end'.

5. **play/pass/declareSam** — During playing, `applyGameAction()` validates move against current turn and rules, mutates `RulesState`, broadcasts GameEvent (play/trick-end/sam-fail/etc.), snapshots all. On trick end, turn passes to next player or leads next trick. When hand is won (one player out of cards), calls `endHand()` → `settle()` → stores `result_json` in DO SQLite → writes one `hand_results` row per player to D1 → status='hand-end'.

6. **nextHand** — Host sends `nextHand` after reviewing results. Calls `beginHand()` again, resets seats' `ready=0`.

7. **leave** — Sender is marked `connected=0`. If in waiting/hand-end, seat is removed via `removeDisconnectedSeats()` and seats are compacted (resets to 0..n-1). If in playing, seat stays until hand ends. If all seats disconnect mid-hand, `onAlarm()` eventually closes the room after the hand completes and idles for 60s.

8. **idle-close** — After a hand ends, `armIdleClose()` schedules a 60s timeout. If no socket activity fires, the turn alarm, `onAlarm()` at deadline runs `closeRoom()` → deletes all DO storage → room becomes inaccessible. Users can then create a new room or rejoin if the room session is still open in D1 (e.g. within the host's session list).

## Dev Commands

```bash
pnpm dev                           # Vite on :5173 with @cloudflare/vite-plugin (DO + D1 in-process)
pnpm typecheck                     # tsc on all packages + svelte-check on web
pnpm test                          # Vitest: packages/rules + apps/worker (Node environment)
pnpm build                         # Vite build + wrangler build
pnpm run deploy                        # pnpm build + wrangler deploy (requires wrangler login)
```

Local D1 state: `apps/web/.wrangler/state/v3/d1/` (created by `pnpm dev` or `wrangler d1 migrations apply --local --persist-to ../web/.wrangler/state` from `apps/worker`).

Test execution: `pnpm --filter @samloc/rules test` (118 tests), `pnpm --filter @samloc/worker test` (49 tests).
