import { applyAction, createHand, settle, type Action, type GameEvent, type RulesState, type StepResult } from '@samloc/rules';
import type { RoomRow, RoomStore, SeatRow } from './room-do-store';
import { buildHandResult } from './room-do-view';
import type { ServerMsg, TrickEntry } from './ws-types';

/** What the hand and action modules need from the Durable Object. */
export interface RoomHost {
  store: RoomStore;
  storage: DurableObjectStorage;
  db: D1Database;
  waitUntil(promise: Promise<unknown>): void;
  send(ws: WebSocket, msg: ServerMsg): void;
  broadcastEvents(events: GameEvent[]): void;
  /** Snapshot every socket; `origin` receives `ack`, everyone else 0. */
  snapshotAll(ack: number, origin?: WebSocket): void;
}

export function parseState(room: RoomRow): RulesState | null {
  return room.state_json ? (JSON.parse(room.state_json) as RulesState) : null;
}

export function parseTrick(room: RoomRow): TrickEntry[] {
  return room.trick_json ? (JSON.parse(room.trick_json) as TrickEntry[]) : [];
}

function armAlarm(host: RoomHost, turnSeconds: number): void {
  const deadline = Date.now() + turnSeconds * 1000;
  host.store.patchRoom({ turn_deadline: deadline });
  void host.storage.setAlarm(deadline);
}

/** Deals the next hand for the current seats; the room must already be compacted to seats 0..n-1. */
export function beginHand(host: RoomHost, ack: number, origin?: WebSocket): void {
  const room = host.store.getRoom();
  if (!room) return;
  const seats = host.store.listSeats();
  const seed = crypto.getRandomValues(new Uint32Array(1))[0] ?? Date.now();
  const leadSeat = seats.find((s) => s.user_id === room.next_lead_user_id)?.seat;
  const handNo = room.hand_no + 1;
  const { state, events } = createHand(seats.length, handNo, seed, leadSeat);
  host.store.patchRoom({
    hand_no: handNo,
    status: 'playing',
    state_json: JSON.stringify(state),
    result_json: null,
    trick_json: '[]',
  });
  host.store.resetReady();
  host.broadcastEvents(events);
  if (state.phase === 'ended') {
    endHand(host, state);
    return;
  }
  armAlarm(host, room.turn_seconds);
  host.snapshotAll(ack, origin);
}

/** Runs one client action through the rules engine; errors go back to that socket alone. */
export function applyGameAction(host: RoomHost, ws: WebSocket, seq: number, action: Action): void {
  const room = host.store.getRoom();
  const state = room ? parseState(room) : null;
  if (!room || room.status !== 'playing' || !state) {
    host.send(ws, { type: 'error', ack: seq, msg: 'Ván chưa bắt đầu' });
    return;
  }
  const res = applyAction(state, action);
  if (res.error) {
    host.send(ws, { type: 'error', ack: seq, msg: res.error });
    return;
  }
  commitStep(host, room, res, seq, ws);
}

function nextTrick(prev: TrickEntry[], state: RulesState, events: GameEvent[]): TrickEntry[] {
  if (events.some((e) => e.type === 'trickEnd')) return [];
  if (state.trick.combo === null) return prev;
  const last = prev[prev.length - 1];
  const same = last !== undefined && last.seat === state.trick.ownerSeat && last.cards.join() === state.trick.cards.join();
  return same ? prev : [...prev, { seat: state.trick.ownerSeat, cards: [...state.trick.cards] }];
}

function commitStep(host: RoomHost, room: RoomRow, res: StepResult, ack: number, origin?: WebSocket): void {
  const trick = nextTrick(parseTrick(room), res.state, res.events);
  host.store.patchRoom({ state_json: JSON.stringify(res.state), trick_json: JSON.stringify(trick) });
  host.broadcastEvents(res.events);
  if (res.state.phase === 'ended') {
    endHand(host, res.state);
    return;
  }
  armAlarm(host, room.turn_seconds);
  host.snapshotAll(ack, origin);
}

/** Settles, updates session totals, records history in D1 (best effort) and parks the room at hand-end. */
export function endHand(host: RoomHost, state: RulesState): void {
  const seats = host.store.listSeats();
  const deltas = settle(state);
  host.store.addTotals(deltas);
  const totals = host.store.listSeats().map((s) => s.total_la);
  const result = buildHandResult(state, seats, deltas, totals);
  const nextLead = seats.find((s) => s.seat === result.nextLeadSeat)?.user_id ?? null;
  host.store.patchRoom({
    status: 'hand-end',
    result_json: JSON.stringify(result),
    turn_deadline: null,
    next_lead_user_id: nextLead,
  });
  void host.storage.deleteAlarm();
  const room = host.store.getRoom();
  if (room) host.waitUntil(writeHandResults(host.db, room.code, state.handNo, seats, deltas));
  host.snapshotAll(0);
  armIdleClose(host);
}

async function writeHandResults(
  db: D1Database,
  code: string,
  handNo: number,
  seats: SeatRow[],
  deltas: number[],
): Promise<void> {
  const now = Date.now();
  const insert = db.prepare(
    'INSERT INTO hand_results (id, room_code, hand_no, user_id, delta_la, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const rows = seats
    .filter((s) => deltas[s.seat] !== undefined)
    .map((s) => insert.bind(crypto.randomUUID(), code, handNo, s.user_id, deltas[s.seat] ?? 0, now));
  if (rows.length > 0) await db.batch(rows);
}

const IDLE_CLOSE_MS = 60_000;

function nobodyConnected(host: RoomHost): boolean {
  return host.store.listSeats().every((s) => s.connected === 0);
}

/** Outside a hand, a room nobody is connected to closes after a grace period so the lobby stops listing it. */
export function armIdleClose(host: RoomHost): void {
  const room = host.store.getRoom();
  if (!room || room.status === 'playing' || !nobodyConnected(host)) return;
  void host.storage.setAlarm(Date.now() + IDLE_CLOSE_MS);
}

/** Turn timer while playing; idle-close check otherwise. A late or duplicate alarm re-reads state and becomes a no-op. */
export async function onAlarm(host: RoomHost): Promise<void> {
  const room = host.store.getRoom();
  const state = room ? parseState(room) : null;
  if (!room) return;
  if (room.status !== 'playing' || !state) {
    if (nobodyConnected(host)) closeRoom(host);
    return;
  }
  if (room.turn_deadline !== null && Date.now() + 250 < room.turn_deadline) {
    await host.storage.setAlarm(room.turn_deadline);
    return;
  }
  const res = applyAction(state, { type: 'timeout', seat: state.turnSeat });
  if (res.error) {
    armAlarm(host, room.turn_seconds);
    return;
  }
  commitStep(host, room, res, 0);
}

/** Last seat left: mark the lobby session closed and wipe the object's storage. */
export function closeRoom(host: RoomHost): void {
  const room = host.store.getRoom();
  if (room) {
    host.waitUntil(
      host.db.prepare('UPDATE room_sessions SET closed_at = ? WHERE code = ? AND closed_at IS NULL')
        .bind(Date.now(), room.code)
        .run(),
    );
  }
  void host.storage.deleteAlarm();
  void host.storage.deleteAll();
}
