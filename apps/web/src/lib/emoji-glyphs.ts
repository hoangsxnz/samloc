import type { EmojiKey } from '@samloc/worker/ws-types';

/** Glyphs are UI-only; the wire protocol carries the key ids from `@samloc/worker/emoji`. */
export const EMOJI_GLYPHS: Record<EmojiKey, string> = {
  like: '👍',
  lol: '😂',
  sad: '😭',
  angry: '😡',
  fire: '🔥',
  money: '🤑',
  think: '🤔',
  pray: '🙏',
};

/** Picker order. The Record types above are keyed by `EmojiKey`, so this stays in step with
 *  the server allowlist: adding a key there fails the typecheck until both maps cover it. */
export const EMOJI_ORDER = Object.keys(EMOJI_GLYPHS) as EmojiKey[];

export const EMOJI_LABELS: Record<EmojiKey, string> = {
  like: 'Thích',
  lol: 'Cười',
  sad: 'Buồn',
  angry: 'Tức',
  fire: 'Cháy',
  money: 'Tiền',
  think: 'Suy nghĩ',
  pray: 'Cầu nguyện',
};
