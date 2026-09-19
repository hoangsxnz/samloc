import type { RoomView } from '@samloc/worker/ws-types';
import type { SoundKey } from './sound.svelte';

function trickKey(view: RoomView): string | null {
  const last = view.trick[view.trick.length - 1];
  return last ? `${view.trick.length}:${last.seat}:${last.cards.join(',')}` : null;
}

function handStarted(prev: RoomView, next: RoomView): boolean {
  return next.status === 'playing' && (prev.status !== 'playing' || prev.handNo !== next.handNo);
}

function handEnded(prev: RoomView, next: RoomView): boolean {
  if (next.status !== 'hand-end' || !next.result) return false;
  return prev.status !== 'hand-end' || prev.result?.handNo !== next.result.handNo;
}

/**
 * Cues derived purely from the previous → next snapshot, so they fire on every screen that
 * receives snapshots and never from a replayed event. The caller skips the first snapshot after a
 * connect so a reload never replays history; a long reconnect gap yields at most one cue of each.
 */
export function soundCuesFor(prev: RoomView, next: RoomView): SoundKey[] {
  const cues: SoundKey[] = [];
  const shuffle = handStarted(prev, next);
  if (shuffle) cues.push('shuffle');
  if (!shuffle && next.trick.length > 0 && trickKey(next) !== trickKey(prev)) cues.push('play');

  const me = next.seats.find((s) => s.seat === next.youSeat)?.userId;
  const known = new Set(prev.seats.map((s) => s.userId));
  if (next.seats.some((s) => !known.has(s.userId) && s.userId !== me)) cues.push('join');

  // The leader is already turnSeat inside the sâm window; the turn starts when the window closes.
  const myTurn = next.youSeat >= 0 && next.turnSeat === next.youSeat && next.phase !== 'sam-window';
  const wasMyTurn = prev.youSeat >= 0 && prev.turnSeat === prev.youSeat && prev.phase !== 'sam-window';
  if (myTurn && (!wasMyTurn || prev.handNo !== next.handNo)) cues.push('turn');

  if (handEnded(prev, next) && next.result) {
    if (next.result.winnerSeat === next.youSeat) cues.push('win');
    else if (next.result.rows.some((r) => r.seat === next.youSeat)) cues.push('lose');
  }
  return cues;
}
