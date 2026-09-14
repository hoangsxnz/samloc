# Code review: web app (phases 6-7) — apps/web/src

Scope: everything under `apps/web/src/**` and `apps/web/index.html`. Read-only review, no edits made.
`pnpm --filter @samloc/web typecheck` and `pnpm --filter @samloc/web build` both exit 0 (bundle 86.6 KB gzip 30.9 KB, well under the 120 KB budget in phase-07's risk table). All files ≤200 lines, kebab-case, no `any`, no `{@html}`.

## Critical

### 1. Table screen has no escape route if the socket never connects
`apps/web/src/screens/table/table-screen.svelte:124-128` — when `room.view` is `null` the screen renders only `<p>Đang kết nối bàn chơi…</p>`. The `≡` menu (only source of `Rời phòng` on this screen) lives inside `TableTopBar`, which is only rendered in the `{#if view}` branch (`table-screen.svelte:63`). `WsClient` (`apps/web/src/lib/ws-client.svelte.ts:81-86`) caps reconnect at 10 attempts (`RECONNECT_MAX_ATTEMPTS`) and then simply stops trying — no `onError` is raised for connection-level failures (browser `close`/`error` events carry no message; `onError` only fires from a parsed `{type:'error'}` server frame over an already-open socket, `ws-client.svelte.ts:66-71`).

Failure scenario: a user opens `#/table/CODE` for a room that is closed, or whose auth cookie has expired (401/404 on the WS upgrade), or whose network is down when the tab is foregrounded. The socket fails, backs off through 10 attempts (~1 min total), gives up, and the screen is permanently stuck on "Đang kết nối bàn chơi…" with no button, no menu, and no message explaining why. The only way out is manually editing the URL hash. `waiting-screen.svelte` does not have this problem — its `‹`/`Rời phòng` header button is rendered unconditionally outside the `{#if !room.view}` block (`waiting-screen.svelte:69-73`), so it is only the table screen that traps the user.

Fix: render a persistent "Rời phòng"/back affordance (or reuse `TableMenuSheet`) outside the `{#if view}` gate, and/or surface a "not connected" state distinct from "still trying" once `WsClient` gives up (e.g. expose `attempts >= MAX` or a `gaveUp` flag).

### 2. Opponent seats can silently disappear from the table after a mid-hand departure
`apps/web/src/lib/table-layout.ts:21-29` (`opponentSlots`) computes each opponent's seat number as `(youSeat + k) % seatCount`, assuming seat numbers are a contiguous `0..seatCount-1` range. They are not guaranteed to be: the worker's `SeatStore.removeSeat` deletes a seat's row outright and its own comment says a vacated number "is never reused mid-session; the next deal re-packs" (`apps/worker/src/room-do-store.ts:89-121`). So while a hand is in progress, `view.seats` can be e.g. `[{seat:0},{seat:1},{seat:3}]` (seat 2 left) with `seats.length === 3`.

`table-screen.svelte:52-57` then does:
```
opponentSlots(view.youSeat, view.seats.length)
  .map((o) => ({ seatView: view.seats.find((s) => s.seat === o.seat), pos: ... }))
  .filter((o) => o.seatView !== undefined);
```
With `youSeat=0`, `seatCount=3`: `k=1 → seat 1` (exists, fine), `k=2 → seat 2` (does not exist → filtered out). Seat 3 — an actively-playing opponent — is never assigned any slot and never rendered anywhere on the table (no avatar, no card-back count, no turn ring, no timer) for the remainder of that hand, even though `centre-stack.svelte` will correctly show their name when they play (it looks seats up by direct `seat` match, not modulo, `centre-stack.svelte:12-14`). The bug self-heals only at the next deal's re-pack.

Same root cause hits `table-logic.svelte.ts:100-101` (`denWarn`): `const nextSeat = (view.youSeat + 1) % view.seats.length;` — after a gap, this can point at the wrong seat entirely, or at a seat that doesn't exist (falls back to `cardCount ?? 0`, silently suppressing the "Có thể phải đền bài" warning when it should fire, or attributing the 1-card check to the wrong player).

This is directly reachable by the already-supported and already-tested "leave mid-hand" flow (`table-menu-sheet.svelte`'s "Rời giữa ván sẽ bị tính cóng/đếm lá" warning), just not with the 2-player table the lead used for manual verification — it needs ≥3 remaining seats with a gap.

Fix: derive slot assignment from `view.seats` turn order directly (e.g. index into the sorted seats array by position relative to `youSeat`, not by seat-number arithmetic), not by assuming `seat` values are `0..n-1`.

## High

### 3. Reconnect banner keeps saying "reconnecting…" after the client has already given up
`apps/web/src/app.svelte:30-32,35-37` shows "Mất kết nối, đang kết nối lại…" whenever `room.view !== null && !room.ws.connected`. Once `WsClient` exhausts `RECONNECT_MAX_ATTEMPTS` (`ws-client.svelte.ts:82`), `#scheduleReconnect` just returns and no further attempts are made — but nothing changes the banner text or the underlying condition, since `connected` stays `false`. A user whose connection drops for more than ~1 minute (all backoffs summed: 0.5+1+2+4+8+16+30+30+30+30 s ≈ 151 s) sees a permanently misleading "reconnecting" message with no indication the client stopped trying. The `visibilitychange` handler (`ws-client.svelte.ts:88-95`) does reset attempts and retry on foreground, so backgrounding/foregrounding the tab recovers, but a user who stays on the tab has no recovery path and no accurate status.

Fix: expose a distinct "gave up" state from `WsClient` and either auto-retry on a longer interval or show an explicit "Không thể kết nối lại — thử tải lại trang" message with a manual retry action.

### 4. Rejected/permanent WS failures are retried with backoff exactly like transient drops, with the user never told why
`ws-client.svelte.ts:73-78`: the `close` handler treats every non-user-initiated close identically, regardless of close code — there's no branch for "the server rejected the upgrade" (closed room, expired/invalid session, kicked from room) versus "the network blipped". Combined with finding #1, a permanently-invalid room/session retries silently for ~1 min and then goes quiet, with the ws-level `onError` callback never invoked (it only fires for parsed application-level `{type:'error'}` frames on an open socket, never for connection failures). Per phase-06/07 security & UX requirements, server-supplied error strings should be surfaced to the user (`ApiError.message` already is, for the REST API, in `api.ts`/screens) — but WS-level auth/closed-room failures have no equivalent path.

Fix: at minimum, distinguish "never connected" vs "was connected, dropped" in the UI copy, and/or have the worker send a final descriptive `{type:'error'}` frame (or a specific WS close code) before closing on auth/room-closed so the client can render something like "Phòng đã đóng" instead of retrying blindly.

### 5. Hand-fan cards do not get the ≥44px hit area the design guidelines require
`apps/web/src/lib/table-layout.ts:47-48` (`CARD_WIDTH = 56`, `FAN_STEP = 28`) and `hand-fan.svelte:21-32`: each card is a `56×80` button, but cards are stacked with a 28 px step and increasing `z-index` (`z-index:{i+1}`, `hand-fan.svelte:26`). Because later (higher-index) cards render on top, the right 28 px of every non-topmost card's button is covered by its neighbour's button and intercepts the pointer event. The exposed and clickable width for any card except the very last one in hand is exactly the 28 px step, not 56 px, and no invisible hit-area padding is added beyond the card's own bounds. `docs/design-guidelines.md` §8 explicitly calls this out: "cards: the visible 30 px strip is widened by an invisible hit area to 44 px" — this widening was never implemented; the button is only as wide as the card itself, so overlapped cards get a *sub-30px* effective hit area, not a widened one.

Failure scenario: with a full 10-card hand at the 28 px step, 9 of the 10 cards have a ~28 px-wide tappable region (well under the 44 px accessibility minimum), so mis-taps that land in the covered region silently toggle the neighbouring (topmost) card instead of the intended one — a direct, testable violation of an explicit design-guidelines requirement, not just a nitpick.

Fix: make the invisible hit area wider than the visible card (e.g. absolutely-position an oversized transparent hit target per card, offset so it doesn't fully occlude the neighbour's exposed strip), per the guideline's own stated mitigation.

## Medium

### 6. `room.connect(code)` is only invoked from `onMount`, so a room-code change without a route-name change is ignored
`waiting-screen.svelte:16-18` and `table-screen.svelte:31-33` both do `onMount(() => { room.connect(code); })` where `code` is a `$derived` off `route.params.code`. `onMount` runs once. Because Svelte's `{#if route.name === 'room'}...{/if}` block in `app.svelte:49` only re-mounts `WaitingScreen` when `route.name` itself changes (not when only `params.code` changes), navigating from `#/room/AAAAAA` directly to `#/room/BBBBBB` (e.g. via browser back/forward across two different rooms, or a stale/duplicate hash edit) leaves the existing `WaitingScreen` instance mounted and never calls `room.connect('BBBBBB')` again — the UI keeps showing room AAAAAA's live data while the header/room-code literal (`{code}`) reads BBBBBB, and actions like `Sẵn sàng`/`Bắt đầu` continue to operate on the stale room.
Likelihood is reduced by the app's own design (share uses a bare code, never a URL, so users aren't normally handed a second room's hash while already viewing one), but it's reachable via browser history navigation and is a real reactivity gap: `onMount` reading a `$derived` value only sees it once. Recommend replacing with `$effect(() => { room.connect(code); })` so it reacts to `code` changes too (guarded by `RoomStore.connect`'s existing idempotency check, which already handles the same-code case safely).

### 7. `WsClient`'s connection-lifecycle flags are shared across socket instances, creating a close/reopen race
`ws-client.svelte.ts`: `#closedByUser`, `connected`, and `#attempts` are instance fields on `WsClient`, not scoped to the specific `WebSocket` object they describe. `RoomStore.connect()` (`room.svelte.ts:28-36`) calls `this.ws.close()` (sets `#closedByUser = true`) and then, for a genuinely new code, immediately calls `this.ws.connect(code)`, which resets `#closedByUser = false` again before the *old* socket's asynchronous `close` event has necessarily fired. If that stale event arrives after the reset (plausible when a tab was backgrounded and iOS/Chrome coalesces/delays socket teardown events, or simply under any scheduling jitter), the old socket's `close` handler (`ws-client.svelte.ts:73-76`) sees `#closedByUser === false` and calls `#scheduleReconnect()`, which will eventually open a *second*, redundant socket to whatever room `#code` currently points to (a shared field), and can also clobber `connected` back to `false` right after the new socket's `open` handler set it `true`, causing the reconnect banner to flash/stick incorrectly.
This isn't hit by the common lobby→create/join→waiting flow (there's a real user click, hence real time, between `disconnect()` and the next `connect()`), so it wasn't caught in the lead's manual pass, but it is a latent bug in shared mutable state that should be fixed by tagging each socket with a generation token and having its callbacks check they're still "the current" socket before acting (a common pattern for exactly this class of race).

## Low / Notes (no action needed unless you want polish)

- `lobby-recent-sessions.svelte:9-21` uses `$effect(() => { api.recentSessions()... })` for a one-time fetch with no reactive dependency read synchronously — it works (runs once per mount, same as `onMount` would), but `onMount` would be the more idiomatic/obviously-correct choice for a fire-once side effect.
- `code-input.svelte:14-18` (`setChar`): backspacing a *middle* box (not the last-filled one) leaves an embedded space character in `value` rather than shifting later characters left, e.g. deleting index 1 of `"ABC"` yields `"A C"` (with a literal space at index 1) instead of `"AC "`/`"A_C"` behaving as most 6-box code inputs would. Not a security issue; worst case the user sees the boxes look right but the join lookup 404s with "Không tìm thấy phòng" for a code that looks correct. Minor UX papercut, not blocking.
- `denWarn`/`opponentSlots` (see Critical #2) are the only places that derive position/order from seat *numbers* via arithmetic rather than via direct `.seats.find(s.seat === x)` lookups or array position; everywhere else (centre-stack, result rows, seat-row, waiting screen) does direct lookups and is unaffected by seat-number gaps.

## Positive observations

- Contract usage is otherwise careful and correct: `youSeat`/`turnSeat` comparisons, `trick` newest-last rendering, `turnDeadline` treated as presentation-only (server alarm is authoritative), `result.rows` indexed by `seat` not array position, `canDeclareSam`/`youAreHost` trusted from the server rather than re-derived — all match the WS contract and phase-07's stated non-goals ("no local game state, no optimistic mutation").
- `selected` is correctly cleared on every snapshot via a dependency-free `$effect` in `table-logic.svelte.ts:48-51`, closing the "stale selection plays wrong cards" risk called out in the plan's own risk table.
- No `{@html}`, all fetches use `credentials: 'include'`, no token/credentials in `localStorage`, share uses the bare code only, server error strings are surfaced via `ApiError.message` for the REST paths.
- `100dvh` (not `100vh`) is used consistently, safe-area padding is applied via `max(Npx, env(...))` on every screen, `prefers-reduced-motion` is handled with a blanket global override, disabled buttons get the spec's 40% opacity, and inputs are exactly 16px to block iOS zoom.
- Timer ring is correctly presentation-only and the tag queue is capped per seat (`MAX_TAGS_PER_SEAT = 3`) with its `setTimeout`s tracked and cleared on teardown — no leaked timers found in `TableLogic`.
- Bundle size (86.6 KB / 30.9 KB gzip) is comfortably under the 120 KB soft budget from phase-07's risk table, confirming tree-shaking of `@samloc/rules` is working as intended.

## Unresolved questions for the lead / worker side

- Does the Durable Object ever send a distinguishing WS close code or a final `{type:'error'}` frame before closing a socket for an expired session / closed room? If yes, the client fix for finding #4 is straightforward (branch on close code); if no, that's a worker-side gap worth raising with `phase4-worker-auth`/`review-rules-worker`.
- Confirm whether the "next deal re-packs" seat numbers (per `room-do-store.ts:118-121`) actually fires the packing *before* the DO's snapshot that flips `status` to `'playing'` for the following hand — if so, finding #2's window is exactly "current hand only," which is what's assumed above.
