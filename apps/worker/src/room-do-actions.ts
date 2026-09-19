import { applyGameAction, beginHand, closeRoom, type RoomHost } from './room-do-hand';
import type { RoomRow, SeatRow } from './room-do-store';
import { hostSeat } from './room-do-view';
import { parseRoomSettings } from './validation';
import type { ClientMsg, RoomSettings } from './ws-types';

export interface Who {
  userId: string;
  name: string;
  /** D1 money balance at socket-upgrade time. Absent on a socket accepted before this shipped. */
  budget?: number;
  /** Avatar version at socket-upgrade time; null without an avatar, absent on older sockets. */
  avatarVer?: number | null;
}

const MIN_PLAYERS = 2;

function fail(host: RoomHost, ws: WebSocket, seq: number, msg: string): void {
  host.send(ws, { type: 'error', ack: seq, msg });
}

function requireHost(host: RoomHost, ws: WebSocket, seq: number, seats: SeatRow[], who: Who): SeatRow | null {
  const mine = seats.find((s) => s.user_id === who.userId) ?? null;
  if (!mine || mine.seat !== hostSeat(seats)) {
    fail(host, ws, seq, 'Chỉ chủ phòng mới làm được việc này');
    return null;
  }
  return mine;
}

/** Every accepted message ends with a snapshot to all sockets; errors go to the sender only. */
export function handleMessage(host: RoomHost, ws: WebSocket, who: Who, msg: ClientMsg): void {
  const room = host.store.getRoom();
  if (!room) {
    fail(host, ws, msg.seq, 'Phòng đã đóng');
    return;
  }
  const seats = host.store.listSeats();
  const mine = seats.find((s) => s.user_id === who.userId) ?? null;

  switch (msg.type) {
    case 'join':
      return handleJoin(host, ws, who, room, seats, mine, msg.seq);
    case 'ready':
      if (room.status !== 'waiting') return fail(host, ws, msg.seq, 'Ván đang diễn ra');
      if (!mine) return fail(host, ws, msg.seq, 'Bạn chưa vào phòng');
      host.store.setSeat(mine.seat, { ready: msg.value ? 1 : 0 });
      return host.snapshotAll(msg.seq, ws);
    case 'settings':
      return handleSettings(host, ws, who, room, seats, msg.settings, msg.seq);
    case 'start':
      if (room.status !== 'waiting') return fail(host, ws, msg.seq, 'Ván đang diễn ra');
      return handleStart(host, ws, who, seats, msg.seq);
    case 'nextHand':
      if (room.status !== 'hand-end') return fail(host, ws, msg.seq, 'Ván hiện tại chưa kết thúc');
      return handleStart(host, ws, who, seats, msg.seq);
    case 'leave':
      return handleLeave(host, ws, room, mine, msg.seq);
    case 'declareSam':
    case 'declineSam':
    case 'pass':
      if (!mine) return fail(host, ws, msg.seq, 'Bạn chưa vào phòng');
      return applyGameAction(host, ws, msg.seq, { type: msg.type, seat: mine.seat });
    case 'play':
      if (!mine) return fail(host, ws, msg.seq, 'Bạn chưa vào phòng');
      return applyGameAction(host, ws, msg.seq, { type: 'play', seat: mine.seat, cards: msg.cards });
    case 'emoji':
      // Reactions are not room state: no snapshot, no store write. A throttled one is
      // dropped silently — an error toast would be noisier than the reaction itself.
      if (!mine) return fail(host, ws, msg.seq, 'Bạn chưa vào phòng');
      if (!host.emojiAllowed(who.userId)) return;
      return host.broadcastEmoji(mine.seat, msg.key);
  }
}

function handleJoin(
  host: RoomHost,
  ws: WebSocket,
  who: Who,
  room: RoomRow,
  seats: SeatRow[],
  mine: SeatRow | null,
  seq: number,
): void {
  if (mine) {
    host.store.setSeat(mine.seat, { connected: 1, display_name: who.name, avatar_ver: who.avatarVer ?? null });
  } else {
    // A player may join while a hand is running: they spectate it and are dealt in on the next one.
    if (seats.length >= room.max_players) return fail(host, ws, seq, 'Phòng đã đầy');
    host.store.addSeat(who.userId, who.name, who.budget ?? 0, who.avatarVer ?? null);
  }
  host.snapshotAll(seq, ws);
}

function handleSettings(
  host: RoomHost,
  ws: WebSocket,
  who: Who,
  room: RoomRow,
  seats: SeatRow[],
  raw: RoomSettings,
  seq: number,
): void {
  if (room.status !== 'waiting') return fail(host, ws, seq, 'Chỉ đổi cài đặt khi đang chờ');
  if (!requireHost(host, ws, seq, seats, who)) return;
  const parsed = parseRoomSettings(raw);
  if (!parsed.ok) return fail(host, ws, seq, parsed.error);
  const settings = parsed.value;
  if (settings.maxPlayers < seats.length) return fail(host, ws, seq, 'Số người không được ít hơn số ghế đã có');
  host.store.patchRoom({
    max_players: settings.maxPlayers,
    turn_seconds: settings.turnSeconds,
    stake_per_la: settings.stakePerLa,
  });
  host.waitUntil(
    host.db.prepare('UPDATE room_sessions SET max_players = ?, turn_seconds = ?, stake_per_la = ? WHERE code = ?')
      .bind(settings.maxPlayers, settings.turnSeconds, settings.stakePerLa, room.code)
      .run(),
  );
  host.snapshotAll(seq, ws);
}

/** Shared by `start` and `nextHand`: drop disconnected seats, require ≥2 ready players, deal. */
function handleStart(host: RoomHost, ws: WebSocket, who: Who, seats: SeatRow[], seq: number): void {
  const me = requireHost(host, ws, seq, seats, who);
  if (!me) return;
  const staying = seats.filter((s) => s.connected === 1);
  if (staying.length < MIN_PLAYERS) return fail(host, ws, seq, 'Cần ít nhất 2 người chơi');
  const room = host.store.getRoom();
  const notReady = staying.filter((s) => s.seat !== me.seat && s.ready === 0);
  if (room?.status === 'waiting' && notReady.length > 0) return fail(host, ws, seq, 'Còn người chưa sẵn sàng');
  host.store.removeDisconnectedSeats();
  host.store.compactSeats();
  beginHand(host, seq, ws);
}

/**
 * Waiting or hand-end: the seat is removed. Playing: the seat stays offline so timeouts play it out
 * and settlement counts it. Seat numbers are only re-packed while waiting; at hand-end the frozen
 * result still refers to the old numbers, and the next deal re-packs anyway.
 * A room with no seats, or a hand nobody is left to play, closes at once.
 */
function handleLeave(host: RoomHost, ws: WebSocket, room: RoomRow, mine: SeatRow | null, seq: number): void {
  if (mine) {
    if (room.status === 'playing') {
      host.store.setSeat(mine.seat, { connected: 0 });
    } else {
      host.store.removeSeat(mine.seat);
      if (room.status === 'waiting') host.store.compactSeats();
    }
  }
  const left = host.store.listSeats();
  const abandoned = room.status === 'playing' && left.every((s) => s.connected === 0);
  if (left.length === 0 || abandoned) closeRoom(host);
  else host.snapshotAll(seq, ws);
  ws.close(1000, 'left');
}
