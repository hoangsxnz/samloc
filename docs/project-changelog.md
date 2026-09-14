# Project Changelog — Sâm Lốc Online

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
