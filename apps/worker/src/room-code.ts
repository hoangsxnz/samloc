const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
// 256 % 32 === 0 is false (256 / 32 = 8 exactly), so no bias-correcting rejection is
// mathematically required for a 32-symbol alphabet; reject bytes >= 224 anyway to keep the
// mapping obviously uniform even if the alphabet size ever changes.
const REJECTION_CEILING = 224;

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
  if (value.length !== CODE_LENGTH) return false;
  return [...value].every((ch) => ALPHABET.includes(ch));
}
