CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE,
  overall_accuracy NUMERIC(6,2) NOT NULL,
  completion_pct NUMERIC(6,2) NOT NULL,
  structure_score NUMERIC(6,2) NOT NULL,
  time_used_seconds INTEGER NOT NULL,
  summary_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS file_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  file_id_ref UUID NOT NULL,
  char_accuracy NUMERIC(6,2) NOT NULL,
  correct_path BOOLEAN NOT NULL,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  mistakes_json JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_file_results_report ON file_results(report_id);
