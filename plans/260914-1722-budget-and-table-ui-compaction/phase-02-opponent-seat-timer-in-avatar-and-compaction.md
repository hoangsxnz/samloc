---
phase: 2
title: Opponent seat timer-in-avatar and compaction
status: completed
priority: P2
effort: 1h30
dependencies: []
---

# Phase 2: Opponent seat timer-in-avatar and compaction

## Overview

Draw the active opponent's countdown as an arc around their avatar with the seconds replacing the initial letter, delete the floating 56 px ring above the seat, and shrink every opponent-seat element so no seat overlaps the top bar, centre stack, me-chip, or action bar in the 844×390 frame.

## Requirements

- Functional: when `active`, the opponent avatar shows `Math.ceil(remain)` instead of the initial, surrounded by a gold arc that drains like today's ring; under 5 s the arc and digits turn `--danger` and the digits pulse.
- Functional: when not active, the avatar shows the initial exactly as today.
- Functional: me-chip is unchanged and still renders the default 56 px `TimerRing` with digits.
- Non-functional: no element of any opponent seat (including the transient event-tag queue) overlaps the top bar (y 0–44), centre stack (x 302–542, y 150–250), me-chip (x 40–200, y 306+), fan track (x 262–570, y 312+), Báo Sâm pill (right 40, y 266–306) or action bar. Verified at 5 players.

## Architecture

### Overlap analysis of the current layout (why things collide)

| Element | Current box | Collides with |
|---|---|---|
| Floating ring `.opp-timer` (`top:-60px`) on a top seat at y 42 | y −18 … 38 | Top bar (0–44) |
| Top-left seat `left:290`, width 92, height ≈ 130 | x 290–382, y 42–172 (+ tag queue to ≈ 210) | Centre stack (x ≥ 302, y ≥ 150) |
| Side seats `top:130`, height ≈ 130 + tag queue | y 130–260 (+ tags to ≈ 300) | Me-chip (y 306) / Báo Sâm pill (y 266) on a busy hand |

### Target opponent seat (80 px wide, ≈ 93 px tall, 109 px with a status pill)

```
   ┌──────────┐   ← 48 px TimerRing (only when active), absolutely over the avatar, no digits
   │  ( 12 )  │   ← 40 px avatar; shows seconds when active, initial otherwise
   └──────────┘
     Tên ngư…      ← name 12 px / 600, max-width 80, ellipsis
   [ 7 ]  +3       ← card-back 22×30 (13 px digits)  +  session lá total 10 px, one row
     Bỏ / Báo 1 / ⟳ ← status pill 10 px (unchanged semantics)
   ┌ event tags ┐   ← absolute, top:100% (unchanged)
```

### `TimerRing` becomes size-parametric

Props added, all optional so `me-chip.svelte` compiles unchanged:

```ts
interface Props {
  remain: number;
  turnSeconds: number;
  size?: number;    // default 56
  stroke?: number;  // default 4
  digits?: boolean; // default true — false renders the arc only
}
const radius = $derived((size - stroke) / 2);
const circumference = $derived(2 * Math.PI * radius);
```

`viewBox` = `0 0 {size} {size}`, `cx`/`cy` = `size / 2`, `transform="rotate(-90 {size/2} {size/2})"`, wrapper `width/height = size`. The `<b>` digit element renders only `{#if digits}`. Keep `role="timer"` and the aria-label.

### Slot positions (`table-layout.ts`)

```ts
export const SEAT_WIDTH = 80;
export const SLOT_POSITIONS = {
  'top-left':   { left: 200, top: 48 },
  'top-right':  { right: 200, top: 48 },
  'top-centre': { left: TABLE_WIDTH / 2 - SEAT_WIDTH / 2, top: 48 },
  left:         { left: 44, top: 120 },
  right:        { right: 44, top: 120 },
};
```

Resulting boxes: top seats x 200–280 / 564–644, y 48–157 → clear of centre stack (x 302) and of the top bar text (room code + `· Ván N` ends ≈ x 190). Top-centre x 382–462, y 48–141; its tag queue (≈ 141–175) can touch the centre stack top edge for 1.6 s only — accepted. Side seats y 120–229, tag queue to ≈ 265 → clear of me-chip (306) and Báo Sâm pill (266).

## Related Code Files

- Modify: `apps/web/src/components/timer-ring.svelte`
- Modify: `apps/web/src/components/opponent-seat.svelte`
- Modify: `apps/web/src/lib/table-layout.ts`
- Read only: `apps/web/src/components/me-chip.svelte` (must keep compiling with default props), `apps/web/src/screens/table/table-screen.svelte` (props already passed: `active`, `remain`, `turnSeconds`), `apps/web/src/app.css` (global `box-sizing: border-box` at line 85 → sizes below are outer sizes)

