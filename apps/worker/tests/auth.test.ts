import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/auth';
import { parseDisplayName, parsePassword, parseRoomSettings, parseUsername } from '../src/validation';

describe('hashPassword / verifyPassword', () => {
  it('round-trips a correct password', async () => {
    const { hash, salt } = await hashPassword('matkhau123');
    expect(await verifyPassword('matkhau123', hash, salt)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const { hash, salt } = await hashPassword('matkhau123');
    expect(await verifyPassword('sai-mat-khau', hash, salt)).toBe(false);
  });

  it('produces a different hash and salt for the same password', async () => {
    const a = await hashPassword('matkhau123');
    const b = await hashPassword('matkhau123');
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe('parseUsername', () => {
  it('accepts a valid username', () => {
    expect(parseUsername('son_99')).toEqual({ ok: true, value: 'son_99' });
  });

  it('rejects a username shorter than 3 characters', () => {
    expect(parseUsername('ab').ok).toBe(false);
  });

  it('rejects usernames with invalid characters', () => {
    expect(parseUsername('sơn!!').ok).toBe(false);
  });
});

describe('parseDisplayName', () => {
  it('accepts a unicode display name', () => {
    expect(parseDisplayName('Sơn')).toEqual({ ok: true, value: 'Sơn' });
  });

  it('rejects an empty display name', () => {
    expect(parseDisplayName('   ').ok).toBe(false);
  });

  it('rejects control characters', () => {
    expect(parseDisplayName('Sơn' + String.fromCharCode(0)).ok).toBe(false);
  });
});

describe('parsePassword', () => {
  it('accepts a password within the valid length range', () => {
    expect(parsePassword('matkhau').ok).toBe(true);
  });

  it('rejects a password shorter than 6 characters', () => {
    expect(parsePassword('abc12').ok).toBe(false);
  });
});

describe('parseRoomSettings', () => {
  it('accepts valid settings', () => {
    expect(parseRoomSettings({ maxPlayers: 4, turnSeconds: 20, stakePerLa: 100 }).ok).toBe(true);
  });

  it('rejects an out-of-range maxPlayers', () => {
    expect(parseRoomSettings({ maxPlayers: 9, turnSeconds: 20, stakePerLa: 100 }).ok).toBe(false);
  });

  it('rejects an unlisted turnSeconds', () => {
    expect(parseRoomSettings({ maxPlayers: 4, turnSeconds: 25, stakePerLa: 100 }).ok).toBe(false);
  });
});
