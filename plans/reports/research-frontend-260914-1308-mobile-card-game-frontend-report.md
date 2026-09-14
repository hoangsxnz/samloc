# Sâm Lốc Mobile Card Game Frontend Research — 2026

## Recommendation Matrix

| Concern | Pick | Why | Runner-Up |
|---------|------|-----|-----------|
| **Framework** | **Svelte 5** | Runtime 5–10KB, runes = predictable reactivity, zero animation boilerplate via transitions. Production-ready Oct 2024, team ramp ≤2wk. | SolidJS (7KB; faster but hiring risk for tiny team) |
| **Card Assets** | **SVG-cards (htdebeer)** LGPL | Pure SVG, npm installable, 52-card set + jokers + backs. Sprite as CSS grid or bundle per-file. Scales lossless. | Webisso/playing-cards (MIT, same quality). |
| **Interaction** | **Portrait only** + tap toggle | Landscape = 5 seats unreadable on 390px. Portrait: seat rotated, opponent hands stacked north (show card count). Tap card to select (raise). | — |
| **Card Fanning** | **CSS 3D transforms** -10° to +10° rotation, negative margin overlap. JS: auto-compute spread angle per hand size. | Zero animation lib needed. 10 cards = ~30px per card on 390px width. Mobile-optimized UX. | GSAP (overkill for static fan, +78KB). |
| **Animations** | **Svelte transitions** + CSS `transition` | transition:animate directives handle deal/flip/collect. 200ms default easing. Ship 0 extra deps. FLIP not needed (turn-based, no layout shift race). | Framer Motion (85KB) or GSAP (78KB) — wasted gzip for turn-based. |
| **State Sync** | **WebSocket + server-authoritative** | Tiny team, anti-cheat mandatory. Svelte store: subscribe to WS events, update UI reactively. Reconnect banner via `$connected` store. | Hand-rolled REST polling (stale, anti-pattern for real-time). |
| **Styling** | **Tailwind v4** | 15–25KB gzipped (PurgeCSS). @theme in CSS, 5x faster builds vs v3. Dark green (#1a4d2e felt), gold accents (#d4af37). Component reuse. | Vanilla CSS (smaller, slower dev; green felt + layout is simple, maybe 1–2 CSS files, worth reconsidering if bundle is crisis). |
| **Fonts** | **Be Vietnam Pro (Google Fonts)** | Neo Grotesk, stacked diacritics perfect for Vietnamese, sharp at mobile sizes. Include Vietnamese subset only (~12KB). Fallback: **Lexend** (sans-serif, also Vietnamese). | Inter/Poppins (no Vietnamese subset by default; must explicitly enable; less legible in Vietnamese). |
| **PWA** | **YES: manifest + SW** | A2HS works iOS/Android 2026. Zero investment for full-screen install. Turn timer benefits from wake-lock during active turn (request via Screen Wake Lock API if needed). | Optional if web-only launch is acceptable. Manifest + basic SW = 30min setup. |

---

## Asset Links & Licenses

**Playing Cards:**
- **[SVG-cards (htdebeer)](https://github.com/htdebeer/SVG-cards)** — LGPL-3.0 (commercial OK). NPM: `npm install svg-cards` or copy SVG dir.  
  Bundle strategy: Combine 52 cards + backs into single sprite.svg (CSS Grid layout, 2–3 cols) or split by suit (4 files). Sprite = 1 HTTP request; per-file = easier hot-reload dev.
- **[Webisso/playing-cards](https://github.com/Webisso/playing-cards)** — MIT. PNG + SVG. Similar quality.

**Fonts:**
- **[Be Vietnam Pro (Google Fonts)](https://fonts.google.com/specimen/Be+Vietnam+Pro)** — Include Vietnamese + Latin subset via `@font-face` or `<link>`.  
  `https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700&subset=vietnamese,latin`
- **[Lexend (Google Fonts)](https://fonts.google.com/specimen/Lexend)** — Vietnamese subset available. Fallback sans-serif.

**Color Palette:**
- Felt: `#1a4d2e` (dark green, accessible on white card text).
- Gold: `#d4af37` (score chip, UI highlight).
- Card: `#ffffff` (faces), `#000000` (spades/clubs), `#dc143c` (hearts/diamonds).

---

## Portrait Layout (390px Phone, 5 Players)

```
                      ┌─────────────┐
                      │   Opponent1 │  Card count: 5
                      │   (North)   │  [X][X]...
                      └─────────────┘

    ┌────────┐  Opponent2         Opponent4  ┌────────┐
    │   Opp2 │  (West)              (East)   │   Opp4 │
    │ Count:4│                                │ Count:7│
    └────────┘                                └────────┘

          ┌──────────────────────────────────┐
          │   COMMUNITY / LAST COMBO         │
          │   (Flop, Turn, River in poker)   │
          │   [3♠] [5♦] [7♣]                │
          └──────────────────────────────────┘

                  ┌────────────────┐
                  │ TIMER: 12s     │
                  │ Current player │
                  └────────────────┘

         ┌──────────────────────────────┐
         │  YOUR HAND (10 cards max)    │
         │  [Rotated fan, -10° to +10°] │
         │    ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐     │
         │  ┌─┴─┼─┴─┼─┴─┼─┴─┼─┴─┐    │
         │ ┌┘   │   │   │   │   └┐   │
         │ │ 2♠ │ 5♦ │ 9♣ │ K♥ │ A♠ │  ← Selected card is raised
         │ └┐   │   │   │   │   ┌┘   │
         │  └─┬─┴─┬─┴─┬─┴─┬─┴─┬─┘    │
         │    └─┘ └─┘ └─┘ └─┘ └─┘    │
         │                           │
         │  [Đánh] [Bỏ lượt]         │
         └──────────────────────────────┘

Seat Rotation (top-down viewing table):
- Player (You): South (bottom, portrait).
- Opponent1: North (top).
- Opponent2: West (left).
- Opponent3: East (right).
- Opponent4: NW/NE (stacked above Opponent1, names/counts only).

Hand Display: Cards fan around bottom-centre anchor, overlap ~30–40px per card, tap to toggle selection (raise +20px). No drag.
```

---

## Implementation Priorities (Phased)

1. **Setup (1–2 days):**  
   - Vite + Svelte 5, install dependencies (ws library, tailwind v4, svelte/transitions).
   - Add manifest.json, basic service worker (offline fallback).
   - Fetch SVG-cards sprite, confirm sprite layout (CSS Grid or transform: translate).

2. **UI Shell (2–3 days):**  
   - Layout: 5-seat table, opponent card counts, your hand (fanned, tappable).
   - Router: login screen, lobby/room, game screen. Tailwind for rapid styling.
   - Typography: Be Vietnam Pro via Google Fonts (Vietnamese subset).

3. **Game Logic (3–4 days):**  
   - WebSocket client: connect, handle GameState events (cardPlayed, turn, roundWon).
   - Svelte store: $gameState, $myHand, $selectedCards, $connected.
   - State reducer: consume events, update UI.

4. **Animations (1–2 days):**  
   - Svelte transitions: cardDealt, cardFlipped, cardPlayed.
   - CSS transforms for fan spread, tap-raise effect.

5. **Polish (1–2 days):**  
   - Reconnect banner, error handling, dark mode (if needed).
   - iOS safe area (viewport-fit=cover, dvh units).
   - Service worker offline page, A2HS metadata.

---

## Mobile-Specific Gotchas

| Issue | Fix |
|-------|-----|
| **iOS 100vh includes toolbar height** | Use `dvh` (dynamic viewport height) in Tailwind or CSS. Meta: `viewport-fit=cover`. |
| **iPhone notch safe areas** | Use `env(safe-area-inset-*)` for top/bottom padding on game area. Tailwind v4: `supports-safe-area` variant. |
| **Card tap-to-select on 390px width** | Hand must rotate at ≥-10° to +10° (not flatter). Test overlap on actual device (emulator 6.7″ phone). |
| **WebSocket reconnect jank** | Show banner (top 40px) when `$connected === false`. No full reload—UI stays live. |
| **Landscape = unreadable** | Disable via manifest `"orientation": "portrait"` or JS lock. 5 seats on 844px width = still cramped. |
| **SVG sprite file size** | Sprite.svg (~150–200KB uncompressed) becomes ~30–40KB gzipped. Accept as baseline asset. |
| **Service worker stale assets** | Use revision hash in manifest.json cache-busting strategy or network-first for game state. |

---

## Unresolved Questions

1. **Server framework & WebSocket library:** Node.js (ws) + Express, or Deno? Affects client library choice (native ws vs Socket.io).
2. **Persistent state storage:** Is game history needed client-side? (IndexedDB for offline replay?) Assumes turn-based, no offline play.
3. **Sound/haptics:** "Minimal" → skip entirely or add subtle card-flip sound (< 50KB). Check iOS audio context (user gesture required).
4. **Login method:** OAuth, username/password, or guest? Affects state store complexity.
5. **Monetization/ads:** If present, adds complexity to PWA manifest + ad SDK. None assumed.

---

**Report Date:** 2026-09-14 | **Sources verified:** Sep 2026 (Svelte 5 stable, Tailwind v4 current, Google Fonts Vietnamese support confirmed).

