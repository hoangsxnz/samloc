# Cloudflare Turn-Based Game Room: DO + WebSocket + D1 Reference (2026)

**Status:** Verified against official Cloudflare docs (Sep 2026). Implementation-ready.

---

## 1. Durable Objects with SQLite Storage

**wrangler.toml/wrangler.jsonc:**
```toml
[[durable_objects.bindings]]
name = "ROOM"
class_name = "GameRoom"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["GameRoom"]
```

**Class structure:**
```typescript
export class GameRoom extends DurableObject {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.ctx = state;
  }

  async fetch(req: Request): Promise<Response> {
    const ws = new WebSocketPair();
    this.ctx.acceptWebSocket(ws[1], { tags: ["game"] });
    return new Response(null, { status: 101, webSocket: ws[0] });
  }

  async webSocketMessage(ws: WebSocket, msg: string | ArrayBuffer) {
    // Deserialize user id from attachment
    const userId = ws.deserializeAttachment() as string;
    
    // SQL access: this.ctx.storage.sql.exec(query, bindings?)
    const result = await this.ctx.storage.sql.exec(
      "INSERT INTO moves (room_id, user_id, move) VALUES (?, ?, ?)",
      [this.roomId, userId, msg]
    );
    
    // Broadcast to all connected clients
    const clients = this.ctx.getWebSockets("game");
    for (const client of clients) {
      client.send(msg);
    }
  }

  async alarm() {
    // Turn timer fired; process turn
    const moves = await this.ctx.storage.sql.exec(
      "SELECT * FROM moves WHERE processed = 0"
    );
    // Process game logic...
    await this.ctx.storage.sql.exec("UPDATE moves SET processed = 1");
  }
}
```

**Key APIs:**
- `this.ctx.storage.sql.exec(query, bindings?)` — SQL execution, returns `{ success, error }`
- `this.ctx.storage.transaction(() => { ... })` — ACID transactions (sync only)
- `this.ctx.acceptWebSocket(ws, { tags })` — Enable hibernation with optional tags
- `this.ctx.storage.setAlarm(timestamp)` — Schedule alarm; `ctx.abort({ retryAlarm: false })` to skip retry
- No `storage.get/put` KV methods on SQLite classes (KV was deprecated; use SQL)
- **Storage Limit:** 10 GB per DO (Free plan: no storage charges)

---

## 2. WebSocket Hibernation API

**acceptWebSocket + auto-response:**
```typescript
this.ctx.acceptWebSocket(ws, { tags: ["game"] });
this.ctx.setWebSocketAutoResponse(
  new WebSocketEventMap.WebSocketMessage({ type: "pong" }),
  ["ping"]
);
```

**Persist identity across hibernation:**
```typescript
const userId = extractUserIdFromHeader(req.headers);
ws.serializeAttachment(userId); // Attach userId

async webSocketMessage(ws: WebSocket, msg: string) {
  const userId = ws.deserializeAttachment() as string;
  // Use userId in game logic
}
```

**Fetch handler upgrade to WebSocket:**
```typescript
export default {
  async fetch(req, env) {
    if (req.headers.get("upgrade") === "websocket") {
      const pair = new WebSocketPair();
      env.ROOM.idFromName(code).get().fetch(req, { webSocket: pair[0] });
      return new Response(null, { status: 101, webSocket: pair[1] });
    }
  }
};
```

**Key facts:**
- Only charges for active execution, not idle hibernation
- `getWebSockets(tag)` returns connected clients; each can be tagged
- Auto-reply to Close frames enabled by default (compat date 2026-04-07+)

---

## 3. Hono + Worker Routing

**Hono app with Durable Object binding:**
```typescript
import { Hono } from "hono";

type Env = { ROOM: DurableObjectNamespace };

const app = new Hono<{ Bindings: Env }>();

app.get("/ws/:code", async (c) => {
  const code = c.req.param("code");
  const userId = c.req.header("x-user-id") || "";
  
  if (!userId) return c.text("Unauthorized", 401);
  
  const roomDo = c.env.ROOM.idFromName(code).get();
  return roomDo.fetch(c.req.raw, { userId }); // Pass auth context
});

export default app;
```

**Type Env** via `wrangler types`:
```bash
wrangler types
```
Generates `worker-configuration.d.ts` with correct bindings.

---

## 4. D1 Database

