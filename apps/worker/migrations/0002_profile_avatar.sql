-- Migration number: 0002 	 2026-09-19T00:00:00.000Z

ALTER TABLE users ADD COLUMN avatar_blob BLOB;
ALTER TABLE users ADD COLUMN avatar_ver INTEGER;
