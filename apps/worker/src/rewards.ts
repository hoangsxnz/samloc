export const CHECKIN_AMOUNT = 1_000;
export const WHEEL_SPINS_PER_DAY = 5;

export interface WheelSegment {
  amount: number;
  weight: number;
  label: string;
}

/** Weights sum to 100; expected value ≈ 950 đ per spin. */
export const WHEEL_SEGMENTS: readonly WheelSegment[] = [
  { amount: 200, weight: 30, label: '200' },
  { amount: 400, weight: 22, label: '400' },
  { amount: 600, weight: 16, label: '600' },
  { amount: 1_000, weight: 13, label: '1.000' },
  { amount: 2_000, weight: 9, label: '2.000' },
  { amount: 4_000, weight: 5, label: '4.000' },
  { amount: 10_000, weight: 2, label: '10.000' },
  { amount: 0, weight: 3, label: 'Chúc may mắn' },
];

const DAY_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Calendar day in Vietnam (UTC+7): the reward resets at midnight local time, not UTC. */
export function dayKey(nowMs: number): string {
  return new Date(nowMs + DAY_OFFSET_MS).toISOString().slice(0, 10);
}

/** `random` in [0, 1): walks the cumulative weights; the last segment absorbs rounding. */
export function pickSegment(random: number): number {
  const total = WHEEL_SEGMENTS.reduce((sum, s) => sum + s.weight, 0);
  let cursor = random * total;
  for (let i = 0; i < WHEEL_SEGMENTS.length; i++) {
    cursor -= WHEEL_SEGMENTS[i]?.weight ?? 0;
    if (cursor < 0) return i;
  }
  return WHEEL_SEGMENTS.length - 1;
}

export function randomUnit(): number {
  return (crypto.getRandomValues(new Uint32Array(1))[0] ?? 0) / 2 ** 32;
}
