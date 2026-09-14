# Additional Free/Low-Cost Hosting Options Research

## Summary

Evaluated 7 hosting options for Node.js WebSocket card game server (2–20 users, SQLite storage, 2026 terms). Key finding: **only 3 truly free + no-sleep options exist** (Cloudflare Workers with Durable Objects, Google Cloud Run free tier, self-host via Tunnel). Most alternatives either sleep/scale-to-zero, don't support WebSockets, or require significant runtime/architecture changes.

---

## Comparison Table

| Option | Free? | Card? | Sleeps? | Wake Latency | WS Support | Storage | Setup Effort | Key Catch |
|--------|-------|-------|---------|--------------|------------|---------|--------------|-----------|
| **Cloudflare Workers + DO** | Yes | No | No | 0ms (edge) | Yes (via DO) | SQLite in DO (10GB) | 4 | Forces Hono/non-Node runtime; Socket.IO incompatible |
| **Google Cloud Run** | Yes (always-free) | No | Yes (scale-to-zero) | 5–10s cold start | Yes (60min timeout) | Ephemeral; pair Turso/Neon | 2 | In-memory state lost on scale; needs external DB |
| **Koyeb** | Yes | No | **Yes (1h idle)** | 3–5s cold start | **NO** (free tier blocks persistent connections) | — | 1 | **WebSockets unsupported on free tier** (deal-breaker) |
| **Northflank** | Yes (2 services) | No | Unknown | ? | Likely yes | 1 free DB | 2 | Sparse public docs; free quota tiny (2 services) |
| **Deno Deploy** | Yes (1M req/mo) | No | No (edge) | 0ms | Yes | Deno KV (1GB) | 3 | Node.js compat limited; Socket.IO uncertain; KV access from Node limited |
| **Cloudflare Tunnel** | Yes | No | No (local) | <100ms (Tunnel latency) | Yes | Local disk or external | 3 | Machine must stay on 24/7; home upload BW bottleneck; quick-tunnel only 200 concurrent |
| **Cheap VPS** | No | No | No | <50ms (local DC) | Yes | Full disk | 1 | $3–7/mo Vietnam; Hetzner Singapore ~€8/mo; reliability depends on provider |

---

## Top 3: Truly Free + No Sleep

1. **Cloudflare Workers + Durable Objects** (best edge + persistence)
   - Free: 100K DO requests/day + Workers runtime
   - Zero cold start (deployed at edge globally)
   - WebSocket Hibernation API reduces idle costs
   - Trade-off: Hono/TypeScript only; no Socket.IO; requires DO programming model

2. **Google Cloud Run always-free tier** (simplest Node.js entry)
   - Free: 2M requests/month + 360K vCPU-seconds/month
   - Standard Node.js/Express/Fastify works
   - WebSocket: 60-min timeout; handles long-lived connections
   - Trade-off: Scales to zero (cold start ~5–10s); in-memory state lost; needs Turso/Neon for persistence

3. **Self-host via Cloudflare Tunnel** (true zero latency)
   - Free Tunnel + free named tunnel (need ~$0.75/yr .xyz domain)
   - Machine stays on, no latency, full control
   - WebSocket native support
   - Trade-off: Machine must run 24/7; home upload BW (5–20 Mbps typical) is bottleneck for many concurrent users; electricity cost; Tunnel adds ~100ms latency per direction

---

## Top 3: Least Effort to Deploy

1. **Google Cloud Run** (push button, standard Node.js)
   - Docker or `gcloud deploy` one-liner
   - Works with Express, Fastify, Socket.IO out of box
   - Lowest learning curve

2. **Cheap Vietnam VPS** (AZDIGI/Vietnix ~$3–5/mo)
   - Full Linux, SSH, any runtime
   - One-time setup, stays running
   - Lowest config complexity post-deployment

3. **Deno Deploy** (similar to Vercel)
   - GitHub push auto-deploys
   - Web UI dashboard
   - Trade-off: Node.js compat layer, Socket.IO uncertain

