ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS recall BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS recall_preview_seconds INTEGER NOT NULL DEFAULT 10;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'recall_preview_seconds_range'
  ) THEN
    ALTER TABLE sessions
      ADD CONSTRAINT recall_preview_seconds_range
      CHECK (recall_preview_seconds BETWEEN 5 AND 60);
  END IF;
END $$;
