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

-- ============================================================
-- FIELD GUIDE SCHEMA
-- Laser engraving settings reference tool
-- ============================================================

-- Machines (xTool F1 and F1 Lite)
CREATE TABLE IF NOT EXISTS machines (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL
);

-- Insert default machines
INSERT OR IGNORE INTO machines (id, label) VALUES 
  ('f1', 'xTool F1'),
  ('f1_lite', 'xTool F1 Lite');

-- Materials (Leather, Wood, Eco Leather, etc.)
CREATE TABLE IF NOT EXISTS materials (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  photo_url TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Settings (machine + material combination)
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  machine_id TEXT NOT NULL REFERENCES machines(id),
  material_id TEXT NOT NULL REFERENCES materials(id),
  speed TEXT,
  power TEXT,
  frequency TEXT,
  passes INTEGER,
  mode TEXT,
  focus_notes TEXT,
  notes TEXT,
  updated_by TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(machine_id, material_id)
);

-- Products (specific items made from materials, e.g. "Leather Keychain")
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  material_id TEXT NOT NULL REFERENCES materials(id),
  photo_url TEXT,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_settings_machine ON settings(machine_id);
CREATE INDEX IF NOT EXISTS idx_settings_material ON settings(material_id);
CREATE INDEX IF NOT EXISTS idx_products_material ON products(material_id);
