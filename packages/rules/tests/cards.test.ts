import { buildDeck, isTwo, sortHand, toCard, toId } from '../src/cards';

describe('cards', () => {
  it('toId/toCard round-trips all 52 cards', () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck).size).toBe(52);
    for (const id of deck) {
      const card = toCard(id);
      expect(toId(card)).toBe(id);
      expect(card.id).toBe(id);
    }
    expect(toCard('10H')).toEqual({ id: '10H', rank: 10, suit: 3 });
    expect(toCard('2S')).toEqual({ id: '2S', rank: 15, suit: 0 });
    expect(toCard('AC')).toEqual({ id: 'AC', rank: 14, suit: 1 });
  });

  it('sortHand orders 3S before 3C before 2H', () => {
    const input = ['2H', '3C', 'JD', '3S', '10S'];
    const sorted = sortHand(input);
    expect(sorted).toEqual(['3S', '3C', '10S', 'JD', '2H']);
    expect(input).toEqual(['2H', '3C', 'JD', '3S', '10S']);
  });

  it('isTwo is true only for rank 15', () => {
    expect(isTwo('2S')).toBe(true);
    expect(isTwo('2H')).toBe(true);
    expect(isTwo('AS')).toBe(false);
    expect(isTwo('3S')).toBe(false);
    expect(buildDeck().filter(isTwo)).toHaveLength(4);
  });
});
