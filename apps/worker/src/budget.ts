export const STARTING_BUDGET = 10_000;

/**
 * Money balance: everyone starts at STARTING_BUDGET; each settled hand moves it by lá × that room's
 * stake, plus every coin grant (daily check-in, wheel). Derived on every read so nothing can drift.
 */
export async function budgetFor(db: D1Database, userId: string): Promise<number> {
  const row = await db
    .prepare(
      `SELECT
         (SELECT COALESCE(SUM(h.delta_la * r.stake_per_la), 0)
            FROM hand_results h JOIN room_sessions r ON r.code = h.room_code
           WHERE h.user_id = ?1)
       + (SELECT COALESCE(SUM(amount), 0) FROM coin_grants WHERE user_id = ?1) AS net`,
    )
    .bind(userId)
    .first<{ net: number }>();
  return STARTING_BUDGET + (row?.net ?? 0);
}
