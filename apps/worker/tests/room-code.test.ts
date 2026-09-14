import { describe, expect, it } from 'vitest';
import { generateRoomCode, isRoomCode } from '../src/room-code';

describe('generateRoomCode', () => {
  it('generates a 6-digit code', () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(6);
    expect(/^[0-9]{6}$/.test(code)).toBe(true);
  });

  it('draws every digit without a strongly biased mapping', () => {
    const counts = new Map<string, number>();
    let total = 0;
    for (let i = 0; i < 10_000; i++) {
      for (const ch of generateRoomCode()) {
        expect(/[0-9]/.test(ch)).toBe(true);
        counts.set(ch, (counts.get(ch) ?? 0) + 1);
        total++;
      }
    }
    expect(counts.size).toBe(10);
    for (const count of counts.values()) {
      expect(count / total).toBeLessThan(0.15);
    }
  });
});

describe('isRoomCode', () => {
  it('accepts a valid code', () => {
    expect(isRoomCode('123456')).toBe(true);
    expect(isRoomCode('000000')).toBe(true);
  });

  it('rejects codes of the wrong length', () => {
    expect(isRoomCode('12345')).toBe(false);
    expect(isRoomCode('1234567')).toBe(false);
  });

  it('rejects codes containing letters', () => {
    expect(isRoomCode('ABC234')).toBe(false);
    expect(isRoomCode('12345A')).toBe(false);
  });
});
