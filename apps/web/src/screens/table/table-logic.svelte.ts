import { canBeat, parseCombo, rankOf, type Combo } from '@samloc/rules';
import type { GameEvent } from '@samloc/worker/ws-types';
import { comboLabel } from '../../lib/card-view';
import { room } from '../../lib/room.svelte';
import { seatsAfter } from '../../lib/table-layout';

export interface Flight {
  id: number;
  seat: number;
  cards: string[];
}

export interface Tag {
  id: number;
  seat: number;
  text: string;
  tone: 'gold' | 'danger' | 'warn' | 'info';
}

const TAG_TTL_MS = 1600;
const TICK_MS = 250;
const MAX_TAGS_PER_SEAT = 3;
/** Slightly longer than the 260ms flight so the layer is never torn down mid-animation. */
const FLIGHT_TTL_MS = 300;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function tagFor(event: GameEvent): { seat: number; text: string; tone: Tag['tone'] } | null {
  switch (event.type) {
    case 'chat2':
      return event.chong
        ? { seat: event.seat, text: `Chặt chồng +${event.amount}`, tone: 'gold' }
        : { seat: event.seat, text: `Chặt 2 +${event.amount}`, tone: 'gold' };
    case 'baoSam':
      return { seat: event.seat, text: 'Báo Sâm!', tone: 'danger' };
    case 'bao1':
      return { seat: event.seat, text: 'Báo 1', tone: 'warn' };
    case 'anTrang':
      return { seat: event.seat, text: 'Ăn trắng', tone: 'info' };
    case 'denBai':
      return { seat: event.seat, text: 'Đền bài', tone: 'danger' };
    default:
      return null;
  }
}

/** All derived table state and the tag queue; instantiated once inside table-screen.svelte's script. */
export class TableLogic {
  selected = $state<string[]>([]);
  tags = $state<Tag[]>([]);
  flight = $state<Flight | null>(null);
  ariaLive = $state('');

  #now = $state(Date.now());
  #tagSeq = 0;
  #flightSeq = 0;
  #seenEvents = new WeakSet<GameEvent>();
  #tagTimers = new Map<number, ReturnType<typeof setTimeout>>();
  #lastTrickKey: string | null = null;
  #flightPrimed = false;
  #flightTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    $effect(() => {
      room.view;
      this.selected = [];
    });

    $effect(() => {
      for (const event of room.events) {
        if (this.#seenEvents.has(event)) continue;
        this.#seenEvents.add(event);
        this.#queueTag(event);
      }
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
      for (const timer of this.#tagTimers.values()) clearTimeout(timer);
      if (this.#flightTimer) clearTimeout(this.#flightTimer);
    });
  }

  readonly isMyTurn = $derived(room.view !== null && room.view.turnSeat === room.view.youSeat);

  readonly currentCombo: Combo | null = $derived.by(() => {
    const trick = room.view?.trick;
    const last = trick?.[trick.length - 1];
    return last ? parseCombo(last.cards) : null;
  });

  readonly combo: Combo | null = $derived.by(() => parseCombo(this.selected));

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

  toggle(id: string): void {
    this.selected = this.selected.includes(id) ? this.selected.filter((c) => c !== id) : [...this.selected, id];
  }

  play(): void {
    if (!this.canPlay) return;
    room.play(this.selected);
  }

  pass(): void {
    room.pass();
  }

  tagsFor(seat: number): Tag[] {
    return this.tags.filter((t) => t.seat === seat);
  }

  #queueTag(event: GameEvent): void {
    const mapped = tagFor(event);
    if (!mapped) return;
    this.ariaLive = mapped.text;
    const id = ++this.#tagSeq;
    let next = [...this.tags, { id, seat: mapped.seat, text: mapped.text, tone: mapped.tone }];
    const seatTags = this.tags.filter((t) => t.seat === mapped.seat);
    if (seatTags.length >= MAX_TAGS_PER_SEAT) {
      const oldest = seatTags[0];
      if (oldest) {
        next = next.filter((t) => t.id !== oldest.id);
        this.#clearTagTimer(oldest.id);
      }
    }
    this.tags = next;
    this.#tagTimers.set(
      id,
      setTimeout(() => {
        this.tags = this.tags.filter((t) => t.id !== id);
        this.#tagTimers.delete(id);
      }, TAG_TTL_MS),
    );
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

  #clearTagTimer(id: number): void {
    const timer = this.#tagTimers.get(id);
    if (timer) clearTimeout(timer);
    this.#tagTimers.delete(id);
  }
}
