# Project Changelog — Sâm Lốc Online

## 2026-09-19

### Sâm window, deal animation, session money badge
- Every seat presses "Huỷ báo" or "Báo Sâm" after the deal (10 s countdown); the first card cannot be played until everyone has decided or the 15 s server deadline passes; a seat's choice shows as a badge on every client
- Deal animation: a deck in the centre deals one face-down card at a time to each seat for the length of the shuffle clip; skipped under reduced motion and on a reload
- Top bar shows the session money swing (`+$800`) instead of a lá count; the collapsed "Kết quả" chip sits left of the menu button instead of on top of it; the session board button is gone so the next leader's name is readable
- Profile boxes centred as a pair; lucky wheel has eight distinct wedge colours and a 4.3 s spin sound

### Fixes from phone play-testing
- Money reads `$10,000` (`$` prefix, en-US grouping) everywhere; deltas `+$500` / `−$500`; wheel wedge labels `1,000` … `10,000`
- Sound unlocks from `pointerup` / `keydown` instead of a once-only `pointerdown`: a touch `pointerdown` never grants user activation, so the `AudioContext` stayed suspended on phones
- Lucky-wheel modal sizes the wheel and its grid column from one `--wheel` variable; phone Safari collapsed the `auto` column and painted the wheel over the buttons
- Result board one notch smaller (640px, `--fs-lg` title, 40px footer buttons, tighter rows) so 5 players fit at 844×390
- No player name under the played combo in the centre of the table

### Features

#### Sound cues and a mute toggle
- Six Web Audio cues derived from snapshot transitions: `shuffle` (hand start), `play` (new trick entry), `join` (another seat appears), `turn` (my turn), `win` / `lose` (hand end; spectators silent); nothing plays on the first snapshot after connecting
- Audio unlocks on the first pointerdown; "Âm thanh: Bật/Tắt" in the table ≡ menu, persisted in `localStorage` `samloc.sound`
- Clips are `apps/web/public/sounds/<key>.mp3` (not in the repo yet — see the plan for the sources); a missing file leaves that cue silent
- Result modal shows "Mừng cậu chủ thắng lớn 💕" on the winner's screen (`result-head.svelte` split out of the modal)

#### Profile: nickname and uploaded avatar
- Home screen after login (`#/home`): avatar, name, budget, "Chơi ngay" / "Hồ sơ"; lobby gains a ⌂ button
- Profile screen (`#/profile`): rename (`PATCH /api/me`) and upload a photo — the browser centre-crops and re-encodes to a 128×128 JPEG ≤ 64 KB, `PUT /api/me/avatar` stores it as a D1 BLOB, `GET /api/avatars/:userId?v=` serves it immutable
- `SeatView.avatarVer` travels through the WS upgrade (`x-avatar-ver`) and DO seats so every seat, waiting row, me-chip, result row and winner pill shows the photo (initial fallback)
- Migration `0002_profile_avatar.sql`

#### Daily check-in and lucky wheel
- `POST /api/checkin` +1.000 đ once a day (UTC+7), `POST /api/spin` up to 5 times a day with server-side weighted wedges 200 / 400 / 600 / 1.000 / 2.000 / 4.000 / 10.000 / "Chúc may mắn" (30/22/16/13/9/5/2/3 %); limits enforced in the database (partial unique index, cap inside the INSERT)
- Grants live in the new `coin_grants` table and are folded into `budgetFor()`, so the budget stays derived
- Home shows the check-in card and a wheel launcher; the SVG wheel spins ≥ 5 turns for 4 s to the server-chosen wedge
- Migration `0003_coin_grants.sql`

### Table fixes
- Báo 1 is an 18 px red badge on the opponent avatar (no pill, no floating tag; aria-live still announces it)
- 4-player tables seat opponents left / top-centre / right; side seats moved to y 148
- Played combos rest on a deterministic scattered spot (120×40 box, ±12°) hashed from seat + cards; the play animation lands on the same spot

## 2026-09-15

### Rules

#### ⚠️ Low straights: 2 may sit at the bottom of a sảnh
- `A-2-3`, `2-3-4`, `A-2-3-4-5` … are now valid straights; `K-A-2` and `Q-K-A-2` stay invalid
- Order is `A-2-3 < 2-3-4 < 3-4-5 < … < Q-K-A`; a low straight never beats a normal one of the same length
- Sảnh rồng (ăn trắng) is unchanged — it still requires a 10-card run inside 3…A
- Supersedes the "Straight range: 3 … A only" line in `docs/game-rules.md`

#### ⚠️ Timeout auto-plays for every seat, not just the leader
- On timeout a player plays their lowest legal move and passes only when nothing beats the trick
- Applies inside a báo sâm hand too: a non-declarer who times out blocks the sâm and the declarer pays
- Supersedes the "if responding → auto-pass" line in `docs/game-rules.md`
- New rules module `legal-moves.ts` (`legalMoves()` / `lowestLegalMove()`) backs both this and the client hints

