import { parseCombo } from '../src/combos';

describe('parseCombo', () => {
  it('single: any one card parses', () => {
    expect(parseCombo(['7H'])).toEqual({ type: 'single', rank: 7, length: 1 });
    expect(parseCombo(['2S'])).toEqual({ type: 'single', rank: 15, length: 1 });
  });

  it('pair: 7H 7S parses; 7H 8S is null', () => {
    expect(parseCombo(['7H', '7S'])).toEqual({ type: 'pair', rank: 7, length: 2 });
    expect(parseCombo(['7H', '8S'])).toBeNull();
  });

  it('triple: three 9s parse as triple rank 9', () => {
    expect(parseCombo(['9H', '9S', '9D'])).toEqual({ type: 'triple', rank: 9, length: 3 });
  });

  it('quad: four Ks parse as quad rank 13', () => {
    expect(parseCombo(['KH', 'KS', 'KD', 'KC'])).toEqual({ type: 'quad', rank: 13, length: 4 });
  });

  it('straight: 3-4-5 parses length 3', () => {
    expect(parseCombo(['3S', '4S', '5S'])).toEqual({ type: 'straight', rank: 5, length: 3 });
  });

  it('straight: Q-K-A parses length 3 rank 14', () => {
    expect(parseCombo(['QS', 'KH', 'AD'])).toEqual({ type: 'straight', rank: 14, length: 3 });
  });

  it('straight: K-A-2 is null', () => {
    expect(parseCombo(['KS', 'AH', '2D'])).toBeNull();
  });

  it('straight: Q-K-A-2 is null', () => {
    expect(parseCombo(['QS', 'KS', 'AH', '2D'])).toBeNull();
  });

  it('straight: A-2 is null (too short)', () => {
    expect(parseCombo(['AS', '2H'])).toBeNull();
  });

  it('low straight: A-2-3 parses length 3 rank 3', () => {
    expect(parseCombo(['AS', '2H', '3D'])).toEqual({ type: 'straight', rank: 3, length: 3 });
  });

  it('low straight: 2-3-4 parses length 3 rank 4', () => {
    expect(parseCombo(['2S', '3H', '4D'])).toEqual({ type: 'straight', rank: 4, length: 3 });
  });

  it('low straight: A-2-3-4-5 parses length 5 rank 5', () => {
    expect(parseCombo(['AS', '2H', '3D', '4C', '5S'])).toEqual({ type: 'straight', rank: 5, length: 5 });
  });

  it('low straight: A-2-3-3 is null (duplicate rank)', () => {
    expect(parseCombo(['AS', '2H', '3D', '3C'])).toBeNull();
  });

  it('straight: mixed suits parse (suits irrelevant)', () => {
    expect(parseCombo(['5S', '6H', '7D', '8C'])).toEqual({ type: 'straight', rank: 8, length: 4 });
  });

  it('straight: 3-4-6 is null (gap)', () => {
    expect(parseCombo(['3S', '4S', '6S'])).toBeNull();
  });

  it('straight: 3-3-4-5 is null (duplicate rank)', () => {
    expect(parseCombo(['3S', '3H', '4S', '5S'])).toBeNull();
  });

  it('đôi thông 3-3-4-4-5-5 is null (no consecutive pairs in this game)', () => {
    expect(parseCombo(['3S', '3H', '4S', '4H', '5S', '5H'])).toBeNull();
  });

  it('two cards of different rank are null', () => {
    expect(parseCombo(['3S', '4S'])).toBeNull();
    expect(parseCombo(['KS', 'AS'])).toBeNull();
  });
});
