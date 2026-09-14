import type { InstantWinKind, RulesState } from '@samloc/rules';
import type { RoomRow, SeatRow } from './room-do-store';
import type { HandResult, HandResultKind, ResultRow, RoomView, SeatView, TrickEntry } from './ws-types';

const INSTANT_WIN_LABELS: Record<InstantWinKind, string> = {
  'sanh-rong': 'Sảnh rồng',
  'tu-quy-2': 'Tứ quý 2',
  'dong-mau': 'Đồng màu',
  'ba-sam-co': 'Ba sám cô',
  'nam-doi': 'Năm đôi',
};

/** The host is derived, never stored: the lowest-numbered seat that is currently connected. */
export function hostSeat(seats: readonly SeatRow[]): number | null {
  const connected = seats.filter((s) => s.connected === 1);
  return connected.length === 0 ? null : Math.min(...connected.map((s) => s.seat));
}

function seatName(seats: readonly SeatRow[], seat: number | null): string {
  return seats.find((s) => s.seat === seat)?.display_name ?? '?';
}

/**
 * The single per-player filter. `hand` is filled only for `forUserId`; every other seat exposes
 * `cardCount` alone. Result rows reveal remaining cards because the hand is over.
 */
export function buildView(
  room: RoomRow,
  seats: readonly SeatRow[],
  state: RulesState | null,
  result: HandResult | null,
  trick: readonly TrickEntry[],
  forUserId: string,
): RoomView {
  const host = hostSeat(seats);
  const you = seats.find((s) => s.user_id === forUserId);
  const youSeat = you?.seat ?? -1;
  const seatViews: SeatView[] = seats.map((s) => {
    const player = state?.players[s.seat];
    return {
      seat: s.seat,
      userId: s.user_id,
      name: s.display_name,
      ready: s.ready === 1,
      connected: s.connected === 1,
      isHost: s.seat === host,
      cardCount: player?.hand.length ?? 0,
      passed: player?.passed ?? false,
      bao1: state?.bao1Seats.includes(s.seat) ?? false,
      totalLa: s.total_la,
    };
  });
  const ownHand = youSeat >= 0 ? (state?.players[youSeat]?.hand ?? []) : [];
  const canDeclareSam =
    state !== null &&
    state.phase === 'sam-window' &&
    youSeat >= 0 &&
    state.players[youSeat] !== undefined &&
    (state.samSeat === null || youSeat < state.samSeat);
  return {
    code: room.code,
    status: room.status,
    settings: { maxPlayers: room.max_players, turnSeconds: room.turn_seconds, stakePerLa: room.stake_per_la },
    handNo: room.hand_no,
    youSeat,
    youAreHost: youSeat >= 0 && youSeat === host,
    seats: seatViews,
    hand: [...ownHand],
    trick: trick.map((t) => ({ seat: t.seat, cards: [...t.cards] })),
    phase: state?.phase ?? null,
    turnSeat: state && state.phase !== 'ended' ? state.turnSeat : null,
    samSeat: state?.samSeat ?? null,
    turnDeadline: room.status === 'playing' ? room.turn_deadline : null,
    canDeclareSam,
    result,
  };
}

function resultKind(state: RulesState): HandResultKind {
  if (state.instantWin) return 'an-trang';
  if (state.samSeat !== null) return state.samResult === 'success' ? 'sam-success' : 'sam-fail';
  if (state.denSeat !== null) return 'den-bai';
  return 'normal';
}

function headline(state: RulesState, seats: readonly SeatRow[], kind: HandResultKind): string {
  switch (kind) {
    case 'an-trang':
      return `${seatName(seats, state.winnerSeat)} ăn trắng: ${INSTANT_WIN_LABELS[state.instantWin?.kind ?? 'nam-doi']}`;
    case 'sam-success':
      return `${seatName(seats, state.samSeat)} Báo Sâm thành công`;
    case 'sam-fail':
      return `${seatName(seats, state.samSeat)} Báo Sâm thất bại`;
    case 'den-bai':
      return `${seatName(seats, state.denSeat)} đền bài`;
    default:
      return `${seatName(seats, state.winnerSeat)} thắng`;
  }
}

/** `totals` are the post-settlement session totals per seat. */
export function buildHandResult(
  state: RulesState,
  seats: readonly SeatRow[],
  deltas: readonly number[],
  totals: readonly number[],
): HandResult {
  const kind = resultKind(state);
  const rows: ResultRow[] = state.players.map((p) => ({
    seat: p.seat,
    name: seatName(seats, p.seat),
    cards: [...p.hand],
    cong: p.played === 0 && p.seat !== state.winnerSeat && kind === 'normal',
    deltaLa: deltas[p.seat] ?? 0,
    totalLa: totals[p.seat] ?? 0,
  }));
  return {
    handNo: state.handNo,
    winnerSeat: state.winnerSeat,
    nextLeadSeat: state.winnerSeat ?? state.blockerSeat ?? 0,
    rows,
    headline: headline(state, seats, kind),
    kind,
  };
}
