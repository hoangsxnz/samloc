import { Hono } from 'hono';
import type { AuthedVariables } from './auth-middleware';
import { budgetFor } from './budget';
import { userJson } from './routes-auth';
import { parseAvatarBytes, parseDisplayName } from './validation';

export const profileRoutes = new Hono<{ Bindings: Env; Variables: AuthedVariables }>();

interface AvatarRow {
  avatar_blob: ArrayBuffer | null;
  avatar_ver: number | null;
}

profileRoutes.patch('/me', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (body === null || typeof body !== 'object') {
    return c.json({ error: 'Dữ liệu không hợp lệ' }, 400);
  }
  const parsed = parseDisplayName((body as Record<string, unknown>).displayName);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);

  const user = c.var.user;
  await c.env.DB.prepare('UPDATE users SET display_name = ? WHERE id = ?').bind(parsed.value, user.id).run();
  const budget = await budgetFor(c.env.DB, user.id);
  return c.json(userJson({ ...user, displayName: parsed.value }, budget));
});

/** The browser sends a 128×128 JPEG it produced itself; the version is a timestamp the client uses as a cache key. */
profileRoutes.put('/me/avatar', async (c) => {
  if (!c.req.header('content-type')?.startsWith('image/jpeg')) {
    return c.json({ error: 'Ảnh phải là JPEG' }, 400);
  }
  const parsed = parseAvatarBytes(await c.req.arrayBuffer());
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);

  const avatarVer = Date.now();
  await c.env.DB.prepare('UPDATE users SET avatar_blob = ?, avatar_ver = ? WHERE id = ?')
    .bind(parsed.value, avatarVer, c.var.user.id)
    .run();
  return c.json({ avatarVer });
});

/** Served immutable: the client always appends `?v=<avatarVer>`, so a new upload is a new URL. */
profileRoutes.get('/avatars/:userId', async (c) => {
  const row = await c.env.DB.prepare('SELECT avatar_blob, avatar_ver FROM users WHERE id = ?')
    .bind(c.req.param('userId'))
    .first<AvatarRow>();
  if (!row?.avatar_blob) return c.json({ error: 'Không có ảnh' }, 404);
  return new Response(row.avatar_blob, {
    headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=31536000, immutable' },
  });
});
