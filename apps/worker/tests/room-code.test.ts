import { describe, expect, it } from 'vitest';
import { generateRoomCode, isRoomCode } from '../src/room-code';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const FORBIDDEN = new Set(['I', 'O', '0', '1']);

describe('generateRoomCode', () => {
  it('generates a 6-character code from the allowed alphabet', () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(6);
    for (const ch of code) {
      expect(ALPHABET.includes(ch)).toBe(true);
    }
  });

  it('never produces ambiguous characters across many draws', () => {
    for (let i = 0; i < 10_000; i++) {
      const code = generateRoomCode();
      for (const ch of code) {
        expect(FORBIDDEN.has(ch)).toBe(false);
      }
    }
  });
});

describe('isRoomCode', () => {
  it('accepts a valid code', () => {
    expect(isRoomCode('ABC234')).toBe(true);
  });

  it('rejects codes of the wrong length', () => {
    expect(isRoomCode('ABC23')).toBe(false);
  });

  it('rejects codes with disallowed characters', () => {
    expect(isRoomCode('ABCO23')).toBe(false);
  });
});
