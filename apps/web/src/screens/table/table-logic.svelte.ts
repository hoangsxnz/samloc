import { untrack } from 'svelte';
import { canBeat, legalMoves, parseCombo, rankOf, type Combo } from '@samloc/rules';
import { comboLabel } from '../../lib/card-view';
import { orderHand, type HandSortMode } from '../../lib/hand-order';
import { room } from '../../lib/room.svelte';
import { seatsAfter } from '../../lib/table-layout';
import { DealSchedule } from './deal-schedule.svelte';
import { TagQueue, type Tag } from './table-tags.svelte';

export interface Flight {
  id: number;
  seat: number;
  cards: string[];
}

const TICK_MS = 250;
/** Slightly longer than the 260ms flight so the layer is never torn down mid-animation. */
const FLIGHT_TTL_MS = 300;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** All derived table state and the tag queue; instantiated once inside table-screen.svelte's script. */
export class TableLogic {
  selected = $state<string[]>([]);
  sortMode = $state<HandSortMode>('rank');
  flight = $state<Flight | null>(null);
  readonly deal = new DealSchedule();
  readonly tagQueue = new TagQueue();

  #now = $state(Date.now());
  #flightSeq = 0;
  #lastTrickKey: string | null = null;
  #flightPrimed = false;
  #flightTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    $effect(() => {
      room.view;
      this.selected = [];
    });

    $effect(() => {
      this.#syncFlight(room.view?.trick);
    });

    $effect(() => {
      if (room.view?.turnDeadline == null) return;
      const timer = setInterval(() => {
        this.#now = Date.now();
      }, TICK_MS);
      return () => clearInterval(timer);
    });

    $effect(() => () => {
      if (this.#flightTimer) clearTimeout(this.#flightTimer);
    });

    // Priming rule as for flights: the first snapshot after a connect sets no handStartedAt.
    $effect(() => {
      if (room.handStartedAt === null || prefersReducedMotion()) return;
      const view = untrack(() => room.view);
      return view ? this.deal.start(view) : undefined;
    });
  }

  readonly isMyTurn = $derived(room.view !== null && room.view.turnSeat === room.view.youSeat);

  /** Null once the trick is closed: its cards stay on the table but no longer have to be beaten. */
  readonly currentCombo: Combo | null = $derived.by(() => {
    const view = room.view;
    if (!view || view.trickClosed) return null;
    const last = view.trick[view.trick.length - 1];
    return last ? parseCombo(last.cards) : null;
  });

  readonly combo: Combo | null = $derived.by(() => parseCombo(this.selected));

  /** Hand in the player's chosen display order; the ids are what gets selected and sent. */
  readonly orderedHand: string[] = $derived(orderHand(room.view?.hand ?? [], this.sortMode));

  /** Every legal play, cheapest first — only on my turn, so nothing is highlighted off-turn. */
  readonly moves: string[][] = $derived.by(() =>
    this.isMyTurn ? legalMoves(room.view?.hand ?? [], this.currentCombo) : [],
  );

  readonly playableIds: Set<string> = $derived(new Set(this.moves.flat()));

  readonly canPlay = $derived(this.isMyTurn && this.combo !== null && canBeat(this.currentCombo, this.combo));

  readonly remain = $derived(Math.max(0, ((room.view?.turnDeadline ?? 0) - this.#now) / 1000));

  readonly invalidReason: string | null = $derived.by(() => {
    if (this.selected.length === 0 || !this.isMyTurn) return null;
    if (!this.combo) return 'Bộ bài không hợp lệ';
    if (this.currentCombo && !canBeat(this.currentCombo, this.combo)) {
      return `Không chặt được ${comboLabel(this.currentCombo)}`;
    }
    return null;
  });

  readonly denWarn: boolean = $derived.by(() => {
    const view = room.view;
    if (!view || !this.isMyTurn || this.currentCombo !== null || this.selected.length !== 1) return false;
    const nextSeat = seatsAfter(view.youSeat, view.seats.map((s) => s.seat))[0];
    const nextSeatCards = view.seats.find((s) => s.seat === nextSeat)?.cardCount ?? 0;
    if (nextSeatCards !== 1) return false;
    const highest = view.hand[view.hand.length - 1];
    const selectedId = this.selected[0];
    if (!selectedId || !highest) return false;
    return rankOf(selectedId) < rankOf(highest);
  });

  /**
   * With an empty selection a tap on a highlighted card seeds the whole cheapest combo containing
   * it — the tap is the hint. With a selection already up it is a plain per-card toggle, so a combo
   * can still be refined by hand; tapping inside a seeded combo clears it.
   */
  toggle(id: string): void {
    if (this.selected.length === 0) {
      const move = this.moves.find((m) => m.includes(id));
      this.selected = move ? [...move] : [id];
      return;
    }
    if (this.selected.includes(id)) {
      const seeded = this.moves.some((m) => m.length === this.selected.length && m.every((c) => this.selected.includes(c)));
      this.selected = seeded && this.selected.length > 1 ? [] : this.selected.filter((c) => c !== id);
      return;
    }
    this.selected = [...this.selected, id];
  }

  toggleSort(): void {
    this.sortMode = this.sortMode === 'rank' ? 'group' : 'rank';
  }

  play(): void {
    if (!this.canPlay) return;
    room.play(this.selected);
  }

  pass(): void {
    room.pass();
  }

  get ariaLive(): string {
    return this.tagQueue.ariaLive;
  }

  tagsFor(seat: number): Tag[] {
    return this.tagQueue.for(seat);
  }

  /**
   * Starts one flight per newly appended trick entry. The key is compared against the
   * previous key only, so a reconnect snapshot replaying the same trick does not re-fire.
   * The first run only records the key: mounting onto a trick that is already on the table
   * (returning to the route mid-hand) must not replay a play that happened earlier.
   */
  #syncFlight(trick: { seat: number; cards: string[] }[] | undefined): void {
    const last = trick?.[trick.length - 1];
    const key = last && trick ? `${trick.length}:${last.seat}:${last.cards.join(',')}` : null;
    if (!this.#flightPrimed) {
      this.#flightPrimed = true;
      this.#lastTrickKey = key;
      return;
    }
    if (key === this.#lastTrickKey) return;
    this.#lastTrickKey = key;
    if (!last || !key || prefersReducedMotion()) return;
    if (this.#flightTimer) clearTimeout(this.#flightTimer);
    this.flight = { id: ++this.#flightSeq, seat: last.seat, cards: [...last.cards] };
    this.#flightTimer = setTimeout(() => {
      this.flight = null;
      this.#flightTimer = null;
    }, FLIGHT_TTL_MS);
  }
}
