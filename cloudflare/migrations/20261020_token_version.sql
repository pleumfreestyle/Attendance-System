-- One-time migration: invalidate existing sessions after password changes/resets.
ALTER TABLE personnel ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;
