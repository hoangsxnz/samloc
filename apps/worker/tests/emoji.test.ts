import { describe, expect, it } from 'vitest';
import { EMOJI_KEYS, isEmojiKey } from '../src/emoji';
import { parseClientMsg } from '../src/ws-parse';

describe('isEmojiKey', () => {
  it('accepts every allowlisted key', () => {
    for (const key of EMOJI_KEYS) expect(isEmojiKey(key)).toBe(true);
  });

  it('rejects anything outside the allowlist', () => {
    expect(isEmojiKey('__proto__')).toBe(false);
    expect(isEmojiKey('constructor')).toBe(false);
    expect(isEmojiKey('')).toBe(false);
    expect(isEmojiKey('x'.repeat(5000))).toBe(false);
    expect(isEmojiKey(42)).toBe(false);
    expect(isEmojiKey(null)).toBe(false);
    expect(isEmojiKey(undefined)).toBe(false);
  });
});

describe('parseClientMsg emoji frames', () => {
  it('parses a valid emoji frame', () => {
    expect(parseClientMsg('{"seq":1,"type":"emoji","key":"lol"}')).toEqual({ seq: 1, type: 'emoji', key: 'lol' });
  });

  it('rejects an unknown key', () => {
    expect(parseClientMsg('{"seq":1,"type":"emoji","key":"nope"}')).toBeNull();
  });

  it('rejects a missing or non-string key', () => {
    expect(parseClientMsg('{"seq":1,"type":"emoji"}')).toBeNull();
    expect(parseClientMsg('{"seq":1,"type":"emoji","key":7}')).toBeNull();
  });
});
