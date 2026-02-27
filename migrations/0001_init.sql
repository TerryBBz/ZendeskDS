-- Components table
CREATE TABLE IF NOT EXISTS components (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'other',
  html TEXT NOT NULL,
  favorite INTEGER DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER
);

-- Templates table
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  blocks TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER,
  updated_at INTEGER
);

-- Trash table
CREATE TABLE IF NOT EXISTS trash (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'other',
  html TEXT NOT NULL,
  favorite INTEGER DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER,
  deleted_at INTEGER NOT NULL
);

-- Folders table
CREATE TABLE IF NOT EXISTS folders (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  icon TEXT DEFAULT '📁',
  color TEXT DEFAULT '#b2bec3'
);

-- Seed default folders
INSERT INTO folders (key, label, icon, color) VALUES
  ('header',  'En-tête',      '📌', '#0984e3'),
  ('content', 'Contenu',      '📝', '#6c5ce7'),
  ('callout', 'Callout',      '💡', '#fdcb6e'),
  ('list',    'Liste',        '📋', '#00cec9'),
  ('footer',  'Pied de page', '📎', '#636e72'),
  ('other',   'Autre',        '🔧', '#b2bec3');
