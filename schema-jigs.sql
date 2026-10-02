-- Jig Inventory Schema
-- Run with: npx wrangler d1 execute foldr-db --remote --file=./schema-jigs.sql
--
-- Additive only: every statement is CREATE ... IF NOT EXISTS, and nothing here
-- touches fldrs or any other existing table, so it is safe to run more than once.

-- Jig types: one row per kind of jig (e.g. "Tumbler jig", "Luggage tags").
--   tracking = 'unit'  every physical jig is its own row in jig_units (the default)
--   tracking = 'bulk'  interchangeable, tracked as a plain count in total_qty
--                      (luggage tags, square tee tags)
CREATE TABLE IF NOT EXISTS jig_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tracking TEXT NOT NULL DEFAULT 'unit' CHECK (tracking IN ('unit', 'bulk')),
  total_qty INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Two active jigs can't share a name
CREATE UNIQUE INDEX IF NOT EXISTS idx_jig_types_name
  ON jig_types(lower(name)) WHERE archived = 0;

-- Physical units, for jig types tracked individually ("Tumbler jig #2")
CREATE TABLE IF NOT EXISTS jig_units (
  id TEXT PRIMARY KEY,
  type_id TEXT NOT NULL REFERENCES jig_types(id),
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'needs_repair', 'retired')),
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE (type_id, label)
);

CREATE INDEX IF NOT EXISTS idx_jig_units_type ON jig_units(type_id);

-- Allocations: a jig on a job. This is the log of what's needed, out and returned.
--   status: needed -> out -> returned (or lost)
--   Availability is always calculated from this table, never stored.
CREATE TABLE IF NOT EXISTS jig_allocations (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,                      -- fldrs.id
  product_id TEXT,                           -- Product.id inside that job's products list
  type_id TEXT NOT NULL REFERENCES jig_types(id),
  unit_id TEXT REFERENCES jig_units(id),     -- set once a specific unit is picked
  qty INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'needed' CHECK (status IN ('needed', 'out', 'returned', 'lost')),
  checked_out_by TEXT,
  checked_out_at TEXT,
  checked_in_by TEXT,
  checked_in_at TEXT,
  return_condition TEXT CHECK (return_condition IN ('ok', 'needs_repair', 'lost')),
  notes TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_jig_alloc_job ON jig_allocations(job_id);
CREATE INDEX IF NOT EXISTS idx_jig_alloc_type_status ON jig_allocations(type_id, status);
CREATE INDEX IF NOT EXISTS idx_jig_alloc_unit ON jig_allocations(unit_id);
