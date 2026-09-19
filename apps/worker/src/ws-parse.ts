import { isEmojiKey } from './emoji';
import type { ClientMsg } from './ws-types';

const SIMPLE_TYPES = new Set(['join', 'start', 'declareSam', 'declineSam', 'pass', 'nextHand', 'leave']);
const MAX_CARDS = 10;
const MAX_CARD_ID = 3;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Shape-checks an incoming frame; returns null for anything the room should ignore. */
export function parseClientMsg(raw: string | ArrayBuffer): ClientMsg | null {
  if (typeof raw !== 'string' || raw.length > 4096) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data) || typeof data['type'] !== 'string') return null;
  const seq = typeof data['seq'] === 'number' && Number.isFinite(data['seq']) ? data['seq'] : null;
  if (seq === null) return null;
  const type = data['type'];

  if (SIMPLE_TYPES.has(type)) return { seq, type } as ClientMsg;
  if (type === 'ready' && typeof data['value'] === 'boolean') return { seq, type, value: data['value'] };
  if (type === 'play') {
    const cards = data['cards'];
    const valid =
      Array.isArray(cards) &&
      cards.length > 0 &&
      cards.length <= MAX_CARDS &&
      cards.every((c) => typeof c === 'string' && c.length <= MAX_CARD_ID);
    return valid ? { seq, type, cards: cards as string[] } : null;
  }
  if (type === 'emoji' && isEmojiKey(data['key'])) return { seq, type, key: data['key'] };
  if (type === 'settings' && isRecord(data['settings'])) {
    const s = data['settings'];
    return {
      seq,
      type,
      settings: {
        maxPlayers: Number(s['maxPlayers']),
        turnSeconds: Number(s['turnSeconds']),
        stakePerLa: Number(s['stakePerLa']),
      },
    };
  }
  return null;
}
