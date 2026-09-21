-- =============================================================================
-- MIGRATION: 202609220001_fix_match_engine_security_and_logic.sql
-- PURPOSE : Enforce role checks in Match Engine RPCs and prevent destructive resets
-- RUN ON  : Supabase → SQL Editor → paste → Run
-- Run AFTER 202609200001_match_engine_publication.sql
-- SAFE    : Uses CREATE OR REPLACE — safe to re-run
-- =============================================================================

BEGIN;

-- 1. Fix run_journal_match: Enforce editor/admin role authorization
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
  -- Security check: Require editor or admin role
  IF public.current_brandex_role() NOT IN ('editor', 'admin') THEN
    RAISE EXCEPTION 'Access denied: editor or admin role required';
  END IF;

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
    REGEXP_REPLACE(t.tm_cpr_number, '[^0-9]', '', 'g') = jr.application_no_norm
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

-- 2. Fix run_form_match: Enforce role check and preserve existing non-matched flags
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
  -- Security check: Require editor or admin role
  IF public.current_brandex_role() NOT IN ('editor', 'admin') THEN
    RAISE EXCEPTION 'Access denied: editor or admin role required';
  END IF;

  -- Match and set TM5 (preserves existing true values on unmatched records)
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

GRANT EXECUTE ON FUNCTION public.run_journal_match() TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_form_match() TO authenticated;

COMMIT;
