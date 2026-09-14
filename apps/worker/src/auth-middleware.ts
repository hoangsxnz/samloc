import type { Context, Next } from 'hono';
import { getSessionCookie, getSessionUser, type SessionUser } from './sessions';

export type AuthedVariables = { user: SessionUser };
type AuthedContext = Context<{ Bindings: Env; Variables: AuthedVariables }>;

export async function authMiddleware(c: AuthedContext, next: Next): Promise<Response | void> {
  const sid = getSessionCookie(c);
  if (!sid) return c.json({ error: 'Phiên đăng nhập đã hết hạn' }, 401);

  const user = await getSessionUser(c.env.DB, sid);
  if (!user) return c.json({ error: 'Phiên đăng nhập đã hết hạn' }, 401);

  c.set('user', user);
  await next();
}
