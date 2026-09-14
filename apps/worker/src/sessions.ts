import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';

const COOKIE_NAME = 'sid';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
}

export async function createSession(db: D1Database, userId: string): Promise<string> {
  const id = crypto.randomUUID();
  const now = Date.now();
  await db
    .prepare('INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(id, userId, now, now + SESSION_TTL_MS)
    .run();
  return id;
}

export async function getSessionUser(db: D1Database, sessionId: string): Promise<SessionUser | null> {
  const row = await db
    .prepare(
      `SELECT u.id AS id, u.username AS username, u.display_name AS displayName
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > ?`,
    )
    .bind(sessionId, Date.now())
    .first<SessionUser>();
  return row ?? null;
}

export async function deleteSession(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
}

export function getSessionCookie(c: Context): string | undefined {
  return getCookie(c, COOKIE_NAME);
}

export function setSessionCookie(c: Context, sessionId: string): void {
  setCookie(c, COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, COOKIE_NAME, { path: '/' });
}
