import { createDeal } from '../src/deal';
import { applyAction, createHand } from '../src/state';
import { deepFreeze, makeState, pass, play, step } from './state-test-helpers';

/** First seed whose deal has no ăn trắng, so the sâm window opens. */
function ordinarySeed(seats: number, from = 0): number {
  for (let seed = from; seed < from + 1000; seed++) {
    if (createHand(seats, 1, seed).state.phase === 'sam-window') return seed;
  }
  throw new Error('no ordinary deal found');
}

describe('turn flow', () => {
  it('first hand: lowest card holder leads', () => {
    const seed = ordinarySeed(4);
    const { state } = createHand(4, 1, seed);
    expect(state.turnSeat).toBe(createDeal(4, seed).leadSeat);
    expect(state.trick.ownerSeat).toBe(state.turnSeat);
    expect(state.phase).toBe('sam-window');
  });

  it('later hand: previous winner leads', () => {
    const seed = ordinarySeed(4);
    const { state } = createHand(4, 2, seed, 2);
    expect(state.turnSeat).toBe(2);
    expect(state.handNo).toBe(2);
  });

  it('lead may be any valid combo', () => {
    const s = makeState([['7S', '7H', '9S'], ['3S', '4S', '5S']]);
    const { state } = play(s, 0, ['7S', '7H']);
    expect(state.trick.combo).toEqual({ type: 'pair', rank: 7, length: 2 });
    expect(state.trick.ownerSeat).toBe(0);
    expect(state.turnSeat).toBe(1);
  });

  it('pass is rejected when leading', () => {
    const s = makeState([['7S', '9S'], ['3S', '4S']]);
    const res = applyAction(s, { type: 'pass', seat: 0 });
    expect(res.error).toBeTruthy();
    expect(res.state).toBe(s);
  });

  it('follower must beat or pass', () => {
    const s = makeState([['7S', '9S'], ['3S', 'KS'], ['4S', '5S']]);
    const { state } = play(s, 0, ['7S']);
    expect(applyAction(state, { type: 'play', seat: 1, cards: ['3S'] }).error).toBeTruthy();
    expect(play(state, 1, ['KS']).state.trick.ownerSeat).toBe(1);
    const passed = pass(state, 1).state;
    expect(passed.players[1]?.passed).toBe(true);
    expect(passed.turnSeat).toBe(2);
  });

  it('illegal combo returns error and unchanged state', () => {
    const s = makeState([['7S', '9S', 'JS'], ['3S', '4S']]);
    const res = applyAction(s, { type: 'play', seat: 0, cards: ['7S', '9S'] });
    expect(res.error).toBeTruthy();
    expect(res.state).toBe(s);
    expect(res.events).toEqual([]);
  });

  it('playing a card not in hand returns error', () => {
    const s = makeState([['7S', '9S'], ['3S', '4S']]);
    const res = applyAction(s, { type: 'play', seat: 0, cards: ['3S'] });
    expect(res.error).toBeTruthy();
    expect(res.state).toBe(s);
  });

  it('acting out of turn returns error', () => {
    const s = makeState([['7S', '9S'], ['3S', '4S']]);
    expect(applyAction(s, { type: 'play', seat: 1, cards: ['3S'] }).error).toBeTruthy();
    expect(applyAction(s, { type: 'pass', seat: 1 }).error).toBeTruthy();
    expect(applyAction(s, { type: 'timeout', seat: 1 }).error).toBeTruthy();
  });

  it('pass locks the player out until the trick ends', () => {
    let s = makeState([['3S', '9S', 'JS'], ['4S', '4H'], ['5S', 'KS']]);
    s = play(s, 0, ['3S']).state;
    s = pass(s, 1).state;
    s = play(s, 2, ['5S']).state;
    expect(s.turnSeat).toBe(0);
    s = play(s, 0, ['9S']).state;
    expect(s.turnSeat).toBe(2);
    expect(applyAction(s, { type: 'play', seat: 1, cards: ['4S'] }).error).toBeTruthy();
  });

  it('trick ends when all others pass and the last player leads next', () => {
    let s = makeState([['3S', '9S'], ['4S', '4H'], ['5S', 'KS']]);
    s = play(s, 0, ['3S']).state;
    s = pass(s, 1).state;
    s = play(s, 2, ['5S']).state;
    const res = pass(s, 0);
    expect(res.events).toEqual([{ type: 'trickEnd', leadSeat: 2 }]);
    expect(res.state.turnSeat).toBe(2);
    expect(res.state.trick).toEqual({ combo: null, cards: [], ownerSeat: 2 });
  });

  it('passed flags clear at trick end', () => {
    let s = makeState([['3S', '9S'], ['4S', '4H'], ['5S', 'KS']]);
    s = play(s, 0, ['3S']).state;
    s = pass(s, 1).state;
    s = play(s, 2, ['5S']).state;
    s = pass(s, 0).state;
    expect(s.players.every((p) => !p.passed)).toBe(true);
  });

  it('báo 1 is emitted when a player drops to one card', () => {
    const s = makeState([['3S', '9S'], ['4S', '4H', '5H']]);
    const res = play(s, 0, ['3S']);
    expect(res.events).toContainEqual({ type: 'bao1', seat: 0 });
    expect(res.state.bao1Seats).toEqual([0]);
  });

  it('báo 1 is emitted only once per seat', () => {
    const s = makeState([['3S', '9S'], ['4S', '4H', '5H']], { bao1Seats: [0] });
    const res = play(s, 0, ['3S']);
    expect(res.events.some((e) => e.type === 'bao1')).toBe(false);
    expect(res.state.bao1Seats).toEqual([0]);
  });

  it('timeout while leading auto-plays the lowest single', () => {
    const s = makeState([['9S', '3H', 'KS'], ['4S', '4H']]);
    const res = step(s, { type: 'timeout', seat: 0 });
    expect(res.state.trick.cards).toEqual(['3H']);
    expect(res.state.players[0]?.hand).toEqual(['9S', 'KS']);
  });

  it('timeout while responding auto-passes', () => {
    let s = makeState([['3S', '9S'], ['4S', '4H'], ['5S', 'KS']]);
    s = play(s, 0, ['3S']).state;
    const res = step(s, { type: 'timeout', seat: 1 });
    expect(res.state.players[1]?.passed).toBe(true);
    expect(res.state.players[1]?.hand).toHaveLength(2);
    expect(res.state.turnSeat).toBe(2);
  });

  it('hand ends immediately when a player empties their hand', () => {
    const s = makeState([['3S'], ['4S', '4H']]);
    const res = play(s, 0, ['3S']);
    expect(res.state.phase).toBe('ended');
    expect(res.state.winnerSeat).toBe(0);
    expect(res.events).toContainEqual({ type: 'handEnd', winnerSeat: 0 });
    expect(applyAction(res.state, { type: 'play', seat: 1, cards: ['4S'] }).error).toBeTruthy();
  });

  it('state survives a JSON round trip', () => {
    let s = makeState([['3S', '9S'], ['4S', '4H'], ['5S', 'KS']]);
    s = play(s, 0, ['3S']).state;
    s = pass(s, 1).state;
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });

  it('applyAction does not mutate its input', () => {
    const s = deepFreeze(makeState([['3S', '9S'], ['4S', '4H']]));
    const snapshot = JSON.stringify(s);
    const res = play(s, 0, ['3S']);
    expect(JSON.stringify(s)).toBe(snapshot);
    expect(res.state).not.toBe(s);
    expect(res.state.players[0]?.hand).toEqual(['9S']);
  });
});
