import { cloneState } from './clone-state';
import type { GameEvent, RulesState, StepResult } from './state';

/**
 * Báo sâm may be declared by any seat while the window is open (before the first card).
 * Competing declarations resolve to the lowest seat; a later higher seat is rejected.
 * The declarer takes the lead for the whole hand.
 */
export function applyDeclareSam(state: RulesState, seat: number): StepResult {
  if (state.phase !== 'sam-window') {
    return { state, events: [], error: 'Chỉ được báo sâm trước khi lá bài đầu tiên được đánh' };
  }
  if (!state.players[seat]) return { state, events: [], error: 'Chỗ ngồi không hợp lệ' };
  if (state.samSeat !== null && state.samSeat <= seat) {
    return { state, events: [], error: 'Đã có người báo sâm trước bạn' };
  }
  const next = cloneState(state);
  next.samSeat = seat;
  next.turnSeat = seat;
  next.trick = { combo: null, cards: [], ownerSeat: seat };
  return { state: next, events: [{ type: 'baoSam', seat }] };
}

/** A declarer's play was beaten: the hand ends at once, nobody wins, the blocker leads next hand. */
export function resolveSamFail(next: RulesState, blockerSeat: number, events: GameEvent[]): void {
  next.samResult = 'fail';
  next.blockerSeat = blockerSeat;
  next.winnerSeat = null;
  next.phase = 'ended';
  events.push({ type: 'handEnd', winnerSeat: null });
}
