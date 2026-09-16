import type { GameEvent } from '@samloc/worker/ws-types';
import { room } from '../../lib/room.svelte';

export interface Tag {
  id: number;
  seat: number;
  text: string;
  tone: 'gold' | 'danger' | 'warn' | 'info';
}

const TAG_TTL_MS = 1600;
const MAX_TAGS_PER_SEAT = 3;

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
    case 'thoi2':
      return { seat: event.seat, text: `Thối 2 ×${event.count} (+${event.amount})`, tone: 'warn' };
    default:
      return null;
  }
}

/** Floating per-seat event tags with a short lifetime, plus the aria-live announcement. */
export class TagQueue {
  tags = $state<Tag[]>([]);
  ariaLive = $state('');

  #seq = 0;
  #seen = new WeakSet<GameEvent>();
  #timers = new Map<number, ReturnType<typeof setTimeout>>();

  constructor() {
    $effect(() => {
      for (const event of room.events) {
        if (this.#seen.has(event)) continue;
        this.#seen.add(event);
        this.#push(event);
      }
    });

    $effect(() => () => {
      for (const timer of this.#timers.values()) clearTimeout(timer);
    });
  }

  for(seat: number): Tag[] {
    return this.tags.filter((t) => t.seat === seat);
  }

  #push(event: GameEvent): void {
    const mapped = tagFor(event);
    if (!mapped) return;
    this.ariaLive = mapped.text;
    const id = ++this.#seq;
    let next = [...this.tags, { id, seat: mapped.seat, text: mapped.text, tone: mapped.tone }];
    const seatTags = this.tags.filter((t) => t.seat === mapped.seat);
    if (seatTags.length >= MAX_TAGS_PER_SEAT) {
      const oldest = seatTags[0];
      if (oldest) {
        next = next.filter((t) => t.id !== oldest.id);
        this.#clear(oldest.id);
      }
    }
    this.tags = next;
    this.#timers.set(
      id,
      setTimeout(() => {
        this.tags = this.tags.filter((t) => t.id !== id);
        this.#timers.delete(id);
      }, TAG_TTL_MS),
    );
  }

  #clear(id: number): void {
    const timer = this.#timers.get(id);
    if (timer) clearTimeout(timer);
    this.#timers.delete(id);
  }
}
