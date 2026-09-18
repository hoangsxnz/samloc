export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const CONTROL_CHARS_RE = /[\p{Cc}\p{Cf}]/u;

export function parseUsername(input: unknown): ParseResult<string> {
  if (typeof input !== 'string') return { ok: false, error: 'Tên đăng nhập không hợp lệ' };
  const value = input.trim().toLowerCase();
  if (!USERNAME_RE.test(value)) {
    return { ok: false, error: 'Tên đăng nhập phải có 3-20 ký tự chữ thường, số hoặc gạch dưới' };
  }
  return { ok: true, value };
}

export function parseDisplayName(input: unknown): ParseResult<string> {
  if (typeof input !== 'string') return { ok: false, error: 'Tên hiển thị không hợp lệ' };
  const value = input.trim();
  if (value.length < 1 || value.length > 20) {
    return { ok: false, error: 'Tên hiển thị phải có 1-20 ký tự' };
  }
  if (CONTROL_CHARS_RE.test(value)) {
    return { ok: false, error: 'Tên hiển thị chứa ký tự không hợp lệ' };
  }
  return { ok: true, value };
}

export function parsePassword(input: unknown): ParseResult<string> {
  if (typeof input !== 'string') return { ok: false, error: 'Mật khẩu không hợp lệ' };
  if (input.length < 6 || input.length > 72) {
    return { ok: false, error: 'Mật khẩu phải có 6-72 ký tự' };
  }
  return { ok: true, value: input };
}

export interface RoomSettings {
  maxPlayers: number;
  turnSeconds: number;
  stakePerLa: number;
}

const MAX_PLAYERS = new Set([2, 3, 4, 5]);
const TURN_SECONDS = new Set([15, 20, 30]);
const STAKE_PER_LA = new Set([50, 100, 200, 500]);

export function parseRoomSettings(input: unknown): ParseResult<RoomSettings> {
  if (typeof input !== 'object' || input === null) {
    return { ok: false, error: 'Cài đặt phòng không hợp lệ' };
  }
  const { maxPlayers, turnSeconds, stakePerLa } = input as Record<string, unknown>;
  if (
    typeof maxPlayers !== 'number' ||
    !MAX_PLAYERS.has(maxPlayers) ||
    typeof turnSeconds !== 'number' ||
    !TURN_SECONDS.has(turnSeconds) ||
    typeof stakePerLa !== 'number' ||
    !STAKE_PER_LA.has(stakePerLa)
  ) {
    return { ok: false, error: 'Cài đặt phòng không hợp lệ' };
  }
  return { ok: true, value: { maxPlayers, turnSeconds, stakePerLa } };
}

export const AVATAR_MAX_BYTES = 64 * 1024;

/** The browser already cropped and re-encoded; the server only checks size and the JPEG magic bytes. */
export function parseAvatarBytes(input: ArrayBuffer): ParseResult<ArrayBuffer> {
  if (input.byteLength === 0 || input.byteLength > AVATAR_MAX_BYTES) {
    return { ok: false, error: 'Ảnh phải nhỏ hơn 64 KB' };
  }
  const head = new Uint8Array(input, 0, Math.min(3, input.byteLength));
  if (head[0] !== 0xff || head[1] !== 0xd8 || head[2] !== 0xff) {
    return { ok: false, error: 'Ảnh phải là JPEG' };
  }
  return { ok: true, value: input };
}
