-- =============================================================================
-- MIGRATION: 202609220006_workflow_creation_trigger.sql
-- PURPOSE  : Add AFTER INSERT trigger so newly created trademark records
--            automatically receive an initial workflow history event (STAGE 1 / Filing).
--
-- BACKGROUND:
--   Migration 202609220002 created an AFTER UPDATE trigger that records status
--   changes to trademark_workflow_history.  That trigger fires only on UPDATE,
--   so a brand-new record had zero workflow history until a user manually
--   changed the status.  This migration closes that gap.
--
-- DESIGN:
--   • A separate AFTER INSERT trigger function is added so the two concerns
--     (creation vs. transition) remain clearly separated and independently
--     testable.
--   • The INSERT trigger always writes exactly one row with:
--       event_type   = 'RECORD_CREATED'
--       from_status  = NULL (no prior state)
--       from_sub_status = NULL
--       to_status    = the inserted status  (default 'STAGE 1')
--       to_sub_status = the inserted sub_status (default 'Filing')
--       changed_by   = the inserting user (auth.uid())
--   • event_at defaults to now() inside trademark_workflow_history, which
--     matches the record's created_at to sub-second precision.
--
-- SAFETY:
--   • Uses CREATE OR REPLACE FUNCTION — safe to re-run.
--   • Uses DROP TRIGGER IF EXISTS before CREATE TRIGGER — safe to re-run.
--   • Does NOT touch existing rows in trademark_workflow_history.
--   • Does NOT backfill historical records.
--   • Does NOT modify the AFTER UPDATE trigger from migration 202609220002.
-- =============================================================================

BEGIN;

-- ── TRIGGER FUNCTION ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trademarks_workflow_created_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.trademark_workflow_history (
    trademark_id,
    event_type,
    from_status,
    from_sub_status,
    to_status,
    to_sub_status,
    changed_by
  ) VALUES (
    NEW.id,
    'RECORD_CREATED',
    NULL,
    NULL,
    NEW.status,
    NEW.sub_status,
    auth.uid()
  );
  RETURN NEW;
END;
$$;

-- ── TRIGGER ───────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trademarks_workflow_created_trigger ON public.trademarks;

CREATE TRIGGER trademarks_workflow_created_trigger
  AFTER INSERT ON public.trademarks
  FOR EACH ROW
  EXECUTE FUNCTION public.trademarks_workflow_created_trigger();

-- ── VERIFICATION (run after applying) ─────────────────────────────────────────
--
-- 1. Confirm trigger exists:
-- SELECT trigger_name, event_manipulation, action_timing
-- FROM information_schema.triggers
-- WHERE event_object_table = 'trademarks'
--   AND trigger_name = 'trademarks_workflow_created_trigger';
--
-- 2. After inserting a test record, confirm history row:
-- INSERT INTO public.trademarks (type, client_code, case_number, application_name, city)
-- VALUES ('X', 'TEST', 'TEST-001', 'Test App', 'Islamabad');
--
-- SELECT * FROM public.trademark_workflow_history
-- WHERE event_type = 'RECORD_CREATED'
-- ORDER BY event_at DESC LIMIT 5;
--
-- 3. Clean up test record (as admin):
-- DELETE FROM public.trademarks WHERE case_number = 'TEST-001';
-- =============================================================================

COMMIT;