### Features

#### Money instead of ±lá
- Seats and result rows show a real money balance (10 000 start + Σ lá × stake, read from D1 at socket upgrade)
- `SeatView.money`, `ResultRow.deltaMoney` / `moneyAfter` added to the wire types; `totalLa` kept for the session board
- Seat rows carry `budget_base`; the WS upgrade forwards it as `x-budget`
- Worker helper `budget.ts` shared by the auth routes and the WS route

#### Play hints and hand re-sorting
- On your turn, cards belonging to a legal play carry a gold outline; nothing is dimmed, nothing is highlighted off-turn
- Tapping an outlined card with an empty selection selects the whole cheapest combo containing it
- New "Xếp bài" button toggles between rank order and combo grouping

#### Mid-session join
- A player may join a room that is already playing, up to the room's player count
- They see a "Bạn sẽ vào ván sau" banner with no action controls, and are dealt in on the next hand
- New seats are ready by default

#### Thối 2 announcement
- New `thoi2` game event, broadcast per paying seat at hand end, rendered as a floating "Thối 2 ×N (+M)" seat tag

#### Table colour presets
- Four felt colours (green / blue / burgundy / charcoal) in the table menu, persisted per device in `localStorage`

### Fixes

- Played cards no longer vanish when a trick ends: the winning combo stays on the table until the next lead (`trick_json` is now `{ entries, closed }`, legacy array shape still parsed)
- Combos are stored sorted, so a hand clicked as `5-4-3` reads as `3-4-5` for every viewer, in the flight animation and in the result modal
- The result modal now waits 1.8 s so the last combo is visible; a tap anywhere shows it immediately
- Result modal fits 5 players without an internal scrollbar: auto-fit grid, compact single-line rows, auto height
- The "đang chờ chủ phòng" line renders horizontally instead of stacking
- Every player, not just the host, has a "Rời phòng" button on the result screen
- Reaction bubbles above my chip are no longer painted over by the emoji bar
- The hand lies in a flat row instead of an arc

## 2026-09-14

### Major Changes

#### ⚠️ BREAKING: Room Codes Now 6 Digits (Not Alphanumeric)
- Room codes changed from 32-character alphanumeric alphabet to **6 digits** (`[0-9]{6}`)
- Pre-existing alphanumeric codes now return 404
- Client input field now numeric-only with no uppercasing
- Worker rejection ceiling updated from 224 → 250 for uniform digit distribution
- **Migration impact:** Users must generate new codes; old codes are invalid

### Features

#### Emoji Reactions (Ephemeral)
- 8 allowlisted emoji reactions: like, lol, sad, angry, fire, money, think, pray
- Broadcast-only (not persisted in snapshots or D1)
- Per-seat cooldown: 1500 ms
- New WebSocket frames: `{ type: 'emoji', key }` (client) and `{ type: 'emoji', seat, key }` (server)
- New components: `emoji-bar.svelte` (picker), `emoji-bubble.svelte` (animated reaction)
- New worker module: `emoji.ts` with allowlist validation

#### Play Animation (Card Flight to Centre)
- New component: `card-flight.svelte`
- 260 ms fly-to-centre CSS transform animation on card play
- Suppressed under `prefers-reduced-motion`
- Newest trick fades in over 260 ms to prevent duplicate card flash
- Driven by last-trick-key to avoid replay on reconnect snapshots

### Improvements

#### UI Layout & Sizing
- **Fan track origin:** `FAN_TRACK_LEFT` shifted 262 → 236 px to prevent overlap with me-chip and action bar for full 10-card fan
- **Opponent card-back:** Enlarged 22×30 px → 28×38 px for better visibility
- **Me-chip timer:** Redesigned as 40 px avatar with 48 px `TimerRing` arc overlay (3 px stroke, no digit label); remaining seconds display inside avatar
- **Action bar, me-chip, sam-pill:** Added `z-index: 20` for consistent layering

#### Card Faces
- Rank/suit pips repositioned from centred to **bottom-right** (flex-end/flex-end), fixing visual fusion of ♥/♦ with centre pips

### Documentation
- Updated `codebase-summary.md` with emoji contract, new components, and FAN_TRACK_LEFT
- Updated `design-guidelines.md` with 6-digit room codes, new timings, emoji picker, card-back sizing, and card flight animation

### Testing
- New test file: `apps/worker/tests/emoji.test.ts` — emoji key validation and allowlist enforcement
- All 126 tests pass; typecheck and production build verified

---

## Commit History

- `8761c5b` feat(web,worker): money budget in lobby, timer merged into opponent avatar, compact seats, plain Đánh label
- `92cbee8` chore: initial commit — Sâm Lốc online monorepo
