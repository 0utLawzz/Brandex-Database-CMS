-- =============================================================================
-- MIGRATION: 202609220003_stage_payment_columns.sql
-- PURPOSE  : Add Stage 1–4 payment placeholder fields to public.trademarks
-- RUN ON   : Supabase → SQL Editor → paste → Run
-- SAFE     : Uses ADD COLUMN IF NOT EXISTS — safe to re-run
-- NOTE     : These are manual/placeholder fields only. Payment verification
--            is NOT automated. No workflow gate is enforced in this migration.
-- =============================================================================

BEGIN;

ALTER TABLE public.trademarks
  ADD COLUMN IF NOT EXISTS stage1_paid        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stage1_paid_date   date,
  ADD COLUMN IF NOT EXISTS stage2_paid        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stage2_paid_date   date,
  ADD COLUMN IF NOT EXISTS stage3_paid        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stage3_paid_date   date,
  ADD COLUMN IF NOT EXISTS stage4_paid        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stage4_paid_date   date,
  ADD COLUMN IF NOT EXISTS payment_reference  text;

-- =============================================================================
-- VERIFICATION QUERIES (run after applying):
--
-- 1. Confirm new columns exist:
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name   = 'trademarks'
--   AND column_name  IN (
--       'stage1_paid','stage1_paid_date',
--       'stage2_paid','stage2_paid_date',
--       'stage3_paid','stage3_paid_date',
--       'stage4_paid','stage4_paid_date',
--       'payment_reference'
--     )
-- ORDER BY column_name;
--
-- 2. Confirm existing rows are unaffected (defaults applied):
-- SELECT id, stage1_paid, stage2_paid, stage3_paid, stage4_paid
-- FROM public.trademarks
-- LIMIT 10;
-- =============================================================================

COMMIT;
