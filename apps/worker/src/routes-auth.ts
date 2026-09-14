import { Hono } from 'hono';
import type { AuthedVariables } from './auth-middleware';
import { hashPassword, verifyPassword } from './auth';
import { clearSessionCookie, createSession, deleteSession, getSessionCookie, setSessionCookie } from './sessions';
import { parseDisplayName, parsePassword, parseUsername } from './validation';

export const authRoutes = new Hono<{ Bindings: Env; Variables: AuthedVariables }>();

interface UserRow {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  password_salt: string;
}

const STARTING_BUDGET = 10_000;

/** Money balance: everyone starts at STARTING_BUDGET; each settled hand moves it by lá × that room's stake. */
async function budgetFor(db: D1Database, userId: string): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(h.delta_la * r.stake_per_la), 0) AS net
       FROM hand_results h JOIN room_sessions r ON r.code = h.room_code
       WHERE h.user_id = ?`,
    )
    .bind(userId)
    .first<{ net: number }>();
  return STARTING_BUDGET + (row?.net ?? 0);
}

authRoutes.post('/register', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (body === null || typeof body !== 'object') {
    return c.json({ error: 'Dữ liệu không hợp lệ' }, 400);
  }
  const { username, displayName, password } = body as Record<string, unknown>;

  const usernameResult = parseUsername(username);
  if (!usernameResult.ok) return c.json({ error: usernameResult.error }, 400);
  const displayNameResult = parseDisplayName(displayName);
  if (!displayNameResult.ok) return c.json({ error: displayNameResult.error }, 400);
  const passwordResult = parsePassword(password);
  if (!passwordResult.ok) return c.json({ error: passwordResult.error }, 400);

  const existing = await c.env.DB.prepare('SELECT 1 FROM users WHERE username = ?')
    .bind(usernameResult.value)
    .first();
  if (existing) return c.json({ error: 'Tên đăng nhập đã tồn tại' }, 409);

  const { hash, salt } = await hashPassword(passwordResult.value);
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO users (id, username, display_name, password_hash, password_salt, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, usernameResult.value, displayNameResult.value, hash, salt, Date.now())
    .run();

  const sessionId = await createSession(c.env.DB, id);
  setSessionCookie(c, sessionId);
  return c.json({ id, username: usernameResult.value, displayName: displayNameResult.value, budget: STARTING_BUDGET });
});

authRoutes.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (body === null || typeof body !== 'object') {
    return c.json({ error: 'Dữ liệu không hợp lệ' }, 400);
  }
  const { username, password } = body as Record<string, unknown>;
  const invalidCredentials = { error: 'Sai tên đăng nhập hoặc mật khẩu' };

  const usernameResult = parseUsername(username);
  const passwordResult = parsePassword(password);
  if (!usernameResult.ok || !passwordResult.ok) return c.json(invalidCredentials, 401);

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE username = ?')
    .bind(usernameResult.value)
    .first<UserRow>();
  if (!user) return c.json(invalidCredentials, 401);

  const valid = await verifyPassword(passwordResult.value, user.password_hash, user.password_salt);
  if (!valid) return c.json(invalidCredentials, 401);

  const sessionId = await createSession(c.env.DB, user.id);
  setSessionCookie(c, sessionId);
  const budget = await budgetFor(c.env.DB, user.id);
  return c.json({ id: user.id, username: user.username, displayName: user.display_name, budget });
});

authRoutes.post('/logout', async (c) => {
  const sid = getSessionCookie(c);
  if (sid) await deleteSession(c.env.DB, sid);
  clearSessionCookie(c);
  return c.json({ ok: true });
});

authRoutes.get('/me', async (c) => {
  const user = c.var.user;
  const budget = await budgetFor(c.env.DB, user.id);
  return c.json({ id: user.id, username: user.username, displayName: user.displayName, budget });
});
