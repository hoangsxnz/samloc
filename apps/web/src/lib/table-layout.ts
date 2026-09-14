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
export const FAN_TRACK_LEFT = 262;
export const FAN_TRACK_WIDTH = 308;
export const FAN_BASE_TOP = 312;

export interface FanCard {
  left: number;
  top: number;
  rotate: number;
}

/**
 * Card positions along the bottom arc: step 28 px, rotation −10°→+10°, outer cards 12 px lower.
 * With fewer than 10 cards the step is kept and the group is re-centred on the 308 px track.
 */
export function fanLayout(count: number): FanCard[] {
  if (count <= 0) return [];
  const groupWidth = CARD_WIDTH + FAN_STEP * (count - 1);
  const startX = FAN_TRACK_LEFT + (FAN_TRACK_WIDTH - groupWidth) / 2;
  const mid = (count - 1) / 2;
  const cards: FanCard[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : (i - mid) / mid;
    cards.push({
      left: startX + FAN_STEP * i,
      top: FAN_BASE_TOP + 12 * t * t,
      rotate: 10 * t,
    });
  }
  return cards;
}
