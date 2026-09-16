/** Design reference frame; the table is scaled, never reflowed. */
export const TABLE_WIDTH = 844;
export const TABLE_HEIGHT = 390;

export type SeatSlot = 'top-left' | 'top-right' | 'left' | 'right' | 'top-centre';

/** Opponent slot order by player count; the local player is always bottom-left. */
const SLOTS_BY_COUNT: Record<number, SeatSlot[]> = {
  2: ['top-centre'],
  3: ['top-left', 'top-right'],
  4: ['top-left', 'top-right', 'right'],
  5: ['left', 'top-left', 'top-right', 'right'],
};

export interface OpponentSlot {
  seat: number;
  slot: SeatSlot;
}

/** Seat numbers in play order starting after `youSeat`; tolerates gaps left by a departed seat. */
export function seatsAfter(youSeat: number, seatNumbers: readonly number[]): number[] {
  const sorted = [...seatNumbers].filter((s) => s !== youSeat).sort((a, b) => a - b);
  const later = sorted.filter((s) => s > youSeat);
  const earlier = sorted.filter((s) => s < youSeat);
  return [...later, ...earlier];
}

/** Opponents in clockwise order from the local seat, mapped onto their table slots. */
export function opponentSlots(youSeat: number, seatNumbers: readonly number[]): OpponentSlot[] {
  const others = seatsAfter(youSeat, seatNumbers);
  const count = Math.min(5, Math.max(2, others.length + 1));
  const slots = SLOTS_BY_COUNT[count] ?? [];
  return others.flatMap((seat, i) => {
    const slot = slots[i];
    return slot ? [{ seat, slot }] : [];
  });
}

export const SEAT_WIDTH = 80;

/** Absolute positions (px) inside the 844×390 frame; top seats sit outside the centre stack (x 302–542). */
export const SLOT_POSITIONS: Record<SeatSlot, { left?: number; right?: number; top: number }> = {
  'top-left': { left: 200, top: 48 },
  'top-right': { right: 200, top: 48 },
  'top-centre': { left: TABLE_WIDTH / 2 - SEAT_WIDTH / 2, top: 48 },
  left: { left: 44, top: 120 },
  right: { right: 44, top: 120 },
};

/** Whole-table scale for viewports shorter than the reference; clamped to 0.82..1. */
export function tableScale(viewportHeight: number, viewportWidth = TABLE_WIDTH): number {
  const byHeight = viewportHeight / TABLE_HEIGHT;
  const byWidth = viewportWidth / TABLE_WIDTH;
  return Math.min(1, Math.max(0.82, Math.min(byHeight, byWidth)));
}

export const CARD_WIDTH = 56;
export const FAN_STEP = 28;
export const FAN_TRACK_LEFT = 236;
export const FAN_TRACK_WIDTH = 308;
export const FAN_BASE_TOP = 312;

/**
 * Left offsets of a flat hand row: step 28 px, no arc and no rotation. With fewer than 10 cards the
 * step is kept and the group is re-centred on the 308 px track, whose origin (x 236) leaves
 * clearance for the me-chip on the left and the action bar on the right.
 */
export function fanLayout(count: number): number[] {
  if (count <= 0) return [];
  const groupWidth = CARD_WIDTH + FAN_STEP * (count - 1);
  const startX = FAN_TRACK_LEFT + (FAN_TRACK_WIDTH - groupWidth) / 2;
  return Array.from({ length: count }, (_, i) => startX + FAN_STEP * i);
}

export interface Point {
  x: number;
  y: number;
}

/** Centre of the played-cards stack: `.centre-stack` sits at top 150 and is 100 px tall. */
export const CENTRE_POINT: Point = { x: TABLE_WIDTH / 2, y: 200 };

/** Middle of the local hand fan; the origin of my own play animation. */
export const FAN_ORIGIN: Point = { x: FAN_TRACK_LEFT + FAN_TRACK_WIDTH / 2, y: FAN_BASE_TOP + 40 };

/** Avatar centre of an opponent slot; the origin of that opponent's play animation. */
export function slotOrigin(slot: SeatSlot): Point {
  const pos = SLOT_POSITIONS[slot];
  const x = pos.left !== undefined ? pos.left + SEAT_WIDTH / 2 : TABLE_WIDTH - (pos.right ?? 0) - SEAT_WIDTH / 2;
  return { x, y: pos.top + 20 };
}
