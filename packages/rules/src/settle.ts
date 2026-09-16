import { isTwo } from './cards';
import type { RulesState } from './state';

const AN_TRANG_AMOUNT = 20;
const SAM_AMOUNT = 20;
const CONG_AMOUNT = 15;
const THOI_2_AMOUNT = 5;

/**
 * Per-seat lá deltas for a finished hand; always sums to zero. The stake multiplier is applied
 * by the caller. Ăn trắng and báo sâm are exclusive: no card counting, no cóng, no thối 2 and no
 * chặt transfers apply to them.
 */
export function settle(state: RulesState): number[] {
  const n = state.players.length;
  const deltas = new Array<number>(n).fill(0);
  const pay = (from: number, to: number, amount: number): void => {
    deltas[from] = (deltas[from] ?? 0) - amount;
    deltas[to] = (deltas[to] ?? 0) + amount;
  };

  if (state.instantWin) {
    const winner = state.instantWin.seat;
    for (const p of state.players) if (p.seat !== winner) pay(p.seat, winner, AN_TRANG_AMOUNT);
    return assertZeroSum(deltas);
  }

  if (state.samSeat !== null) {
    const declarer = state.samSeat;
    const success = state.samResult === 'success';
    for (const p of state.players) {
      if (p.seat === declarer) continue;
      if (success) pay(p.seat, declarer, SAM_AMOUNT);
      else pay(declarer, p.seat, SAM_AMOUNT);
    }
    return assertZeroSum(deltas);
  }

  const winner = state.winnerSeat;
  if (winner === null) throw new Error('Ván chưa có người thắng');
  const owed = new Array<number>(n).fill(0);
  for (const p of state.players) {
    if (p.seat === winner) continue;
    const base = p.played === 0 ? CONG_AMOUNT : p.hand.length;
    const amount = base + THOI_2_AMOUNT * p.hand.filter(isTwo).length;
    owed[p.seat] = amount;
    pay(p.seat, winner, amount);
  }
  if (state.denSeat !== null) {
    for (const p of state.players) {
      if (p.seat === winner || p.seat === state.denSeat) continue;
      pay(state.denSeat, p.seat, owed[p.seat] ?? 0);
    }
  }
  for (const t of state.chatChain) pay(t.fromSeat, t.toSeat, t.amount);
  return assertZeroSum(deltas);
}

export interface Thoi2Count {
  seat: number;
  /** 2s still in hand when the hand ended. */
  count: number;
  /** Lá penalty for those 2s (before the stake multiplier). */
  amount: number;
}

/**
 * Read-only report of who pays thối 2, for the hand-end announcement. Empty for ăn trắng and
 * báo sâm hands, which skip card counting entirely. `settle` keeps its own arithmetic.
 */
export function thoi2Counts(state: RulesState): Thoi2Count[] {
  if (state.instantWin !== null || state.samSeat !== null) return [];
  const winner = state.winnerSeat;
  if (winner === null) return [];
  const out: Thoi2Count[] = [];
  for (const p of state.players) {
    if (p.seat === winner) continue;
    const count = p.hand.filter(isTwo).length;
    if (count > 0) out.push({ seat: p.seat, count, amount: THOI_2_AMOUNT * count });
  }
  return out;
}

function assertZeroSum(deltas: number[]): number[] {
  const sum = deltas.reduce((a, b) => a + b, 0);
  if (sum !== 0) throw new Error(`Tổng điểm không cân bằng: ${sum}`);
  return deltas;
}
