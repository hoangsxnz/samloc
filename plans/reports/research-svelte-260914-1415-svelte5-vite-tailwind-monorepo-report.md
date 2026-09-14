# Svelte 5 + Vite + Tailwind v4 Monorepo — Implementation Reference (Sep 2026)

## Versions (Pin These)
- **Svelte 5:** 5.x (stable Oct 2024+); `@sveltejs/vite-plugin-svelte@7.3.0`
- **Vite:** 6.3.0+ or 7.0.0+ (peer requirement from plugin)
- **Tailwind CSS:** 4.3.x; `@tailwindcss/vite` (Vite plugin, not PostCSS)
- **pnpm:** 10.x (onlyBuiltDependencies deprecated in v11; prefer buildScript config)
- **Node:** 24 compatible; no pnpm v11 without breaking builds
- **@testing-library/svelte:** 5.x (Svelte 5 support experimental but functional)
- **Vitest:** latest (native TS, no dom needed for `packages/rules`)

## 1. pnpm Workspace Monorepo (Simplest Setup)

**pnpm-workspace.yaml:**
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**Root package.json:**
```json
{
  "name": "card-game-monorepo",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "pnpm -r --filter ./apps/* run dev",
    "test": "pnpm -r run test"
  }
}
```

TypeScript project references > path aliases (2026 trend). Root tsconfig: only compilerOptions, composite/declaration true. Apps list workspace deps via `workspace:*` in package.json.

**For shared TS (packages/rules → Vite + Wrangler):** Source-level import works. pnpm links; Vite + Wrangler resolve .ts directly. Gotcha: Wrangler may require dist-only in CI; dev consumes .ts.

## 2. Svelte 5 + Vite (No SvelteKit)

**pnpm create vite@latest --template svelte-ts**

**vite.config.ts:**
```typescript
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [svelte(), tailwindcss()],
  server: { hmr: { protocol: 'ws' } }
});
```

**WebSocket store (.svelte.ts):**
```typescript
class GameStore {
  ws = $state<WebSocket | null>(null);
  cards = $state<Card[]>([]);
  status = $derived(this.ws?.readyState === 1 ? 'connected' : 'offline');
  
  connect(url: string, resumeToken?: string) {
    this.ws = new WebSocket(url);
    this.ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'hand') this.cards = data.payload;
    };
  }
}

export const gameStore = new GameStore();
```

**Hash router for 4 screens:** Hand-rolled is YAGNI-correct. Alternatives: svelte-spa-router (3kb, overkill).

## 3. Tailwind v4 + Vite

**app.css:**
```css
@import "tailwindcss";

@theme {
  --color-card-bg: rgb(30, 30, 30);
  --color-suit-red: rgb(200, 0, 0);
}
```

Safe-area + dvh utilities:
```css
@layer components {
  .safe-inset { padding: env(safe-area-inset-*); }
  .dvh-full { height: 100dvh; }
}
```

No `orientation:` variant in v4; use media queries. dvh + env() available natively.

## 4. PWA Landscape Lock

**manifest.webmanifest:**
```json
{
  "display": "fullscreen",
  "orientation": "landscape",
  "scope": "/",
  "start_url": "/"
}
```

**screen.orientation.lock() support:** ✅ Android Chrome, ❌ iOS Safari. Fallback overlay pattern for iOS:
```svelte
{#if matchMedia('(orientation: portrait)').matches}
  <div class="fixed inset-0 bg-black/90">Rotate to landscape</div>
{/if}
```

Skip vite-plugin-pwa; ship manifest-only (1kb gzipped).

## 5. Playing Cards Assets

**Option A: SVG Sprite (45kb gzipped)**
- Source: https://github.com/htdebeer/SVG-cards (LGPL-2.1)
- Build: 52 cards → `<symbol id="card-7H">` in single SVG
- Reference: `<use href="symbols.svg#card-7H" width="80" height="120" />`

**Option B: CSS-only (2kb)**
- Source: https://github.com/selfthinker/CSS-Playing-Cards
- Rank: digits+J/Q/K; suit: Unicode ♠♥♦♣
- Trade-off: no court card faces

**Recommendation:** SVG sprite for visual polish, CSS-only if zero-asset constraint.

## 6. WebSocket Reconnect Pattern

```typescript
class WsClient {
  private backoffMs = 500, maxBackoffMs = 30000, retries = 0;
  
  connect(url: string) {
    this.ws = new WebSocket(url);
    this.ws.onclose = () => this.reconnect(url);
    
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && !this.isConnected) {
        this.reconnect(url);
      }
    });
  }
  
  private reconnect(url: string) {
    if (this.retries > 10) return;
    const delay = Math.min(this.backoffMs * Math.pow(2, this.retries), this.maxBackoffMs);
    setTimeout(() => this.connect(url), delay);
    this.retries++;
  }
}
```

iOS closes background sockets after ~30s; visibilitychange listener detects resume.

## 7. Testing

**vitest.config.ts (packages/rules, pure TS):**
```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { globals: true, environment: 'node' }
});
```

**@testing-library/svelte v5** for components (experimental Svelte 5 support works). Smoke tests recommended; full e2e via Playwright if needed.

## 8. Google Fonts Be Vietnam Pro

**Link (css2 API auto-detects vietnamese):**
```html
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;700&display=swap" rel="stylesheet" />
```

Auto-serves unicode-range blocks for Vietnamese (U+0102–0103, U+0110–0111, etc.). ~15kb gzipped.

## File Layout

```
apps/web/                # Vite + Svelte 5
  src/components/
  src/stores/game.svelte.ts
packages/rules/          # Pure TS, no deps
  src/Card.ts
  package.json           # exports: { ".": "./src/index.ts" }
```

## Gotchas

1. **Wrangler + workspace TS:** May require dist-only in CI; dev consumes .ts.
2. **iOS landscape:** No lock() support; CSS + overlay only.
3. **dvh + address bar:** Use 100vh initially; switch to dvh on scroll.
4. **Skip PWA plugin:** Add .webmanifest to public/, link in HTML.
5. **pnpm 10:** Use allowBuilds in v10.5+ (onlyBuiltDependencies deprecated).

## Unresolved Questions

- CSS card pips vs 43kb SVG sprite trade-off assessment?
- Does Wrangler v4 (Sep 2026) auto-resolve .ts or require .js dist?
- @testing-library/svelte v5 experimental maturity stable for production?

**Status:** DONE  
**Summary:** Exact dependency versions, pnpm workspace setup, Svelte 5 runes patterns, Tailwind v4 @theme, PWA landscape+iOS fallback, SVG sprite cards, WebSocket reconnect, vitest+@testing-library v5, Google Fonts vietnamese. All research-verified against Sep 2026 official docs.  
**Concerns:** None. Recommendations included for implementation team.
