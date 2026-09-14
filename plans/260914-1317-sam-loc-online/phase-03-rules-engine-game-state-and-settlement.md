---
phase: 3
title: "Rules engine game state and settlement"
status: completed
effort: "5h"
priority: P1
dependencies: [phase-02]
---

# Phase 3: Rules engine game state and settlement

Context: `docs/game-rules.md` §Turn flow / §Hand end & scoring

## Overview

The authoritative state machine: one hand of Sâm Lốc from deal to settlement, as a pure reducer.
`applyAction(state, action) → { state, events }` never mutates its input and never touches I/O, so the
Durable Object can persist `state` as JSON and replay nothing. Settlement returns lá deltas summing to
zero, and the stake multiplier is applied outside the engine.

## Requirements

**Functional** — deal → ăn trắng check → báo sâm window → play → hand end, every house rule enforced;
illegal actions (wrong seat, wrong phase, card not held, combo does not beat) rejected with a reason;
events emitted for ăn trắng, báo sâm, báo 1, chặt 2, chặt chồng, đền bài, trick end, hand end;
`settle(state)` returns per-seat lá deltas summing to 0; timeout auto-plays the lowest single when
leading, otherwise auto-passes.
**Non-functional** — pure functions only; `RulesState` JSON round-trippable (no `Map`/`Set`/`Date`/class
instances); files ≤200 lines, hence the `reducer-play` / `reducer-sam` / `settle` split.

## Architecture

**`RulesState`** (`src/state.ts`)
```ts
export type Phase = 'sam-window' | 'playing' | 'ended';
export interface PlayerState {
  seat: number; hand: CardId[];   // seat 0..n-1 = deal order = clockwise; hand sorted ascending
  played: number;                 // cards played this hand; 0 at hand end === cóng
  passed: boolean;                // pass-locked for the current trick
}
export interface TrickState {
  combo: Combo | null; cards: CardId[];   // combo to beat; null === nobody has led yet
  ownerSeat: number;                      // played `combo`, or the seat to lead when combo is null
}
export interface Transfer { fromSeat: number; toSeat: number; amount: number }
export interface RulesState {
  handNo: number; players: PlayerState[]; turnSeat: number; phase: Phase; trick: TrickState;
  samSeat: number | null;                            // báo sâm declarer
  samResult: 'success' | 'fail' | null;
  instantWin: { seat: number; kind: InstantWinKind } | null;
  bao1Seats: number[];                               // seats already announced at 1 card
  chatChain: Transfer[];                             // settled chặt 2 / chặt chồng transfers
  lastCut: { seat: number; amount: number } | null;  // head of the chain; reset at trick end
  denWatch: { leaderSeat: number; targetSeat: number } | null;
  denSeat: number | null;                            // đền bài offender
  winnerSeat: number | null;
  blockerSeat: number | null;                        // beat a failed sâm; leads the next hand
}
export type Action = { type: 'play'; seat: number; cards: CardId[] }
  | { type: 'declareSam' | 'pass' | 'timeout'; seat: number };
export type GameEvent =
  | { type: 'anTrang'; seat: number; kind: InstantWinKind }
  | { type: 'chat2'; seat: number; fromSeat: number; amount: number; chong: boolean }
  | { type: 'baoSam' | 'bao1' | 'denBai'; seat: number }
  | { type: 'trickEnd'; leadSeat: number } | { type: 'handEnd'; winnerSeat: number | null };
export function createHand(seats: number, handNo: number, seed: number, leadSeat?: number):
  { state: RulesState; events: GameEvent[] };
export function applyAction(state: RulesState, action: Action):
  { state: RulesState; events: GameEvent[]; error?: string };
export function settle(state: RulesState): number[];
```

**`createHand`** — calls `createDeal`; `leadSeat` overrides the lowest-card rule from hand 2 onward
(previous winner leads). Scans `hasInstantWin` in seat order; the first hit sets `instantWin`,
`winnerSeat`, `phase = 'ended'` and emits `anTrang`, so the sâm window never opens. Otherwise
`phase = 'sam-window'`, `turnSeat = leadSeat`, `trick = { combo: null, cards: [], ownerSeat: leadSeat }`.

**Báo sâm window** (`reducer-sam.ts`) — any seat may `declareSam` while `phase === 'sam-window'`; multiple
declarations resolve to the lowest seat number first, and a later higher-seat declaration is rejected. The
window closes on the first `play` (`phase = 'playing'`). With `samSeat` set the declarer becomes `turnSeat`
and leads. Any other seat's play beating the declarer → `samResult = 'fail'`, `blockerSeat = that seat`,
`phase = 'ended'`, `winnerSeat = null`, `handEnd`. Declarer empties hand → `'success'`, `winnerSeat =
samSeat`. The next hand is led by `winnerSeat ?? blockerSeat`, so a blocked sâm hands the lead to the
blocker.

