/** Reaction ids are the wire protocol; the glyph for each id lives in the web app alone,
 *  so the server never relays attacker-controlled text and the icons can change client-side. */
export const EMOJI_KEYS = ['like', 'lol', 'sad', 'angry', 'fire', 'money', 'think', 'pray'] as const;

export type EmojiKey = (typeof EMOJI_KEYS)[number];

export function isEmojiKey(value: unknown): value is EmojiKey {
  return typeof value === 'string' && (EMOJI_KEYS as readonly string[]).includes(value);
}
