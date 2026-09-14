import type { CardId } from './cards';
import { cloneState } from './clone-state';
import { parseCombo } from './combos';
import { canBeat, lowestSingle } from './compare';
import { applyChat, checkBao1, updateDenWatch } from './reducer-events';
import { resolveSamFail } from './reducer-sam';
import type { GameEvent, RulesState, StepResult } from './state';

function fail(state: RulesState, error: string): StepResult {
  return { state, events: [], error };
}

/** Next seat clockwise that has not passed this trick. */
function nextSeat(state: RulesState, from: number): number {
  const n = state.players.length;
  for (let step = 1; step <= n; step++) {
    const seat = (from + step) % n;
    if (!state.players[seat]?.passed) return seat;
  }
  return from;
}

function endTrick(next: RulesState, events: GameEvent[]): void {
  const owner = next.trick.ownerSeat;
  events.push({ type: 'trickEnd', leadSeat: owner });
  for (const p of next.players) p.passed = false;
  next.trick = { combo: null, cards: [], ownerSeat: owner };
  next.lastCut = null;
  next.denWatch = null;
  next.turnSeat = owner;
}

export function applyPlay(state: RulesState, seat: number, cards: CardId[]): StepResult {
  if (state.phase === 'ended') return fail(state, 'Ván đã kết thúc');
  if (seat !== state.turnSeat) return fail(state, 'Chưa đến lượt của bạn');
  const current = state.players[seat];
  if (!current) return fail(state, 'Chỗ ngồi không hợp lệ');
  if (cards.length === 0) return fail(state, 'Hãy chọn bài để đánh');
  if (new Set(cards).size !== cards.length) return fail(state, 'Bài bị trùng');
  if (cards.some((id) => !current.hand.includes(id))) return fail(state, 'Bạn không có lá bài này');
  const combo = parseCombo(cards);
  if (combo === null) return fail(state, 'Bộ bài không hợp lệ');
  if (!canBeat(state.trick.combo, combo)) return fail(state, 'Không chặt được bài trên bàn');

  const next = cloneState(state);
  const events: GameEvent[] = [];
  const wasLead = state.trick.combo === null;
  if (next.phase === 'sam-window') next.phase = 'playing';

  // A non-declarer can only ever play by beating the declarer, which ends the hand at once.
  if (next.samSeat !== null && seat !== next.samSeat) {
    resolveSamFail(next, seat, events);
    return { state: next, events };
  }

  const player = next.players[seat];
  if (!player) return fail(state, 'Chỗ ngồi không hợp lệ');
  const handBefore = [...player.hand];
  player.hand = player.hand.filter((id) => !cards.includes(id));
  player.played += cards.length;

  applyChat(next, seat, combo, events);
  next.trick = { combo, cards: [...cards], ownerSeat: seat };
  checkBao1(next, seat, events);
  updateDenWatch(next, seat, combo, cards, wasLead, handBefore, events);

  if (player.hand.length === 0) {
    next.phase = 'ended';
    next.winnerSeat = seat;
    if (next.samSeat === seat) next.samResult = 'success';
    events.push({ type: 'handEnd', winnerSeat: seat });
    return { state: next, events };
  }
  next.turnSeat = nextSeat(next, seat);
  return { state: next, events };
}

export function applyPass(state: RulesState, seat: number): StepResult {
  if (state.phase === 'ended') return fail(state, 'Ván đã kết thúc');
  if (seat !== state.turnSeat) return fail(state, 'Chưa đến lượt của bạn');
  if (state.trick.combo === null) return fail(state, 'Người dẫn bài phải đánh, không được bỏ lượt');
  const next = cloneState(state);
  const events: GameEvent[] = [];
  const player = next.players[seat];
  if (!player) return fail(state, 'Chỗ ngồi không hợp lệ');
  player.passed = true;
  const stillIn = next.players.filter((p) => !p.passed && p.seat !== next.trick.ownerSeat);
  if (stillIn.length === 0) endTrick(next, events);
  else next.turnSeat = nextSeat(next, seat);
  return { state: next, events };
}

/** Leading → auto-play the lowest single (always legal); responding → auto-pass. */
export function applyTimeout(state: RulesState, seat: number): StepResult {
  if (state.phase === 'ended') return fail(state, 'Ván đã kết thúc');
  if (seat !== state.turnSeat) return fail(state, 'Chưa đến lượt của bạn');
  const player = state.players[seat];
  if (!player) return fail(state, 'Chỗ ngồi không hợp lệ');
  if (state.trick.combo === null) return applyPlay(state, seat, [lowestSingle(player.hand)]);
  return applyPass(state, seat);
}
