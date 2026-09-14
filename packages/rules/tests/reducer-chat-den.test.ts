import { makeState, pass, play } from './state-test-helpers';

const Q3 = ['3S', '3C', '3D', '3H'];
const Q5 = ['5S', '5C', '5D', '5H'];
const Q7 = ['7S', '7C', '7D', '7H'];

describe('chặt 2 and chặt chồng', () => {
  it('quad on a single 2 records a 15 lá transfer and emits chặt 2', () => {
    let s = makeState([['2S', '9S'], [...Q3, 'KS'], ['4S', '6S']]);
    s = play(s, 0, ['2S']).state;
    const res = play(s, 1, Q3);
    expect(res.state.chatChain).toEqual([{ fromSeat: 0, toSeat: 1, amount: 15 }]);
    expect(res.state.lastCut).toEqual({ seat: 1, amount: 15 });
    expect(res.events).toContainEqual({ type: 'chat2', seat: 1, fromSeat: 0, amount: 15, chong: false });
  });

  it('chặt chồng transfers 30 from the previous cutter to the new one', () => {
    let s = makeState([['2S', '9S'], [...Q3, 'KS'], [...Q5, '6S']]);
    s = play(s, 0, ['2S']).state;
    s = play(s, 1, Q3).state;
    const res = play(s, 2, Q5);
    expect(res.state.chatChain).toEqual([
      { fromSeat: 0, toSeat: 1, amount: 15 },
      { fromSeat: 1, toSeat: 2, amount: 30 },
    ]);
    expect(res.events).toContainEqual({ type: 'chat2', seat: 2, fromSeat: 1, amount: 30, chong: true });
  });

  it('third cut doubles again to 60', () => {
    let s = makeState([['2S', '9S'], [...Q3, 'KS'], [...Q5, '6S'], [...Q7, '8S']]);
    s = play(s, 0, ['2S']).state;
    s = play(s, 1, Q3).state;
    s = play(s, 2, Q5).state;
    const res = play(s, 3, Q7);
    expect(res.state.chatChain[2]).toEqual({ fromSeat: 2, toSeat: 3, amount: 60 });
    expect(res.state.lastCut).toEqual({ seat: 3, amount: 60 });
  });

  it('chặt chain resets at trick end', () => {
    let s = makeState([['2S', '9S'], [...Q3, 'KS'], [...Q5, '6S']]);
    s = play(s, 0, ['2S']).state;
    s = play(s, 1, Q3).state;
    s = pass(s, 2).state;
    s = pass(s, 0).state;
    expect(s.lastCut).toBeNull();
    expect(s.chatChain).toHaveLength(1);
    expect(s.turnSeat).toBe(1);
  });

  it('quad played as a lead is not a chặt', () => {
    let s = makeState([[...Q3, '9S'], [...Q5, 'KS']]);
    const lead = play(s, 0, Q3);
    expect(lead.events.some((e) => e.type === 'chat2')).toBe(false);
    s = lead.state;
    const res = play(s, 1, Q5);
    expect(res.events.some((e) => e.type === 'chat2')).toBe(false);
    expect(res.state.chatChain).toEqual([]);
  });
});

describe('đền bài', () => {
  it('đền bài: leader plays a non-highest single, the báo-1 next player wins on it', () => {
    let s = makeState([['3S', 'KS', '4S'], ['5S'], ['6S', '7S']]);
    s = play(s, 0, ['3S']).state;
    expect(s.denWatch).toEqual({ leaderSeat: 0, targetSeat: 1 });
    const res = play(s, 1, ['5S']);
    expect(res.state.denSeat).toBe(0);
    expect(res.state.winnerSeat).toBe(1);
    expect(res.events).toContainEqual({ type: 'denBai', seat: 0 });
  });

  it('no đền bài when the leader played their highest single', () => {
    let s = makeState([['3S', 'KS', '4S'], ['AS'], ['6S', '7S']]);
    s = play(s, 0, ['KS']).state;
    expect(s.denWatch).toBeNull();
    const res = play(s, 1, ['AS']);
    expect(res.state.denSeat).toBeNull();
    expect(res.state.winnerSeat).toBe(1);
  });

  it('no đền bài when another player takes the trick first', () => {
    let s = makeState([['3S', 'KS', '4S'], ['5S'], ['6S', '7S']]);
    s = play(s, 0, ['3S']).state;
    s = pass(s, 1).state;
    s = play(s, 2, ['6S']).state;
    expect(s.denWatch).toBeNull();
    expect(s.denSeat).toBeNull();
  });

  it('no đền bài when the báo-1 player is not immediately after the leader', () => {
    let s = makeState([['3S', 'KS', '4S'], ['6S', '7S', '8S'], ['AS']]);
    s = play(s, 0, ['3S']).state;
    expect(s.denWatch).toBeNull();
    s = pass(s, 1).state;
    const res = play(s, 2, ['AS']);
    expect(res.state.denSeat).toBeNull();
    expect(res.state.winnerSeat).toBe(2);
  });

  it('no đền bài when the winning play was itself a lead', () => {
    const s = makeState([['3S', 'KS'], ['5S'], ['6S', '7S']], { turnSeat: 1 });
    const res = play(s, 1, ['5S']);
    expect(res.state.denSeat).toBeNull();
    expect(res.state.winnerSeat).toBe(1);
  });

  it('no chặt transfer or event during a báo sâm hand', () => {
    let s = makeState([['2S', '9S'], [...Q3, 'KS']], { phase: 'sam-window', samSeat: 0 });
    s = play(s, 0, ['2S']).state;
    const res = play(s, 1, Q3);
    expect(res.events.some((e) => e.type === 'chat2')).toBe(false);
    expect(res.state.chatChain).toEqual([]);
    expect(res.state.samResult).toBe('fail');
    expect(res.state.blockerSeat).toBe(1);
  });
});
