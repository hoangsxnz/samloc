import type { Combo } from '../src/combos';
import { canBeat, highestSingle, lowestSingle } from '../src/compare';

const single = (rank: number): Combo => ({ type: 'single', rank, length: 1 });
const pair = (rank: number): Combo => ({ type: 'pair', rank, length: 2 });
const triple = (rank: number): Combo => ({ type: 'triple', rank, length: 3 });
const quad = (rank: number): Combo => ({ type: 'quad', rank, length: 4 });
const straight = (rank: number, length: number): Combo => ({ type: 'straight', rank, length });

describe('canBeat', () => {
  it('low straights rank below every normal straight of the same length', () => {
    expect(canBeat(straight(3, 3), straight(4, 3))).toBe(true); // A-2-3 < 2-3-4
    expect(canBeat(straight(4, 3), straight(5, 3))).toBe(true); // 2-3-4 < 3-4-5
    expect(canBeat(straight(4, 3), straight(3, 3))).toBe(false);
    expect(canBeat(straight(14, 3), straight(3, 3))).toBe(false); // Q-K-A holds off A-2-3
  });

  it('a low straight cannot beat a straight of a different length', () => {
    expect(canBeat(straight(6, 4), straight(4, 3))).toBe(false);
    expect(canBeat(straight(4, 3), straight(5, 4))).toBe(false);
  });


  it('null prev: any combo may lead', () => {
    expect(canBeat(null, single(3))).toBe(true);
    expect(canBeat(null, quad(3))).toBe(true);
    expect(canBeat(null, straight(5, 3))).toBe(true);
  });

  it('higher single beats lower single', () => {
    expect(canBeat(single(7), single(8))).toBe(true);
    expect(canBeat(single(8), single(7))).toBe(false);
  });

  it('equal rank single cannot beat', () => {
    expect(canBeat(single(9), single(9))).toBe(false);
  });

  it('single 2 beats single A', () => {
    expect(canBeat(single(14), single(15))).toBe(true);
  });

  it('pair 8 beats pair 7', () => {
    expect(canBeat(pair(7), pair(8))).toBe(true);
  });

  it('pair 7 cannot beat pair 7', () => {
    expect(canBeat(pair(7), pair(7))).toBe(false);
  });

  it('straight must match length: 4-card straight cannot beat 3-card straight', () => {
    expect(canBeat(straight(5, 3), straight(9, 4))).toBe(false);
  });

  it('straight 5-6-7 beats 3-4-5', () => {
    expect(canBeat(straight(5, 3), straight(7, 3))).toBe(true);
  });

  it('different types never beat (pair vs single)', () => {
    expect(canBeat(single(3), pair(14))).toBe(false);
    expect(canBeat(pair(3), single(15))).toBe(false);
    expect(canBeat(triple(3), straight(14, 3))).toBe(false);
  });

  it('quad beats a single 2 (chặt heo)', () => {
    expect(canBeat(single(15), quad(3))).toBe(true);
  });

  it('quad does NOT beat a single A', () => {
    expect(canBeat(single(14), quad(13))).toBe(false);
  });

  it('quad does NOT beat a pair, triple or straight', () => {
    expect(canBeat(pair(15), quad(13))).toBe(false);
    expect(canBeat(triple(3), quad(13))).toBe(false);
    expect(canBeat(straight(5, 3), quad(13))).toBe(false);
  });

  it('bigger quad beats smaller quad (chặt chồng)', () => {
    expect(canBeat(quad(5), quad(9))).toBe(true);
  });

  it('smaller quad cannot beat bigger quad', () => {
    expect(canBeat(quad(9), quad(5))).toBe(false);
    expect(canBeat(quad(9), quad(9))).toBe(false);
  });
});

describe('lowestSingle / highestSingle', () => {
  it('pick the extremes by rank then suit', () => {
    const hand = ['KH', '3C', '2S', '3S', '10D'];
    expect(lowestSingle(hand)).toBe('3S');
    expect(highestSingle(hand)).toBe('2S');
  });

  it('throw on an empty hand', () => {
    expect(() => lowestSingle([])).toThrow();
    expect(() => highestSingle([])).toThrow();
  });
});