**Pass lock** (`reducer-play.ts`) — `pass` sets `passed = true` and is rejected when `trick.combo === null`
(the leader must play). `nextSeat` walks `(seat + 1) % n` skipping passed seats. Trick end:
```
if (players.filter(p => !p.passed && p.seat !== trick.ownerSeat).length === 0) {
  emit trickEnd(trick.ownerSeat); players.forEach(p => p.passed = false)
  trick = { combo: null, cards: [], ownerSeat: trick.ownerSeat }
  lastCut = null; denWatch = null; turnSeat = trick.ownerSeat
}
```

**`play` validation order** — seat is `turnSeat` → phase is `sam-window` or `playing` → every card is in
hand → `parseCombo(cards) !== null` → `canBeat(trick.combo, combo)`. Any failure returns the unchanged
state plus a Vietnamese `error`, surfaced verbatim by the DO to that one client. A `timeout` action is
rewritten to `play` with `lowestSingle(hand)` when `trick.combo === null`, otherwise to `pass`; a lead is
always legal, so that rewrite cannot fail.

**Chặt 2 / chặt chồng, báo 1, đền bài** — all three run inside a successful `play`, after the cards leave
`hand`. Chặt transfers are immediate and final (the original 15 from the 2's owner stands even if that
cutter is later cut) and are skipped on a báo sâm hand. Báo 1 is server-driven. Đền bài arms on a lead,
disarms when someone else takes the trick, fires on the win, and clears at trick end and on a new lead.
```
// wasLead === (trick.combo was null before this play)
if (samSeat === null) {                                   // no chặt at all on a báo sâm hand
  if (combo.type === 'quad' && trick.combo?.type === 'single' && trick.combo.rank === 15) {
    push { from: trick.ownerSeat, to: seat, amount: 15 }
    lastCut = { seat, amount: 15 };  emit chat2(chong: false)
  } else if (combo.type === 'quad' && trick.combo?.type === 'quad' && lastCut) {
    const amount = lastCut.amount * 2                      // 30, 60, …
    push { from: lastCut.seat, to: seat, amount }; lastCut = { seat, amount }
    emit chat2(chong: true) } }
if (hand.length === 1 && !bao1Seats.includes(seat)) { bao1Seats.push(seat); emit bao1(seat) }
const nextP = players[(seat + 1) % n]
if (wasLead && combo.type === 'single' && nextP.hand.length === 1 &&
    rankOf(cards[0]) < rankOf(highestSingle(handBeforePlay)))
  denWatch = { leaderSeat: seat, targetSeat: nextP.seat }
else if (!wasLead && seat !== denWatch?.targetSeat) denWatch = null
if (denWatch && !wasLead && seat === denWatch.targetSeat && hand.length === 0) {
  denSeat = denWatch.leaderSeat; emit denBai(denSeat)
}
```

**`settle(state)`** (`settle.ts`), where `pay(from, to, n)` does `d[from] -= n; d[to] += n`:
```
d = zeros(n); owed = zeros(n)
if (instantWin) { for (s !== instantWin.seat) pay(s, instantWin.seat, 20); return d }
// báo sâm is exclusive: no card counting, no cóng, no thối 2, no chặt transfers
if (samSeat !== null) { const w = samResult === 'success'
  for (s !== samSeat) w ? pay(s, samSeat, 20) : pay(samSeat, s, 20); return d }
for each loser p (p.seat !== winnerSeat) {  // cóng = flat 15 instead of cards; +5 per remaining 2
  owed[p.seat] = (p.played === 0 ? 15 : p.hand.length) + 5 * p.hand.filter(isTwo).length
  pay(p.seat, winnerSeat, owed[p.seat]) }
if (denSeat !== null) for each loser p (p.seat !== winnerSeat && p.seat !== denSeat)
  pay(denSeat, p.seat, owed[p.seat])     // refunds p, charges the offender; winner unaffected
for (const t of chatChain) pay(t.fromSeat, t.toSeat, t.amount)
return d                                 // invariant: sum(d) === 0
```

## Related Code Files

**Create** — `packages/rules/src/state.ts` (types, `createHand`, `applyAction` dispatch), `reducer-play.ts`
(play/pass/timeout, trick resolution, chặt, báo 1, đền watch), `reducer-sam.ts` (declare, window close,
resolution), `settle.ts`, and `reducer-events.ts` **only if** a reducer file would otherwise exceed 200
lines; tests `reducer-turn-flow.test.ts`, `reducer-sam.test.ts`, `reducer-chat-den.test.ts`, `settle.test.ts`.
**Modify** — `packages/rules/src/index.ts` (re-export `applyAction`, `createHand`, `settle`, all types). **Delete** — none.

## Implementation Steps

1. `state.ts`: types verbatim, `createHand` (deal → instant-win scan → phase) in ≤80 lines, plus the
   step-4 `applyAction` switch and nothing else.
2. `reducer-play.ts`: `applyPlay`, `applyPass`, `applyTimeout` plus private `nextSeat`, `endTrick`,
   `checkBao1`, `applyChat`, `updateDenWatch`. `structuredClone(state)` first thing in each handler.
