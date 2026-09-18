import { AVATAR_MAX_BYTES, parseAvatarBytes } from '../src/validation';

function bytes(head: number[], length: number): ArrayBuffer {
  const buf = new Uint8Array(length);
  buf.set(head);
  return buf.buffer;
}

describe('parseAvatarBytes', () => {
  it('accepts a JPEG header padded to 1 KB', () => {
    const result = parseAvatarBytes(bytes([0xff, 0xd8, 0xff], 1024));
    expect(result.ok).toBe(true);
  });

  it('rejects an empty body', () => {
    expect(parseAvatarBytes(new ArrayBuffer(0))).toEqual({ ok: false, error: 'Ảnh phải nhỏ hơn 64 KB' });
  });

  it('rejects one byte over the cap and accepts the cap itself', () => {
    expect(parseAvatarBytes(bytes([0xff, 0xd8, 0xff], AVATAR_MAX_BYTES + 1)).ok).toBe(false);
    expect(parseAvatarBytes(bytes([0xff, 0xd8, 0xff], AVATAR_MAX_BYTES)).ok).toBe(true);
  });

  it('rejects a PNG header', () => {
    expect(parseAvatarBytes(bytes([0x89, 0x50, 0x4e, 0x47], 1024))).toEqual({ ok: false, error: 'Ảnh phải là JPEG' });
  });
});
