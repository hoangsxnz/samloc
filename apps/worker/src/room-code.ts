const ALPHABET = '0123456789';
const CODE_LENGTH = 6;
// 256 % 10 === 6, so bytes 250-255 would map back onto digits 0-5 and over-represent them.
// Reject every byte >= 250 so the remaining range (0-249) covers each digit exactly 25 times.
const REJECTION_CEILING = 250;

export function generateRoomCode(): string {
  const buffer = new Uint8Array(CODE_LENGTH);
  let result = '';
  while (result.length < CODE_LENGTH) {
    crypto.getRandomValues(buffer);
    for (const byte of buffer) {
      if (result.length >= CODE_LENGTH) break;
      if (byte >= REJECTION_CEILING) continue;
      result += ALPHABET.charAt(byte % ALPHABET.length);
    }
  }
  return result;
}

export function isRoomCode(value: string): boolean {
  return /^[0-9]{6}$/.test(value);
}
