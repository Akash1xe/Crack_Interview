ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS lld_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  reference_code TEXT NOT NULL,
  pattern_tag TEXT NOT NULL DEFAULT 'none',
  order_index INTEGER NOT NULL DEFAULT 0,
  UNIQUE(project_id, name)
);

CREATE INDEX IF NOT EXISTS idx_lld_classes_project_order
  ON lld_classes(project_id, order_index);