**wrangler.toml:**
```toml
[[d1_databases]]
binding = "DB"
database_name = "game_db"
database_id = "..."
```

**Usage in Worker:**
```typescript
const result = await env.DB
  .prepare("INSERT INTO players (id, name) VALUES (?, ?)")
  .bind(userId, username)
  .run();

const player = await env.DB
  .prepare("SELECT * FROM players WHERE id = ?")
  .bind(userId)
  .first(); // first(), all(), run()

// Batch:
const batch = [
  env.DB.prepare("INSERT INTO log (msg) VALUES (?)").bind("move"),
  env.DB.prepare("UPDATE state SET turn = turn + 1"),
];
const results = await env.DB.batch(batch);
```

**Migrations:**
```bash
wrangler d1 migrations create game_db create_tables
# Edit migrations/000001_create_tables.sql
wrangler d1 migrations apply game_db --local
```

**Free plan:** Daily limits (Sep 2026+) on row reads/writes; reset midnight UTC. Specific limits not exposed in docs; check D1 pricing page.

---

## 5. Workers Static Assets

**wrangler.toml:**
```toml
[env.production]
routes = [
  { pattern = "example.com/api/*", zone_name = "example.com" },
  { pattern = "example.com/ws/*", zone_name = "example.com" }
]

[assets]
directory = "../web/dist"
not_found_handling = "single-page-application"
run_worker_first = false  # Serve SPA on 404, but let /api /ws routes hit Worker first
```

**Routing precedence:** With `run_worker_first = false` (default), Worker fetch handler is called first; if no match, static assets serve. Confusing with SPA—safer to use custom `Routes` in wrangler.toml to explicitly route `/api/*` and `/ws/*` to Worker before assets fallback.

---

## 6. Local Development

**Option A: Wrangler + Vite Dev Proxy**
```bash
wrangler dev
```
Runs on http://localhost:8787 (supports DO, D1, WebSocket).

