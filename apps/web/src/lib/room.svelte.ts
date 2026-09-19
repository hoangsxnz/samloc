import type { EmojiKey, GameEvent, RoomSettings, RoomView } from '@samloc/worker/ws-types';
import { go } from './router.svelte';
import { sound } from './sound.svelte';
import { soundCuesFor } from './sound-cues';
import { WsClient } from './ws-client.svelte';

const MAX_EVENTS = 10;
const REACTION_TTL_MS = 1600;
const MAX_REACTIONS_PER_SEAT = 3;

export interface Reaction {
  id: number;
  seat: number;
  key: EmojiKey;
}

/** Owns one WsClient across the waiting and table screens; the shell disconnects it on leaving the room routes. */
class RoomStore {
  ws = new WsClient();
  view = $state<RoomView | null>(null);
  events = $state<GameEvent[]>([]);
  reactions = $state<Reaction[]>([]);
  lastError = $state<string | null>(null);
  /** `Date.now()` of the snapshot that dealt the current hand; null after a reload, so a deal never replays. */
  handStartedAt = $state<number | null>(null);
  #code: string | null = null;
  #reactionSeq = 0;
  #reactionTimers = new Map<number, ReturnType<typeof setTimeout>>();

  constructor() {
    // Cues compare against the last seen snapshot only: nothing plays on the first one after
    // connect(), so a reload or a route change never replays what already happened.
    this.ws.onSnapshot = (view) => {
      const prev = this.view;
      this.view = view;
      const cues = prev ? soundCuesFor(prev, view) : [];
      if (cues.includes('shuffle')) this.handStartedAt = Date.now();
      for (const key of cues) sound.play(key);
    };
    this.ws.onEvent = (event) => {
      this.events = [...this.events, event].slice(-MAX_EVENTS);
    };
    this.ws.onEmoji = (seat, key) => {
      this.#pushReaction(seat, key);
    };
    this.ws.onError = (msg) => {
      this.lastError = msg;
    };
  }

  /** Idempotent for the room already open, so moving between the waiting and table screens keeps the socket. */
  connect(code: string): void {
    if (this.#code === code && this.ws.connected) return;
    if (this.#code !== null) this.ws.close();
    this.#code = code;
    this.view = null;
    this.handStartedAt = null;
    this.events = [];
    this.#clearReactions();
    this.lastError = null;
    this.ws.connect(code);
  }

  disconnect(): void {
    if (this.#code === null) return;
    this.#code = null;
    this.ws.close();
    this.view = null;
    this.handStartedAt = null;
    this.events = [];
    this.#clearReactions();
  }

  ready(value: boolean): void {
    this.ws.send({ type: 'ready', value });
  }

  start(): void {
    this.ws.send({ type: 'start' });
  }

  updateSettings(settings: RoomSettings): void {
    this.ws.send({ type: 'settings', settings });
  }

  play(cards: string[]): void {
    this.ws.send({ type: 'play', cards });
  }

  pass(): void {
    this.ws.send({ type: 'pass' });
  }

  declareSam(): void {
    this.ws.send({ type: 'declareSam' });
  }

  declineSam(): void {
    this.ws.send({ type: 'declineSam' });
  }

  nextHand(): void {
    this.ws.send({ type: 'nextHand' });
  }

  sendEmoji(key: EmojiKey): void {
    this.ws.send({ type: 'emoji', key });
  }

  reactionsFor(seat: number): Reaction[] {
    return this.reactions.filter((r) => r.seat === seat);
  }

  /** Transient bubbles: the oldest of a seat is dropped once it holds the cap. */
  #pushReaction(seat: number, key: EmojiKey): void {
    const id = ++this.#reactionSeq;
    let next = [...this.reactions, { id, seat, key }];
    const seatReactions = this.reactions.filter((r) => r.seat === seat);
    if (seatReactions.length >= MAX_REACTIONS_PER_SEAT) {
      const oldest = seatReactions[0];
      if (oldest) {
        next = next.filter((r) => r.id !== oldest.id);
        this.#clearReactionTimer(oldest.id);
      }
    }
    this.reactions = next;
    this.#reactionTimers.set(
      id,
      setTimeout(() => {
        this.reactions = this.reactions.filter((r) => r.id !== id);
        this.#reactionTimers.delete(id);
      }, REACTION_TTL_MS),
    );
  }

  #clearReactionTimer(id: number): void {
    const timer = this.#reactionTimers.get(id);
    if (timer) clearTimeout(timer);
    this.#reactionTimers.delete(id);
  }

  #clearReactions(): void {
    for (const timer of this.#reactionTimers.values()) clearTimeout(timer);
    this.#reactionTimers.clear();
    this.reactions = [];
  }

  clearError(): void {
    this.lastError = null;
  }

  leave(): void {
    this.ws.send({ type: 'leave' });
    this.disconnect();
    go('#/lobby');
  }
}

export const room = new RoomStore();
