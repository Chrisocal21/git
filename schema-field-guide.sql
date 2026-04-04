-- Field Guide Schema Only
-- Run with: npx wrangler d1 execute foldr-db --remote --file=./schema-field-guide.sql

-- Machines (xTool F1 and F1 Lite)
CREATE TABLE IF NOT EXISTS fg_machines (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL
);

-- Materials (Leather, Wood, Eco Leather, etc.)
CREATE TABLE IF NOT EXISTS fg_materials (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  product_name TEXT,
  product_sku TEXT,
  photo_url TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Settings (machine + material combination)
CREATE TABLE IF NOT EXISTS fg_settings (
  id TEXT PRIMARY KEY,
  machine_id TEXT NOT NULL,
  material_id TEXT NOT NULL,
  speed TEXT,
  power TEXT,
  frequency TEXT,
  passes INTEGER,
  mode TEXT,
  focus_notes TEXT,
  dimensions TEXT,
  notes TEXT,
  updated_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Products (specific items made from materials, e.g. "Leather Keychain")
CREATE TABLE IF NOT EXISTS fg_products (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  material_id TEXT NOT NULL,
  photo_url TEXT,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Insert default machines
INSERT OR IGNORE INTO fg_machines (id, label) VALUES 
  ('f1', 'xTool F1');
