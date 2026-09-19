# Design Guidelines — Sâm Lốc Online

Mobile-first, **landscape-only** browser card game for a private friend group. UI language: Vietnamese.
Wireframes: `docs/wireframe/01..05-*.html` (844×390 landscape frames, inline CSS, no JS).

## 1. Palette (CSS custom properties)

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#0f1a14` | App background outside the table, lobby/login screens |
| `--surface` | `#1b2a21` | Panels, list rows, inputs |
| `--surface-2` | `#24382c` | Raised panels, hover rows, modal body |
| `--felt` | `#1a4d2e` | Table felt (game screen background) |
| `--felt-dark` | `#123822` | Table rim, pressed felt |
| `--felt-light` | `#22643c` | Felt highlight (radial gradient centre) |
| `--gold` | `#d4af37` | Primary action, active-turn ring, score chips, focus ring |
| `--gold-dark` | `#a8862a` | Primary pressed state |
| `--on-gold` | `#1a1408` | Text on gold |
| `--text` | `#f4f1e8` | Body text on dark (contrast 11:1 on felt) |
| `--text-muted` | `#a8b5ac` | Secondary text, hints (4.6:1 on felt) |
| `--line` | `rgba(255,255,255,.12)` | Borders, dividers |
| `--card-face` | `#ffffff` | Card face |
| `--card-red` | `#dc143c` | ♥ ♦ rank + suit |
| `--card-black` | `#1a1a1a` | ♠ ♣ rank + suit |
| `--card-back` | `#7a1f2e` | Card back base (diamond lattice in `rgba(255,255,255,.3)`) |
| `--danger` | `#dc2626` | Destructive action, penalty amounts, timer < 5 s |
| `--success` | `#22c55e` | Ready state, positive score |
| `--warn` | `#f59e0b` | Reconnect banner, warning event tags |
| `--info` | `#3b82f6` | Informational event tag |

Contrast: `--gold` on `--felt` = 4.6:1 (OK for large/bold text and icons; body text on felt uses `--text`).
`--on-gold` on `--gold` = 9:1. Positive score → `--success`, negative → `#f87171` (lighter red for 4.5:1 on dark).

## 2. Typography

Font: **Be Vietnam Pro** (Google Fonts, `subset=vietnamese,latin`, weights 400/600/700). Fallback `system-ui, sans-serif`.
```
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700&display=swap" rel="stylesheet">
```
Card rank glyphs use the same font, weight 700, `font-variant-numeric: tabular-nums`.

| Token | Size / line-height | Use |
|---|---|---|
| `--fs-xs` | 12 / 16 | Badges, timestamps |
| `--fs-sm` | 14 / 20 | Secondary labels, list meta |
| `--fs-md` | 16 / 24 | Body, inputs, buttons |
| `--fs-lg` | 18 / 26 | Section titles, player names on table |
| `--fs-xl` | 22 / 28 | Screen titles |
| `--fs-2xl` | 28 / 34 | Score totals, timer digits |
| `--fs-3xl` | 36 / 40 | Room code, hand result net score |

Room codes: 6 digits (0–9), `letter-spacing: .18em`, weight 700, monospace rendering (tabular-nums).

## 3. Spacing & radius

Base 4 px: `--sp-1: 4px, --sp-2: 8px, --sp-3: 12px, --sp-4: 16px, --sp-5: 24px, --sp-6: 32px`.
Radius: `--r-sm: 8px` (badges, inputs), `--r-md: 12px` (buttons, cards-as-panels), `--r-lg: 20px` (modals, sheets), `--r-card: 6px` (playing cards), `--r-full: 999px` (pills, avatars).
Screen padding: 16 px vertical, 40 px horizontal (covers the landscape notch; see §7).

## 4. Component inventory

