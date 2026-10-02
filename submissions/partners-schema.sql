-- Additive migration: existing submissions and receipt permissions are untouched.
CREATE TABLE IF NOT EXISTS partners (
  id TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','pending','approving','active','rejected','suspended')),
  author_id TEXT NOT NULL DEFAULT '',
  desired_name TEXT NOT NULL DEFAULT '',
  application_note TEXT NOT NULL DEFAULT '',
  reviewer_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS partners_author ON partners(author_id) WHERE author_id != '';
CREATE INDEX IF NOT EXISTS partners_status ON partners(status, applied_at);
CREATE TABLE IF NOT EXISTS partner_sessions (
  session_hash TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL REFERENCES partners(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS partner_sessions_owner ON partner_sessions(partner_id);
CREATE TABLE IF NOT EXISTS partner_oauth_states (state_hash TEXT PRIMARY KEY, expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS partner_rate (rate_key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS partner_works (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL REFERENCES partners(id),
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  series TEXT NOT NULL DEFAULT '',
  subseries TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  submission_id TEXT UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS partner_works_owner ON partner_works(partner_id, updated_at);
CREATE TABLE IF NOT EXISTS partner_work_history (
  work_id TEXT NOT NULL REFERENCES partner_works(id),
  version INTEGER NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(work_id,version)
);
CREATE TABLE IF NOT EXISTS partner_poems (
  poem_id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL REFERENCES partners(id),
  author_id TEXT NOT NULL,
  assigned_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS partner_poems_owner ON partner_poems(partner_id);
CREATE TABLE IF NOT EXISTS partner_revisions (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL REFERENCES partners(id),
  poem_id TEXT NOT NULL REFERENCES partner_poems(poem_id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','publishing','published','declined','withdrawn')),
  version INTEGER NOT NULL DEFAULT 1,
  data TEXT NOT NULL,
  base_data TEXT NOT NULL,
  base_hash TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  reviewer_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  decided_at TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS partner_revision_open ON partner_revisions(poem_id) WHERE status IN ('draft','submitted','publishing');
CREATE INDEX IF NOT EXISTS partner_revision_queue ON partner_revisions(status, updated_at);
CREATE TABLE IF NOT EXISTS partner_revision_history (
  revision_id TEXT NOT NULL REFERENCES partner_revisions(id),
  version INTEGER NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(revision_id,version)
);
CREATE TABLE IF NOT EXISTS partner_audit (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  created_at TEXT NOT NULL
);
