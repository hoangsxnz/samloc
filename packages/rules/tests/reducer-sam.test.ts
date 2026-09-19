import { applyAction, buildHand, createHand, type RulesState } from '../src/state';
import { closeWindow, makeState, play, step } from './state-test-helpers';

const SAM_WINDOW = { phase: 'sam-window' as const };

describe('báo sâm', () => {
  it('declareSam is accepted only before the first card', () => {
    const s = makeState([['3S', '9S'], ['4S', '4H']], SAM_WINDOW);
    const res = step(s, { type: 'declareSam', seat: 1 });
    expect(res.state.samSeat).toBe(1);
    expect(res.events).toEqual([{ type: 'baoSam', seat: 1 }]);
    expect(res.state.phase).toBe('sam-window');
  });

  it('declareSam is rejected after the first card is played', () => {
    let s = makeState([['3S', '9S'], ['4S', '4H']], SAM_WINDOW);
    s = play(closeWindow(s), 0, ['3S']).state;
    expect(s.phase).toBe('playing');
    const res = applyAction(s, { type: 'declareSam', seat: 1 });
    expect(res.error).toBeTruthy();
    expect(res.state).toBe(s);
  });

  it('multiple declarations resolve to the lowest seat', () => {
    let s = makeState([['3S', '9S'], ['4S', '4H'], ['5S', 'KS'], ['6S', 'AS']], SAM_WINDOW);
    s = step(s, { type: 'declareSam', seat: 2 }).state;
    s = step(s, { type: 'declareSam', seat: 1 }).state;
    expect(s.samSeat).toBe(1);
    expect(applyAction(s, { type: 'declareSam', seat: 3 }).error).toBeTruthy();
    expect(applyAction(s, { type: 'declareSam', seat: 2 }).error).toBeTruthy();
    expect(s.samSeat).toBe(1);
  });

  it('declarer leads regardless of the lowest-card rule', () => {
    const s = makeState([['3S', '9S'], ['4S', '4H'], ['5S', 'KS']], SAM_WINDOW);
    expect(s.turnSeat).toBe(0);
    const { state } = step(s, { type: 'declareSam', seat: 2 });
    expect(state.turnSeat).toBe(2);
    expect(state.trick.ownerSeat).toBe(2);
    expect(applyAction(state, { type: 'play', seat: 0, cards: ['3S'] }).error).toBeTruthy();
  });

  it('sâm succeeds when the declarer empties their hand unbeaten', () => {
    let s = makeState([['3S', '9S'], ['2S']], SAM_WINDOW);
    s = step(s, { type: 'declareSam', seat: 1 }).state;
    const res = play(closeWindow(s), 1, ['2S']);
    expect(res.state.phase).toBe('ended');
    expect(res.state.samResult).toBe('success');
    expect(res.state.winnerSeat).toBe(1);
    expect(res.events).toContainEqual({ type: 'handEnd', winnerSeat: 1 });
  });

  it('a non-declarer who times out auto-plays and blocks the sâm', () => {
    let s = makeState([['5S', '9S'], ['3S', '4S']], SAM_WINDOW);
    s = step(s, { type: 'declareSam', seat: 1 }).state;
    s = play(closeWindow(s), 1, ['3S']).state;
    const res = step(s, { type: 'timeout', seat: 0 });
    expect(res.state.samResult).toBe('fail');
    expect(res.state.blockerSeat).toBe(0);
    expect(res.state.phase).toBe('ended');
  });

  it('sâm fails the moment any play is beaten and the hand ends', () => {
    let s = makeState([['5S', '9S'], ['3S', '4S']], SAM_WINDOW);
    s = step(s, { type: 'declareSam', seat: 1 }).state;
    s = play(closeWindow(s), 1, ['3S']).state;
    const res = play(s, 0, ['5S']);
    expect(res.state.phase).toBe('ended');
    expect(res.state.samResult).toBe('fail');
    expect(res.state.blockerSeat).toBe(0);
    expect(res.state.winnerSeat).toBeNull();
    expect(res.events).toEqual([{ type: 'handEnd', winnerSeat: null }]);
    expect(res.state.players[0]?.hand).toEqual(['5S', '9S']);
  });

  it('ăn trắng skips the sâm window entirely', () => {
    const hands = [
      ['3S', '3H', '6C', '6D', '9S', '9H', 'QC', 'QD', 'AS', 'AH'],
      ['4S', '5H', '7D', '8C', '10S', 'JH', 'KD', '2C', '4C', '5S'],
    ];
    const { state, events } = buildHand(hands, 1, 1);
    expect(state.phase).toBe('ended');
    expect(state.instantWin).toEqual({ seat: 0, kind: 'nam-doi' });
    expect(state.winnerSeat).toBe(0);
    expect(events).toEqual([
      { type: 'anTrang', seat: 0, kind: 'nam-doi' },
      { type: 'handEnd', winnerSeat: 0 },
    ]);
    expect(applyAction(state, { type: 'declareSam', seat: 1 }).error).toBeTruthy();
  });

  it('ăn trắng ties resolve to the earlier seat', () => {
    const hands = [
      ['4S', '5H', '7D', '8C', '10S', 'JH', 'KD', '2C', '4C', '5S'],
      ['3S', '3H', '6C', '6D', '9S', '9H', 'QC', 'QD', 'AS', 'AH'],
      ['3D', '4D', '6H', '7H', '9D', '10D', 'JD', 'KH', 'AD', '2D'],
    ];
    const { state } = buildHand(hands, 1, 0);
    expect(state.instantWin).toEqual({ seat: 1, kind: 'nam-doi' });
    expect(state.winnerSeat).toBe(1);
  });

  it('after a failed sâm the blocking seat leads the next hand', () => {
    let s = makeState([['5S', '9S'], ['3S', '4S'], ['6S', '7S']], SAM_WINDOW);
    s = step(s, { type: 'declareSam', seat: 1 }).state;
    s = play(closeWindow(s), 1, ['3S']).state;
    s = play(s, 2, ['6S']).state;
    const nextLead = s.winnerSeat ?? s.blockerSeat;
    expect(nextLead).toBe(2);
    for (let seed = 0; seed < 50; seed++) {
      const next = createHand(3, 2, seed, nextLead ?? 0).state;
      if (next.phase === 'sam-window') {
        expect(next.turnSeat).toBe(2);
        return;
      }
    }
  });

  describe("window closes on every seat's decision or the deadline", () => {
    const HANDS = [['3S', '9S'], ['4S', '4H'], ['5S', 'KS']];

    it('play is rejected while the window is open', () => {
      const s = makeState(HANDS, SAM_WINDOW);
      const res = applyAction(s, { type: 'play', seat: 0, cards: ['3S'] });
      expect(res.error).toBe('Chờ mọi người quyết định báo sâm');
      expect(res.state).toBe(s);
    });

    it('declineSam from every seat closes the window with the lead unchanged', () => {
      let s = makeState(HANDS, SAM_WINDOW);
      s = step(s, { type: 'declineSam', seat: 1 }).state;
      expect(s.phase).toBe('sam-window');
      s = step(s, { type: 'declineSam', seat: 0 }).state;
      const res = step(s, { type: 'declineSam', seat: 2 });
      expect(res.events).toEqual([]);
      expect(res.state.phase).toBe('playing');
      expect(res.state.turnSeat).toBe(0);
      expect(res.state.samDecisions).toEqual([
        { seat: 1, choice: 'decline' },
        { seat: 0, choice: 'decline' },
        { seat: 2, choice: 'decline' },
      ]);
    });

    it('a declaration plus the other declines closes the window on the declarer', () => {
      let s = makeState(HANDS, SAM_WINDOW);
      s = step(s, { type: 'declareSam', seat: 2 }).state;
      s = step(s, { type: 'declineSam', seat: 0 }).state;
      expect(s.phase).toBe('sam-window');
      s = step(s, { type: 'declineSam', seat: 1 }).state;
      expect(s.phase).toBe('playing');
      expect(s.samSeat).toBe(2);
      expect(s.turnSeat).toBe(2);
    });

    it('a decision is final: no declare after decline, no second decline, none after the window', () => {
      let s = makeState(HANDS, SAM_WINDOW);
      s = step(s, { type: 'declineSam', seat: 1 }).state;
      expect(applyAction(s, { type: 'declareSam', seat: 1 }).error).toBe('Bạn đã quyết định rồi');
      expect(applyAction(s, { type: 'declineSam', seat: 1 }).error).toBe('Bạn đã quyết định rồi');
      const playing = closeWindow(s);
      expect(applyAction(playing, { type: 'declineSam', seat: 0 }).error).toBeTruthy();
      expect(applyAction(playing, { type: 'declineSam', seat: 0 }).state).toBe(playing);
    });

    it('the deadline timeout closes the window without playing a card', () => {
      const s = makeState(HANDS, SAM_WINDOW);
      const res = step(s, { type: 'timeout', seat: s.turnSeat });
      expect(res.events).toEqual([]);
      expect(res.state.phase).toBe('playing');
      expect(res.state.turnSeat).toBe(0);
      expect(res.state.trick.combo).toBeNull();
      expect(res.state.players.map((p) => p.hand.length)).toEqual([2, 2, 2]);
    });

    it('an overridden declarer has spent its decision', () => {
      let s = makeState(HANDS, SAM_WINDOW);
      s = step(s, { type: 'declareSam', seat: 2 }).state;
      s = step(s, { type: 'declareSam', seat: 1 }).state;
      expect(s.samSeat).toBe(1);
      expect(applyAction(s, { type: 'declineSam', seat: 2 }).error).toBe('Bạn đã quyết định rồi');
      const res = step(s, { type: 'declineSam', seat: 0 });
      expect(res.state.phase).toBe('playing');
      expect(res.state.turnSeat).toBe(1);
    });

    it('a state dealt before samDecisions existed still accepts decisions', () => {
      const legacy = makeState(HANDS, SAM_WINDOW) as Partial<RulesState>;
      delete legacy.samDecisions;
      const res = step(legacy as RulesState, { type: 'declineSam', seat: 0 });
      expect(res.state.samDecisions).toEqual([{ seat: 0, choice: 'decline' }]);
    });
  });
});