**Buttons** — height 48 px (≥44 px tap target), radius `--r-md`, weight 600, full width in forms.
- Primary: `--gold` bg, `--on-gold` text. Pressed `--gold-dark`. Disabled 40 % opacity.
- Secondary: transparent bg, 1.5 px `--gold` border, `--gold` text. Pressed: `rgba(212,175,55,.15)` bg.
- Danger: `--danger` bg, white text. Used for "Rời phòng", confirm dialogs.
- Ghost: no border, `--text-muted` text. Toggle links ("Tạo tài khoản").
- Focus: 2 px `--gold` outline, offset 2 px (keyboard + a11y).

**Playing card** — 56×80 px (ratio 0.71). Radius `--r-card`, `--card-face` bg, 1 px `rgba(0,0,0,.15)` border, shadow `0 2px 6px rgba(0,0,0,.35)`. Rank top-left (22 px/700) with suit glyph beneath (18 px); centre suit 32 px. Red suits `--card-red`, black `--card-black`.
Small variant (centre stack, result rows): 44×62 px, rank 16 px. Card back: `--card-back` with lattice pattern, 4 px inner white border.

**Own hand fan (10 cards)** — cards absolutely positioned along the bottom edge on a 308 px track (x 236–544); step 28 px (index 0 at 0 px, index 9 at 252 px, total 308 px). Rotation `-10° → +10°` in 2.2° steps; vertical offset follows the arc (outer cards +12 px), base card top at 312 px so the bottom sits near the edge. Selected card: `translateY(-20px)`, gold 2 px outline. Tap toggles selection; no drag. Fewer cards: keep step 28 px, re-centre the track. Hand must never overlap the me-chip (left 40–200 px) or action bar (right 40–266 px: Đánh 120 + Bỏ lượt 96 + gap): track spans 236–544 px.

**Avatar** — one component everywhere (seats, me-chip, waiting rows, result rows, lobby/home headers): the user's uploaded photo (128×128 JPEG, served at `/api/avatars/:id?v=`) or the initial letter on `--surface-2`. The consumer keeps its own ring (2 px `--line`, gold when active).

**Seat (opponent)** — 80 px wide column: 40 px round avatar + name (12 px/600, max 8 chars + ellipsis). Below the name, one row: 28×38 px card-back (`--card-back`, 1.5 px white border) with the remaining count in white 15 px/700 (turns `--danger` when 1 card left) + session lá total (10 px `--muted`). Báo 1: an 18 px `--danger` badge with a white "1" on the avatar's top-right corner (2 px `--felt-dark` ring); no pill and no floating tag, so the seat column never grows into the centre stack. Active turn: gold avatar border + 48 px timer arc (3 px stroke) wrapped around the avatar, and the remaining seconds replace the avatar inside it; under 5 s arc and digits `--danger`, digits pulse. Passed: avatar 50 % opacity + "Bỏ" pill (10 px). Disconnected: grey ring + "⟳". Emoji reactions appear above the avatar.

**Timer ring** — one component, size-parametric (`size`, `stroke`, `digits` props). Me-chip: 40 px avatar with 48 px ring overlay (3 px stroke, no digits label) and remaining seconds displayed inside the avatar. Opponent: 48 px arc-only variant around the active avatar (digits live inside the avatar). Gold arc drains clockwise from `turnSeconds`; under 5 s stroke `--danger`, digits pulse (see §5).

**Centre stack** — no frame. Each played combo is a row of small cards (20 px overlap) resting on its own spot inside a 120×40 px box centred on the table (x 302–542, y 150–250 column), rotated ±12°; the spot is a hash of seat + cards, so every client and every reconnect shows the same scatter and the play animation lands exactly there. The newest sits on top at full opacity with the player name (11 px `--muted`) beneath; older combos of the trick stay where they landed at 30–50 % opacity. Trick end: whole stack fades 350 ms.

**Action bar** — anchored bottom-right (right 40 px, bottom 20 px): "Bỏ lượt" (secondary, 96 px) + "Đánh" (primary, 120 px, disabled until selection is valid). A "Báo Sâm" pill (secondary with gold glow) floats above the bar ONLY during the pre-play window (after deal, before the first card); it is removed for everyone as soon as the first card is played. Right offset includes `env(safe-area-inset-right)`.

