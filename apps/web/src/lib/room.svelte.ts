import type { GameEvent, RoomSettings, RoomView } from '@samloc/worker/ws-types';
import { go } from './router.svelte';
import { WsClient } from './ws-client.svelte';

const MAX_EVENTS = 10;

/** Owns one WsClient across the waiting and table screens; the shell disconnects it on leaving the room routes. */
class RoomStore {
  ws = new WsClient();
  view = $state<RoomView | null>(null);
  events = $state<GameEvent[]>([]);
  lastError = $state<string | null>(null);
  #code: string | null = null;

  constructor() {
    this.ws.onSnapshot = (view) => {
      this.view = view;
    };
    this.ws.onEvent = (event) => {
      this.events = [...this.events, event].slice(-MAX_EVENTS);
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
    this.events = [];
    this.lastError = null;
    this.ws.connect(code);
  }

  disconnect(): void {
    if (this.#code === null) return;
    this.#code = null;
    this.ws.close();
    this.view = null;
    this.events = [];
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

  nextHand(): void {
    this.ws.send({ type: 'nextHand' });
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
