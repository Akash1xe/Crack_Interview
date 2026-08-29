CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('snippet','machine_coding','lld')),
  difficulty TEXT NOT NULL,
  estimated_minutes INTEGER NOT NULL DEFAULT 10,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS folder_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES folder_nodes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('folder','file'))
);

CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  folder_node_id UUID REFERENCES folder_nodes(id) ON DELETE SET NULL,
  path TEXT NOT NULL,
  reference_code TEXT NOT NULL,
  language TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  UNIQUE(project_id, path)
);

CREATE INDEX IF NOT EXISTS idx_projects_category ON projects(category);
CREATE INDEX IF NOT EXISTS idx_files_project_order ON files(project_id, order_index);