**Event tag** — no centre toast. A small pill (11 px/700) appears under the seat of the player involved for 1.6 s: "Chặt 2 +15" (gold), "Báo Sâm" (danger), "Ăn trắng" (info), "Đền bài" (danger), "Thối 2" (warn). Mirrored to aria-live; "Báo 1" is aria-live only (the avatar badge is its visual).
- "Chặt 2! +15" gold bg / `--on-gold`; "Chặt chồng! +30" same with double-chevron icon.
- "Báo Sâm!" `--danger` bg / white; "Cóng" shown in result overlay only.
- Reconnect: full-width top banner 30 px, `--warn` bg, "Mất kết nối, đang kết nối lại…" with spinner; slides down over the top bar, inset by left/right safe areas.

**Emoji reactions** — ephemeral, peer-broadcast-only (not persisted). 8 allowlisted reactions: like, lol, sad, angry, fire, money, think, pray. Picker: 8-icon row triggered by a button (or auto-show); closes on outside pointerdown. Bubbles: emojis rise and fade over 1600 ms above the reacting player's avatar. Per-seat cooldown: 1500 ms. Cap 3 reactions per seat displayed simultaneously.

**Modal / result sheet** — centred modal 640×330 px, radius `--r-lg`, `--surface` bg, scrim `rgba(0,0,0,.6)`. Header: title or headline, winner pill (avatar + "X thắng"), and the full-width gold line "Mừng cậu chủ thắng lớn 💕" (16 px/700) only on the winner's screen. Player rows in a 2-column grid (5 players → 3 rows, inner scroll): avatar, name, net ± for the hand, session total, and the player's remaining cards as mini faces (24×32 px, 7 px overlap). No itemised penalty chips. Footer actions in one row.

**Table menu (≡)** — felt swatches, "Âm thanh: Bật/Tắt" (secondary, `aria-pressed`), "Rời phòng".

**Check-in card** — `.panel`: title "Điểm danh hàng ngày", "+1.000đ mỗi ngày", primary "Nhận 1.000đ" → disabled "Đã điểm danh hôm nay ✓".

