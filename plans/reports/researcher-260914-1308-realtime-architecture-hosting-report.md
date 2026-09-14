# Realtime Multiplayer Architecture & Hosting Research

## Scale Context
2–5 players/room, ~10–20 concurrent users max, turn-based browser card game (Sâm Lốc), friends-only, persistent score history, 15–30s turn timers, mobile network resilience required.

## Recommendations

| Component | Pick | Why | Runner-Up |
|-----------|------|-----|-----------|
| **Realtime Transport** | Socket.IO | Auto-reconnection, room management, fallback transports; turn-based overhead negligible. [1][2] | Raw WS + Colyseus (more control, steeper setup) |
| **Backend Runtime** | Node.js/TypeScript (Fastify + ws) | Single dev productivity, monorepo code sharing with frontend, Socket.IO native, familiar ecosystem. Bun/Elyxir viable but heavier. | Elixir/Phoenix (LiveView is genuinely strong [7] but slower ramp for solo dev) |
| **Persistence** | Turso (libSQL edge SQLite) | Free: 9GB storage, 1B row reads/mo, 25M writes/mo. Persistent, zero cold-start, Drizzle/Prisma compatible. [5] | Postgres (Neon: 100 CU-hrs/mo, 0.5GB [4]; Supabase: 500MB, pauses after 7 days [4]) |
| **Hosting** | Oracle Cloud Always Free | 2 OCPU/12GB ARM + 200GB block storage forever. No cold-start, WebSocket-capable, persistent volumes. [6] | Railway: $1/mo base + usage after $5 trial (predictable but paid) [3] |
| **Auth** | Better Auth (email+password) | Single-dev small app: ~1hr setup, bcrypt/argon2 built-in, session cookie or JWT, no external deps. Lucia deprecated (v2.0 → learning resource). [8][9] | Hand-rolled bcrypt/argon2 (overkill for this scale) |

## Game State Patterns (Best Practices)

1. **Authoritative server reducer**: Client sends action → server validates game rules → mutates reducer → broadcasts new state. Clients never mutate.
2. **Event log for reconnect**: Store {action, playerID, timestamp, seq} in DB. On reconnect, replay from last ack'd seq to bring client current.
3. **Idempotent actions**: Each action has sequence number (`turnSeq`). Server dedupes `(playerID, turnSeq)` to survive retransmits.
4. **Per-player view filtering**: Server broadcasts only visible hand/info to each player (fog of war). Never send full state to client.
5. **Turn timers**: Server tracks timer start, clients display countdown locally (via interpolation). Server source-of-truth.

## Key Decisions & Trade-offs

**Socket.IO vs Raw WS:**  
Socket.IO adds ~2% latency overhead [1]; turn-based games don't care. Saves ~50 lines reconnection logic; worth it for solo dev.

**Turso vs Postgres:**  
Turso's 9GB free is generous for score history. Neon's cold-start acceptable (max 30s resumption). Turso requires HTTP client (rust lib or node wrapper); slight complexity tradeoff for zero cold-start.

**Oracle Always Free:**  
Halved to 2 OCPU/12GB in 2026 [6] but sufficient for 20 users. Account provisioning varies by region/payment method; check eligibility first. No billing surprises.

**Better Auth vs DIY:**  
Better Auth v3 (6000+ GitHub stars, 500K weekly downloads by early 2026) [8]. Saves auth bugs, includes session + password reset + 2FA templates.

## Architecture Sketch

```
Browser (React/Vue) 
  ↓ Socket.IO
[Node.js + Fastify + Socket.IO.js]
  ↓ Drizzle ORM
[Turso (libSQL)]
  ├ Users (email_hash, salt, session_token)
  ├ Games (room_code, state, turn_seq, created_at)
  └ Scores (player_id, game_id, final_score)
```

Costs: **$0/mo** (Oracle free + Turso free tier covers 20 concurrent users, ~50 games/day for months).

---

## Unresolved Questions

1. **Turso HTTP latency under 100ms?** Verify Turso response time from Oracle Cloud region (likely Asia).
2. **Socket.IO session stickiness on Oracle free tier?** May need node affinity config if multi-instance scaling needed (unlikely).
3. **Turso write propagation delay** for cross-replica consistency? Docs mention async; verify if acceptable for turn commitment.
4. **Oracle Always Free availability guarantee?** Stated "indefinitely" but terms can change; build exit path to Railway ($1/mo).

## Sources

[1] https://velt.dev/blog/socketio-vs-websocket-guide-developers  
[2] https://app.cinevva.com/guides/multiplayer-browser-game  
[3] https://dev.to/nayankyada/railway-pricing-2026-free-tier-limits-usage-costs-when-to-upgrade-1acm  
[4] https://www.kunalganglani.com/blog/neon-vs-supabase-2026  
[5] https://www.codebrand.us/blog/turso-database-complete-guide-2026  
[6] https://terminalbytes.com/oracle-cloud-free-tier-changes-2026  
[7] https://codesync.global/media/georacer-building-a-real-time-multiplayer-mobile-game-in-elixir-in-6-weeks-cbf20  
[8] https://trybuildpilot.com/625-better-auth-vs-lucia-vs-nextauth-2026  
[9] https://www.pkgpulse.com/guides/lucia-auth-v3-vs-better-auth-vs-stack-auth-self-hosted-2026
