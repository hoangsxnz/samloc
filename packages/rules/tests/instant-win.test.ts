import { hasInstantWin } from '../src/instant-win';

describe('hasInstantWin', () => {
  it('sảnh rồng 3..Q detected', () => {
    const hand = ['3S', '4H', '5D', '6C', '7S', '8H', '9D', '10C', 'JS', 'QH'];
    expect(hasInstantWin(hand)).toBe('sanh-rong');
  });

  it('sảnh rồng 5..A detected', () => {
    const hand = ['5S', '6H', '7D', '8C', '9S', '10H', 'JD', 'QC', 'KS', 'AH'];
    expect(hasInstantWin(hand)).toBe('sanh-rong');
  });

  it('tứ quý 2 detected', () => {
    const hand = ['2S', '2C', '2D', '2H', '3S', '5H', '7D', '9C', 'JS', 'KH'];
    expect(hasInstantWin(hand)).toBe('tu-quy-2');
  });

  it('10 same colour detected (all red, all black)', () => {
    const allRed = ['3H', '4D', '6H', '7D', '9H', '10D', 'JH', 'KD', 'AH', '2D'];
    const allBlack = ['3S', '4C', '6S', '7C', '9S', '10C', 'JS', 'KC', 'AS', '2C'];
    expect(hasInstantWin(allRed)).toBe('dong-mau');
    expect(hasInstantWin(allBlack)).toBe('dong-mau');
  });

  it('3 triples detected', () => {
    const hand = ['3S', '3C', '3D', '7S', '7C', '7H', 'JS', 'JD', 'JH', 'KS'];
    expect(hasInstantWin(hand)).toBe('ba-sam-co');
  });

  it('5 pairs detected', () => {
    const hand = ['3S', '3H', '6C', '6D', '9S', '9H', 'QC', 'QD', 'AS', 'AH'];
    expect(hasInstantWin(hand)).toBe('nam-doi');
  });

  it('priority: hand with both tứ quý 2 and 5 pairs returns tu-quy-2', () => {
    const hand = ['2S', '2C', '2D', '2H', '5S', '5H', '9C', '9D', 'KS', 'KH'];
    expect(hasInstantWin(hand)).toBe('tu-quy-2');
  });

  it('ordinary hand returns null', () => {
    const hand = ['3S', '4H', '6D', '7C', '9S', '10H', 'JD', 'KC', 'AS', '2H'];
    expect(hasInstantWin(hand)).toBeNull();
  });
});
