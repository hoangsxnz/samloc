import type { RoomView } from '@samloc/worker/ws-types';
import { seatsAfter } from '../../lib/table-layout';

/** The deal animation lasts as long as `shuffle.mp3`. */
const DEAL_MS = 4600;
const CARDS_PER_SEAT = 10;

/**
 * Timing of the deal animation: one face-down card leaves the centre deck per tick, leader first
 * and clockwise, until every seat holds its ten. The fan and the opponents' counts are sliced
 * from the real snapshot with `dealtFor`, so nothing here touches game state.
 */
export class DealSchedule {
  /** True while the deck sits in the centre and cards fly out one at a time. */
  dealing = $state(false);
  /** Cards dealt so far over all seats; the last one is still in flight. */
  dealt = $state(0);
  /** Seats with cards, clockwise from the leader; fixed at the deal so a sâm declaration does not reorder it. */
  #order: number[] = [];

  /** Seat the card in flight is going to; null outside the deal. */
  readonly currentSeat: number | null = $derived.by(() => {
    if (!this.dealing || this.#order.length === 0) return null;
    return this.#order[(this.dealt - 1) % this.#order.length] ?? null;
  });

  /** Cards at `seat` so far, counting the one in flight so the fan grows as its copy fades. */
  dealtFor(seat: number): number {
    const idx = this.#order.indexOf(seat);
    const n = this.#order.length;
    if (idx < 0 || n === 0) return 0;
    return Math.max(0, Math.min(CARDS_PER_SEAT, Math.floor((this.dealt - idx - 1) / n) + 1));
  }

  /** Starts the schedule from the dealt snapshot; returns the cleanup for the caller's effect. */
  start(view: RoomView): (() => void) | undefined {
    const seats = view.seats.filter((s) => s.cardCount > 0).map((s) => s.seat);
    const lead = view.turnSeat ?? seats[0];
    if (lead === undefined) return;
    const order = [lead, ...seatsAfter(lead, seats)].filter((s) => seats.includes(s));
    const total = order.length * CARDS_PER_SEAT;
    if (total === 0) return;
    this.#order = order;
    this.dealt = 1;
    this.dealing = true;
    const timer = setInterval(() => {
      if (this.dealt < total) {
        this.dealt += 1;
        return;
      }
      this.#stop(timer);
    }, DEAL_MS / total);
    return () => this.#stop(timer);
  }

  #stop(timer: ReturnType<typeof setInterval>): void {
    clearInterval(timer);
    this.dealing = false;
    this.dealt = 0;
  }
}
