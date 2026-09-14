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
| `--warn` | `#f59e0b` | Reconnect banner, "Báo 1" event tag |
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

Room codes: 6 uppercase chars, `letter-spacing: .18em`, weight 700.

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

**Own hand fan (10 cards)** — cards absolutely positioned along the bottom edge on a 308 px track (x 262–570); step 28 px (index 0 at 0 px, index 9 at 252 px, total 308 px). Rotation `-10° → +10°` in 2.2° steps; vertical offset follows the arc (outer cards +12 px), base card top at 312 px so the bottom sits near the edge. Selected card: `translateY(-20px)`, gold 2 px outline. Tap toggles selection; no drag. Fewer cards: keep step 28 px, re-centre the track. Hand must never overlap the me-chip (left 40–200 px) or action bar (right 40–266 px: Đánh 120 + Bỏ lượt 96 + gap): track spans 262–570 px.

**Seat (opponent)** — 80 px wide column: 40 px round avatar (initial letter, `--surface-2` bg, 2 px `--line` border) + name (12 px/600, max 8 chars + ellipsis). Below the name, one row: 22×30 px card-back (`--card-back`, 1.5 px white border) with the remaining count in white 13 px/700 (turns `--danger` when 1 card left) + session lá total (10 px `--muted`). No avatar badge, no extra label. Active turn: gold avatar border + 48 px timer arc (3 px stroke) wrapped around the avatar, and the remaining seconds replace the initial inside it; under 5 s arc and digits `--danger`, digits pulse. Passed: avatar 50 % opacity + "Bỏ" pill (10 px). Báo 1: pill turns `--danger`. Disconnected: grey ring + "⟳".

**Timer ring** — one component, size-parametric (`size`, `stroke`, `digits` props). Me-chip: 56 px circle, 4 px stroke, digits centred 22 px/700. Opponent: 48 px arc-only variant around the active avatar (digits live inside the avatar). Gold arc drains clockwise from `turnSeconds`; under 5 s stroke `--danger`, digits pulse (see §5).

**Centre stack** — no frame. Each played combo is a row of small cards (20 px overlap) centred on the table; the newest sits on top at full opacity with the player name (11 px `--muted`) beneath; older combos of the trick stay underneath at 30–50 % opacity with a small offset and ±5–7° rotation. Trick end: whole stack fades 350 ms.

**Action bar** — anchored bottom-right (right 40 px, bottom 20 px): "Bỏ lượt" (secondary, 96 px) + "Đánh" (primary, 120 px, disabled until selection is valid). A "Báo Sâm" pill (secondary with gold glow) floats above the bar ONLY during the pre-play window (after deal, before the first card); it is removed for everyone as soon as the first card is played. Right offset includes `env(safe-area-inset-right)`.

**Event tag** — no centre toast. A small pill (11 px/700) appears under the seat of the player involved for 1.6 s: "Chặt 2 +15" (gold), "Báo Sâm" (danger), "Báo 1" (warn), "Ăn trắng" (info). Mirrored to aria-live.
- "Chặt 2! +15" gold bg / `--on-gold`; "Chặt chồng! +30" same with double-chevron icon.
- "Báo Sâm!" `--danger` bg / white; "Báo 1" `--warn` bg / `--on-gold`; "Cóng", "Thối 2" shown in result overlay only.
- Reconnect: full-width top banner 30 px, `--warn` bg, "Mất kết nối, đang kết nối lại…" with spinner; slides down over the top bar, inset by left/right safe areas.

**Modal / result sheet** — centred modal 640×330 px, radius `--r-lg`, `--surface` bg, scrim `rgba(0,0,0,.6)`. Player rows in a 2-column grid (5 players → 3 rows, inner scroll): avatar, name, net ± for the hand, session total, and the player's remaining cards as mini faces (24×32 px, 7 px overlap). No itemised penalty chips. Footer actions in one row.

## 5. Motion

Durations: micro 120 ms (press, toggle), standard 200 ms (raise card, event tag in), deal 300 ms per card staggered 40 ms, collect 350 ms. Easing: `cubic-bezier(.2,.8,.2,1)` for enter, `ease-in` for exit.
- Deal: cards fly from table centre to hand with rotation; total ≤ 700 ms for 10 cards.
- Play: selected cards translate from hand to centre stack, scale 1 → 0.7; previous combo drops to 30–50 % opacity.
- Trick end: centre stack fades 350 ms.
- Timer under 5 s: digits `scale(1→1.15)` pulse 500 ms infinite.
- `@media (prefers-reduced-motion: reduce)`: disable deal/collect motion, keep opacity fades ≤ 100 ms, no pulse.

## 6. Landscape lock

Landscape only. `manifest.orientation: "landscape"` handles installed PWA; iOS Safari ignores manifest orientation outside PWA, so the app also detects `matchMedia('(orientation: portrait)')` and shows a full-screen overlay "Xoay ngang máy để chơi" (rotate icon, `--bg` background) on every screen, not just the table. Rationale: 4 opponents around the felt plus a 10-card fan and an action bar fit in 844×390 without stacking; the fan gets a 30 px step instead of 28 px, and seats sit on the edges like a real table. Where supported, call `screen.orientation.lock('landscape')` after the first user gesture (PWA only).

## 7. Viewport, safe areas, layout rules

- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, `user-scalable=no` on the game screen only.
- Heights use `100dvh`, never `100vh`. Root `height: 100dvh; overflow: hidden` on the table; lobby/login screens scroll inside a content column.
- Landscape safe areas: the notch sits on the left or right, so `padding-left: max(40px, env(safe-area-inset-left))` and `padding-right: max(40px, env(safe-area-inset-right))` on every screen; `padding-top: max(8px, env(safe-area-inset-top))`, `padding-bottom: max(12px, env(safe-area-inset-bottom))` (home indicator).
- Table layout is absolute inside 844×390 (design reference): top bar 0–44; top seats at y 48 (x 200 from each edge; 2-player seat top-centre); side seats at y 120 (x 44 from each edge); centre stack 240×100 at y 150–250 (no frame, no toast); me-chip + timer bottom-left (x 40, y 306); hand track 262–570, base top 312; action bar bottom-right (`Đánh` label only, never the combo name). Scale the whole table with `transform: scale()` for 360–430 px tall viewports rather than reflowing.
- Lobby/waiting use 2–3 columns side by side; login is a 2-column hero + form. Lobby header chip shows the money budget `Ngân sách: 10.000` (`vi-VN` thousands separator; 10 000 on register ± settled hands × stake).
- `touch-action: manipulation` on interactive elements to kill 300 ms delay; `-webkit-tap-highlight-color: transparent`.

## 8. Accessibility minimums

- Tap targets ≥ 44×44 px (cards: the visible 30 px strip is widened by an invisible hit area to 44 px).
- Text contrast ≥ 4.5:1, large text/icons ≥ 3:1; never convey state by colour alone (turn ring + "Đến lượt" label; suit glyph + colour).
- Every event tag is mirrored to an `aria-live="polite"` region; timer has `role="timer"`.
- Inputs 16 px font to prevent iOS zoom; labels visible, not placeholder-only.
- Respect `prefers-reduced-motion`; keep animations non-blocking for input.