**Lucky wheel** — modal 560×340: left a 280 px SVG wheel (8 wedges alternating `--surface-2` / `--felt-light`, gold 1.5 px strokes, 13 px/700 labels reading outward, 10 px for "Chúc may mắn", gold hub and a gold triangle pointer fixed at 12 o'clock); right the title, "Còn N lượt hôm nay", primary "Quay", the result line (gold, "+600đ 🎉" or "Chúc may mắn lần sau") and ghost "Đóng". Spin: 4 s `cubic-bezier(.17,.67,.12,.99)`, at least five full turns, never rewinds; the scrim and "Đóng" are disabled while spinning; under reduced motion the result shows at once.

## 5. Motion

Durations: micro 120 ms (press, toggle), standard 200 ms (raise card, event tag in), deal 300 ms per card staggered 40 ms, collect 350 ms, play animation 260 ms. Easing: `cubic-bezier(.2,.8,.2,1)` for enter, `ease-in` for exit.
- Deal: cards fly from table centre to hand with rotation; total ≤ 700 ms for 10 cards.
- Play: fly-to-centre animation (260 ms) — selected cards transform from hand to centre stack. Previous combo drops to 30–50 % opacity. Newest trick fades in over 260 ms to prevent duplicate card flash mid-flight.
- Trick end: centre stack fades 350 ms.
- Timer under 5 s: digits `scale(1→1.15)` pulse 500 ms infinite.
- Sound cues (Web Audio, unlocked from `pointerup` / `keydown` — the events that grant user activation on touch — and retried until the context runs; mute persisted in `localStorage` `samloc.sound`): `shuffle` on hand start, `play` on every new trick entry, `join` when another seat appears, `turn` when the turn becomes mine, `win` / `lose` at hand end (spectators hear neither). Nothing plays on the first snapshot after connecting. Files live in `apps/web/public/sounds/<key>.mp3`; a missing file leaves that cue silent.
- `@media (prefers-reduced-motion: reduce)`: disable deal/play/collect motion, keep opacity fades ≤ 100 ms, no pulse.

## 6. Landscape lock

Landscape only. `manifest.orientation: "landscape"` handles installed PWA; iOS Safari ignores manifest orientation outside PWA, so the app also detects `matchMedia('(orientation: portrait)')` and shows a full-screen overlay "Xoay ngang máy để chơi" (rotate icon, `--bg` background) on every screen, not just the table. Rationale: 4 opponents around the felt plus a 10-card fan and an action bar fit in 844×390 without stacking; the fan gets a 30 px step instead of 28 px, and seats sit on the edges like a real table. Where supported, call `screen.orientation.lock('landscape')` after the first user gesture (PWA only).

## 7. Viewport, safe areas, layout rules

- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, `user-scalable=no` on the game screen only.
- Heights use `100dvh`, never `100vh`. Root `height: 100dvh; overflow: hidden` on the table; lobby/login screens scroll inside a content column.
- Landscape safe areas: the notch sits on the left or right, so `padding-left: max(40px, env(safe-area-inset-left))` and `padding-right: max(40px, env(safe-area-inset-right))` on every screen; `padding-top: max(8px, env(safe-area-inset-top))`, `padding-bottom: max(12px, env(safe-area-inset-bottom))` (home indicator).
- Table layout is absolute inside 844×390 (design reference): top bar 0–44; top seats at y 48 (x 200 from each edge; 2-player seat top-centre); side seats at y 148 (x 44 from each edge, centred on the table's y 200); slots by player count — 2: top-centre; 3: top-left / top-right; 4: left / top-centre / right (0 / 90 / 180 / 270 around me); 5: left / top-left / top-right / right; centre stack 240×100 at y 150–250 (no frame, no toast); me-chip + timer bottom-left (x 40, y 306); hand track 236–544, base top 312; action bar bottom-right (`Đánh` label only, never the combo name). Scale the whole table with `transform: scale()` for 360–430 px tall viewports rather than reflowing.
- Lobby/waiting use 2–3 columns side by side; login is a 2-column hero + form. Lobby header: avatar, name, `Ngân sách: 10.000` chip (`vi-VN` thousands separator; 10 000 on register ± settled hands × stake + coin grants), ⌂ home and ⏻ logout icon buttons.
- Home (`#/home`, landing after login): two equal columns. Left: 72 px avatar in a gold ring, display name (22 px/700), `@username`, budget chip, logout icon; then stacked "Chơi ngay" (primary) and "Hồ sơ" (secondary). Right: the check-in card and a wheel launcher panel ("Còn N/5 lượt hôm nay", secondary "Quay ngay"). Fits 390 px tall without scrolling.
- Profile (`#/profile`): ghost "← Trang chủ" header; two columns — 96 px avatar in a gold ring with secondary "Đổi ảnh" (file picker; the browser crops and resizes to 128×128 JPEG ≤ 64 KB), and a `.panel` form with "Tên hiển thị" + primary "Lưu" (disabled while unchanged), green "Đã lưu" for 1.5 s.
- `touch-action: manipulation` on interactive elements to kill 300 ms delay; `-webkit-tap-highlight-color: transparent`.

## 8. Accessibility minimums

- Tap targets ≥ 44×44 px (cards: the visible 30 px strip is widened by an invisible hit area to 44 px).
- Text contrast ≥ 4.5:1, large text/icons ≥ 3:1; never convey state by colour alone (turn ring + "Đến lượt" label; suit glyph + colour).
- Every event tag is mirrored to an `aria-live="polite"` region; timer has `role="timer"`.
- Inputs 16 px font to prevent iOS zoom; labels visible, not placeholder-only.
- Respect `prefers-reduced-motion`; keep animations non-blocking for input.
