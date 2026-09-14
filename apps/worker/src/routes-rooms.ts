import { Hono } from 'hono';
import type { AuthedVariables } from './auth-middleware';
import { generateRoomCode, isRoomCode } from './room-code';
import { parseRoomSettings, type RoomSettings } from './validation';

export const roomRoutes = new Hono<{ Bindings: Env; Variables: AuthedVariables }>();

const MAX_OPEN_ROOMS = 3;
const MAX_INSERT_ATTEMPTS = 5;

interface RoomRow {
  maxPlayers: number;
  turnSeconds: number;
  stakePerLa: number;
  closedAt: number | null;
}

interface SessionRow {
  code: string;
  stakePerLa: number;
  closedAt: number | null;
  hands: number;
  netLa: number;
}

async function insertRoomWithRetry(db: D1Database, hostUserId: string, settings: RoomSettings): Promise<string> {
  const now = Date.now();
  for (let attempt = 0; attempt < MAX_INSERT_ATTEMPTS; attempt++) {
    const code = generateRoomCode();
    try {
      await db
        .prepare(
          `INSERT INTO room_sessions (code, host_user_id, max_players, turn_seconds, stake_per_la, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(code, hostUserId, settings.maxPlayers, settings.turnSeconds, settings.stakePerLa, now)
        .run();
      return code;
    } catch (err) {
      if (attempt === MAX_INSERT_ATTEMPTS - 1) throw err;
    }
  }
  throw new Error('unreachable');
}

async function fetchPlayers(db: D1Database, codes: string[]): Promise<Map<string, string[]>> {
  const placeholders = codes.map(() => '?').join(',');
  const rows = await db
    .prepare(
      `SELECT DISTINCT h.room_code AS code, u.display_name AS displayName
       FROM hand_results h JOIN users u ON u.id = h.user_id
       WHERE h.room_code IN (${placeholders})`,
    )
    .bind(...codes)
    .all<{ code: string; displayName: string }>();

  const map = new Map<string, string[]>();
  for (const row of rows.results) {
    const list = map.get(row.code) ?? [];
    list.push(row.displayName);
    map.set(row.code, list);
  }
  return map;
}

roomRoutes.post('/rooms', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (body === null || typeof body !== 'object') {
    return c.json({ error: 'Dữ liệu không hợp lệ' }, 400);
  }
  const settingsResult = parseRoomSettings(body);
  if (!settingsResult.ok) return c.json({ error: settingsResult.error }, 400);

  const user = c.var.user;
  const openCount = await c.env.DB.prepare(
    'SELECT COUNT(*) AS count FROM room_sessions WHERE host_user_id = ? AND closed_at IS NULL',
  )
    .bind(user.id)
    .first<{ count: number }>();
  if ((openCount?.count ?? 0) >= MAX_OPEN_ROOMS) {
    return c.json({ error: 'Bạn đang có 3 phòng mở' }, 429);
  }

  const code = await insertRoomWithRetry(c.env.DB, user.id, settingsResult.value);
  return c.json({ code, ...settingsResult.value });
});

roomRoutes.get('/rooms/:code', async (c) => {
  const code = c.req.param('code').toUpperCase();
  if (!isRoomCode(code)) {
    return c.json({ error: 'Mã phòng không hợp lệ' }, 400);
  }

  const room = await c.env.DB.prepare(
    `SELECT max_players AS maxPlayers, turn_seconds AS turnSeconds, stake_per_la AS stakePerLa,
            closed_at AS closedAt
     FROM room_sessions WHERE code = ?`,
  )
    .bind(code)
    .first<RoomRow>();

  if (!room) return c.json({ exists: false });
  return c.json({
    exists: true,
    maxPlayers: room.maxPlayers,
    turnSeconds: room.turnSeconds,
    stakePerLa: room.stakePerLa,
    closed: room.closedAt !== null,
  });
});

roomRoutes.get('/sessions', async (c) => {
  const user = c.var.user;
  const rooms = await c.env.DB.prepare(
    `SELECT r.code AS code, r.stake_per_la AS stakePerLa, r.closed_at AS closedAt,
            COUNT(DISTINCT h.hand_no) AS hands, SUM(h.delta_la) AS netLa, MAX(h.created_at) AS lastAt
     FROM hand_results h JOIN room_sessions r ON r.code = h.room_code
     WHERE h.user_id = ? GROUP BY r.code ORDER BY lastAt DESC LIMIT 20`,
  )
    .bind(user.id)
    .all<SessionRow>();

  const codes = rooms.results.map((r) => r.code);
  const players = codes.length > 0 ? await fetchPlayers(c.env.DB, codes) : new Map<string, string[]>();

  const sessions = rooms.results.map((r) => ({
    code: r.code,
    hands: r.hands,
    netLa: r.netLa,
    netScore: r.netLa * r.stakePerLa,
    stakePerLa: r.stakePerLa,
    players: players.get(r.code) ?? [],
    open: r.closedAt === null,
  }));

  return c.json({ sessions });
});
