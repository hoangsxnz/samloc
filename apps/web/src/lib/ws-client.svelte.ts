import type { ClientMsg, GameEvent, RoomView, ServerMsg } from '@samloc/worker/ws-types';

/** Plain Omit collapses discriminated unions; this distributes over each member instead. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type OutgoingMsg = DistributiveOmit<ClientMsg, 'seq'>;

const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 30_000;
const RECONNECT_MAX_ATTEMPTS = 10;

function wsBase(): string {
  return location.origin.replace(/^http/, 'ws');
}

/** Reused unchanged by phase 7. Reconnects with backoff and rejoins on every open. */
export class WsClient {
  connected = $state(false);
  /** True once every reconnect attempt has been used up; cleared by the next connect(). */
  failed = $state(false);

  onSnapshot: (view: RoomView) => void = () => {};
  onEvent: (event: GameEvent) => void = () => {};
  onError: (msg: string, ack: number) => void = () => {};

  #socket: WebSocket | null = null;
  #code = '';
  #seq = 0;
  #attempts = 0;
  #reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  #closedByUser = false;

  connect(code: string): void {
    this.#code = code;
    this.#closedByUser = false;
    this.#attempts = 0;
    this.failed = false;
    this.#open();
    document.addEventListener('visibilitychange', this.#onVisibilityChange);
  }

  send(msg: OutgoingMsg): number {
    const seq = ++this.#seq;
    const full = { ...msg, seq } as ClientMsg;
    if (this.#socket?.readyState === WebSocket.OPEN) {
      this.#socket.send(JSON.stringify(full));
    }
    return seq;
  }

  close(): void {
    this.#closedByUser = true;
    document.removeEventListener('visibilitychange', this.#onVisibilityChange);
    if (this.#reconnectTimer) clearTimeout(this.#reconnectTimer);
    this.#socket?.close();
    this.#socket = null;
    this.connected = false;
  }

  #open(): void {
    const socket = new WebSocket(`${wsBase()}/ws/${this.#code}`);
    this.#socket = socket;

    socket.addEventListener('open', () => {
      this.connected = true;
      this.#attempts = 0;
      this.send({ type: 'join' });
    });

    socket.addEventListener('message', (event: MessageEvent<string>) => {
      const msg = JSON.parse(event.data) as ServerMsg;
      if (msg.type === 'snapshot') this.onSnapshot(msg.view);
      else if (msg.type === 'event') this.onEvent(msg.event);
      else if (msg.type === 'error') this.onError(msg.msg, msg.ack);
    });

    socket.addEventListener('close', () => {
      this.connected = false;
      if (!this.#closedByUser) this.#scheduleReconnect();
    });

    socket.addEventListener('error', () => socket.close());
  }

  #scheduleReconnect(): void {
    if (this.#attempts >= RECONNECT_MAX_ATTEMPTS) {
      this.failed = true;
      return;
    }
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** this.#attempts, RECONNECT_MAX_MS);
    this.#attempts += 1;
    this.#reconnectTimer = setTimeout(() => this.#open(), delay);
  }

  #onVisibilityChange = (): void => {
    // iOS drops background sockets after ~30s; reconnect immediately on foregrounding
    if (document.visibilityState === 'visible' && !this.connected && !this.#closedByUser) {
      if (this.#reconnectTimer) clearTimeout(this.#reconnectTimer);
      this.#attempts = 0;
      this.#open();
    }
  };
}
