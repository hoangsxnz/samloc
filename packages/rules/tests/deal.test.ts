import { compareCards } from '../src/cards';
import { createDeal, lowestCardSeat } from '../src/deal';

describe('createDeal', () => {
  it('createDeal(4, 42) is deterministic across calls', () => {
    expect(createDeal(4, 42)).toEqual(createDeal(4, 42));
    expect(createDeal(4, 42)).not.toEqual(createDeal(4, 43));
  });

  it('createDeal deals 10 cards per player with no duplicates across hands', () => {
    const { hands } = createDeal(5, 7);
    const all = hands.flat();
    expect(hands.every((h) => h.length === 10)).toBe(true);
    expect(new Set(all).size).toBe(50);
  });

  it('createDeal supports 2..5 players', () => {
    for (const n of [2, 3, 4, 5]) {
      expect(createDeal(n, 1).hands).toHaveLength(n);
    }
    expect(() => createDeal(1, 1)).toThrow();
    expect(() => createDeal(6, 1)).toThrow();
  });

  it('hands are sorted ascending', () => {
    const { hands } = createDeal(4, 99);
    for (const hand of hands) {
      const sorted = [...hand].sort(compareCards);
      expect(hand).toEqual(sorted);
    }
  });

  it('leadSeat holds the lowest card (3S when dealt)', () => {
    for (let seed = 0; seed < 50; seed++) {
      const { hands, leadSeat } = createDeal(4, seed);
      const holder = hands.findIndex((h) => h.includes('3S'));
      if (holder >= 0) expect(leadSeat).toBe(holder);
    }
  });

  it('leadSeat falls back to the next lowest card when 3S is undealt', () => {
    const hands = [
      ['4S', 'KH'],
      ['3C', 'AH'],
      ['5D', '2H'],
    ];
    expect(lowestCardSeat(hands)).toBe(1);
    // With 2 players only 20 of 52 cards are dealt; whenever 3S is missing the leader holds the global minimum.
    for (let seed = 0; seed < 100; seed++) {
      const { hands: dealt, leadSeat } = createDeal(2, seed);
      const min = dealt.flat().sort(compareCards)[0];
      expect(dealt[leadSeat]).toContain(min);
    }
  });
});
