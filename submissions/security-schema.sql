-- Apply before deploying either Worker. No manuscript or ownership data is changed.
CREATE TABLE IF NOT EXISTS reviewer_sessions (
  session_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS reviewer_sessions_owner ON reviewer_sessions(email);
CREATE TABLE IF NOT EXISTS reviewer_oauth_states (
  state_hash TEXT PRIMARY KEY,
  return_path TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS session_labels (session_hash TEXT PRIMARY KEY, browser TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS security_rate (rate_key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS security_rate_expiry ON security_rate(expires_at);
CREATE TABLE IF NOT EXISTS security_settings (name TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS security_audit (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  result INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS security_audit_date ON security_audit(created_at, id);
