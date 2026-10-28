-- Consolidated CMS Supabase Ledger is the sole payment source of truth.
-- This migration is intentionally not applied by this PR; apply only after isolated
-- preview-database verification and explicit release approval.

-- A CMS trademark can have at most one approved Ledger-case link.
CREATE UNIQUE INDEX IF NOT EXISTS ledger_cases_one_approved_link_per_trademark
  ON public.ledger_cases (cms_trademark_id)
  WHERE reconciliation_status = 'approved_link'
    AND cms_trademark_id IS NOT NULL;

-- Resolve payment truth from active Ledger charges and receipts, never cached
-- trademarks.stage*_paid flags. This helper is called by the trigger function below.
CREATE OR REPLACE FUNCTION public.cms_stage_payment_cleared(
  p_trademark_id text,
  p_stage text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_case_id uuid;
  v_link_count integer;
  v_due numeric;
  v_received numeric;
BEGIN
  IF p_stage NOT IN ('S1', 'S2', 'S3', 'S4') THEN
    RETURN false;
  END IF;

  SELECT count(*), (array_agg(id))[1]
    INTO v_link_count, v_case_id
    FROM public.ledger_cases
   WHERE cms_trademark_id = p_trademark_id
     AND reconciliation_status = 'approved_link';

  IF v_link_count <> 1 OR v_case_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT
    coalesce(sum(amount_due) FILTER (WHERE entry_type = 'charge'), 0),
    coalesce(sum(amount_received) FILTER (WHERE entry_type = 'receiving'), 0)
    INTO v_due, v_received
    FROM public.ledger_entries
   WHERE case_id = v_case_id
     AND stage = p_stage
     AND voided_at IS NULL;

  RETURN v_due > 0 AND v_received >= v_due;
END;
$function$;

REVOKE ALL ON FUNCTION public.cms_stage_payment_cleared(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cms_stage_payment_cleared(text, text) FROM anon, authenticated;

-- Trigger functions cannot be called directly as ordinary SQL functions. SECURITY
-- DEFINER lets this trigger safely read authoritative Ledger rows despite RLS.
CREATE OR REPLACE FUNCTION public.enforce_case_workflow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  changed boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Existing server-side historical importer may preserve historical workflow values.
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
      NEW.sub_status := coalesce(NEW.sub_status, 'Filing');
      IF NEW.status <> 'STAGE 1' OR NEW.sub_status <> 'Filing' THEN
        RAISE EXCEPTION 'New cases must start at Stage 1 / Filing';
      END IF;
      IF nullif(trim(NEW.agent), '') IS NOT NULL OR NEW.assigned_agent_id IS NOT NULL THEN
        RAISE EXCEPTION 'Assign agents in Stage 2 / Assigned';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  changed := NEW.status IS DISTINCT FROM OLD.status
    OR NEW.sub_status IS DISTINCT FROM OLD.sub_status;

  IF changed AND NOT public.workflow_transition_valid(
    OLD.status, OLD.sub_status, NEW.status, NEW.sub_status
  ) THEN
    RAISE EXCEPTION 'Invalid workflow transition: % / % -> % / %',
      OLD.status, OLD.sub_status, NEW.status, NEW.sub_status;
  END IF;

  -- Fail closed unless the previous stage is fully paid in the consolidated Ledger.
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'STOPPED' THEN
    IF NEW.status IN ('STAGE 2', 'STAGE 3', 'STAGE 4')
       AND NOT public.cms_stage_payment_cleared(NEW.id, 'S1') THEN
      RAISE EXCEPTION 'Stage 1 payment must be cleared in the Ledger before progression';
    END IF;
    IF NEW.status IN ('STAGE 3', 'STAGE 4')
       AND NOT public.cms_stage_payment_cleared(NEW.id, 'S2') THEN
      RAISE EXCEPTION 'Stage 2 payment must be cleared in the Ledger before progression';
    END IF;
    IF NEW.status = 'STAGE 4'
       AND NOT public.cms_stage_payment_cleared(NEW.id, 'S3') THEN
      RAISE EXCEPTION 'Stage 3 payment must be cleared in the Ledger before progression';
    END IF;
  END IF;

  IF NEW.status = 'STOPPED' AND OLD.status <> 'STOPPED' THEN
    IF nullif(trim(NEW.stopped_reason), '') IS NULL THEN
      RAISE EXCEPTION 'STOPPED requires a reason';
    END IF;
    NEW.sub_status := NULL;
    NEW.stopped_at := now();
    NEW.notes := concat_ws(E'\\n\\n', nullif(NEW.notes, ''),
      'STOPPED: ' || trim(NEW.stopped_reason) || ' (' || NEW.stopped_at::text || ')');
  ELSIF OLD.status = 'STOPPED' THEN
    IF NEW.stopped_reason IS DISTINCT FROM OLD.stopped_reason
       OR NEW.stopped_at IS DISTINCT FROM OLD.stopped_at
       OR NEW.notes IS DISTINCT FROM OLD.notes THEN
      RAISE EXCEPTION 'STOPPED reason and notes are preserved';
    END IF;
  END IF;

  IF NEW.agent IS DISTINCT FROM OLD.agent
     OR NEW.assigned_agent_id IS DISTINCT FROM OLD.assigned_agent_id
     OR NEW.agent_rate IS DISTINCT FROM OLD.agent_rate THEN
    IF OLD.status <> 'STAGE 2' OR OLD.sub_status <> 'Assigned' THEN
      RAISE EXCEPTION 'Assign agents and rates in Stage 2 / Assigned';
    END IF;
    IF NEW.assigned_agent_id IS NOT NULL THEN
      SELECT upper(name) INTO NEW.agent
        FROM public.agents
       WHERE id = NEW.assigned_agent_id AND is_active;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Choose an active agent';
      END IF;
    ELSIF nullif(trim(NEW.agent), '') IS NOT NULL THEN
      RAISE EXCEPTION 'Choose an agent profile, not a free-text name';
    END IF;
  END IF;

  IF changed AND NEW.status = 'STAGE 2' AND NEW.sub_status = 'Accepted' THEN
    IF NEW.assigned_agent_id IS NULL OR NEW.agent_rate IS NULL THEN
      RAISE EXCEPTION 'Set an assigned agent and agreed rate before Accepted';
    END IF;
  END IF;

  IF changed AND NEW.status = 'STAGE 3' AND NEW.sub_status = 'Published' THEN
    NEW.publication_date := coalesce(NEW.publication_date, current_date);
    NEW.opposition_deadline := (NEW.publication_date + interval '2 months')::date;
  END IF;

  IF changed AND NEW.status = 'STAGE 3' AND NEW.sub_status = 'D-Note Received' THEN
    NEW.demand_note_received := true;
    NEW.demand_note_date := coalesce(NEW.demand_note_date, current_date);
  END IF;

  IF changed AND NEW.status = 'STAGE 3' AND NEW.sub_status = 'D-Note Submitted' THEN
    NEW.demand_note_submitted_date := current_date;
    NEW.certificate_due_date := current_date + 25;
  ELSE
    NEW.demand_note_submitted_date := OLD.demand_note_submitted_date;
    NEW.certificate_due_date := OLD.certificate_due_date;
  END IF;

  IF changed AND NEW.status = 'STAGE 4' AND NEW.sub_status = 'CER Acknowledge' THEN
    NEW.certificate_acknowledged_date := current_date;
  ELSE
    NEW.certificate_acknowledged_date := OLD.certificate_acknowledged_date;
  END IF;

  RETURN NEW;
END;
$function$;

-- Workflow receipts must use exactly one approved link. This protects the RPC
-- itself; UI checks alone are not an authorization boundary.
CREATE OR REPLACE FUNCTION public.record_client_receipt(
  p_trademark_id text,
  p_stage text,
  p_amount numeric,
  p_entry_date date DEFAULT CURRENT_DATE,
  p_payment_method text DEFAULT 'cash',
  p_bank_name text DEFAULT NULL,
  p_cheque_no text DEFAULT NULL,
  p_receipt_no text DEFAULT NULL,
  p_details text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_request_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_case public.ledger_cases%ROWTYPE;
  v_case_count integer;
  v_entry_id uuid;
  v_receipt_no text;
  v_existing public.ledger_entries%ROWTYPE;
  v_entry_date date := coalesce(p_entry_date, current_date);
BEGIN
  IF public.current_brandex_role()::text <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can record client receipts.';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Receipt amount must be greater than zero.';
  END IF;
  IF p_stage NOT IN ('S1', 'S2', 'S3', 'S4') THEN
    RAISE EXCEPTION 'Invalid stage.';
  END IF;

  SELECT count(*) INTO v_case_count
    FROM public.ledger_cases
   WHERE cms_trademark_id = p_trademark_id
     AND reconciliation_status = 'approved_link';
  IF v_case_count <> 1 THEN
    RAISE EXCEPTION 'No single approved Ledger case is linked to this CMS trademark.';
  END IF;

  SELECT * INTO v_case
    FROM public.ledger_cases
   WHERE cms_trademark_id = p_trademark_id
     AND reconciliation_status = 'approved_link'
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No single approved Ledger case is linked to this CMS trademark.';
  END IF;

  IF p_request_id IS NOT NULL THEN
    SELECT * INTO v_existing
      FROM public.ledger_entries
     WHERE request_id = p_request_id;
    IF FOUND THEN
      IF v_existing.entry_type <> 'receiving'
         OR v_existing.stage IS DISTINCT FROM p_stage
         OR v_existing.amount_received IS DISTINCT FROM p_amount
         OR v_existing.entry_date IS DISTINCT FROM v_entry_date
         OR v_existing.case_id IS DISTINCT FROM v_case.id THEN
        RAISE EXCEPTION 'Idempotency key was already used for a different receipt.';
      END IF;
      RETURN jsonb_build_object(
        'id', v_existing.id, 'receipt_no', v_existing.receipt_no,
        'amount', v_existing.amount_received, 'stage', v_existing.stage,
        'entry_date', v_existing.entry_date
      );
    END IF;
  END IF;

  v_receipt_no := 'REC-' || to_char(v_entry_date, 'YYYY') || '-'
    || lpad(nextval('public.ledger_receipt_seq')::text, 4, '0');

  INSERT INTO public.ledger_entries(
    client_id, case_id, entry_date, entry_type, stage,
    amount_due, amount_received, payment_method, bank_name, cheque_no,
    receipt_no, details, notes, request_id, created_by
  )
  VALUES (
    v_case.client_id, v_case.id, v_entry_date, 'receiving', p_stage,
    0, p_amount, p_payment_method, p_bank_name, p_cheque_no,
    v_receipt_no, p_details, p_notes, p_request_id, v_user_id
  )
  ON CONFLICT (request_id) DO NOTHING
  RETURNING id INTO v_entry_id;

  IF v_entry_id IS NULL THEN
    SELECT * INTO v_existing
      FROM public.ledger_entries
     WHERE request_id = p_request_id;
    IF v_existing.entry_type <> 'receiving'
       OR v_existing.stage IS DISTINCT FROM p_stage
       OR v_existing.amount_received IS DISTINCT FROM p_amount
       OR v_existing.entry_date IS DISTINCT FROM v_entry_date
       OR v_existing.case_id IS DISTINCT FROM v_case.id THEN
      RAISE EXCEPTION 'Idempotency key was already used for a different receipt.';
    END IF;
    RETURN jsonb_build_object(
      'id', v_existing.id, 'receipt_no', v_existing.receipt_no,
      'amount', v_existing.amount_received, 'stage', v_existing.stage,
      'entry_date', v_existing.entry_date
    );
  END IF;

  RETURN jsonb_build_object(
    'id', v_entry_id, 'receipt_no', v_receipt_no,
    'amount', p_amount, 'stage', p_stage, 'entry_date', v_entry_date
  );
END;
$function$;