3. `reducer-sam.ts`: `applyDeclareSam`, `closeSamWindow(state, firstPlayerSeat)`, `resolveSam(state, beaten)`.
4. `applyAction` dispatches into the two reducer modules and always returns `{ state, events, error? }`;
   on `error` it returns the **original** state object.
5. `settle.ts`: the algorithm above plus an internal `assertZeroSum` guard (plain `if` + `throw`).
6. Write the tests below with explicit `CardId[]` literals, not `createDeal`. Run
   `pnpm --filter @samloc/rules test`, then `pnpm -r typecheck`.

## Test Matrix (vitest, use these case names verbatim)

| File | Cases |
|---|---|
| `reducer-turn-flow.test.ts` | `first hand: lowest card holder leads`; `later hand: previous winner leads`; `lead may be any valid combo`; `pass is rejected when leading`; `follower must beat or pass`; `illegal combo returns error and unchanged state`; `playing a card not in hand returns error`; `acting out of turn returns error`; `pass locks the player out until the trick ends`; `trick ends when all others pass and the last player leads next`; `passed flags clear at trick end`; `báo 1 is emitted when a player drops to one card`; `báo 1 is emitted only once per seat`; `timeout while leading auto-plays the lowest single`; `timeout while responding auto-passes`; `hand ends immediately when a player empties their hand`; `state survives a JSON round trip`; `applyAction does not mutate its input` |
| `reducer-sam.test.ts` | `declareSam is accepted only before the first card`; `declareSam is rejected after the first card is played`; `multiple declarations resolve to the lowest seat`; `declarer leads regardless of the lowest-card rule`; `sâm succeeds when the declarer empties their hand unbeaten`; `sâm fails the moment any play is beaten and the hand ends`; `ăn trắng skips the sâm window entirely`; `ăn trắng ties resolve to the earlier seat`; `after a failed sâm the blocking seat leads the next hand` |
| `reducer-chat-den.test.ts` | `quad on a single 2 records a 15 lá transfer and emits chặt 2`; `chặt chồng transfers 30 from the previous cutter to the new one`; `third cut doubles again to 60`; `chặt chain resets at trick end`; `quad played as a lead is not a chặt`; `đền bài: leader plays a non-highest single, the báo-1 next player wins on it`; `no đền bài when the leader played their highest single`; `no đền bài when another player takes the trick first`; `no đền bài when the báo-1 player is not immediately after the leader`; `no đền bài when the winning play was itself a lead`; `no chặt transfer or event during a báo sâm hand` |
| `settle.test.ts` | `deltas always sum to zero` (asserted across every other case); `losers pay one lá per remaining card`; `thối 2 adds 5 lá per remaining 2`; `cóng pays 15 flat plus thối 2`; `ăn trắng pays 20 from each other player and ignores cards`; `báo sâm success pays the declarer 20 from each player`; `báo sâm failure pays each player 20 by the declarer and nothing else`; `chặt transfers are added on top of card counts`; `đền bài: the offender pays every other loser's amount, the winner receives the same total`; `đền bài offender still pays their own cards` |

## Success Criteria

- [x] Every test case name above exists and passes: `pnpm --filter @samloc/rules test`
- [x] `pnpm -r typecheck` exits 0
- [x] `JSON.parse(JSON.stringify(state))` deep-equals a mid-hand `state`, and `applyAction` never mutates
      its input (asserted with a frozen clone)
- [x] Every file in `packages/rules/src` ≤200 lines

## Risk Assessment

| Risk | L×I | Mitigation |
|---|---|---|
| Two house rules read narrowly: đền bài "not their highest single", and chặt chồng stacking | M×H | **Confirmed by the user**, not open questions. Đền bài means "the leader held a strictly higher single than the one played"; the original 15 from the 2's owner stands even when that cutter is later cut. Both are pinned by named tests, so a future reversal is a one-file change |
| Cóng + báo sâm failure double-charging | M×M | `settle` returns early when `samSeat !== null`; the `báo sâm failure … and nothing else` test guards it |
| `structuredClone` missing, or a reducer file creeps past 200 lines | L×L | `structuredClone` exists in Workers and Node 24 (swap for a 6-line `cloneState` if not); the step-2 helper split keeps files small, with `reducer-events.ts` as the overflow |

**Rollback:** additive inside `packages/rules`; phase 2 modules stay untouched and green.

## Security Considerations

- The reducer is the only authority on legality: phase 5 calls `applyAction` for **every** client message
  and never accepts client-supplied state.
- `createHand`'s `seed` must come from `crypto.getRandomValues` in the DO; a guessable seed leaks all hands.
- `error` strings are user-facing Vietnamese and must not leak another player's cards.

## Next Steps

Phase 5 persists `RulesState` as JSON in DO SQLite, maps `GameEvent` to `{type:'event'}` frames, and reads `nextLeadSeat` as `winnerSeat ?? blockerSeat`.