---

## Option-by-Option Deep Dive

### 1. Cloudflare Workers + Durable Objects

**Limits (2026):** 100K DO requests/day free; Workers: 100K requests/day; 313K GB-sec CPU/day.

**WebSocket:** Native via Hibernation API (only way to handle long-lived WS without constant billing). Suspends object during idle, resumes on message.

**Storage:** Durable Object transactional storage, 10GB per DO, strongly consistent, durable across requests. Can store SQLite database inside DO.

**Region:** Global edge (Vietnam served from Singapore/APAC edge).

**Deploy:** `npm run deploy` via Wrangler CLI.

**Catch:** Workers runtime ≠ Node.js. Forces Hono, itty-router, or raw Fetch API. Socket.IO **does not work** (requires Node.js http.Server). Game must be refactored to Fetch-based WebSocket API. No Fastify, no Express.

---

### 2. Google Cloud Run

**Limits (2026):** 2M requests/month, 360K vCPU-seconds/month, 2M GB-seconds/month (always-free tier).

**WebSocket:** Fully supported; configurable timeout up to 60 minutes. **Critical:** max 60-min request timeout. After timeout, client must reconnect (WS dropped).

**Storage:** Ephemeral container filesystem (not persistent). Pair with Turso (SQLite in cloud) or Neon (PostgreSQL), both have free tiers.

**Region:** US multi-region by default; can't pin to Asia (cold start hits regardless).

**Deploy:** `gcloud run deploy` or GitHub Actions + Cloud Build.

**Cold Start:** ~5–10s for Node.js (scales down to zero after 15 min idle).

**Catch:** Scale-to-zero means in-memory state (game session data) is lost. Every wake is a cold start. Suitable if all state goes to external DB. Timeout limit (60 min) may disconnect long-playing sessions if they exceed it.

---

### 3. Koyeb

**Deal-breaker:** Free tier **does not support persistent connections (WebSocket, HTTP/2 streaming)**. Scale-to-zero after 1h idle unavoidable. Paid tier needed for always-on ($12/mo) and WebSocket.

**Skip for this use case.**

---

### 4. Northflank

**Free Tier:** 2 free services, 1 free database, 2 free cron jobs.

**WebSocket:** Docs unclear. Platform supports WebSockets in architecture (mentions real-time team collaboration), but no explicit free-tier limitation stated in search results.

**Catch:** Sparse public documentation for free tier limits. Service limit (2 services) means frontend + backend only, no room for side services. Unclear if free DB is SQLite or PostgreSQL.

**Verdict:** Too risky; insufficient data on free tier WS support and storage.

---

### 5. Deno Deploy

**Free Tier:** 1M requests/month, 100GB bandwidth, 20 deployments, 1GB Deno KV, global edge.

**WebSocket:** Supported natively. Raw WebSocket API works; Socket.IO status unclear (not explicitly tested/reported in community).

**Storage:** Deno KV (key-value) free 1GB. No direct SQL; KV for simple state (game scores) possible, but complex queries harder.

**Node.js Compat:** Broad npm compatibility via Node.js compat layer, but packages with C bindings, native modules, or deep Node.js APIs won't work. Socket.IO uses Node.js APIs, uncertain if it runs.

**Region:** Global edge.

**Deploy:** GitHub push (like Vercel).

**Catch:** Deno KV access from Node.js code is not exposed (external KV Connect not live). If relying on Socket.IO or complex ORMs, risks are high. Edge runtime, not standard Node.js.

---

### 6. Self-Host via Cloudflare Tunnel

**Cost:** Free Tunnel + ~$0.75/yr .xyz domain (for persistent named tunnel; quick-tunnel ephemeral).

**WebSocket:** Fully supported. Tunnel transparently forwards WS traffic.

**Setup:** Install cloudflared CLI, `cloudflared tunnel create`, configure DNS, run locally.

**Latency:** Tunnel adds ~100ms round-trip (client → Cloudflare → home → game server).

