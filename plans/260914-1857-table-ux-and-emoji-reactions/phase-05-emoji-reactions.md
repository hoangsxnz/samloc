---
phase: 5
title: "Emoji reactions"
status: completed
priority: P2
effort: "2h30m"
dependencies: []
---

# Phase 5: Emoji reactions

## Overview

Players send one of 8 fixed emoji to the whole room; it pops above the
sender's avatar for everyone for ~1.6s. Ephemeral only — no persistence, no
free-text chat (user decision, see `plan.md`).

## Requirements

- Functional: an emoji button on the table opens a one-row picker; tapping an
  icon broadcasts it; every client shows it floating above that player's seat
  (own seat included). Works in `waiting`, `playing` and `hand-end`.
- Non-functional: server accepts only the 8 allowlisted keys (never raw text
  from the client), 1 emoji per seat per 1.5s, nothing stored in DO SQLite or
  D1, no change to `RoomView` (so no snapshot churn).

## Architecture

A new fire-and-forget message pair alongside the existing game messages:

```
ClientMsg  { seq, type: 'emoji', key: EmojiKey }
ServerMsg  { type: 'emoji', seat: number, key: EmojiKey }   ← broadcast to all sockets
```

`key` is an id (`like`, `lol`, …), not a glyph: the server never relays
attacker-controlled text and the glyph set can change client-side alone.

Server path: `ws-parse.ts` validates the key against `EMOJI_KEYS` →
`room-do-actions.ts` resolves the sender's seat and rejects if unseated or
inside the per-seat cooldown → `room-do.ts` broadcasts. No snapshot, no
`store` write, no alarm interaction.

Client path: `ws-client.svelte.ts` gains `onEmoji` → `room.svelte.ts` keeps a
`reactions` array (`{ id, seat, key }`, entry removed after 1600ms, cap 3 per
seat like the existing event-tag queue) → `opponent-seat.svelte` and
`me-chip.svelte` render the bubble for their seat.

Cooldown state lives in an in-memory `Map<userId, number>` on the `RoomDO`
instance. Hibernation clears it; worst case a player gets one extra emoji after
a wake-up, which is harmless — do not spend a SQLite write on this.

## Emoji set (ids are protocol, glyphs are UI)

| key | glyph | key | glyph |
|---|---|---|---|
| `like` | 👍 | `fire` | 🔥 |
| `lol` | 😂 | `money` | 🤑 |
| `sad` | 😭 | `think` | 🤔 |
| `angry` | 😡 | `pray` | 🙏 |

## Related Code Files

- Create: `apps/worker/src/emoji.ts` — `EMOJI_KEYS` tuple, `EmojiKey` type, `isEmojiKey()`
- Modify: `apps/worker/src/ws-types.ts` — `ClientMsg` and `ServerMsg` members
- Modify: `apps/worker/src/ws-parse.ts` — parse + allowlist the `emoji` frame
- Modify: `apps/worker/src/room-do-actions.ts` — `case 'emoji'`: seat lookup, cooldown, broadcast
- Modify: `apps/worker/src/room-do.ts` — `broadcastEmoji(seat, key)` + cooldown map (`RoomHost` interface in `room-do-hand.ts` may need the method added)
- Create: `apps/web/src/components/emoji-bar.svelte` — trigger button + 8-icon row
- Create: `apps/web/src/components/emoji-bubble.svelte` — floating glyph above a seat
- Modify: `apps/web/src/lib/ws-client.svelte.ts` — `onEmoji` callback
- Modify: `apps/web/src/lib/room.svelte.ts` — `reactions` state, `sendEmoji()`, TTL cleanup
- Modify: `apps/web/src/components/opponent-seat.svelte`, `apps/web/src/components/me-chip.svelte` — render bubbles
- Modify: `apps/web/src/screens/table/table-screen.svelte` — mount `<EmojiBar>`
- Create: `apps/worker/tests/emoji.test.ts` — key allowlist + `parseClientMsg` shape tests
- Read for context: `apps/worker/src/room-do-hand.ts` (the `RoomHost` interface), `apps/web/src/components/event-tag.svelte` (existing transient-pill pattern)

## Implementation Steps

1. `emoji.ts`: `export const EMOJI_KEYS = ['like','lol','sad','angry','fire','money','think','pray'] as const;`
   `export type EmojiKey = (typeof EMOJI_KEYS)[number];`
   `export function isEmojiKey(v: unknown): v is EmojiKey`.
