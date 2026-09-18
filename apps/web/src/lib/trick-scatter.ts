/** Box the played combos land in, in design-frame px, centred on `CENTRE_POINT`. */
export const SCATTER_BOX = { width: 120, height: 60 };
export const SCATTER_MAX_ROT = 12;

export interface Scatter {
  dx: number;
  dy: number;
  rot: number;
}

/** 32-bit FNV-1a; small and stable across engines, which is all a layout seed needs. */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function unit(hash: number, shift: number): number {
  return ((hash >>> shift) & 0x3ff) / 0x3ff;
}

/** Hashes `${seat}:${cards}` so every client and every snapshot places a combo identically. */
export function scatterFor(seat: number, cards: readonly string[]): Scatter {
  const hash = fnv1a(`${seat}:${cards.join(',')}`);
  return {
    dx: (unit(hash, 0) - 0.5) * SCATTER_BOX.width,
    dy: (unit(hash, 10) - 0.5) * SCATTER_BOX.height,
    rot: (unit(hash, 20) - 0.5) * 2 * SCATTER_MAX_ROT,
  };
}
