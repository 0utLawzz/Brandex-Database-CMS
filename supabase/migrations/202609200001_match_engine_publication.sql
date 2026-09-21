-- =============================================================================
-- MIGRATION: 202609200001_match_engine_publication.sql
-- PURPOSE : Match Engine + Publication Workflow fields
-- RUN ON  : Supabase → SQL Editor → paste → Run
-- Run AFTER 202609120001_form_journal_registry.sql
-- SAFE    : Uses IF NOT EXISTS / CREATE OR REPLACE — safe to re-run
-- =============================================================================

BEGIN;

-- =============================================================================
-- PART 1: ADD PUBLICATION WORKFLOW FIELDS TO TRADEMARKS TABLE
-- Tracks publication → opposition window → demand note workflow
-- =============================================================================

ALTER TABLE public.trademarks
  ADD COLUMN IF NOT EXISTS publication_date DATE,
  ADD COLUMN IF NOT EXISTS opposition_deadline DATE,
  ADD COLUMN IF NOT EXISTS demand_note_received BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS demand_note_date DATE;

-- =============================================================================
-- PART 2: CREATE INDEX FOR PUBLICATION PIPELINE QUERIES
-- =============================================================================

CREATE INDEX IF NOT EXISTS trademarks_publication_date_idx
  ON public.trademarks (publication_date) WHERE publication_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS trademarks_opposition_deadline_idx
  ON public.trademarks (opposition_deadline) WHERE opposition_deadline IS NOT NULL;

-- =============================================================================
-- PART 3: MATCH ENGINE RPC FUNCTIONS
-- These functions will be called from the frontend to match registry data
-- =============================================================================

-- Function to match journal_registry to trademarks by TM number
CREATE OR REPLACE FUNCTION public.run_journal_match()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matched_count INTEGER := 0;
  result JSONB;
BEGIN
  -- Update trademarks with journal data from journal_registry
  UPDATE public.trademarks t
  SET
    journal_number = jr.journal_no,
    journal_date = jr.journal_date,
    publication_date = jr.journal_date,
    opposition_deadline = jr.journal_date + INTERVAL '2 months',
    journal_data = jsonb_build_object(
      'found', true,
      'Application No', jr.application_no,
      'Journal No', jr.journal_no,
      'Journal Date', jr.journal_date,
      'Class', jr.nice_class,
      'Applicant Name and Address', jr.applicant,
      'Agent Name and Address', jr.agent,
      'Date of Filing', jr.date_of_filing,
      'Generated Doc', jr.generated_doc
    )
  FROM public.journal_registry jr
  WHERE
    -- Match by normalized TM number
    REGEXP_REPLACE(t.tm_cpr_number, '[^0-9]', '', 'g') = jr.application_no_norm
    -- Only update if journal data is newer or missing
    AND (t.journal_date IS NULL OR jr.journal_date > t.journal_date);

  GET DIAGNOSTICS matched_count = ROW_COUNT;

  result := jsonb_build_object(
    'status', 'success',
    'matched_trademarks', matched_count,
    'message', 'Journal match completed successfully',
    'ran_at', now()
  );

  RETURN result;
END;
$$;

-- Function to match form_registry to trademarks by TM number
CREATE OR REPLACE FUNCTION public.run_form_match()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matched_count INTEGER := 0;
  tm5_count INTEGER := 0;
  tm6_count INTEGER := 0;
  tm11_count INTEGER := 0;
  tm16_count INTEGER := 0;
  tm56_count INTEGER := 0;
  result JSONB;
BEGIN
  -- Reset all TM form flags to false
  UPDATE public.trademarks
  SET tm5 = false, tm6 = false, tm11 = false, tm16 = false, tm56 = false;

  -- Match and set TM5
  UPDATE public.trademarks t
  SET tm5 = true
  FROM public.form_registry fr
  WHERE
    REGEXP_REPLACE(t.tm_cpr_number, '[^0-9]', '', 'g') = fr.tm_number_norm
    AND fr.form_type = 'tm5';
  GET DIAGNOSTICS tm5_count = ROW_COUNT;

  -- Match and set TM6
  UPDATE public.trademarks t
  SET tm6 = true
  FROM public.form_registry fr
  WHERE
    REGEXP_REPLACE(t.tm_cpr_number, '[^0-9]', '', 'g') = fr.tm_number_norm
    AND fr.form_type = 'tm6';
  GET DIAGNOSTICS tm6_count = ROW_COUNT;

  -- Match and set TM11
  UPDATE public.trademarks t
  SET tm11 = true
  FROM public.form_registry fr
  WHERE
    REGEXP_REPLACE(t.tm_cpr_number, '[^0-9]', '', 'g') = fr.tm_number_norm
    AND fr.form_type = 'tm11';
  GET DIAGNOSTICS tm11_count = ROW_COUNT;

  -- Match and set TM16
  UPDATE public.trademarks t
  SET tm16 = true
  FROM public.form_registry fr
  WHERE
    REGEXP_REPLACE(t.tm_cpr_number, '[^0-9]', '', 'g') = fr.tm_number_norm
    AND fr.form_type = 'tm16';
  GET DIAGNOSTICS tm16_count = ROW_COUNT;

  -- Match and set TM56
  UPDATE public.trademarks t
  SET tm56 = true
  FROM public.form_registry fr
  WHERE
    REGEXP_REPLACE(t.tm_cpr_number, '[^0-9]', '', 'g') = fr.tm_number_norm
    AND fr.form_type = 'tm56';
  GET DIAGNOSTICS tm56_count = ROW_COUNT;

  matched_count := tm5_count + tm6_count + tm11_count + tm16_count + tm56_count;

  result := jsonb_build_object(
    'status', 'success',
    'total', matched_count,
    'tm5', tm5_count,
    'tm6', tm6_count,
    'tm11', tm11_count,
    'tm16', tm16_count,
    'tm56', tm56_count,
    'message', 'Form match completed successfully'
  );

  RETURN result;
END;
$$;

-- =============================================================================
-- PART 4: GRANT EXECUTE PERMISSIONS ON RPC FUNCTIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.run_journal_match() TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_form_match() TO authenticated;

COMMIT;

-- =============================================================================
-- HOW TO VERIFY after running:
--
-- 1. New columns exist?
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'trademarks' AND column_name IN ('publication_date', 'opposition_deadline', 'demand_note_received', 'demand_note_date');
--
-- 2. Functions exist?
-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_schema = 'public' AND routine_name IN ('run_journal_match', 'run_form_match');
--
-- 3. Test journal match (run from SQL Editor):
-- SELECT public.run_journal_match();
--
-- 4. Test form match (run from SQL Editor):
-- SELECT public.run_form_match();
-- =============================================================================
