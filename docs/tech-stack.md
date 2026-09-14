# Tech Stack — Sâm Lốc Online

Approved 2026-09-14 (research: `plans/reports/researcher-260914-1308-*`).

## Decisions

| Layer | Pick | Why |
|---|---|---|
| Language | TypeScript everywhere (pnpm monorepo) | One language; rule engine shared client/server |
| Rule engine | `packages/rules` — pure TS, zero deps | Deterministic, unit-tested, used by server (authoritative) and client (UI hints) |
| Backend | Cloudflare Workers + Hono, one Durable Object per room | Free, no sleep, no card; DO serializes room state; WebSocket Hibernation API |
| Persistence | Live game state: DO SQLite storage. Accounts, sessions, hand results: Cloudflare D1 (free tier) | Zero ops; both free |
| Auth | Username + password, PBKDF2-SHA256 via WebCrypto (Workers has no argon2), HttpOnly session cookie | Private app; no email/OAuth needed |
| Frontend | Svelte 5 (runes) + Vite + Tailwind v4 | 5–10 KB runtime, built-in transitions |
| Cards | Drawn in CSS (rank + suit glyph), no image assets | Minimal UI per user; zero asset weight |
| Font | Be Vietnam Pro (Vietnamese subset), fallback system-ui | Diacritics render correctly |
| Layout | Mobile LANDSCAPE-first (844×390 base), orientation locked landscape via manifest + JS hint, PWA manifest | User decision 2026-09-14; wide table fits 5 seats |
| Hosting | Cloudflare Workers (API + WS + static assets in one worker), `wrangler deploy` | See `docs/deployment.md` |
| Realtime client | Native WebSocket + small reconnect wrapper (no Socket.IO) | Workers runtime constraint |
| Routing / PWA | Hand-rolled hash router (5 screens); manifest only, no service worker | YAGNI |
| Local dev | `@cloudflare/vite-plugin` (DO + D1 + WS in Vite); fallback `wrangler dev` + proxy | Single dev server |

## Implementation notes (2026-09-14)
- `@samloc/rules` is consumed as TypeScript source (`exports: "./src/index.ts"`) by both Vite and Wrangler; no dist build step.
- TypeScript pinned to 6.x: `svelte-check` does not yet support TypeScript 7.
- Worker tests run under plain vitest (`environment: node`); the installed `@cloudflare/vitest-pool-workers` exposes no `./config` entry. All worker unit tests are pure functions (WebCrypto, validation, view filter).
- PBKDF2 stays at 100 000 iterations (native WebCrypto, not metered as JS CPU).
- The Durable Object stores the current trick's combos (`trick_json`) and the next leader's user id (`next_lead_user_id`) alongside the rules state, so the client can render the trick history and the lead survives seat compaction.
- Rooms close when the last seat leaves, when a hand is abandoned by every player, or 60 s after a hand ends with nobody connected.

## Constraints
- Server (Durable Object) is the only source of truth; clients never mutate game state.
- Client sends actions with a sequence number; DO replies with a per-player filtered snapshot after every action (no event replay needed at this scale).
- Per-player view filtering: opponents' hands never leave the server.
- Files ≤200 lines; kebab-case filenames.

## Game rules (house rules, room-configurable)
See `docs/game-rules.md`.
