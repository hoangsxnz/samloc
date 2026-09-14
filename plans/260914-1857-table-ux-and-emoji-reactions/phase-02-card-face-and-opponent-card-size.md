---
phase: 2
title: "Card face and opponent card size"
status: completed
priority: P1
effort: "1h"
dependencies: []
---

# Phase 2: Card face and opponent card size

## Overview

Two card-rendering fixes: the ♥/♦ corner pip currently touches the large
centre pip on `lg` and `sm` card faces, and the opponent card-back token is
too small to read at a glance.

## Key insight (root cause of the heart collision)

`playing-card.svelte` positions three absolutely-placed glyphs inside the
card box. For `card-lg` (56×80):

| Element | Box (x, y) |
|---|---|
| `.card-rank` | left 5, top 3, 22px |
| `.card-suit-small` | left 6, top 25, 18px → occupies ≈ x 6–24, y 25–43 |
| `.card-suit-centre` | centred in 56×80 with `padding-top: 14px`, 32px → glyph ≈ x 12–44, y 31–49 |

The two suit boxes intersect at x 12–24, y 31–43. `♠`/`♣` have narrow
side-bearings so the gap still reads; `♥`/`♦` are wide and visually fuse.
`card-sm` (44×62) has the same overlap (corner y 19–31 vs centre y ≈ 26–46).
This is a layout bug, not a font bug — changing the glyph will not fix it.

## Requirements

- Functional: at every card size, the corner block (rank + small suit) and the
  centre pip have **non-intersecting bounding boxes** for all four suits.
- Non-functional: card stays 56×80 / 44×62 / 24×32; no new DOM nodes; readable
  at the 0.82 minimum table scale.

## Architecture

Keep the same three spans. Anchor the corner block to the top-left and move
the centre pip to the **bottom-right quadrant** using flex alignment plus
padding, instead of centring it and nudging with `padding-top`. Geometry then
separates on both axes and no suit can collide.

Proposed values (verify visually, adjust ±2px if needed):

```css
/* lg 56×80 — corner occupies x 4–24, y 3–43; pip occupies x ≈ 26–50, y ≈ 44–74 */
.card-lg .card-suit-centre {
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 0 6px 4px 0;
  font-size: 30px;
}
/* sm 44×62 — corner x 4–18, y 3–31; pip x ≈ 20–39, y ≈ 34–58 */
.card-sm .card-suit-centre {
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 0 5px 3px 0;
  font-size: 22px;
}
```

`card-xs` already hides the centre pip — leave it.

## Related Code Files

- Modify: `apps/web/src/components/playing-card.svelte` — `.card-lg/.card-sm .card-suit-centre` rules
- Modify: `apps/web/src/components/opponent-seat.svelte` — `.opp-cardback` size
- Read for context: `apps/web/src/lib/table-layout.ts` (SLOT_POSITIONS top = 48), `apps/web/src/components/centre-stack.svelte` (`.centre-stack` top = 150)

## Implementation Steps

1. Replace the `.card-lg .card-suit-centre` and `.card-sm .card-suit-centre`
   rules with the bottom-right anchored versions above. Remove the
   `padding-top` hack.
2. Run the dev server and eyeball one card of **each suit** at `lg` (hand fan)
   and `sm` (centre stack). Confirm ♥ and ♦ corner/centre pips have clear air
   between them. Adjust padding by ±2px only if they still touch.
3. `opponent-seat.svelte`: `.opp-cardback` 22×30 → **28×38**, `border-radius`
   4px → 5px, `font-size` 13px → 15px. Keep the `.one` danger styling.
4. Re-check the opponent seat column height budget in the 844×390 frame:
   `top 48 + avatar 40 + gap 2 + name 15 + gap 2 + cardback 38 = 145`, which
   must stay **above the centre stack at y 150**. If the measured column
   exceeds 145, cut `.opp-name` line-height instead of shrinking the card.
5. Check the 5-player layout (`left` / `right` slots at top 120): the taller
   column must not reach the fan track (`FAN_BASE_TOP` 312) — it ends ~217, fine.

## Success Criteria

- [ ] All four suits render with visibly separated corner and centre pips at `lg` and `sm`
- [ ] Opponent card-back reads clearly at 0.82 table scale
- [ ] Opponent seat column bottom edge ≤ y 148 in the design frame (no overlap with the centre stack)
- [ ] `pnpm typecheck` clean (svelte-check included)

## Risk Assessment

- **Reverses part of `260914-1722` phase 2** (opponent element compaction).
  That compaction existed to stop a top-bar collision; growing only the card
  back (below the avatar, not above it) does not re-create it, but step 4's
  height check is mandatory, not optional.
- Bottom-right pip is a visual change to every card in the game; if it reads
  badly, the fallback is a *centred* pip with the corner suit removed
  entirely (rank-only corner) — do not reintroduce overlapping geometry.
