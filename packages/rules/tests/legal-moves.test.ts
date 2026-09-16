import type { Combo } from '../src/combos';
import { legalMoves, lowestLegalMove } from '../src/legal-moves';

const single = (rank: number): Combo => ({ type: 'single', rank, length: 1 });
const pair = (rank: number): Combo => ({ type: 'pair', rank, length: 2 });
const straight = (rank: number, length: number): Combo => ({ type: 'straight', rank, length });

/** Sorted string form so a move set can be compared regardless of enumeration order. */
const keys = (moves: string[][]): string[] => moves.map((m) => m.join('-')).sort();

describe('legalMoves', () => {
  it('leading offers singles, groups and runs', () => {
    const moves = legalMoves(['3S', '3H', '4S', '5S'], null);
    expect(keys(moves)).toEqual(['3H', '3H-4S-5S', '3S', '3S-3H', '3S-4S-5S', '4S', '5S']);
  });

  it('responding to a pair keeps only higher pairs', () => {
    const moves = legalMoves(['3S', '3H', '9S', '9H', 'KS'], pair(3));
    expect(keys(moves)).toEqual(['9S-9H']);
  });

  it('responding to a single 2 includes a quad', () => {
    const moves = legalMoves(['4S', '4C', '4D', '4H', '5S'], single(15));
    expect(keys(moves)).toEqual(['4S-4C-4D-4H']);
  });

  it('a low straight is offered when the hand holds A-2-3', () => {
    const moves = legalMoves(['AS', '2H', '3D'], null);
    expect(keys(moves)).toContain('AS-2H-3D');
  });

  it('2-3-4 beats A-2-3, and 3-4-5 beats 2-3-4', () => {
    expect(keys(legalMoves(['2S', '3H', '4D'], straight(3, 3)))).toEqual(['2S-3H-4D']);
    expect(keys(legalMoves(['3S', '4H', '5D'], straight(4, 3)))).toEqual(['3S-4H-5D']);
  });

  it('a low straight beats nothing of its own length', () => {
    expect(legalMoves(['AS', '2H', '3D'], straight(3, 3))).toEqual([]);
  });

  it('every suit of a duplicated rank can seed a run', () => {
    const moves = legalMoves(['3S', '3H', '4S', '5S'], null);
    const runCards = new Set(moves.filter((m) => m.length === 3).flat());
    expect(runCards.has('3S')).toBe(true);
    expect(runCards.has('3H')).toBe(true);
  });
});

describe('lowestLegalMove', () => {
  it('leads with the lowest single', () => {
    expect(lowestLegalMove(['9S', '3H', 'KS'], null)).toEqual(['3H']);
  });

  it('responds with the cheapest beating combo', () => {
    expect(lowestLegalMove(['4S', 'KH', '9S'], single(3))).toEqual(['4S']);
  });

  it('returns null when nothing beats the trick', () => {
    expect(lowestLegalMove(['4S', '4H'], single(13))).toBeNull();
  });

  it('returns null for an empty hand', () => {
    expect(lowestLegalMove([], null)).toBeNull();
  });
});