**Persistence:** Runs on user's machine (PC, laptop, RPi). Full filesystem, any runtime.

**Catch:**
- **Machine uptime:** Must stay on 24/7 (electricity cost, reliability).
- **Home upload BW:** Typical home internet (FTTH) = 5–20 Mbps upload. For 20 concurrent WS (assume 1–2 Kbps per client for game events), rough max ~100 Mbps needed. Home BW usually sufficient, but ISP throttling or neighbor congestion unpredictable.
- **Quick Tunnel:** 200 concurrent requests max; only for testing.
- **Named Tunnel:** Requires Cloudflare account + domain. Free .xyz domain renewal pricing unclear (first year ~$0.75, renewal can jump).

---

### 7. Cheap VPS (Paid Baseline)

**Vietnam Options:**
- **AZDIGI:** From 79,000 VND (~$3/mo; 512MB RAM). For 2GB: 249,000 VND (~$10/mo).
- **Vietnix:** From 159,000 VND (~$6/mo; 2GB RAM).
- **VinaHost:** From $5/mo.

**Hetzner Cloud (Singapore):**
- CPX22: €7.99/mo (~$8.50) after April 2026 price increase.
- Singapore traffic: expensive overage at €7.40/TB (avoid high bandwidth).
- Cost-optimized tier not available in Singapore.

**Setup:** SSH, full Linux, standard deployment. Uptime depends on provider (Vietnamese hosts 99.9% SLA typical).

**Verdict:** Lowest friction post-landing (no cold starts, no edge-runtime constraints), but not free.

---

## Unresolved Questions

1. **Socket.IO on Deno Deploy:** Community unclear; requires testing. Fallback to raw WS likely needed.
2. **Northflank free tier WebSocket:** Official docs unavailable in search results. Needs direct vendor contact.
3. **Google Cloud Run 60-min timeout:** Is timeout per-request or per-connection? If per-connection, long-lived sessions will disconnect mid-game.
4. **Cloudflare Tunnel .xyz renewal:** First year $0.75, but renewal pricing unknown (may jump to $13/yr).
5. **Home upload BW + concurrent users:** Needs empirical test. Typical FTTH upload (10–20 Mbps) likely okay for 20 users, but depends on game event frequency.
6. **Deno KV access from Socket.IO:** If Deno KV Connect for Node.js still blocked, storage strategy unclear for Node.js code on Deno Deploy.

---

## Recommendation Summary

**Truly free + no-sleep tier:** Cloudflare Workers (if rewriting to Hono), Google Cloud Run (accept cold start), or self-host (accept machine uptime).

**Least friction:** Google Cloud Run (standard Node.js) or $5/mo Vietnam VPS (eliminate sleep entirely).

**Not viable:** Koyeb (no WS free), Northflank (data gap), Deno Deploy (Socket.IO uncertain).

---

## Sources

- [Cloudflare Durable Objects Pricing & Free Tier (April 2025)](https://developers.cloudflare.com/changelog/2025-04-07-durable-objects-free-tier/)
- [Google Cloud Run WebSocket Support & Timeout (2026)](https://docs.cloud.google.com/run/docs/tutorials/websockets)
- [Koyeb Free Tier WebSocket Limitation](https://www.srvrlss.io/provider/koyeb/)
- [Deno Deploy Free Tier & KV (2026)](https://www.srvrlss.io/provider/deno-deploy/)
- [Cloudflare Tunnel Quick Tunnel Limits](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/)
- [Socket.IO Hono Compatibility Issue](https://github.com/orgs/honojs/discussions/1781)
- [Vietnamese VPS Pricing Comparison (AZDIGI, Vietnix, VinaHost)](https://azdigi.com/blog/kien-thuc-vps/azdigi-vs-vietnix-vps)
- [Hetzner Cloud Singapore Pricing & April 2026 Increase](https://betterstack.com/community/guides/web-servers/hetzner-cloud-review/)
- [Cheap Domain Pricing .xyz .vn .top (2026)](https://www.networksolutions.com/blog/cheap-domain-names/)