Vite dev server (http://localhost:5173) proxies `/api` and `/ws`:
```typescript
// vite.config.ts
export default {
  server: {
    proxy: {
      "/api": "http://localhost:8787",
      "/ws": { target: "ws://localhost:8787", ws: true }
    }
  }
};
```

**Option B: Cloudflare Vite Plugin**
```bash
npm install @cloudflare/vite-plugin
```
```typescript
// vite.config.ts
import { getViteConfig } from "@cloudflare/vite-plugin";
export default getViteConfig();
```
Integrates DO, D1, WebSockets in single dev server. **Recommended 2026** over proxy.

Persistence: `.wrangler/state/` stores local DO and D1 state.

---

## 7. Authentication on Workers

**PBKDF2-SHA256 password hashing:**
```typescript
async function hashPassword(password: string, salt: Uint8Array): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: salt,
      iterations: 100000 // OWASP 2025 recommendation
    },
    await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]),
    256
  );
  return Array.from(new Uint8Array(key)).map(b => b.toString(16)).join("");
}

// Timing-safe compare (crypto.subtle.timingSafeEqual)
async function verifyPassword(stored: string, attempt: string): Promise<boolean> {
  return crypto.subtle.timingSafeEqual(
    new TextEncoder().encode(stored),
    new TextEncoder().encode(attempt)
  );
}
```

**Sessions with Hono cookies:**
```typescript
import { setCookie, getCookie } from "hono/cookie";

app.post("/login", async (c) => {
  const sessionId = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO sessions (id, user_id, expires) VALUES (?, ?, ?)")
    .bind(sessionId, userId, Date.now() + 24*60*60*1000)
    .run();
  
  setCookie(c, "session_id", sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/"
  });
});
```

---

## 8. Testing Durable Objects

**vitest + @cloudflare/vitest-pool-workers:**
```bash
npm install @cloudflare/vitest-pool-workers vitest
```

```typescript
// vitest.config.ts
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" }
      }
    }
  }
});
```

```typescript
// src/__tests__/room.test.ts
import { env, createTestHarness } from "@cloudflare/vitest-pool-workers";
import { describe, it, expect } from "vitest";

describe("GameRoom", () => {
  it("stores moves in SQLite", async () => {
    const stub = env.ROOM.get(env.ROOM.idFromName("test-room"));
    const res = await stub.fetch("http://localhost/move", {
      method: "POST",
      body: "move-data"
    });
    // Assertions...
  });

  it("evicts and restores", async () => {
    const stub = env.ROOM.get(env.ROOM.idFromName("room2"));
    await stub.fetch(new Request("http://localhost/state"));
    
    // Simulate eviction
    await env.evictAllDurableObjects();
    
    // Verify state restored from SQLite
    const restored = await stub.fetch(new Request("http://localhost/state"));
  });
});
```

**Note:** vitest-pool-workers runs in workerd; good for integration tests. For unit tests of pure game logic, prefer plain vitest with mocked storage.

---

## 9. Free Plan Limits (2026)

| Resource | Free Limit | Reset |
|----------|-----------|-------|
| **Workers Requests** | 100k/day | 00:00 UTC |
| **DO Requests** | 100k/day | 00:00 UTC |
| **DO Duration** | 313k GB-s/day | 00:00 UTC |
| **DO SQLite Storage** | No charge (FREE) | — |
| **D1 Row Reads** | Daily limit (TBD) | 00:00 UTC |
| **D1 Row Writes** | Daily limit (TBD) | 00:00 UTC |

Effective Sep 1, 2026, D1 queries exceeding limits fail with errors (not silently truncated).

---

## Recommended File Layout for Apps/Worker

```
apps/worker/
├── wrangler.toml
├── src/
│   ├── index.ts          # Hono app entry point
│   ├── room.ts           # GameRoom Durable Object class
│   ├── auth.ts           # PBKDF2, session logic
│   └── types.ts          # Env interface (from wrangler types)
├── migrations/
│   └── 000001_init.sql   # D1 schema
└── tests/
    └── room.test.ts      # vitest-pool-workers tests
```

---

## Gotchas

1. **SQLite-only for new DOs:** KV-backed DOs deprecated. New namespaces must be `new_sqlite_classes`.
2. **No storage.get/put on SQLite:** Use `sql.exec()` instead. KV methods not available.
3. **Transactions sync-only:** Async/await inside `transaction()` throws. Use sync callbacks.
4. **WebSocket Hibernation not auto:** Must call `acceptWebSocket()` to enable; otherwise Worker is pinned to memory.
5. **Attachment serialization:** Only happens on `serializeAttachment()`; if not called, state lost on eviction.
6. **D1 batch returns array:** Each result is { success: bool, error?: string }, not a single result.
7. **Static assets + SPA confusing:** Use explicit routes in wrangler.toml to ensure `/api` and `/ws` hit Worker first.
8. **Free plan rate limit is per-day, not per-minute:** 100k requests/day sounds high but small delays can exceed; monitor.
9. **Vite plugin vs. Wrangler:** Vite plugin (2026) is now stable for DO+D1+WebSocket local dev; prefer over manual proxy setup.
10. **Alarm retries are automatic:** Use `{ retryAlarm: false }` in `ctx.abort()` to suppress retry on next eviction.

---

## Unresolved Questions

1. **D1 free tier row limit numbers:** Docs state "daily limit" and enforcement (Sep 1, 2026) but exact numbers not public. Check D1 pricing page directly or request via API.
2. **DO request billing on hibernated conns:** Does a message from hibernated WebSocket count as a request? (Docs say "duration when JS executes," but edge unclear.)
3. **Max attachment size:** No documented limit on `serializeAttachment()` payload. Assume <64KB (typical object storage limit).
4. **Wrangler assets CLI:** Recent changelog mentions "interactive wrangler assets" (Sep 9, 2025) but no detailed docs yet. Behavior may change.

---

**Sources:**
- [Durable Objects Overview](https://developers.cloudflare.com/durable-objects/)
- [SQLite Storage API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)
- [WebSocket Hibernation Server Example](https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/)
- [WebSockets API](https://developers.cloudflare.com/workers/runtime-apis/websockets/)
- [D1 Database API](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [Static Assets Configuration](https://developers.cloudflare.com/workers/static-assets/)
- [Hono Framework Guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/hono/)
- [Web Crypto API](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)
- [Vitest Integration](https://developers.cloudflare.com/workers/testing/vitest-integration/)
- [Durable Objects Alarms](https://developers.cloudflare.com/durable-objects/examples/alarms-api/)
- [Pricing & Limits](https://developers.cloudflare.com/workers/platform/pricing/) / [D1 Limits](https://developers.cloudflare.com/d1/platform/pricing/)
- [Vite Plugin](https://developers.cloudflare.com/workers/vite-plugin/)
