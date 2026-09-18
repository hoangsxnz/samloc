-- Migration number: 0003 	 2026-09-19T00:00:00.000Z

CREATE TABLE coin_grants (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  kind       TEXT NOT NULL CHECK (kind IN ('checkin', 'wheel')),
  amount     INTEGER NOT NULL,
  day        TEXT NOT NULL,          -- YYYY-MM-DD in UTC+7
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_coin_grants_user_day ON coin_grants(user_id, day, kind);
CREATE UNIQUE INDEX idx_coin_grants_checkin ON coin_grants(user_id, day) WHERE kind = 'checkin';
