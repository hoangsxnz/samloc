import type { CardId } from '../src/cards';
import { settle } from '../src/settle';
import type { RulesState } from '../src/state';
import { makeState } from './state-test-helpers';

interface SeatSpec {
  hand: CardId[];
  played?: number;
}

/** Ended state where `winner` has an empty hand; every other seat has `played` cards (default 1). */
function ended(seats: SeatSpec[], winner: number | null, overrides: Partial<RulesState> = {}): RulesState {
  const base = makeState(seats.map((s) => s.hand));
  base.players = base.players.map((p, i) => ({ ...p, played: seats[i]?.played ?? (i === winner ? 10 : 1) }));
  return { ...base, phase: 'ended', winnerSeat: winner, ...overrides };
}

function settleZeroSum(state: RulesState): number[] {
  const deltas = settle(state);
  expect(deltas.reduce((a, b) => a + b, 0)).toBe(0);
  return deltas;
}

describe('settle', () => {
  it('deltas always sum to zero', () => {
    settleZeroSum(ended([{ hand: [] }, { hand: ['3S', '4S'] }, { hand: ['2S'] }], 0));
    settleZeroSum(ended([{ hand: [] }, { hand: ['3S'] }], 0, { instantWin: { seat: 1, kind: 'nam-doi' } }));
  });

  it('losers pay one lá per remaining card', () => {
    const s = ended([{ hand: [] }, { hand: ['3S', '4S', '5S'] }, { hand: ['6S', '7S', '8S', '9S', '10S', 'JS', 'QS'] }], 0);
    expect(settleZeroSum(s)).toEqual([10, -3, -7]);
  });

  it('thối 2 adds 5 lá per remaining 2', () => {
    const s = ended([{ hand: [] }, { hand: ['2S', '2H', '5S'] }], 0);
    expect(settleZeroSum(s)).toEqual([13, -13]);
  });

  it('cóng pays 15 flat plus thối 2', () => {
    const s = ended(
      [
        { hand: [] },
        { hand: ['3S', '4S', '5S', '6S', '7S', '8S', '9S', '10S', 'JS', '2S'], played: 0 },
        { hand: ['KS'] },
      ],
      0,
    );
    expect(settleZeroSum(s)).toEqual([21, -20, -1]);
  });

  it('ăn trắng pays 20 from each other player and ignores cards', () => {
    const s = ended(
      [{ hand: ['3S', '4S'], played: 0 }, { hand: ['5S'] }, { hand: ['2S', '2H'], played: 0 }, { hand: ['KS'] }],
      1,
      { instantWin: { seat: 1, kind: 'dong-mau' } },
    );
    expect(settleZeroSum(s)).toEqual([-20, 60, -20, -20]);
  });

  it('báo sâm success pays the declarer 20 from each player', () => {
    const s = ended([{ hand: ['3S', '2S'], played: 0 }, { hand: ['5S'] }, { hand: [] }], 2, {
      samSeat: 2,
      samResult: 'success',
    });
    expect(settleZeroSum(s)).toEqual([-20, -20, 40]);
  });

  it('báo sâm failure pays each player 20 by the declarer and nothing else', () => {
    const s = ended([{ hand: ['3S', '2S'], played: 0 }, { hand: ['5S'], played: 0 }, { hand: ['7S', '8S'] }], null, {
      samSeat: 2,
      samResult: 'fail',
      blockerSeat: 0,
      chatChain: [{ fromSeat: 0, toSeat: 1, amount: 15 }],
    });
    expect(settleZeroSum(s)).toEqual([20, 20, -40]);
  });

  it('chặt transfers are added on top of card counts', () => {
    const s = ended([{ hand: [] }, { hand: ['3S', '4S'] }, { hand: ['6S', '7S', '8S'] }], 0, {
      chatChain: [{ fromSeat: 1, toSeat: 2, amount: 15 }],
    });
    expect(settleZeroSum(s)).toEqual([5, -17, 12]);
  });

  it('đền bài: the offender pays every other loser\'s amount, the winner receives the same total', () => {
    const s = ended(
      [{ hand: ['3S', '4S', '5S', '6S'] }, { hand: [] }, { hand: ['7S', '8S', '9S'] }, { hand: ['10S', 'JS', 'QS', 'KS', 'AS', '3H'] }],
      1,
      { denSeat: 0 },
    );
    expect(settleZeroSum(s)).toEqual([-13, 13, 0, 0]);
  });

  it('đền bài offender still pays their own cards', () => {
    const s = ended([{ hand: ['3S', '4S', '5S', '6S'] }, { hand: [] }, { hand: ['7S', '8S', '9S'] }], 1, { denSeat: 0 });
    const deltas = settleZeroSum(s);
    expect(deltas[0]).toBe(-(4 + 3));
    expect(deltas[1]).toBe(7);
    expect(deltas[2]).toBe(0);
  });
});
