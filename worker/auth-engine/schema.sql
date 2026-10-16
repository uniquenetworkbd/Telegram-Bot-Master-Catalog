-- Authentication & OTP Bot Engine v1.0
-- Cloudflare D1 schema. Apply with: wrangler d1 execute <DB_NAME> --file=worker/schema.sql

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  telegram_user_id TEXT NOT NULL UNIQUE,
  telegram_username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_login_at INTEGER
);

CREATE TABLE IF NOT EXISTS auth_challenges (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL CHECK (action IN ('register', 'login')),
  telegram_username TEXT NOT NULL COLLATE NOCASE,
  display_name TEXT,
  telegram_user_id TEXT,
  otp_hash TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'otp_sent', 'verified', 'expired', 'locked', 'cancelled')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  verified_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_auth_challenges_status_expiry
  ON auth_challenges(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_challenges_username
  ON auth_challenges(telegram_username, created_at);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user
  ON auth_sessions(user_id, expires_at);
