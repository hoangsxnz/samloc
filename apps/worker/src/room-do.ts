import { DurableObject } from 'cloudflare:workers';
import type { GameEvent } from '@samloc/rules';
import { handleMessage, type Who } from './room-do-actions';
import { armIdleClose, onAlarm, parseState, parseTrick, type RoomHost } from './room-do-hand';
import { RoomStore } from './room-do-store';
import { buildView } from './room-do-view';
import { parseClientMsg } from './ws-parse';
import type { HandResult, ServerMsg } from './ws-types';

interface Bucket {
  tokens: number;
  ts: number;
}

const RATE_PER_SEC = 10;
const BURST = 20;

/**
 * One object per room code: seats, settings, the authoritative `RulesState`, the turn alarm and
 * the per-player snapshot filter. Sockets use the Hibernation API and are tagged with the user id,
 * so a second tab from one account shares the seat.
 */
export class RoomDO extends DurableObject<Env> implements RoomHost {
  readonly store: RoomStore;
  readonly storage: DurableObjectStorage;
  readonly db: D1Database;
  readonly #buckets = new Map<WebSocket, Bucket>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.storage = ctx.storage;
    this.db = env.DB;
    this.store = new RoomStore(ctx.storage.sql);
    this.store.ensureSchema();
  }

  waitUntil(promise: Promise<unknown>): void {
    this.ctx.waitUntil(promise);
  }

  /** The Worker forwards the authenticated user in `x-*` headers; a browser cannot reach a stub. */
  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected websocket', { status: 426 });
    const userId = request.headers.get('x-user-id');
    const rawName = request.headers.get('x-user-name');
    const code = request.headers.get('x-room-code');
    if (!userId || !rawName || !code) return new Response('Missing identity', { status: 400 });
    const name = decodeURIComponent(rawName);
    this.store.ensureSchema();
    this.store.seedRoom(code, {
      maxPlayers: Number(request.headers.get('x-max-players') ?? 4),
      turnSeconds: Number(request.headers.get('x-turn-seconds') ?? 20),
      stakePerLa: Number(request.headers.get('x-stake') ?? 100),
    });
    const pair = new WebSocketPair();
    const server = pair[1];
    this.ctx.acceptWebSocket(server, [userId]);
    server.serializeAttachment({ userId, name } satisfies Who);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  override async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const who = ws.deserializeAttachment() as Who;
    if (!this.takeToken(ws)) {
      this.send(ws, { type: 'error', ack: 0, msg: 'Thao tác quá nhanh' });
      return;
    }
    const msg = parseClientMsg(raw);
    if (!msg) {
      this.send(ws, { type: 'error', ack: 0, msg: 'Tin nhắn không hợp lệ' });
      return;
    }
    handleMessage(this, ws, who, msg);
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    this.dropSocket(ws);
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    this.dropSocket(ws);
  }

  override async alarm(): Promise<void> {
    await onAlarm(this);
  }

  /** A seat only goes offline once its last socket is gone; the host flag follows automatically. */
  private dropSocket(ws: WebSocket): void {
    this.#buckets.delete(ws);
    const who = ws.deserializeAttachment() as Who | null;
    if (!who) return;
    const others = this.ctx.getWebSockets(who.userId).filter((s) => s !== ws);
    if (others.length === 0) {
      const seat = this.store.getRoom() ? this.store.findSeat(who.userId) : null;
      if (seat) this.store.setSeat(seat.seat, { connected: 0 });
    }
    if (this.store.getRoom()) {
      this.snapshotAll(0);
      armIdleClose(this);
    }
  }

  /** Token bucket: 10 messages/s with a burst of 20. Hibernation resets it to full, which is fine. */
  private takeToken(ws: WebSocket): boolean {
    const now = Date.now();
    const bucket = this.#buckets.get(ws) ?? { tokens: BURST, ts: now };
    bucket.tokens = Math.min(BURST, bucket.tokens + ((now - bucket.ts) / 1000) * RATE_PER_SEC);
    bucket.ts = now;
    if (bucket.tokens < 1) {
      this.#buckets.set(ws, bucket);
      return false;
    }
    bucket.tokens -= 1;
    this.#buckets.set(ws, bucket);
    return true;
  }

  send(ws: WebSocket, msg: ServerMsg): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // A closing socket may reject the write; the close handler cleans up.
    }
  }

  broadcastEvents(events: GameEvent[]): void {
    if (events.length === 0) return;
    for (const ws of this.ctx.getWebSockets()) {
      for (const event of events) this.send(ws, { type: 'event', event });
    }
  }

  snapshotAll(ack: number, origin?: WebSocket): void {
    const room = this.store.getRoom();
    if (!room) return;
    const seats = this.store.listSeats();
    const state = parseState(room);
    const result = room.result_json ? (JSON.parse(room.result_json) as HandResult) : null;
    const trick = parseTrick(room);
    for (const ws of this.ctx.getWebSockets()) {
      const who = ws.deserializeAttachment() as Who | null;
      if (!who) continue;
      const view = buildView(room, seats, state, result, trick, who.userId);
      this.send(ws, { type: 'snapshot', ack: ws === origin ? ack : 0, view });
    }
  }
}