2. `ws-types.ts`: add `| { type: 'emoji'; key: EmojiKey }` to `ClientMsg` and
   `| { type: 'emoji'; seat: number; key: EmojiKey }` to `ServerMsg`. Re-export
   `EmojiKey` so the web package can import it from `@samloc/worker/ws-types`
   (that is how the web app already imports `RoomView`).
3. `ws-parse.ts`: `if (type === 'emoji' && isEmojiKey(data['key'])) return { seq, type, key: data['key'] };`
   placed with the other typed branches. The 4096-byte frame cap already applies.
4. `room-do-actions.ts`: add `case 'emoji'`. Require `mine` (`'Bạn chưa vào phòng'`),
   check the cooldown via a new `RoomHost` method, then `host.broadcastEmoji(mine.seat, msg.key)`.
   Do **not** call `snapshotAll` — the reaction is not part of room state.
5. `room-do.ts`: `#emojiAt = new Map<string, number>()`;
   `emojiAllowed(userId: string): boolean` (1500ms since last, records the new
   timestamp); `broadcastEmoji(seat, key)` loops `ctx.getWebSockets()` and sends
   the frame. Add both to the `RoomHost` interface in `room-do-hand.ts`.
   A rejected emoji is silently dropped (no error frame — it would be noisier
   than the emoji).
6. `ws-client.svelte.ts`: `onEmoji: (seat: number, key: EmojiKey) => void` and
   the `else if (msg.type === 'emoji')` branch.
7. `room.svelte.ts`: `reactions = $state<{ id: number; seat: number; key: EmojiKey }[]>([])`,
   `sendEmoji(key)`, and a TTL removal mirroring `table-logic`'s tag queue
   (1600ms, max 3 per seat). Clear `reactions` in `connect()`/`disconnect()`.
8. `emoji-bubble.svelte`: props `{ key: EmojiKey }`; renders the glyph with a
   `rise-and-fade` 1600ms animation (`translateY(0) → translateY(-24px)`,
   opacity 1 → 0); disabled under `prefers-reduced-motion` (static, still fades).
9. `emoji-bar.svelte`: a 40px round button at `left: 40px; top: 248px` in the
   design frame (free space above `me-chip`) that toggles a row of 8 buttons
   opening to the right. `z-index: 20` (same band as phase 3's overlays), 44px
   tap targets, closes on select and on outside click.
10. `opponent-seat.svelte` / `me-chip.svelte`: new `reactions` prop, rendered
    in an absolutely positioned stack **above** the avatar (`bottom: 100%`), so
    it does not fight the existing event-tag queue at `top: 100%`.
11. `table-screen.svelte`: pass `room.reactionsFor(seat)` into each seat and
    mount `<EmojiBar onpick={(k) => room.sendEmoji(k)} />`.
12. Tests (`apps/worker/tests/emoji.test.ts`): `isEmojiKey` accepts the 8 keys
    and rejects `'__proto__'`, `''`, a 5000-char string and a non-string;
    `parseClientMsg('{"seq":1,"type":"emoji","key":"lol"}')` parses and
    `key:"nope"` returns null.

## Success Criteria

- [ ] Tapping an emoji shows it above my avatar on my screen and on every other client within one tick
- [ ] Emojis work while waiting, while playing and at hand-end
- [ ] A second tap within 1.5s is dropped server-side (verify with two fast taps + a server-side log or by observing only one bubble on the other client)
- [ ] An `emoji` frame with an unknown key is rejected by `parseClientMsg` (test)
- [ ] No new rows in DO SQLite or D1; `RoomView` shape unchanged
- [ ] `pnpm --filter @samloc/worker test` and `pnpm typecheck` clean

## Risk Assessment

- **Scope note for the user:** the original request said "gửi icon, chat tổng".
  This phase ships icons only; free-text chat was explicitly deselected. If it
  comes back, it reuses this exact message path plus a message list — the
  design does not block it.
- The shared 10 msg/s token bucket already caps spam; the 1.5s per-seat
  cooldown exists so emoji cannot starve the bucket needed for plays.
- Emoji bubbles at `bottom: 100%` on top-row opponent seats (top 48) render
  into the top-bar band (y ≈ 24–48). Check overlap with `table-top-bar`; if it
  reads badly, render those bubbles to the side of the avatar instead of above.
