# Code Standards — Sâm Lốc Online

Conventions enforced across the monorepo. All code reviewed and verified 2026-09-14.

## TypeScript Compiler Options

- `strict: true` — strict null checks, no implicit any
- `noUncheckedIndexedAccess: true` — indexed objects must validate bounds
- Target: ES2020 (Workers runtime)

## File & Naming Conventions

- **Kebab-case filenames** (`.ts`, `.svelte`) — e.g. `room-do-view.ts`, `playing-card.svelte`
- **File size limit: 200 lines max** — enforced via `find...wc -l` checks; larger components split into subtopic files (see `phase-06-implementation-report.md`, `phase-07-implementation-report.md`)
- **`.svelte.ts` for files with runes** — reactive state (`$state`, `$effect`, `$derived`) must live in `.svelte.ts` files, not `.ts` (runes are Svelte 5 only and require the special extension to compile correctly; see `lib/ws-client.svelte.ts`)
- **No `{@html}`** — no raw HTML injection in templates; use component slots or styled text instead

## TypeScript Style

- **Svelte 5 runes only** — no legacy `let`/`onMount`/`getContext`; use `$state`, `$effect`, `$derived` (see `lib/room.svelte.ts`, `lib/session.svelte.ts`)
- **Type imports** — prefer `import type { X }` for types only (reduces runtime bundle; see `apps/worker/src/ws-types.ts`, `packages/rules/src/state.ts`)
- **Discriminated unions over overloads** — `ClientMsg` and `ServerMsg` use `{ type: ... } & (...)` pattern (`apps/worker/src/ws-types.ts`)
- **No default exports** — named exports only
- **No implicit return** — functions are explicit (no auto-return from arrow functions spanning multiple lines)

## Internationalization

- **Vietnamese strings with diacritics** — all user-facing text must preserve tones (ă, ê, ô, ơ, ư, đ, etc.; see `apps/worker/src/validation.ts` error messages, `apps/worker/src/routes-auth.ts` status messages, all screens in `apps/web/src/screens/`)
- **No English fallbacks for UI text** — the app is Vietnamese-only
- **Font:** Be Vietnam Pro (Google Fonts, subset=vietnamese) ensures diacritics render; fallback `system-ui, sans-serif`

## Architecture Constraints

### Rules Engine (`packages/rules`)

- **Pure functions** — no I/O, no imports from Node/Cloudflare APIs
- **JSON-safe state** — `RulesState` and `GameEvent` must be serializable to/from JSON (used on server and client)
- **No mutations** — all reducers (`reducer-*.ts`) accept state and return a new state via `structuredClone()` + mutation on the copy
- **Seed determinism** — hand seeding via `crypto.getRandomValues()` on server; same seed always produces same deal

### Server (`apps/worker`)

- **Server is sole authority** — client validation is UI-only; server always re-validates actions via `applyGameAction()` before mutating game state
- **All D1 access parameterised** — no SQL string concatenation; all queries use `?` placeholders (verified in `room-do-store.ts`; see code-review-rules-and-worker-report.md)
- **Rate limiting** — DO enforces 10 msg/s per socket, burst 20 (token bucket in `room-do.ts:104–117`)
- **Per-player view filtering** — opponent hands hidden at snapshot time in `room-do-view.ts:buildView()`, confirmed by `room-do-view.test.ts` serialized-frame check; no player ever sees another player's cards in any `ServerMsg`

### Frontend (`apps/web`)

- **No local game state** — `table-screen.svelte` renders only what `RoomView` provides; no optimistic updates or desynced copies
- **Reactive state in `.svelte.ts` singletons** — `room`, `session`, `router`, `orientation` (all `lib/*.svelte.ts`) are the source of truth
- **Component state is transient** — UI state like `selected` cards, modal visibility live in component `$state` and reset on every snapshot (see `table-logic.svelte.ts`)

## Testing Conventions

### Test File Naming

Per `docs/game-rules.md` bullets:

- **Cards / Combos:** `cards.test.ts`, `combos.test.ts`
- **Turn flow / Settlement:** `reducer-*.test.ts` (e.g. `reducer-turn-flow.test.ts`, `reducer-chat-den.test.ts`, `reducer-sam.test.ts`, `settle.test.ts`)
- **Integration / Rules:** `instant-win.test.ts`, `compare.test.ts`, `deal.test.ts`
- **Auth / Infrastructure:** `auth.test.ts`, `room-code.test.ts`, `room-do-view.test.ts`

### Test Coverage

- **Rules engine:** 95 tests (`packages/rules/tests/`) verify combos, comparisons, deal distribution, instant-wins, turn flow, settlement against `docs/game-rules.md`
- **Worker:** 26 tests (`apps/worker/tests/`) verify auth (PBKDF2, validators), room codes, D1 schema
- **Web:** No unit tests (Vitest in Node; UI verified by dev server + visual inspection in browser)
- **Integration:** Phase-04/06/07 implementation reports include `curl` and manual smoke tests

## Code Comments

- **Why, not what** — comments explain design decisions and invariants, not repeat the code
- **No plan/phase references** — code comments must not cite plan phases (e.g. "per phase-05 spec...") or finding codes (e.g. "to fix H1..."); cite the actual codebase location or design doc instead (see `code-review-rules-and-worker-report.md` section 5 on code-comment hygiene)
- **Example:** ✓ "socket-to-seat mapping is by user id, not seat number, to survive seat compaction" vs. ✗ "per phase-05, use user id instead of seat" (see `room-do-hand.ts:38`)

## Commits & Versioning

- **Conventional commits:** `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:` prefixes
- **No AI references** — commit messages do not mention "Claude" or agents
- **Atomic commits** — one logical change per commit; related files grouped
- **Example:** `feat: add room idle-close after 60s with no players` vs. `Update room-do.ts`

## Security & Validation

- **Input validation on server** — `parseUsername()`, `parsePassword()`, `parseRoomSettings()` in `validation.ts` return `{ok, value|error}` with Vietnamese error messages
- **Authentication:** Username + password (no OAuth), PBKDF2-SHA256 (100k iterations, 16-byte salt), HttpOnly session cookies
- **CSRF:** SameSite=Lax on cookies; the app is same-origin only
- **Trust boundary:** Authenticated user id (`x-user-id` header) is always server-overwritten via `Headers.set()`, never trusted from client

## Build & Deployment

- **No plan references in source code** — code comments, filenames, and identifiers must be self-contained and stable
- **Monorepo structure:**
  - `packages/rules/src/` compiled as TypeScript source (no `dist/` build step); consumed via `exports: ./src/index.ts` in both Vite and Wrangler
  - `apps/worker/` and `apps/web/` built by their respective tools (Wrangler + Vite)
- **Version pinning:**
  - TypeScript 6.x (svelte-check compatibility; TS 7.x pending svelte-check update)
  - Svelte 5.0+ (runes; no legacy mode)
  - Node 24, pnpm 10
- **Deployment:**
  - `pnpm run deploy` = `pnpm build` + `wrangler deploy`
  - Workers free tier: 100k requests/day (DO + WS hibernated)
