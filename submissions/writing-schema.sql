-- Apply once after schema.sql + partners-schema.sql + security-schema.sql.
-- Additive migration: existing rows remain empty; never infer writing dates.
ALTER TABLE submissions ADD COLUMN writing TEXT NOT NULL DEFAULT '{}';
ALTER TABLE partner_works ADD COLUMN writing TEXT NOT NULL DEFAULT '{}';
-- Immutable private snapshots are staged before a GitHub write. The public
-- poem holds only an opaque revision pointer and explicitly public fields.
CREATE TABLE poem_writing (
  revision TEXT PRIMARY KEY,
  poem_id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX poem_writing_created ON poem_writing(created_at);
