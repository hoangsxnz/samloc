import { buildHand, settle } from '@samloc/rules';
import type { RoomRow, SeatRow } from '../src/room-do-store';
import { buildHandResult, buildView, hostSeat } from '../src/room-do-view';

const room: RoomRow = {
  code: 'ABC234',
  hand_no: 1,
  max_players: 4,
  turn_seconds: 20,
  stake_per_la: 100,
  status: 'playing',
  state_json: null,
  result_json: null,
  trick_json: null,
  turn_deadline: 1_000,
  next_lead_user_id: null,
};

const seats: SeatRow[] = [
  { seat: 0, user_id: 'u0', display_name: 'An', ready: 0, connected: 0, total_la: 5 },
  { seat: 1, user_id: 'u1', display_name: 'Bình', ready: 0, connected: 1, total_la: -5 },
  { seat: 2, user_id: 'u2', display_name: 'Chi', ready: 0, connected: 1, total_la: 0 },
];

const hands = [
  ['3S', '4H', '6D', '7C', '9S', '10H', 'JD', 'KC', 'AS', '2H'],
  ['3C', '5H', '6S', '8C', '9D', '10S', 'QD', 'KH', 'AC', '2S'],
  ['4S', '5D', '7H', '8S', 'JC', 'QS', 'KS', 'AD', '2C', '2D'],
];

describe('hostSeat', () => {
  it('is the lowest connected seat, skipping a disconnected seat 0', () => {
    expect(hostSeat(seats)).toBe(1);
    expect(hostSeat(seats.map((s) => ({ ...s, connected: 1 })))).toBe(0);
    expect(hostSeat(seats.map((s) => ({ ...s, connected: 0 })))).toBeNull();
  });
});

describe('buildView', () => {
  const { state } = buildHand(hands, 1, 0);
  const view = buildView(room, seats, state, null, [{ seat: 0, cards: ['3S'] }], 'u1');

  it('reveals only the receiving seat\'s hand and card counts for everyone else', () => {
    expect(view.youSeat).toBe(1);
    expect(view.hand).toEqual(hands[1]);
    expect(view.seats[0]?.cardCount).toBe(10);
    expect(view.seats[2]?.cardCount).toBe(10);
    const serialized = JSON.stringify({ ...view, hand: [], trick: [] });
    for (const id of [...(hands[0] ?? []), ...(hands[2] ?? [])]) {
      expect(serialized).not.toContain(`"${id}"`);
    }
  });

  it('marks the derived host and the receiving seat', () => {
    expect(view.youAreHost).toBe(true);
    expect(view.seats.map((s) => s.isHost)).toEqual([false, true, false]);
    expect(view.seats[0]?.connected).toBe(false);
  });

  it('exposes the turn, the sâm window and the trick history', () => {
    expect(view.phase).toBe('sam-window');
    expect(view.turnSeat).toBe(0);
    expect(view.canDeclareSam).toBe(true);
    expect(view.trick).toEqual([{ seat: 0, cards: ['3S'] }]);
    expect(view.turnDeadline).toBe(1_000);
  });

  it('gives a spectator no hand and no host flag', () => {
    const outsider = buildView(room, seats, state, null, [], 'nobody');
    expect(outsider.youSeat).toBe(-1);
    expect(outsider.hand).toEqual([]);
    expect(outsider.youAreHost).toBe(false);
    expect(outsider.canDeclareSam).toBe(false);
  });
});

describe('buildHandResult', () => {
  it('reveals remaining cards, flags cóng and names the next leader', () => {
    const { state } = buildHand(hands, 3, 0);
    const ended = { ...state, phase: 'ended' as const, winnerSeat: 2 };
    ended.players = ended.players.map((p) => (p.seat === 2 ? { ...p, hand: [], played: 10 } : p));
    ended.players = ended.players.map((p) => (p.seat === 1 ? { ...p, played: 3 } : p));
    const deltas = settle(ended);
    const result = buildHandResult(ended, seats, deltas, [0, 0, 0]);
    expect(result.kind).toBe('normal');
    expect(result.headline).toBe('Chi thắng');
    expect(result.nextLeadSeat).toBe(2);
    expect(result.rows[0]?.cong).toBe(true);
    expect(result.rows[1]?.cong).toBe(false);
    expect(result.rows[0]?.cards).toEqual(hands[0]);
    expect(result.rows.reduce((sum, r) => sum + r.deltaLa, 0)).toBe(0);
  });

  it('describes a blocked sâm and hands the lead to the blocker', () => {
    const { state } = buildHand(hands, 2, 0);
    const failed = { ...state, phase: 'ended' as const, samSeat: 0, samResult: 'fail' as const, blockerSeat: 2 };
    const result = buildHandResult(failed, seats, settle(failed), [0, 0, 0]);
    expect(result.kind).toBe('sam-fail');
    expect(result.headline).toBe('An Báo Sâm thất bại');
    expect(result.winnerSeat).toBeNull();
    expect(result.nextLeadSeat).toBe(2);
  });
});
