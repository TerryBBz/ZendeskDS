-- Add tags column to components and trash
ALTER TABLE components ADD COLUMN tags TEXT DEFAULT '[]';
ALTER TABLE trash ADD COLUMN tags TEXT DEFAULT '[]';

-- Component version history table
CREATE TABLE IF NOT EXISTS component_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  component_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  html TEXT NOT NULL,
  tags TEXT DEFAULT '[]',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (component_id) REFERENCES components(id) ON DELETE CASCADE
);

CREATE INDEX idx_versions_component ON component_versions(component_id, created_at DESC);
