import { buildHand, type GameEvent, type RulesState } from '@samloc/rules';
import type { RoomRow } from '../src/room-do-store';
import { EMPTY_TRICK, nextTrick, parseTrick, type TrickLog } from '../src/room-do-trick';

const room = (trickJson: string | null): RoomRow => ({
  code: 'ABC234',
  hand_no: 1,
  max_players: 4,
  turn_seconds: 20,
  stake_per_la: 100,
  status: 'playing',
  state_json: null,
  result_json: null,
  trick_json: trickJson,
  turn_deadline: null,
  next_lead_user_id: null,
});

const hands = [
  ['3S', '4H', '6D', '7C', '9S', '10H', 'JD', 'KC', 'AS', '2H'],
  ['3C', '5H', '6S', '8C', '9D', '10S', 'QD', 'KH', 'AC', '2S'],
];

/** A state whose current trick is `cards` played by `seat`. */
function played(seat: number, cards: string[]): RulesState {
  const { state } = buildHand(hands, 1, 0);
  return { ...state, trick: { combo: { type: 'straight', rank: 5, length: cards.length }, cards, ownerSeat: seat } };
}

const TRICK_END: GameEvent[] = [{ type: 'trickEnd', leadSeat: 1 }];

describe('parseTrick', () => {
  it('reads the current shape and defaults to an open, empty trick', () => {
    expect(parseTrick(room(null))).toEqual(EMPTY_TRICK);
    expect(parseTrick(room('{"entries":[{"seat":1,"cards":["3S"]}],"closed":true}'))).toEqual({
      entries: [{ seat: 1, cards: ['3S'] }],
      closed: true,
    });
  });

  it('tolerates the legacy bare-array shape from a room mid-hand across a deploy', () => {
    expect(parseTrick(room('[{"seat":0,"cards":["3S"]}]'))).toEqual({
      entries: [{ seat: 0, cards: ['3S'] }],
      closed: false,
    });
  });
});

describe('nextTrick', () => {
  it('stores entry cards ascending regardless of click order', () => {
    const log = nextTrick(EMPTY_TRICK, played(0, ['5H', '4H', '3S']), []);
    expect(log.entries).toEqual([{ seat: 0, cards: ['3S', '4H', '5H'] }]);
  });

  it('keeps the winning combo on the table when the trick ends', () => {
    const open: TrickLog = { entries: [{ seat: 0, cards: ['3S', '4H', '5H'] }], closed: false };
    const closed = nextTrick(open, played(0, ['5H', '4H', '3S']), TRICK_END);
    expect(closed).toEqual({ entries: open.entries, closed: true });
  });

  it('replaces a closed trick with the next lead', () => {
    const closed: TrickLog = { entries: [{ seat: 0, cards: ['3S'] }], closed: true };
    const log = nextTrick(closed, played(1, ['8C', '6S', '7C']), []);
    expect(log).toEqual({ entries: [{ seat: 1, cards: ['6S', '7C', '8C'] }], closed: false });
  });

  it('appends within an open trick and ignores a repeated state', () => {
    const state = played(1, ['6S', '7C', '8C']);
    const first = nextTrick({ entries: [{ seat: 0, cards: ['3S'] }], closed: false }, state, []);
    expect(first.entries).toHaveLength(2);
    expect(nextTrick(first, state, [])).toBe(first);
  });
});
