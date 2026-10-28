-- Consolidate the Ledger data model into the CMS Supabase project.
-- Replaces the prior unapplied draft migration, which assumed UUID CMS trademark IDs.
BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.ledger_receipt_seq START WITH 1001;

CREATE TABLE public.ledger_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  prefix text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ledger_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid REFERENCES public.ledger_series(id) ON DELETE RESTRICT,
  client_code text NOT NULL UNIQUE,
  client_name text,
  city text,
  header_balance numeric(14,2) NOT NULL DEFAULT 0,
  bank_name text,
  bank_account text,
  bank_iban text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  email text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ledger_client_stage_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.ledger_clients(id) ON DELETE RESTRICT,
  stage text NOT NULL CHECK (stage IN ('S1','S2','S3','S4')),
  amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'PKR',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, stage)
);

CREATE TABLE public.ledger_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.ledger_clients(id) ON DELETE RESTRICT,
  tm_no text,
  tm_no_normalized text,
  folder_no text,
  case_ref text,
  application_name text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','stopped')),
  notes text,
  cms_trademark_id text REFERENCES public.trademarks(id) ON DELETE SET NULL,
  reconciliation_status text NOT NULL DEFAULT 'unmatched'
    CHECK (reconciliation_status IN ('unmatched','pending_review','ownership_conflict','approved_link')),
  source_created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (tm_no_normalized IS NULL OR tm_no_normalized = NULLIF(regexp_replace(coalesce(tm_no,''), '[^0-9]', '', 'g'), ''))
);

CREATE UNIQUE INDEX ledger_cases_tm_normalized_unique
  ON public.ledger_cases(tm_no_normalized) WHERE tm_no_normalized IS NOT NULL;
CREATE UNIQUE INDEX ledger_cases_cms_trademark_unique
  ON public.ledger_cases(cms_trademark_id) WHERE cms_trademark_id IS NOT NULL;

CREATE TABLE public.ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.ledger_clients(id) ON DELETE RESTRICT,
  case_id uuid REFERENCES public.ledger_cases(id) ON DELETE RESTRICT,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  entry_type text NOT NULL CHECK (entry_type IN ('charge','receiving')),
  stage text CHECK (stage IS NULL OR stage IN ('S1','S2','S3','S4')),
  details text,
  amount_due numeric(14,2) CHECK (amount_due IS NULL OR amount_due >= 0),
  amount_received numeric(14,2) CHECK (amount_received IS NULL OR amount_received >= 0),
  running_balance numeric(14,2),
  payment_method text,
  bank_name text,
  cheque_no text,
  receipt_no text,
  notes text,
  voided_at timestamptz,
  void_reason text,
  linked_entry_id uuid REFERENCES public.ledger_entries(id) ON DELETE RESTRICT,
  request_id uuid UNIQUE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source_created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.sync_ledger_receipt_sequence()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $
DECLARE
  v_max_suffix bigint;
