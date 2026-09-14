---
phase: 3
title: "Bottom layout and timer in avatar"
status: completed
priority: P1
effort: "1h30m"
dependencies: [2]
---

# Phase 3: Bottom layout and timer in avatar

## Overview

With a full hand the fan overlaps both the countdown ring on the left and the
"Bỏ lượt" button on the right. Fix by merging my countdown into my avatar
(same treatment opponents already have) and re-fitting the fan track between
the two.

## Key insight (measured in the 844×390 design frame)

| Element | Span x | Span y |
|---|---|---|
| `me-chip` (`left: 40`, `top: 306`) | 40 → ~246 (avatar 40 + gap 10 + label ~90 + gap 10 + **TimerRing 56**) | 306–362 |
| Hand fan, 10 cards (`FAN_TRACK_LEFT 262`, width 308) | 262 → 570, **~248 → ~584 after the ±10° rotation** | 312–392 (292 when a card is selected) |
| `action-bar` (`right: 40`, `bottom: 20`) | 578 → 804 | 322–370 |

So the leftmost rotated card lands on the timer ring and the rightmost lands
on "Bỏ lượt". Two independent causes: the 56px ring makes `me-chip` too wide,
and the 308px fan track is too wide for the 332px of free space between them.

## Requirements

- Functional: my remaining seconds are shown as digits inside my avatar with
  the arc wrapping it, exactly like `opponent-seat.svelte`. No card overlaps
  `me-chip` or `action-bar` at 10 cards, selected or not.
- Non-functional: ≥16px clearance on each side at 10 cards including rotation;
  overlays stay clickable regardless of paint order; `role="timer"` and the
  existing aria-live behaviour preserved.

## Architecture

1. `me-chip` mirrors the opponent pattern: a `.me-avatar-wrap` with the digit
   inside `.me-avatar` (replacing the name initial while it is my turn) and
   `<TimerRing size={48} stroke={3} digits={false} />` absolutely positioned at
   `inset: -4px`. The standalone 56px ring is deleted, freeing ~66px.
2. Fan track shifts left and keeps its 28px step:
   `FAN_TRACK_LEFT 262 → 236` (width stays 308) → cards span 236–544, ≈222–558
   with rotation. Clearance: me-chip now ends at ~180 (42px gap), action-bar
   starts at 578 (20px gap).
3. `me-chip`, `action-bar` and `sam-pill` get `z-index: 20` so a card can never
   paint over them even if the geometry is nudged later.

## Related Code Files

- Modify: `apps/web/src/components/me-chip.svelte` — avatar wrap, digit, arc ring, z-index
- Modify: `apps/web/src/lib/table-layout.ts` — `FAN_TRACK_LEFT`
- Modify: `apps/web/src/components/action-bar.svelte` — z-index on `.action-bar` and `.sam-pill`
- Read for context: `apps/web/src/components/opponent-seat.svelte:28-35,63-92` (the pattern to mirror), `apps/web/src/components/hand-fan.svelte`, `apps/web/src/components/timer-ring.svelte`

## Implementation Steps

1. `me-chip.svelte` markup:
   ```svelte
   <div class="me-avatar-wrap">
     <div class="me-avatar" class:active={isMyTurn} class:danger={isMyTurn && remain < 5}>
       {isMyTurn ? Math.ceil(remain) : initial(name)}
     </div>
     {#if isMyTurn}
       <div class="me-ring"><TimerRing {remain} {turnSeconds} size={48} stroke={3} digits={false} /></div>
     {/if}
   </div>
   ```
   Delete the standalone `{#if isMyTurn}<TimerRing …/>{/if}` block.
2. `me-chip.svelte` styles: add `.me-avatar-wrap { position: relative; width: 40px; height: 40px; }`,
   `.me-ring { position: absolute; inset: -4px; pointer-events: none; }`,
   `.me-avatar.danger { color: var(--danger); animation: … }` reusing the same
   500ms pulse keyframes as `opponent-seat.svelte` (duplicate the keyframe
   block locally — Svelte scopes styles per component; do not extract a shared
   file for two rules). Add `font-variant-numeric: tabular-nums` to `.me-avatar`
   so the digit does not jitter. Add `z-index: 20` to `.me-chip`.
3. `table-layout.ts`: `FAN_TRACK_LEFT = 236`. Leave `FAN_TRACK_WIDTH`,
   `FAN_STEP`, `FAN_BASE_TOP` unchanged. Update the doc comment above
   `fanLayout()` to state the new track origin.
4. `action-bar.svelte`: `z-index: 20` on `.action-bar` and `.sam-pill`.
5. Verify at 10, 7, 3 and 1 cards, selected and not, at scale 1.0 and 0.82:
   measure the leftmost/rightmost card edges against `me-chip` and the
   "Bỏ lượt" button. Both gaps must stay ≥16px.

## Success Criteria

- [ ] My countdown appears as digits inside my 40px avatar with the arc around it; the separate ring is gone
- [ ] At 10 cards nothing overlaps `me-chip` or "Bỏ lượt" / "Đánh" at scale 1.0 and 0.82
- [ ] "Bỏ lượt" and "Đánh" remain tappable with a full hand (tap test in dev, not just visual)
- [ ] Timer still turns red and pulses under 5s; `role="timer"` still present
- [ ] `pnpm typecheck` clean

## Risk Assessment

- Moving the fan left by 26px narrows the gap to `me-chip` if the name label is
  long. `me-chip`'s label is a fixed Vietnamese string ("Lượt của bạn" / "Chờ
  lượt"), but `invalidReason` renders as a `<small>` **below** the label so it
  does not widen the row — confirm that during step 5.
- The digit replacing the initial removes the only place my own name appears on
  the table while it is my turn. Acceptable: the name is redundant for the
  local player, and this matches opponent seats.
