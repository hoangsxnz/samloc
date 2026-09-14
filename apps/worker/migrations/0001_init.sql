-- Migration number: 0001 	 2026-09-14T08:36:17.058Z

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);

CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

CREATE TABLE room_sessions (
  code          TEXT PRIMARY KEY,
  host_user_id  TEXT NOT NULL REFERENCES users(id),
  max_players   INTEGER NOT NULL,
  turn_seconds  INTEGER NOT NULL,
  stake_per_la  INTEGER NOT NULL,
  created_at    INTEGER NOT NULL,
  closed_at     INTEGER
);
CREATE INDEX idx_room_sessions_host ON room_sessions(host_user_id, created_at DESC);

CREATE TABLE hand_results (
  id         TEXT PRIMARY KEY,
  room_code  TEXT NOT NULL REFERENCES room_sessions(code),
  hand_no    INTEGER NOT NULL,
  user_id    TEXT NOT NULL REFERENCES users(id),
  delta_la   INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_hand_results_room ON hand_results(room_code, hand_no);
CREATE INDEX idx_hand_results_user ON hand_results(user_id, created_at DESC);
