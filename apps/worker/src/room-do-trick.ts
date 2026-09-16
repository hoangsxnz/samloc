import { sortHand, type GameEvent, type RulesState } from '@samloc/rules';
import type { RoomRow } from './room-do-store';
import type { TrickEntry } from './ws-types';

/**
 * Combos played in the current trick, newest last. `closed` marks a trick everybody passed on: the
 * cards stay on the table so players can read them, and the next lead replaces them.
 */
export interface TrickLog {
  entries: TrickEntry[];
  closed: boolean;
}

export const EMPTY_TRICK: TrickLog = { entries: [], closed: false };

export function parseTrick(room: RoomRow): TrickLog {
  if (!room.trick_json) return EMPTY_TRICK;
  const parsed: unknown = JSON.parse(room.trick_json);
  // A room mid-hand across a deploy still holds the old bare-array shape.
  return Array.isArray(parsed) ? { entries: parsed as TrickEntry[], closed: false } : (parsed as TrickLog);
}

export function nextTrick(prev: TrickLog, state: RulesState, events: GameEvent[]): TrickLog {
  if (events.some((e) => e.type === 'trickEnd')) return { entries: prev.entries, closed: true };
  if (state.trick.combo === null) return prev;
  // Stored sorted, so a combo clicked as 5-4-3 reads as 3-4-5 for every viewer and animation.
  const entry: TrickEntry = { seat: state.trick.ownerSeat, cards: sortHand(state.trick.cards) };
  if (prev.closed) return { entries: [entry], closed: false };
  const last = prev.entries[prev.entries.length - 1];
  const same = last !== undefined && last.seat === entry.seat && last.cards.join() === entry.cards.join();
  return same ? prev : { entries: [...prev.entries, entry], closed: false };
}
