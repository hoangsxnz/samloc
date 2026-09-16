export const STARTING_BUDGET = 10_000;

/** Money balance: everyone starts at STARTING_BUDGET; each settled hand moves it by lá × that room's stake. */
export async function budgetFor(db: D1Database, userId: string): Promise<number> {
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
