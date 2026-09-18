import { WHEEL_SEGMENTS, dayKey, pickSegment } from '../src/rewards';

describe('dayKey', () => {
  it('rolls over at midnight in UTC+7', () => {
    expect(dayKey(Date.UTC(2026, 8, 18, 16, 59, 59))).toBe('2026-09-18');
    expect(dayKey(Date.UTC(2026, 8, 18, 17, 0, 0))).toBe('2026-09-19');
  });
});

describe('WHEEL_SEGMENTS', () => {
  it('has eight wedges, weights summing to 100 and exactly one empty wedge', () => {
    expect(WHEEL_SEGMENTS).toHaveLength(8);
    expect(WHEEL_SEGMENTS.reduce((sum, s) => sum + s.weight, 0)).toBe(100);
    expect(WHEEL_SEGMENTS.filter((s) => s.amount === 0)).toHaveLength(1);
  });
});

describe('pickSegment', () => {
  it('maps the ends and a boundary of the unit interval', () => {
    expect(pickSegment(0)).toBe(0);
    expect(pickSegment(0.9999)).toBe(7);
    expect(pickSegment(0.3)).toBe(1);
    expect(pickSegment(0.2999)).toBe(0);
  });

  it('draws each wedge in proportion to its weight', () => {
    let seed = 42;
    const lcg = (): number => {
      seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
      return seed / 2 ** 32;
    };
    const draws = 20_000;
    const counts = new Array<number>(WHEEL_SEGMENTS.length).fill(0);
    for (let i = 0; i < draws; i++) {
      const index = pickSegment(lcg());
      counts[index] = (counts[index] ?? 0) + 1;
    }
    WHEEL_SEGMENTS.forEach((segment, i) => {
      const share = ((counts[i] ?? 0) / draws) * 100;
      expect(Math.abs(share - segment.weight)).toBeLessThanOrEqual(2);
    });
  });
});
