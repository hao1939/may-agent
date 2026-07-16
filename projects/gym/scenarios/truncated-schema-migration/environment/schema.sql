-- User Management Schema
-- Version: 2.3.0
-- Last updated: 2024-01-15

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Note: migration was updating this table to add profile fields
-- for the v2.3 user profiles feature
