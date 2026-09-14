import { Hono } from 'hono';
import { isRoomCode } from './room-code';
import { getSessionCookie, getSessionUser } from './sessions';

interface RoomSettingsRow {
  max_players: number;
  turn_seconds: number;
  stake_per_la: number;
  closed_at: number | null;
}

export const wsRoutes = new Hono<{ Bindings: Env }>();

/**
 * Authenticates the upgrade with the session cookie, loads the room's settings from D1 and hands
 * the socket to the room's Durable Object. Identity travels in `x-*` headers that only this Worker
 * can set on a stub call.
 */
wsRoutes.get('/ws/:code', async (c) => {
  if (c.req.header('Upgrade')?.toLowerCase() !== 'websocket') return c.text('Cần kết nối WebSocket', 426);
  const sid = getSessionCookie(c);
  const user = sid ? await getSessionUser(c.env.DB, sid) : null;
  if (!user) return c.text('Phiên đăng nhập đã hết hạn', 401);

  const code = c.req.param('code').toUpperCase();
  if (!isRoomCode(code)) return c.text('Không tìm thấy phòng', 404);
  const row = await c.env.DB.prepare(
    'SELECT max_players, turn_seconds, stake_per_la, closed_at FROM room_sessions WHERE code = ?',
  )
    .bind(code)
    .first<RoomSettingsRow>();
  if (!row || row.closed_at !== null) return c.text('Không tìm thấy phòng', 404);

  const headers = new Headers(c.req.raw.headers);
  headers.set('x-user-id', user.id);
  headers.set('x-user-name', encodeURIComponent(user.displayName));
  headers.set('x-room-code', code);
  headers.set('x-max-players', String(row.max_players));
  headers.set('x-turn-seconds', String(row.turn_seconds));
  headers.set('x-stake', String(row.stake_per_la));
  const stub = c.env.ROOM.get(c.env.ROOM.idFromName(code));
  return stub.fetch(c.req.raw.url, { headers });
});
