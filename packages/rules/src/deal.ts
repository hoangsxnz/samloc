import { buildDeck, compareCards, sortHand, type CardId } from './cards';

export interface Deal {
  hands: CardId[][];
  /** Seat holding the globally lowest (rank, suit) card. */
  leadSeat: number;
}

const HAND_SIZE = 10;

/** Small deterministic PRNG; returns a function yielding floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates on a copy of `deck`. */
export function shuffle(deck: readonly CardId[], rng: () => number): CardId[] {
  const out = [...deck];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = out[i];
    const b = out[j];
    if (a !== undefined && b !== undefined) {
      out[i] = b;
      out[j] = a;
    }
  }
  return out;
}

/** Seat whose hand holds the lowest card overall. */
export function lowestCardSeat(hands: readonly (readonly CardId[])[]): number {
  let bestSeat = 0;
  let bestCard: CardId | null = null;
  hands.forEach((hand, seat) => {
    for (const id of hand) {
      if (bestCard === null || compareCards(id, bestCard) < 0) {
        bestCard = id;
        bestSeat = seat;
      }
    }
  });
  return bestSeat;
}

/**
 * Deals 10 cards to each of `playerCount` seats (2..5), deterministic for a given seed.
 * The seed is deterministic on purpose so tests can replay hands; the server must derive it
 * from `crypto.getRandomValues`, never from a client-supplied value.
 */
export function createDeal(playerCount: number, seed: number): Deal {
  if (playerCount < 2 || playerCount > 5) throw new Error('Số người chơi phải từ 2 đến 5');
  const deck = shuffle(buildDeck(), mulberry32(seed));
  const hands: CardId[][] = [];
  for (let seat = 0; seat < playerCount; seat++) {
    hands.push(sortHand(deck.slice(seat * HAND_SIZE, (seat + 1) * HAND_SIZE)));
  }
  return { hands, leadSeat: lowestCardSeat(hands) };
}
