-- GIT App - Cloudflare D1 Schema
-- Run this with: wrangler d1 execute <DATABASE_NAME> --file=./schema.sql

-- Main fldrs table
CREATE TABLE IF NOT EXISTS fldrs (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_fldrs_updated ON fldrs(updated_at DESC);
