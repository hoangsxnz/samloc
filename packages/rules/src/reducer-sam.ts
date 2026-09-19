import { cloneState } from './clone-state';
import type { GameEvent, RulesState, StepResult } from './state';

/** Rooms dealt before `samDecisions` existed carry a state without the field. */
function decided(state: RulesState, seat: number): boolean {
  return (state.samDecisions ?? []).some((d) => d.seat === seat);
}

/** The first card may be played once every seat has pressed Báo Sâm or Huỷ báo. */
function closeWindowIfDecided(next: RulesState): void {
  if (next.samDecisions.length >= next.players.length) next.phase = 'playing';
}

/**
 * Báo sâm may be declared by any seat while the window is open (before the first card).
 * Competing declarations resolve to the lowest seat; a later higher seat is rejected.
 * The declarer takes the lead for the whole hand. An overridden declarer keeps its entry: its
 * decision is spent.
 */
export function applyDeclareSam(state: RulesState, seat: number): StepResult {
  if (state.phase !== 'sam-window') {
    return { state, events: [], error: 'Chỉ được báo sâm trước khi lá bài đầu tiên được đánh' };
  }
  if (!state.players[seat]) return { state, events: [], error: 'Chỗ ngồi không hợp lệ' };
  if (state.samSeat !== null && state.samSeat <= seat) {
    return { state, events: [], error: 'Đã có người báo sâm trước bạn' };
  }
  if (decided(state, seat)) return { state, events: [], error: 'Bạn đã quyết định rồi' };
  const next = cloneState(state);
  next.samSeat = seat;
  next.turnSeat = seat;
  next.trick = { combo: null, cards: [], ownerSeat: seat };
  next.samDecisions = [...(next.samDecisions ?? []), { seat, choice: 'declare' }];
  closeWindowIfDecided(next);
  return { state: next, events: [{ type: 'baoSam', seat }] };
}

/** Huỷ báo is final for the hand: a seat that declined cannot declare afterwards. */
export function applyDeclineSam(state: RulesState, seat: number): StepResult {
  if (state.phase !== 'sam-window') {
    return { state, events: [], error: 'Chỉ huỷ báo trước khi lá bài đầu tiên được đánh' };
  }
  if (!state.players[seat]) return { state, events: [], error: 'Chỗ ngồi không hợp lệ' };
  if (decided(state, seat)) return { state, events: [], error: 'Bạn đã quyết định rồi' };
  const next = cloneState(state);
  next.samDecisions = [...(next.samDecisions ?? []), { seat, choice: 'decline' }];
  closeWindowIfDecided(next);
  return { state: next, events: [] };
}

/** A declarer's play was beaten: the hand ends at once, nobody wins, the blocker leads next hand. */
export function resolveSamFail(next: RulesState, blockerSeat: number, events: GameEvent[]): void {
  next.samResult = 'fail';
  next.blockerSeat = blockerSeat;
  next.winnerSeat = null;
  next.phase = 'ended';
  events.push({ type: 'handEnd', winnerSeat: null });
}
