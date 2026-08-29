CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  project_id UUID NOT NULL,
  category TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  time_limit_seconds INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('in_progress','submitted','expired')) DEFAULT 'in_progress',
  reference_snapshot JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS session_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  file_id_ref UUID NOT NULL,
  typed_code TEXT NOT NULL DEFAULT '',
  typed_path TEXT NOT NULL DEFAULT '',
  submitted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_session_files_session ON session_files(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_started ON sessions(user_id, started_at DESC);
