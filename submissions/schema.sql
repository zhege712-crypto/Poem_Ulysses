CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  receipt_hash TEXT NOT NULL UNIQUE,
  consent_version TEXT NOT NULL,
  consent_at TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  content TEXT NOT NULL,
  date TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  series TEXT NOT NULL DEFAULT '',
  subseries TEXT NOT NULL DEFAULT '',
  author_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'submitted',
  public_note TEXT NOT NULL DEFAULT '',
  private_note TEXT NOT NULL DEFAULT '',
  poem_id TEXT NOT NULL DEFAULT '',
  published_url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  publishing_at TEXT NOT NULL DEFAULT '',
  decided_at TEXT NOT NULL DEFAULT '',
  CHECK (status IN ('submitted', 'reviewing', 'publishing', 'published', 'declined', 'withdrawn'))
);

CREATE INDEX IF NOT EXISTS submissions_status_created
  ON submissions(status, created_at DESC);

CREATE TABLE IF NOT EXISTS submission_rate (
  rate_key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at TEXT NOT NULL
);