BEGIN
  SELECT max((regexp_match(receipt_no, '([0-9]+)
CREATE INDEX ledger_clients_series_idx ON public.ledger_clients(series_id) WHERE series_id IS NOT NULL;
CREATE INDEX ledger_cases_client_idx ON public.ledger_cases(client_id);
CREATE INDEX ledger_entries_case_stage_idx ON public.ledger_entries(case_id, stage);
CREATE INDEX ledger_entries_active_idx ON public.ledger_entries(case_id, stage) WHERE voided_at IS NULL;
CREATE INDEX ledger_entries_linked_entry_idx ON public.ledger_entries(linked_entry_id) WHERE linked_entry_id IS NOT NULL;
CREATE INDEX ledger_entries_created_by_idx ON public.ledger_entries(created_by) WHERE created_by IS NOT NULL;
CREATE UNIQUE INDEX ledger_entries_receipt_no_unique
  ON public.ledger_entries(receipt_no) WHERE receipt_no IS NOT NULL;

CREATE TABLE public.ledger_case_link_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ledger_case_id uuid NOT NULL REFERENCES public.ledger_cases(id) ON DELETE RESTRICT,
  cms_trademark_id text NOT NULL REFERENCES public.trademarks(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('linked')),
  reason text NOT NULL CHECK (length(trim(reason)) >= 3),
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ledger_case_link_audit_case_idx ON public.ledger_case_link_audit(ledger_case_id);
CREATE INDEX ledger_case_link_audit_trademark_idx ON public.ledger_case_link_audit(cms_trademark_id);

CREATE OR REPLACE FUNCTION public.guard_ledger_case_link_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_setting('brandex.internal_case_link', true) IS DISTINCT FROM 'true' THEN
    IF TG_OP = 'INSERT' AND NEW.cms_trademark_id IS NOT NULL THEN
      RAISE EXCEPTION 'Use the audited ledger case link operation.';
    ELSIF TG_OP = 'UPDATE' AND NEW.cms_trademark_id IS DISTINCT FROM OLD.cms_trademark_id THEN
      -- Allow FK ON DELETE SET NULL to detach history when a CMS trademark is deleted.
      IF NEW.cms_trademark_id IS NULL AND pg_trigger_depth() > 1 THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'Use the audited ledger case link operation.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER ledger_cases_guard_link
  BEFORE INSERT OR UPDATE ON public.ledger_cases
  FOR EACH ROW EXECUTE FUNCTION public.guard_ledger_case_link_change();

CREATE OR REPLACE FUNCTION public.prevent_unverified_stage_payment_changes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_setting('brandex.internal_ledger_sync', true) = 'true'
     OR current_user NOT IN ('anon','authenticated') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.stage1_paid OR NEW.stage1_paid_date IS NOT NULL
       OR NEW.stage2_paid OR NEW.stage2_paid_date IS NOT NULL
       OR NEW.stage3_paid OR NEW.stage3_paid_date IS NOT NULL
       OR NEW.stage4_paid OR NEW.stage4_paid_date IS NOT NULL THEN
      RAISE EXCEPTION 'Stage payment status must come from ledger entries.';
    END IF;
  ELSIF ROW(NEW.stage1_paid, NEW.stage1_paid_date, NEW.stage2_paid, NEW.stage2_paid_date,
            NEW.stage3_paid, NEW.stage3_paid_date, NEW.stage4_paid, NEW.stage4_paid_date)
        IS DISTINCT FROM
        ROW(OLD.stage1_paid, OLD.stage1_paid_date, OLD.stage2_paid, OLD.stage2_paid_date,
            OLD.stage3_paid, OLD.stage3_paid_date, OLD.stage4_paid, OLD.stage4_paid_date) THEN
    RAISE EXCEPTION 'Stage payment status must come from ledger entries.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS prevent_unverified_stage_payment_changes ON public.trademarks;
CREATE TRIGGER prevent_unverified_stage_payment_changes
  BEFORE INSERT OR UPDATE ON public.trademarks
  FOR EACH ROW EXECUTE FUNCTION public.prevent_unverified_stage_payment_changes();

CREATE OR REPLACE FUNCTION public.sync_trademark_from_ledger(p_trademark_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_due numeric;
  v_received numeric;
  v_paid boolean;
  v_paid_date date;
  v_stage text;
  v_stage_num integer;
  v_prior_setting text := current_setting('brandex.internal_ledger_sync', true);
BEGIN
  PERFORM 1 FROM public.trademarks WHERE id=p_trademark_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  FOR v_stage IN SELECT unnest(ARRAY['S1','S2','S3','S4']) LOOP
    SELECT coalesce(sum(amount_due) FILTER (WHERE entry_type='charge'),0),
           coalesce(sum(amount_received) FILTER (WHERE entry_type='receiving'),0),
           max(entry_date) FILTER (WHERE entry_type='receiving' AND coalesce(amount_received,0)>0)
      INTO v_due, v_received, v_paid_date
      FROM public.ledger_entries e
      JOIN public.ledger_cases c ON c.id=e.case_id
     WHERE c.cms_trademark_id=p_trademark_id
       AND e.stage=v_stage
       AND e.voided_at IS NULL;
    v_paid := v_due > 0 AND v_received >= v_due;
    v_stage_num := substring(v_stage from 2)::integer;
    PERFORM set_config('brandex.internal_ledger_sync','true',true);
    EXECUTE format('UPDATE public.trademarks SET stage%s_paid=$1, stage%s_paid_date=$2 WHERE id=$3',
                   v_stage_num, v_stage_num)
      USING v_paid, CASE WHEN v_paid THEN v_paid_date ELSE NULL END, p_trademark_id;
    PERFORM set_config('brandex.internal_ledger_sync',coalesce(v_prior_setting,'false'),true);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_trademark_for_ledger_entry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_tm_id text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    SELECT cms_trademark_id INTO v_tm_id FROM public.ledger_cases WHERE id=OLD.case_id;
    IF v_tm_id IS NOT NULL THEN PERFORM public.sync_trademark_from_ledger(v_tm_id); END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    SELECT cms_trademark_id INTO v_tm_id FROM public.ledger_cases WHERE id=NEW.case_id;
    IF v_tm_id IS NOT NULL THEN PERFORM public.sync_trademark_from_ledger(v_tm_id); END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
CREATE TRIGGER ledger_entries_sync_trademark
  AFTER INSERT OR UPDATE OR DELETE ON public.ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.sync_trademark_for_ledger_entry();

CREATE OR REPLACE FUNCTION public.sync_trademark_for_ledger_case_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.cms_trademark_id IS NOT NULL THEN PERFORM public.sync_trademark_from_ledger(OLD.cms_trademark_id); END IF;
  IF NEW.cms_trademark_id IS NOT NULL THEN PERFORM public.sync_trademark_from_ledger(NEW.cms_trademark_id); END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER ledger_cases_sync_trademark
  AFTER UPDATE OF cms_trademark_id ON public.ledger_cases
  FOR EACH ROW EXECUTE FUNCTION public.sync_trademark_for_ledger_case_link();

CREATE OR REPLACE FUNCTION public.link_ledger_case_to_trademark(
  p_ledger_case_id uuid, p_trademark_id text, p_reason text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text := public.current_brandex_role()::text;
  v_tm_normalized text;
  v_old_setting text := current_setting('brandex.internal_case_link', true);
BEGIN
  IF v_role <> 'admin' THEN RAISE EXCEPTION 'Only administrators can link ledger cases.'; END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN RAISE EXCEPTION 'An audit reason is required.'; END IF;
  SELECT tm_cpr_number_norm INTO v_tm_normalized FROM public.trademarks WHERE id=p_trademark_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'CMS trademark not found.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ledger_cases WHERE id=p_ledger_case_id) THEN RAISE EXCEPTION 'Ledger case not found.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ledger_cases WHERE id=p_ledger_case_id AND tm_no_normalized=v_tm_normalized) THEN
    RAISE EXCEPTION 'The normalized TM number does not match.';
  END IF;
  PERFORM set_config('brandex.internal_case_link','true',true);
  UPDATE public.ledger_cases SET cms_trademark_id=p_trademark_id, reconciliation_status='approved_link', updated_at=now()
   WHERE id=p_ledger_case_id AND cms_trademark_id IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ledger case is already linked; use an audited transfer process.'; END IF;
  PERFORM set_config('brandex.internal_case_link',coalesce(v_old_setting,'false'),true);
  INSERT INTO public.ledger_case_link_audit(ledger_case_id,cms_trademark_id,action,reason,changed_by)
  VALUES (p_ledger_case_id,p_trademark_id,'linked',trim(p_reason),v_user_id);
END;
$$;

CREATE OR REPLACE VIEW public.client_ledger_entries WITH (security_invoker = true) AS
SELECT e.id, c.cms_trademark_id AS trademark_id, e.entry_date, e.entry_type, e.stage,
       e.amount_due, e.amount_received, e.payment_method,
       e.bank_name, e.cheque_no,
       e.receipt_no, e.details, e.notes, e.voided_at, e.void_reason,
       e.created_by, e.created_at, e.updated_at
  FROM public.ledger_entries e
  JOIN public.ledger_cases c ON c.id=e.case_id
 WHERE c.cms_trademark_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.record_ledger_receiving(
  p_client_id uuid, p_case_id uuid, p_entry_date date, p_stage text,
  p_amount numeric, p_payment_method text, p_details text,
  p_notes text, p_linked_entry_id uuid, p_request_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_receipt_no text;
  v_entry_id uuid;
  v_row public.ledger_entries%ROWTYPE;
BEGIN
  IF public.current_brandex_role()::text <> 'admin' THEN RAISE EXCEPTION 'Only administrators can record client receipts.'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Receipt amount must be greater than zero.'; END IF;
  IF p_stage IS NOT NULL AND p_stage NOT IN ('S1','S2','S3','S4') THEN RAISE EXCEPTION 'Invalid stage.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ledger_clients WHERE id=p_client_id AND is_active) THEN RAISE EXCEPTION 'Active client not found.'; END IF;
  IF p_case_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.ledger_cases WHERE id=p_case_id AND client_id=p_client_id) THEN RAISE EXCEPTION 'Case does not belong to this client.'; END IF;
  IF p_linked_entry_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.ledger_entries
     WHERE id=p_linked_entry_id AND client_id=p_client_id AND entry_type='charge' AND voided_at IS NULL
  ) THEN RAISE EXCEPTION 'Linked charge is not active or does not belong to this client.'; END IF;
  IF p_request_id IS NOT NULL THEN
    SELECT * INTO v_row FROM public.ledger_entries WHERE request_id=p_request_id;
    IF FOUND THEN
      IF v_row.entry_type <> 'receiving' OR v_row.client_id IS DISTINCT FROM p_client_id
         OR v_row.case_id IS DISTINCT FROM p_case_id OR v_row.stage IS DISTINCT FROM p_stage
         OR v_row.amount_received IS DISTINCT FROM p_amount
         OR v_row.entry_date IS DISTINCT FROM coalesce(p_entry_date,current_date) THEN
        RAISE EXCEPTION 'Idempotency key was already used for a different receipt.';
      END IF;
      RETURN jsonb_build_object('id',v_row.id,'receipt_no',v_row.receipt_no,'amount',v_row.amount_received,'stage',v_row.stage,'entry_date',v_row.entry_date);
    END IF;
  END IF;
  v_receipt_no := 'REC-' || to_char(coalesce(p_entry_date,current_date),'YYYY') || '-' || lpad(nextval('public.ledger_receipt_seq')::text,4,'0');
  INSERT INTO public.ledger_entries(client_id,case_id,entry_date,entry_type,stage,amount_due,amount_received,payment_method,details,notes,linked_entry_id,receipt_no,request_id,created_by)
  VALUES(p_client_id,p_case_id,coalesce(p_entry_date,current_date),'receiving',p_stage,0,p_amount,p_payment_method,p_details,p_notes,p_linked_entry_id,v_receipt_no,p_request_id,v_user_id)
  ON CONFLICT (request_id) DO NOTHING
  RETURNING id INTO v_entry_id;
  IF v_entry_id IS NULL THEN
    SELECT * INTO v_row FROM public.ledger_entries WHERE request_id=p_request_id;
    IF v_row.entry_type <> 'receiving' OR v_row.client_id IS DISTINCT FROM p_client_id
       OR v_row.case_id IS DISTINCT FROM p_case_id OR v_row.stage IS DISTINCT FROM p_stage
       OR v_row.amount_received IS DISTINCT FROM p_amount
       OR v_row.entry_date IS DISTINCT FROM coalesce(p_entry_date,current_date) THEN
      RAISE EXCEPTION 'Idempotency key was already used for a different receipt.';
    END IF;
    RETURN jsonb_build_object('id',v_row.id,'receipt_no',v_row.receipt_no,'amount',v_row.amount_received,'stage',v_row.stage,'entry_date',v_row.entry_date);
  END IF;
  RETURN jsonb_build_object('id',v_entry_id,'receipt_no',v_receipt_no,'amount',p_amount,'stage',p_stage,'entry_date',coalesce(p_entry_date,current_date));
END;
$$;

CREATE OR REPLACE FUNCTION public.record_client_receipt(
  p_trademark_id text, p_stage text, p_amount numeric,
  p_entry_date date DEFAULT CURRENT_DATE, p_payment_method text DEFAULT 'cash',
  p_bank_name text DEFAULT NULL, p_cheque_no text DEFAULT NULL,
  p_receipt_no text DEFAULT NULL, p_details text DEFAULT NULL, p_notes text DEFAULT NULL,
  p_request_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_case public.ledger_cases%ROWTYPE;
  v_entry_id uuid;
  v_receipt_no text;
  v_existing public.ledger_entries%ROWTYPE;
  v_entry_date date := coalesce(p_entry_date,current_date);
BEGIN
  IF public.current_brandex_role()::text <> 'admin' THEN RAISE EXCEPTION 'Only administrators can record client receipts.'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Receipt amount must be greater than zero.'; END IF;
  IF p_stage NOT IN ('S1','S2','S3','S4') THEN RAISE EXCEPTION 'Invalid stage.'; END IF;
  IF p_request_id IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.ledger_entries WHERE request_id=p_request_id;
    IF FOUND THEN
      IF v_existing.entry_type <> 'receiving' OR v_existing.stage IS DISTINCT FROM p_stage
         OR v_existing.amount_received IS DISTINCT FROM p_amount OR v_existing.entry_date IS DISTINCT FROM v_entry_date
         OR NOT EXISTS (SELECT 1 FROM public.ledger_cases c WHERE c.id=v_existing.case_id AND c.cms_trademark_id=p_trademark_id) THEN
        RAISE EXCEPTION 'Idempotency key was already used for a different receipt.';
      END IF;
      RETURN jsonb_build_object('id',v_existing.id,'receipt_no',v_existing.receipt_no,'amount',v_existing.amount_received,'stage',v_existing.stage,'entry_date',v_existing.entry_date);
    END IF;
  END IF;
  SELECT * INTO v_case FROM public.ledger_cases WHERE cms_trademark_id=p_trademark_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No approved ledger case is linked to this CMS trademark.'; END IF;
  v_receipt_no := 'REC-' || to_char(v_entry_date,'YYYY') || '-' || lpad(nextval('public.ledger_receipt_seq')::text,4,'0');
  INSERT INTO public.ledger_entries(client_id,case_id,entry_date,entry_type,stage,amount_due,amount_received,payment_method,bank_name,cheque_no,receipt_no,details,notes,request_id,created_by)
  VALUES(v_case.client_id,v_case.id,v_entry_date,'receiving',p_stage,0,p_amount,p_payment_method,p_bank_name,p_cheque_no,v_receipt_no,p_details,p_notes,p_request_id,v_user_id)
  ON CONFLICT (request_id) DO NOTHING
  RETURNING id INTO v_entry_id;
  IF v_entry_id IS NULL THEN
    SELECT * INTO v_existing FROM public.ledger_entries WHERE request_id=p_request_id;
    IF v_existing.entry_type <> 'receiving' OR v_existing.stage IS DISTINCT FROM p_stage
       OR v_existing.amount_received IS DISTINCT FROM p_amount OR v_existing.entry_date IS DISTINCT FROM v_entry_date
       OR NOT EXISTS (SELECT 1 FROM public.ledger_cases c WHERE c.id=v_existing.case_id AND c.cms_trademark_id=p_trademark_id) THEN
      RAISE EXCEPTION 'Idempotency key was already used for a different receipt.';
    END IF;
    RETURN jsonb_build_object('id',v_existing.id,'receipt_no',v_existing.receipt_no,'amount',v_existing.amount_received,'stage',v_existing.stage,'entry_date',v_existing.entry_date);
  END IF;
  RETURN jsonb_build_object('id',v_entry_id,'receipt_no',v_receipt_no,'amount',p_amount,'stage',p_stage,'entry_date',v_entry_date);
END;
$$;

CREATE OR REPLACE FUNCTION public.void_client_receipt(p_entry_id uuid,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user_id uuid := auth.uid(); v_receipt public.ledger_entries%ROWTYPE;
BEGIN
  IF public.current_brandex_role()::text <> 'admin' THEN RAISE EXCEPTION 'Only administrators can void client receipts.'; END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN RAISE EXCEPTION 'A specific void reason is required.'; END IF;
  SELECT * INTO v_receipt FROM public.ledger_entries WHERE id=p_entry_id AND entry_type='receiving' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Receipt entry not found.'; END IF;
  IF v_receipt.voided_at IS NOT NULL THEN RAISE EXCEPTION 'Receipt is already voided.'; END IF;
  UPDATE public.ledger_entries SET voided_at=now(),void_reason=trim(p_reason),updated_at=now() WHERE id=p_entry_id;
  RETURN jsonb_build_object('id',p_entry_id,'status','voided','voided_at',now());
END;
$$;

ALTER TABLE public.ledger_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_client_stage_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_case_link_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY ledger_series_read ON public.ledger_series FOR SELECT TO authenticated
  USING ((select public.current_brandex_role())::text IN ('admin','viewer'));
CREATE POLICY ledger_series_admin ON public.ledger_series FOR ALL TO authenticated
  USING (public.current_brandex_role()::text='admin') WITH CHECK ((select public.current_brandex_role())::text='admin');
CREATE POLICY ledger_clients_read ON public.ledger_clients FOR SELECT TO authenticated
  USING (public.current_brandex_role()::text IN ('admin','viewer'));
CREATE POLICY ledger_clients_admin ON public.ledger_clients FOR ALL TO authenticated
  USING (public.current_brandex_role()::text='admin') WITH CHECK (public.current_brandex_role()::text='admin');
CREATE POLICY ledger_rates_read ON public.ledger_client_stage_rates FOR SELECT TO authenticated
  USING (public.current_brandex_role()::text IN ('admin','viewer'));
CREATE POLICY ledger_rates_admin ON public.ledger_client_stage_rates FOR ALL TO authenticated
  USING (public.current_brandex_role()::text='admin') WITH CHECK (public.current_brandex_role()::text='admin');
CREATE POLICY ledger_cases_read ON public.ledger_cases FOR SELECT TO authenticated
  USING (public.current_brandex_role()::text IN ('admin','viewer'));
CREATE POLICY ledger_cases_admin ON public.ledger_cases FOR ALL TO authenticated
  USING (public.current_brandex_role()::text='admin') WITH CHECK (public.current_brandex_role()::text='admin');
CREATE POLICY ledger_entries_read ON public.ledger_entries FOR SELECT TO authenticated
  USING (public.current_brandex_role()::text IN ('admin','viewer'));
CREATE POLICY ledger_entries_admin ON public.ledger_entries FOR ALL TO authenticated
  USING (public.current_brandex_role()::text='admin') WITH CHECK (public.current_brandex_role()::text='admin');
CREATE POLICY ledger_link_audit_read ON public.ledger_case_link_audit FOR SELECT TO authenticated
  USING (public.current_brandex_role()::text IN ('admin','viewer'));

GRANT SELECT, INSERT, UPDATE ON public.ledger_series, public.ledger_clients,
  public.ledger_client_stage_rates, public.ledger_cases, public.ledger_entries TO authenticated;
GRANT ALL ON public.ledger_series, public.ledger_clients, public.ledger_client_stage_rates,
  public.ledger_cases, public.ledger_entries, public.ledger_case_link_audit TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.ledger_receipt_seq TO service_role;
GRANT SELECT ON public.ledger_case_link_audit, public.client_ledger_entries TO authenticated;
REVOKE ALL ON FUNCTION public.sync_trademark_from_ledger(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_ledger_receipt_sequence() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_ledger_case_to_trademark(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_client_receipt(text,text,numeric,date,text,text,text,text,text,text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_ledger_receiving(uuid,uuid,date,text,numeric,text,text,text,uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.void_client_receipt(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_ledger_receipt_sequence() TO service_role;
GRANT EXECUTE ON FUNCTION public.link_ledger_case_to_trademark(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_client_receipt(text,text,numeric,date,text,text,text,text,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_ledger_receiving(uuid,uuid,date,text,numeric,text,text,text,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_client_receipt(uuid,text) TO authenticated;

COMMIT;
))[1]::bigint)
    INTO v_max_suffix
    FROM public.ledger_entries
   WHERE receipt_no IS NOT NULL;
  v_max_suffix := greatest(coalesce(v_max_suffix, 1000), 1000);
  PERFORM setval('public.ledger_receipt_seq', v_max_suffix, true);
  RETURN v_max_suffix;
END;
$;

CREATE INDEX ledger_entries_client_date_idx ON public.ledger_entries(client_id, entry_date DESC, created_at DESC);
CREATE INDEX ledger_clients_series_idx ON public.ledger_clients(series_id) WHERE series_id IS NOT NULL;
CREATE INDEX ledger_cases_client_idx ON public.ledger_cases(client_id);
CREATE INDEX ledger_entries_case_stage_idx ON public.ledger_entries(case_id, stage);
CREATE INDEX ledger_entries_active_idx ON public.ledger_entries(case_id, stage) WHERE voided_at IS NULL;
CREATE INDEX ledger_entries_linked_entry_idx ON public.ledger_entries(linked_entry_id) WHERE linked_entry_id IS NOT NULL;
CREATE INDEX ledger_entries_created_by_idx ON public.ledger_entries(created_by) WHERE created_by IS NOT NULL;
CREATE UNIQUE INDEX ledger_entries_receipt_no_unique
  ON public.ledger_entries(receipt_no) WHERE receipt_no IS NOT NULL;

CREATE TABLE public.ledger_case_link_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ledger_case_id uuid NOT NULL REFERENCES public.ledger_cases(id) ON DELETE RESTRICT,
  cms_trademark_id text NOT NULL REFERENCES public.trademarks(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('linked')),
  reason text NOT NULL CHECK (length(trim(reason)) >= 3),
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ledger_case_link_audit_case_idx ON public.ledger_case_link_audit(ledger_case_id);
CREATE INDEX ledger_case_link_audit_trademark_idx ON public.ledger_case_link_audit(cms_trademark_id);

CREATE OR REPLACE FUNCTION public.guard_ledger_case_link_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_setting('brandex.internal_case_link', true) IS DISTINCT FROM 'true' THEN
    IF TG_OP = 'INSERT' AND NEW.cms_trademark_id IS NOT NULL THEN
      RAISE EXCEPTION 'Use the audited ledger case link operation.';
    ELSIF TG_OP = 'UPDATE' AND NEW.cms_trademark_id IS DISTINCT FROM OLD.cms_trademark_id THEN
      -- Allow FK ON DELETE SET NULL to detach history when a CMS trademark is deleted.
      IF NEW.cms_trademark_id IS NULL AND pg_trigger_depth() > 1 THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'Use the audited ledger case link operation.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER ledger_cases_guard_link
  BEFORE INSERT OR UPDATE ON public.ledger_cases
  FOR EACH ROW EXECUTE FUNCTION public.guard_ledger_case_link_change();

CREATE OR REPLACE FUNCTION public.prevent_unverified_stage_payment_changes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_setting('brandex.internal_ledger_sync', true) = 'true'
     OR current_user NOT IN ('anon','authenticated') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.stage1_paid OR NEW.stage1_paid_date IS NOT NULL
       OR NEW.stage2_paid OR NEW.stage2_paid_date IS NOT NULL
       OR NEW.stage3_paid OR NEW.stage3_paid_date IS NOT NULL
       OR NEW.stage4_paid OR NEW.stage4_paid_date IS NOT NULL THEN
      RAISE EXCEPTION 'Stage payment status must come from ledger entries.';
    END IF;
  ELSIF ROW(NEW.stage1_paid, NEW.stage1_paid_date, NEW.stage2_paid, NEW.stage2_paid_date,
            NEW.stage3_paid, NEW.stage3_paid_date, NEW.stage4_paid, NEW.stage4_paid_date)
        IS DISTINCT FROM
        ROW(OLD.stage1_paid, OLD.stage1_paid_date, OLD.stage2_paid, OLD.stage2_paid_date,
            OLD.stage3_paid, OLD.stage3_paid_date, OLD.stage4_paid, OLD.stage4_paid_date) THEN
    RAISE EXCEPTION 'Stage payment status must come from ledger entries.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS prevent_unverified_stage_payment_changes ON public.trademarks;
CREATE TRIGGER prevent_unverified_stage_payment_changes
  BEFORE INSERT OR UPDATE ON public.trademarks
  FOR EACH ROW EXECUTE FUNCTION public.prevent_unverified_stage_payment_changes();

CREATE OR REPLACE FUNCTION public.sync_trademark_from_ledger(p_trademark_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_due numeric;
  v_received numeric;
  v_paid boolean;
  v_paid_date date;
  v_stage text;
  v_stage_num integer;
  v_prior_setting text := current_setting('brandex.internal_ledger_sync', true);
BEGIN
  PERFORM 1 FROM public.trademarks WHERE id=p_trademark_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  FOR v_stage IN SELECT unnest(ARRAY['S1','S2','S3','S4']) LOOP
    SELECT coalesce(sum(amount_due) FILTER (WHERE entry_type='charge'),0),
           coalesce(sum(amount_received) FILTER (WHERE entry_type='receiving'),0),
           max(entry_date) FILTER (WHERE entry_type='receiving' AND coalesce(amount_received,0)>0)
      INTO v_due, v_received, v_paid_date
      FROM public.ledger_entries e
      JOIN public.ledger_cases c ON c.id=e.case_id
     WHERE c.cms_trademark_id=p_trademark_id
       AND e.stage=v_stage
       AND e.voided_at IS NULL;
    v_paid := v_due > 0 AND v_received >= v_due;
    v_stage_num := substring(v_stage from 2)::integer;
    PERFORM set_config('brandex.internal_ledger_sync','true',true);
    EXECUTE format('UPDATE public.trademarks SET stage%s_paid=$1, stage%s_paid_date=$2 WHERE id=$3',
                   v_stage_num, v_stage_num)
      USING v_paid, CASE WHEN v_paid THEN v_paid_date ELSE NULL END, p_trademark_id;
    PERFORM set_config('brandex.internal_ledger_sync',coalesce(v_prior_setting,'false'),true);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_trademark_for_ledger_entry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_tm_id text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    SELECT cms_trademark_id INTO v_tm_id FROM public.ledger_cases WHERE id=OLD.case_id;
    IF v_tm_id IS NOT NULL THEN PERFORM public.sync_trademark_from_ledger(v_tm_id); END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    SELECT cms_trademark_id INTO v_tm_id FROM public.ledger_cases WHERE id=NEW.case_id;
    IF v_tm_id IS NOT NULL THEN PERFORM public.sync_trademark_from_ledger(v_tm_id); END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
CREATE TRIGGER ledger_entries_sync_trademark
  AFTER INSERT OR UPDATE OR DELETE ON public.ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.sync_trademark_for_ledger_entry();

CREATE OR REPLACE FUNCTION public.sync_trademark_for_ledger_case_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.cms_trademark_id IS NOT NULL THEN PERFORM public.sync_trademark_from_ledger(OLD.cms_trademark_id); END IF;
  IF NEW.cms_trademark_id IS NOT NULL THEN PERFORM public.sync_trademark_from_ledger(NEW.cms_trademark_id); END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER ledger_cases_sync_trademark
  AFTER UPDATE OF cms_trademark_id ON public.ledger_cases
  FOR EACH ROW EXECUTE FUNCTION public.sync_trademark_for_ledger_case_link();

CREATE OR REPLACE FUNCTION public.link_ledger_case_to_trademark(
  p_ledger_case_id uuid, p_trademark_id text, p_reason text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text := public.current_brandex_role()::text;
  v_tm_normalized text;
  v_old_setting text := current_setting('brandex.internal_case_link', true);
BEGIN
  IF v_role <> 'admin' THEN RAISE EXCEPTION 'Only administrators can link ledger cases.'; END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN RAISE EXCEPTION 'An audit reason is required.'; END IF;
  SELECT tm_cpr_number_norm INTO v_tm_normalized FROM public.trademarks WHERE id=p_trademark_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'CMS trademark not found.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ledger_cases WHERE id=p_ledger_case_id) THEN RAISE EXCEPTION 'Ledger case not found.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ledger_cases WHERE id=p_ledger_case_id AND tm_no_normalized=v_tm_normalized) THEN
    RAISE EXCEPTION 'The normalized TM number does not match.';
  END IF;
  PERFORM set_config('brandex.internal_case_link','true',true);
  UPDATE public.ledger_cases SET cms_trademark_id=p_trademark_id, reconciliation_status='approved_link', updated_at=now()
   WHERE id=p_ledger_case_id AND cms_trademark_id IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ledger case is already linked; use an audited transfer process.'; END IF;
  PERFORM set_config('brandex.internal_case_link',coalesce(v_old_setting,'false'),true);
  INSERT INTO public.ledger_case_link_audit(ledger_case_id,cms_trademark_id,action,reason,changed_by)
  VALUES (p_ledger_case_id,p_trademark_id,'linked',trim(p_reason),v_user_id);
END;
$$;

CREATE OR REPLACE VIEW public.client_ledger_entries WITH (security_invoker = true) AS
SELECT e.id, c.cms_trademark_id AS trademark_id, e.entry_date, e.entry_type, e.stage,
       e.amount_due, e.amount_received, e.payment_method,
       e.bank_name, e.cheque_no,
       e.receipt_no, e.details, e.notes, e.voided_at, e.void_reason,
       e.created_by, e.created_at, e.updated_at
  FROM public.ledger_entries e
  JOIN public.ledger_cases c ON c.id=e.case_id
 WHERE c.cms_trademark_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.record_ledger_receiving(
  p_client_id uuid, p_case_id uuid, p_entry_date date, p_stage text,
  p_amount numeric, p_payment_method text, p_details text,
  p_notes text, p_linked_entry_id uuid, p_request_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_receipt_no text;
  v_entry_id uuid;
  v_row public.ledger_entries%ROWTYPE;
BEGIN
  IF public.current_brandex_role()::text <> 'admin' THEN RAISE EXCEPTION 'Only administrators can record client receipts.'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Receipt amount must be greater than zero.'; END IF;
  IF p_stage IS NOT NULL AND p_stage NOT IN ('S1','S2','S3','S4') THEN RAISE EXCEPTION 'Invalid stage.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ledger_clients WHERE id=p_client_id AND is_active) THEN RAISE EXCEPTION 'Active client not found.'; END IF;
  IF p_case_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.ledger_cases WHERE id=p_case_id AND client_id=p_client_id) THEN RAISE EXCEPTION 'Case does not belong to this client.'; END IF;
  IF p_linked_entry_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.ledger_entries
     WHERE id=p_linked_entry_id AND client_id=p_client_id AND entry_type='charge' AND voided_at IS NULL
  ) THEN RAISE EXCEPTION 'Linked charge is not active or does not belong to this client.'; END IF;
  IF p_request_id IS NOT NULL THEN
    SELECT * INTO v_row FROM public.ledger_entries WHERE request_id=p_request_id;
    IF FOUND THEN
      IF v_row.entry_type <> 'receiving' OR v_row.client_id IS DISTINCT FROM p_client_id
         OR v_row.case_id IS DISTINCT FROM p_case_id OR v_row.stage IS DISTINCT FROM p_stage
         OR v_row.amount_received IS DISTINCT FROM p_amount
         OR v_row.entry_date IS DISTINCT FROM coalesce(p_entry_date,current_date) THEN
        RAISE EXCEPTION 'Idempotency key was already used for a different receipt.';
      END IF;
      RETURN jsonb_build_object('id',v_row.id,'receipt_no',v_row.receipt_no,'amount',v_row.amount_received,'stage',v_row.stage,'entry_date',v_row.entry_date);
    END IF;
  END IF;
  v_receipt_no := 'REC-' || to_char(coalesce(p_entry_date,current_date),'YYYY') || '-' || lpad(nextval('public.ledger_receipt_seq')::text,4,'0');
  INSERT INTO public.ledger_entries(client_id,case_id,entry_date,entry_type,stage,amount_due,amount_received,payment_method,details,notes,linked_entry_id,receipt_no,request_id,created_by)
  VALUES(p_client_id,p_case_id,coalesce(p_entry_date,current_date),'receiving',p_stage,0,p_amount,p_payment_method,p_details,p_notes,p_linked_entry_id,v_receipt_no,p_request_id,v_user_id)
  ON CONFLICT (request_id) DO NOTHING
  RETURNING id INTO v_entry_id;
  IF v_entry_id IS NULL THEN
    SELECT * INTO v_row FROM public.ledger_entries WHERE request_id=p_request_id;
    IF v_row.entry_type <> 'receiving' OR v_row.client_id IS DISTINCT FROM p_client_id
       OR v_row.case_id IS DISTINCT FROM p_case_id OR v_row.stage IS DISTINCT FROM p_stage
       OR v_row.amount_received IS DISTINCT FROM p_amount
       OR v_row.entry_date IS DISTINCT FROM coalesce(p_entry_date,current_date) THEN
      RAISE EXCEPTION 'Idempotency key was already used for a different receipt.';
    END IF;
    RETURN jsonb_build_object('id',v_row.id,'receipt_no',v_row.receipt_no,'amount',v_row.amount_received,'stage',v_row.stage,'entry_date',v_row.entry_date);
  END IF;
  RETURN jsonb_build_object('id',v_entry_id,'receipt_no',v_receipt_no,'amount',p_amount,'stage',p_stage,'entry_date',coalesce(p_entry_date,current_date));
END;
$$;

CREATE OR REPLACE FUNCTION public.record_client_receipt(
  p_trademark_id text, p_stage text, p_amount numeric,
  p_entry_date date DEFAULT CURRENT_DATE, p_payment_method text DEFAULT 'cash',
  p_bank_name text DEFAULT NULL, p_cheque_no text DEFAULT NULL,
  p_receipt_no text DEFAULT NULL, p_details text DEFAULT NULL, p_notes text DEFAULT NULL,
  p_request_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_case public.ledger_cases%ROWTYPE;
  v_entry_id uuid;
  v_receipt_no text;
  v_existing public.ledger_entries%ROWTYPE;
  v_entry_date date := coalesce(p_entry_date,current_date);
BEGIN
  IF public.current_brandex_role()::text <> 'admin' THEN RAISE EXCEPTION 'Only administrators can record client receipts.'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Receipt amount must be greater than zero.'; END IF;
  IF p_stage NOT IN ('S1','S2','S3','S4') THEN RAISE EXCEPTION 'Invalid stage.'; END IF;
  IF p_request_id IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.ledger_entries WHERE request_id=p_request_id;
    IF FOUND THEN
      IF v_existing.entry_type <> 'receiving' OR v_existing.stage IS DISTINCT FROM p_stage
         OR v_existing.amount_received IS DISTINCT FROM p_amount OR v_existing.entry_date IS DISTINCT FROM v_entry_date
         OR NOT EXISTS (SELECT 1 FROM public.ledger_cases c WHERE c.id=v_existing.case_id AND c.cms_trademark_id=p_trademark_id) THEN
        RAISE EXCEPTION 'Idempotency key was already used for a different receipt.';
      END IF;
      RETURN jsonb_build_object('id',v_existing.id,'receipt_no',v_existing.receipt_no,'amount',v_existing.amount_received,'stage',v_existing.stage,'entry_date',v_existing.entry_date);
    END IF;
  END IF;
  SELECT * INTO v_case FROM public.ledger_cases WHERE cms_trademark_id=p_trademark_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No approved ledger case is linked to this CMS trademark.'; END IF;
  v_receipt_no := 'REC-' || to_char(v_entry_date,'YYYY') || '-' || lpad(nextval('public.ledger_receipt_seq')::text,4,'0');
  INSERT INTO public.ledger_entries(client_id,case_id,entry_date,entry_type,stage,amount_due,amount_received,payment_method,bank_name,cheque_no,receipt_no,details,notes,request_id,created_by)
  VALUES(v_case.client_id,v_case.id,v_entry_date,'receiving',p_stage,0,p_amount,p_payment_method,p_bank_name,p_cheque_no,v_receipt_no,p_details,p_notes,p_request_id,v_user_id)
  ON CONFLICT (request_id) DO NOTHING
  RETURNING id INTO v_entry_id;
  IF v_entry_id IS NULL THEN
    SELECT * INTO v_existing FROM public.ledger_entries WHERE request_id=p_request_id;
    IF v_existing.entry_type <> 'receiving' OR v_existing.stage IS DISTINCT FROM p_stage
       OR v_existing.amount_received IS DISTINCT FROM p_amount OR v_existing.entry_date IS DISTINCT FROM v_entry_date
       OR NOT EXISTS (SELECT 1 FROM public.ledger_cases c WHERE c.id=v_existing.case_id AND c.cms_trademark_id=p_trademark_id) THEN
      RAISE EXCEPTION 'Idempotency key was already used for a different receipt.';
    END IF;
    RETURN jsonb_build_object('id',v_existing.id,'receipt_no',v_existing.receipt_no,'amount',v_existing.amount_received,'stage',v_existing.stage,'entry_date',v_existing.entry_date);
  END IF;
  RETURN jsonb_build_object('id',v_entry_id,'receipt_no',v_receipt_no,'amount',p_amount,'stage',p_stage,'entry_date',v_entry_date);
END;
$$;

CREATE OR REPLACE FUNCTION public.void_client_receipt(p_entry_id uuid,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user_id uuid := auth.uid(); v_receipt public.ledger_entries%ROWTYPE;
BEGIN
  IF public.current_brandex_role()::text <> 'admin' THEN RAISE EXCEPTION 'Only administrators can void client receipts.'; END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN RAISE EXCEPTION 'A specific void reason is required.'; END IF;
  SELECT * INTO v_receipt FROM public.ledger_entries WHERE id=p_entry_id AND entry_type='receiving' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Receipt entry not found.'; END IF;
  IF v_receipt.voided_at IS NOT NULL THEN RAISE EXCEPTION 'Receipt is already voided.'; END IF;
  UPDATE public.ledger_entries SET voided_at=now(),void_reason=trim(p_reason),updated_at=now() WHERE id=p_entry_id;
  RETURN jsonb_build_object('id',p_entry_id,'status','voided','voided_at',now());
END;
$$;

ALTER TABLE public.ledger_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_client_stage_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_case_link_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY ledger_series_read ON public.ledger_series FOR SELECT TO authenticated
  USING ((select public.current_brandex_role())::text IN ('admin','viewer'));
CREATE POLICY ledger_series_admin ON public.ledger_series FOR ALL TO authenticated
  USING (public.current_brandex_role()::text='admin') WITH CHECK ((select public.current_brandex_role())::text='admin');
CREATE POLICY ledger_clients_read ON public.ledger_clients FOR SELECT TO authenticated
  USING (public.current_brandex_role()::text IN ('admin','viewer'));
CREATE POLICY ledger_clients_admin ON public.ledger_clients FOR ALL TO authenticated
  USING (public.current_brandex_role()::text='admin') WITH CHECK (public.current_brandex_role()::text='admin');
CREATE POLICY ledger_rates_read ON public.ledger_client_stage_rates FOR SELECT TO authenticated
  USING (public.current_brandex_role()::text IN ('admin','viewer'));
CREATE POLICY ledger_rates_admin ON public.ledger_client_stage_rates FOR ALL TO authenticated
  USING (public.current_brandex_role()::text='admin') WITH CHECK (public.current_brandex_role()::text='admin');
CREATE POLICY ledger_cases_read ON public.ledger_cases FOR SELECT TO authenticated
  USING (public.current_brandex_role()::text IN ('admin','viewer'));
CREATE POLICY ledger_cases_admin ON public.ledger_cases FOR ALL TO authenticated
  USING (public.current_brandex_role()::text='admin') WITH CHECK (public.current_brandex_role()::text='admin');
CREATE POLICY ledger_entries_read ON public.ledger_entries FOR SELECT TO authenticated
  USING (public.current_brandex_role()::text IN ('admin','viewer'));
CREATE POLICY ledger_entries_admin ON public.ledger_entries FOR ALL TO authenticated
  USING (public.current_brandex_role()::text='admin') WITH CHECK (public.current_brandex_role()::text='admin');
CREATE POLICY ledger_link_audit_read ON public.ledger_case_link_audit FOR SELECT TO authenticated
  USING (public.current_brandex_role()::text IN ('admin','viewer'));

GRANT SELECT, INSERT, UPDATE ON public.ledger_series, public.ledger_clients,
  public.ledger_client_stage_rates, public.ledger_cases, public.ledger_entries TO authenticated;
GRANT ALL ON public.ledger_series, public.ledger_clients, public.ledger_client_stage_rates,
  public.ledger_cases, public.ledger_entries, public.ledger_case_link_audit TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.ledger_receipt_seq TO service_role;
GRANT SELECT ON public.ledger_case_link_audit, public.client_ledger_entries TO authenticated;
REVOKE ALL ON FUNCTION public.sync_trademark_from_ledger(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_ledger_case_to_trademark(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_client_receipt(text,text,numeric,date,text,text,text,text,text,text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_ledger_receiving(uuid,uuid,date,text,numeric,text,text,text,uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.void_client_receipt(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_ledger_case_to_trademark(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_client_receipt(text,text,numeric,date,text,text,text,text,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_ledger_receiving(uuid,uuid,date,text,numeric,text,text,text,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_client_receipt(uuid,text) TO authenticated;

COMMIT;