## Implementation Steps

1. `timer-ring.svelte` — add `size`, `stroke`, `digits` props with defaults; convert `RADIUS`/`CIRCUMFERENCE` constants to `$derived`; parametrise `viewBox`, `cx`, `cy`, `r`, `rotate`, wrapper width/height (use `style="width:{size}px;height:{size}px"`); wrap `<b>` in `{#if digits}`. Leave the `danger` colour and pulse logic as is.
2. `opponent-seat.svelte` markup:
   ```svelte
   <div class="opp-avatar-wrap">
     <div class="opp-avatar" class:active class:danger={active && remain < 5}>
       {active ? Math.ceil(remain) : initial(seat.name)}
     </div>
     {#if active}
       <div class="opp-ring"><TimerRing {remain} {turnSeconds} size={48} stroke={3} digits={false} /></div>
     {/if}
   </div>
   <span class="opp-name">{displayName}</span>
   <div class="opp-count-row">
     <div class="opp-cardback" class:one={seat.cardCount === 1}>{seat.cardCount}</div>
     <span class="opp-total">{seat.totalLa >= 0 ? '+' : ''}{seat.totalLa}</span>
   </div>
   {/* status pill and tag queue unchanged */}
   ```
   Delete the old `{#if active}<div class="opp-timer">…` block.
3. `opponent-seat.svelte` styles:
   - `.opp-seat { width: 80px; gap: 2px; }`
   - `.opp-avatar-wrap { position: relative; width: 40px; height: 40px; }`
   - `.opp-avatar { width: 40px; height: 40px; font-size: 15px; font-variant-numeric: tabular-nums; }`
   - `.opp-avatar.active { border-color: var(--gold); }` — remove the `border-width: 3px` and the 6 px glow (the arc replaces them)
   - `.opp-avatar.danger { color: var(--danger); animation: opp-digit-pulse 500ms ease-in-out infinite; }` + local `@keyframes opp-digit-pulse` (scale 1 → 1.15, same as timer-ring)
   - `.opp-ring { position: absolute; inset: -4px; pointer-events: none; }`
   - `.opp-name { font-size: 12px; line-height: 15px; max-width: 80px; }`
   - `.opp-count-row { display: flex; align-items: center; gap: 4px; }`
   - `.opp-cardback { width: 22px; height: 30px; font-size: 13px; }`
   - `.opp-total { font-size: 10px; }`
   - `.opp-tag { font-size: 10px; padding: 1px 6px; line-height: 13px; }`
   - delete `.opp-timer`
4. `table-layout.ts` — add `SEAT_WIDTH`, update `SLOT_POSITIONS` per the table above. No other export changes (`fanLayout`, `tableScale` untouched).
5. `pnpm --filter @samloc/web typecheck` (svelte-check) green.
6. Visual pass in the browser on the local stack (`pnpm dev` + `pnpm --filter @samloc/worker dev`, see `docs/runbook.md`): open a 5-player room with several tabs, start a hand, and screenshot with the active turn on (a) a top seat, (b) a side seat, (c) under 5 s. Check the boxes in Success Criteria against the screenshots.

## Success Criteria

- [ ] Active opponent: arc around avatar drains over `turnSeconds`; digits inside avatar count down; both go red and digits pulse under 5 s
- [ ] Inactive opponent: initial letter, grey border, no ring
- [ ] Me-chip visually identical to before (56 px ring with digits)
- [ ] At 5 players nothing in any opponent seat overlaps top bar, centre stack, me-chip, fan, Báo Sâm pill, or action bar; 2, 3 and 4 players also checked
- [ ] Name still truncates at 8 chars + ellipsis; `Bỏ`, `Báo 1`, `⟳` pills still appear
- [ ] `pnpm --filter @samloc/web typecheck` green

## Risk Assessment

- **Digits replace the initial** — a player may lose the visual identity cue during their opponent's turn; the name is directly below and the gold arc marks the seat, so identity stays readable. Alternative if the user dislikes it: keep the initial and put the digits in a 16 px badge at the avatar's bottom-right (one-line change in the markup).
- **Event-tag queue under top-centre seat** grazes the centre stack top for 1.6 s in 2-player games. Cosmetic; if it bothers, lower `centre-stack.svelte` `top` from 150 to 160 (out of scope here).
- **Scaled viewports** (`tableScale` 0.82) shrink 10 px text to ≈ 8 px on 360 px-tall phones. Still legible for numbers; if not, raise `.opp-total`/`.opp-tag` to 11 px and accept the extra 2 px of height.
