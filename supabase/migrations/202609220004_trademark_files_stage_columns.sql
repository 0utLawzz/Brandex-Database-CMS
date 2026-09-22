-- =============================================================================
-- MIGRATION: 202609220004_trademark_files_stage_columns.sql
-- PURPOSE  : Add stage/sub_stage/title columns to public.trademark_files for
--            stage-wise document uploads (Batch 9)
-- RUN ON   : Supabase → SQL Editor → paste → Run
-- SAFE     : Uses ADD COLUMN IF NOT EXISTS — safe to re-run
-- NOTE     : Additive only. No existing columns altered. No NOT NULL constraints.
--            No data backfill. No new storage bucket. No RLS policy changes.
--            No file_category enum changes. No new tables.
-- =============================================================================

BEGIN;

ALTER TABLE public.trademark_files
  ADD COLUMN IF NOT EXISTS stage     text,
  ADD COLUMN IF NOT EXISTS sub_stage text,
  ADD COLUMN IF NOT EXISTS title     text;

-- Index for efficient per-trademark, per-stage document listing ordered by upload time
CREATE INDEX IF NOT EXISTS trademark_files_stage_idx
  ON public.trademark_files (trademark_id, stage, created_at DESC);

-- =============================================================================
-- VERIFICATION QUERIES (run after applying):
--
-- 1. Confirm new columns exist:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name   = 'trademark_files'
--   AND column_name  IN ('stage', 'sub_stage', 'title')
-- ORDER BY column_name;
--
-- 2. Confirm index was created:
-- SELECT indexname FROM pg_indexes
-- WHERE tablename = 'trademark_files'
--   AND indexname = 'trademark_files_stage_idx';
--
-- 3. Confirm existing rows are unaffected (new columns are NULL by default):
-- SELECT id, stage, sub_stage, title FROM public.trademark_files LIMIT 10;
-- =============================================================================

COMMIT;
