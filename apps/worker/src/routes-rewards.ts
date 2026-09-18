import { Hono } from 'hono';
import type { AuthedVariables } from './auth-middleware';
import { budgetFor } from './budget';
import { CHECKIN_AMOUNT, WHEEL_SEGMENTS, WHEEL_SPINS_PER_DAY, dayKey, pickSegment, randomUnit } from './rewards';

export const rewardRoutes = new Hono<{ Bindings: Env; Variables: AuthedVariables }>();

interface CountRow {
  kind: 'checkin' | 'wheel';
  n: number;
}

async function countToday(db: D1Database, userId: string, day: string): Promise<{ checkedIn: boolean; spinsLeft: number }> {
  const rows = await db
    .prepare('SELECT kind, COUNT(*) AS n FROM coin_grants WHERE user_id = ? AND day = ? GROUP BY kind')
    .bind(userId, day)
    .all<CountRow>();
  const spins = rows.results.find((r) => r.kind === 'wheel')?.n ?? 0;
  return {
    checkedIn: rows.results.some((r) => r.kind === 'checkin'),
    spinsLeft: Math.max(0, WHEEL_SPINS_PER_DAY - spins),
  };
}

rewardRoutes.get('/rewards', async (c) => {
  const day = dayKey(Date.now());
  const today = await countToday(c.env.DB, c.var.user.id, day);
  return c.json({
    day,
    ...today,
    checkinAmount: CHECKIN_AMOUNT,
    segments: WHEEL_SEGMENTS.map((s) => ({ amount: s.amount, label: s.label })),
  });
});

/** One per day: the partial unique index on (user_id, day) rejects the second insert. */
rewardRoutes.post('/checkin', async (c) => {
  const user = c.var.user;
  const now = Date.now();
  try {
    await c.env.DB.prepare(
      `INSERT INTO coin_grants (id, user_id, kind, amount, day, created_at) VALUES (?, ?, 'checkin', ?, ?, ?)`,
    )
      .bind(crypto.randomUUID(), user.id, CHECKIN_AMOUNT, dayKey(now), now)
      .run();
  } catch (err) {
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      return c.json({ error: 'Hôm nay đã điểm danh rồi' }, 409);
    }
    throw err;
  }
  return c.json({ amount: CHECKIN_AMOUNT, budget: await budgetFor(c.env.DB, user.id) });
});

/** The prize is drawn here; the insert and the daily cap are one statement so parallel spins cannot overshoot. */
rewardRoutes.post('/spin', async (c) => {
  const user = c.var.user;
  const now = Date.now();
  const day = dayKey(now);
  const segment = pickSegment(randomUnit());
  const amount = WHEEL_SEGMENTS[segment]?.amount ?? 0;
  const result = await c.env.DB.prepare(
    `INSERT INTO coin_grants (id, user_id, kind, amount, day, created_at)
     SELECT ?1, ?2, 'wheel', ?3, ?4, ?5
      WHERE (SELECT COUNT(*) FROM coin_grants WHERE user_id = ?2 AND kind = 'wheel' AND day = ?4) < ?6`,
  )
    .bind(crypto.randomUUID(), user.id, amount, day, now, WHEEL_SPINS_PER_DAY)
    .run();
  if (result.meta.changes === 0) return c.json({ error: 'Hết lượt quay hôm nay' }, 429);

  const { spinsLeft } = await countToday(c.env.DB, user.id, day);
  return c.json({ segment, amount, spinsLeft, budget: await budgetFor(c.env.DB, user.id) });
});
