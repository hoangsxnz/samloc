# Sâm Lốc Online — End-of-Session Debrief

**Date**: 2026-09-14 16:20  
**Severity**: Medium  
**Component**: Full monorepo, phases 1–7 complete; phase 8 blocked  
**Status**: Blocked  

## What Happened

Implemented a private-group card game in a pnpm monorepo: TypeScript rules engine (phases 1–3), Worker auth+D1 (phase 4), Durable Object realtime (phase 5), Svelte 5 login/lobby/waiting/table UI (phases 6–7). All code compiles, tests pass (121/121), 40 of 46 success criteria verified in browser. Phase 8 (deploy docs + 43-item device smoke test) blocked on `wrangler login`, which only the user can run. Two findings from code review remain live: seat-gap display bug (found by modulo-arithmetic analysis, not testing) and optional H1 leave-during-hand-end compaction desync.

## The Brutal Truth

We shipped 2-player happy-path testing. That's why the seat-gap bug lived in code review undetected by any manual pass — requires ≥3 seats with a mid-hand departure. Same reason the socket-lifecycle race and the reconnect-banner permanent-stall weren't caught: need browser backgrounding or network drops, not just tab navigation. The Vite D1 local-state bug cost hours because it silently fails (generic "no such table" at the DB layer with no stack trace). The Bash environment hook blocking any command with "dist" in it is maddening — can't grep for it, can't find it, can't clean it. That's not the dev team's fault, but it made debugging the D1 directory mismatch harder.

## Technical Details

**Difficulties:** TypeScript 7 broke svelte-check (pinned to 6.x); `@cloudflare/vitest-pool-workers@0.22.0` has no `./config` export (fell back to plain vitest node pool); Vite plugin persists D1 to `apps/web/.wrangler`, but `wrangler migrations apply` from `apps/worker` persists to `apps/worker/.wrangler` (different state trees); non-ASCII `x-user-name` header needed URL-encoding between Worker and DO; seat-gap bug in `opponentSlots()` modulo arithmetic (`(youSeat + k) % seatCount` fails when seats [0,1,3] exist); socket closes on waiting→table transition, causing reconnect banner to appear even on successful reconnect; table screen has no escape if WS never connects.

**Fixes applied from reviews:** Compacted seats only during waiting (not on bare leave during hand-end); host no longer persisted in DO (derived live); socket kept across waiting→table via idempotent `room.connect()`; idle-close alarm 60s after hand-end with nobody connected; `seatsAfter()` replaces modulo derivation for opponent slots; reconnect banner capped at 10 attempts.

## What We Tried

- Initial design persisted host in DO — broken by review, removed (creator in D1 only; live host dynamic).
- Compacted seats on every `leave` action — broke `HandResult.rows[].seat` alignment, restricted to waiting phase only.
- Socket closed on screen transition — caused reconnect banners, kept socket alive instead (disconnect only on logout/back).
- `opponentSlots()` using seat-number modulo — failed with gaps, switched to array-position iteration.

## Root Cause Analysis

The two-player manual test (register → create room with bot → play a hand → result → hand 2 → leave) is a happy path. It doesn't exercise: mid-hand leaves (no seat gaps), socket errors (network is fine locally), WS reconnection failure (WiFi reconnects immediately), or viewport heights <360px (tested at 430px only). Code review caught multiple bugs the manual pass missed because reviews forced reading-through entire scenarios (H1 leave-during-hand-end, C2 seat gaps, C1 socket-never-connects trap) rather than just the happy path. The Vite D1 directory mismatch is a Cloudflare framework quirk, not a code bug — it's in the docs now, but cost investigation time.

## Lessons Learned

1. **Two-player tests are insufficient for a 2–5 player game.** Mid-hand departures expose gaps that ≥3 concurrent players require. Future manual verification needs 3+ real players or explicit "player leaves mid-trick" flows.
2. **Code review > manual testing for error paths.** Reading through "what if this fails?" scenarios found socket/seat/auth failures that a happy-path run can never hit.
3. **Local dev gotchas belong in onboarding docs.** The Vite D1 directory split should have been documented immediately after discovery, not after shipping.
4. **Array iteration is safer than arithmetic for circular structures.** Seat-number modulo assumes no gaps; array position (`view.seats[i]`) doesn't.

## Next Steps

User runs `wrangler login`, creates/applies remote D1 migration, then `pnpm deploy`. Run phase-8 smoke checklist on 3+ real phones (43 items). Resolve two unresolved questions: (1) does the DO send a distinguishing close code for auth/room-closed so the web client can display "Phòng đã đóng" instead of retrying blindly? (2) is H1 (leave-during-hand-end result-seat desync) acceptable as documented, or schedule a fix?

## Unresolved Questions

- Should registration stay open? (Plan decision: yes; revisit post-launch.)
- Does the DO send a final `{type:'error'}` frame or WS close code for expired session / closed room?
- Does seat re-packing fire *before* the DO's snapshot flipping status to 'playing' for the next hand?
- Is H1 (leave-during-hand-end compaction) acceptable pre-ship, or fix before deploy?
- Is the TOCTOU race on 3-open-room cap (M1) acceptable for this private app?
