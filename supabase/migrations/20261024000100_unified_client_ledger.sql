-- =====================================================================
-- Brandex Database CMS — Unified Client Ledger Architecture
-- Integrates Client Ledger directly into the primary database.
-- 1 Database, 1 Place, 1 System.
-- =====================================================================

BEGIN;

-- 1. Receipt serial sequence for official Brandex payment receipts
CREATE SEQUENCE IF NOT EXISTS public.client_receipt_seq START 1001;

-- 2. Client ledger entries table
CREATE TABLE IF NOT EXISTS public.client_ledger_entries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trademark_id     uuid NOT NULL REFERENCES public.trademarks(id) ON DELETE CASCADE,
  entry_date       date NOT NULL DEFAULT CURRENT_DATE,
  entry_type       text NOT NULL CHECK (entry_type IN ('charge', 'receiving')),
  stage            text NOT NULL CHECK (stage IN ('S1', 'S2', 'S3', 'S4')),
  amount_due       numeric(14,2) DEFAULT 0 CHECK (amount_due >= 0),
  amount_received  numeric(14,2) DEFAULT 0 CHECK (amount_received >= 0),
  payment_method   text CHECK (payment_method IS NULL OR payment_method IN ('cash', 'bank_transfer', 'cheque', 'online', 'other')),
  bank_name        text,
  cheque_no        text,
  receipt_no       text,
  details          text,
  notes            text,
  voided_at        timestamptz,
  void_reason      text,
  created_by       uuid REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Indexes for lightning-fast queries and ledger reports
CREATE INDEX IF NOT EXISTS idx_client_ledger_tm ON public.client_ledger_entries(trademark_id, stage);
CREATE INDEX IF NOT EXISTS idx_client_ledger_date ON public.client_ledger_entries(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_client_ledger_receipt ON public.client_ledger_entries(receipt_no);
CREATE INDEX IF NOT EXISTS idx_client_ledger_voided ON public.client_ledger_entries(voided_at) WHERE voided_at IS NOT NULL;

-- 3. Update the stage payment guard to permit internal ledger sync
CREATE OR REPLACE FUNCTION public.prevent_unverified_stage_payment_changes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Allow internal database sync from client_ledger_entries trigger
  IF current_setting('brandex.internal_ledger_sync', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF coalesce(auth.jwt() ->> 'role', '') = 'authenticated' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.stage1_paid OR NEW.stage1_paid_date IS NOT NULL
         OR NEW.stage2_paid OR NEW.stage2_paid_date IS NOT NULL
         OR NEW.stage3_paid OR NEW.stage3_paid_date IS NOT NULL
         OR NEW.stage4_paid OR NEW.stage4_paid_date IS NOT NULL THEN
        RAISE EXCEPTION 'Stage payment status must be updated through Brandex Client Ledger entries.';
      END IF;
    ELSIF ROW(
      NEW.stage1_paid, NEW.stage1_paid_date,
      NEW.stage2_paid, NEW.stage2_paid_date,
      NEW.stage3_paid, NEW.stage3_paid_date,
      NEW.stage4_paid, NEW.stage4_paid_date
    ) IS DISTINCT FROM ROW(
      OLD.stage1_paid, OLD.stage1_paid_date,
      OLD.stage2_paid, OLD.stage2_paid_date,
      OLD.stage3_paid, OLD.stage3_paid_date,
      OLD.stage4_paid, OLD.stage4_paid_date
    ) THEN
      RAISE EXCEPTION 'Stage payment status must be updated through Brandex Client Ledger entries.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Function to recalculate and sync stage payments for a trademark
CREATE OR REPLACE FUNCTION public.sync_trademark_from_ledger(p_trademark_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_s1_due numeric := 0; v_s1_rec numeric := 0; v_s1_paid boolean := false; v_s1_date date := null;
  v_s2_due numeric := 0; v_s2_rec numeric := 0; v_s2_paid boolean := false; v_s2_date date := null;
  v_s3_due numeric := 0; v_s3_rec numeric := 0; v_s3_paid boolean := false; v_s3_date date := null;
  v_s4_due numeric := 0; v_s4_rec numeric := 0; v_s4_paid boolean := false; v_s4_date date := null;
  v_last_receipt text := null;
BEGIN
  -- Stage 1
  SELECT COALESCE(SUM(amount_due), 0), COALESCE(SUM(amount_received), 0)
    INTO v_s1_due, v_s1_rec
    FROM public.client_ledger_entries
   WHERE trademark_id = p_trademark_id AND stage = 'S1' AND voided_at IS NULL;
  SELECT entry_date INTO v_s1_date
    FROM public.client_ledger_entries
   WHERE trademark_id = p_trademark_id AND stage = 'S1' AND entry_type = 'receiving' AND amount_received > 0 AND voided_at IS NULL
   ORDER BY entry_date DESC, created_at DESC LIMIT 1;
  v_s1_paid := (v_s1_rec > 0 AND (v_s1_due = 0 OR v_s1_rec >= v_s1_due));

  -- Stage 2
  SELECT COALESCE(SUM(amount_due), 0), COALESCE(SUM(amount_received), 0)
    INTO v_s2_due, v_s2_rec
    FROM public.client_ledger_entries
   WHERE trademark_id = p_trademark_id AND stage = 'S2' AND voided_at IS NULL;
  SELECT entry_date INTO v_s2_date
    FROM public.client_ledger_entries
   WHERE trademark_id = p_trademark_id AND stage = 'S2' AND entry_type = 'receiving' AND amount_received > 0 AND voided_at IS NULL
   ORDER BY entry_date DESC, created_at DESC LIMIT 1;
  v_s2_paid := (v_s2_rec > 0 AND (v_s2_due = 0 OR v_s2_rec >= v_s2_due));

  -- Stage 3
  SELECT COALESCE(SUM(amount_due), 0), COALESCE(SUM(amount_received), 0)
    INTO v_s3_due, v_s3_rec
    FROM public.client_ledger_entries
   WHERE trademark_id = p_trademark_id AND stage = 'S3' AND voided_at IS NULL;
  SELECT entry_date INTO v_s3_date
    FROM public.client_ledger_entries
   WHERE trademark_id = p_trademark_id AND stage = 'S3' AND entry_type = 'receiving' AND amount_received > 0 AND voided_at IS NULL
   ORDER BY entry_date DESC, created_at DESC LIMIT 1;
  v_s3_paid := (v_s3_rec > 0 AND (v_s3_due = 0 OR v_s3_rec >= v_s3_due));

  -- Stage 4
  SELECT COALESCE(SUM(amount_due), 0), COALESCE(SUM(amount_received), 0)
    INTO v_s4_due, v_s4_rec
    FROM public.client_ledger_entries
   WHERE trademark_id = p_trademark_id AND stage = 'S4' AND voided_at IS NULL;
  SELECT entry_date INTO v_s4_date
    FROM public.client_ledger_entries
   WHERE trademark_id = p_trademark_id AND stage = 'S4' AND entry_type = 'receiving' AND amount_received > 0 AND voided_at IS NULL
   ORDER BY entry_date DESC, created_at DESC LIMIT 1;
  v_s4_paid := (v_s4_rec > 0 AND (v_s4_due = 0 OR v_s4_rec >= v_s4_due));

  -- Latest receipt number
  SELECT receipt_no INTO v_last_receipt
    FROM public.client_ledger_entries
   WHERE trademark_id = p_trademark_id AND receipt_no IS NOT NULL AND voided_at IS NULL
   ORDER BY entry_date DESC, created_at DESC LIMIT 1;

  -- Set session setting to allow trigger to update trademarks table
  PERFORM set_config('brandex.internal_ledger_sync', 'true', true);

  UPDATE public.trademarks
     SET stage1_paid = v_s1_paid,
         stage1_paid_date = v_s1_date,
         stage2_paid = v_s2_paid,
         stage2_paid_date = v_s2_date,
         stage3_paid = v_s3_paid,
         stage3_paid_date = v_s3_date,
         stage4_paid = v_s4_paid,
         stage4_paid_date = v_s4_date,
         payment_reference = COALESCE(v_last_receipt, payment_reference)
   WHERE id = p_trademark_id;

  PERFORM set_config('brandex.internal_ledger_sync', 'false', true);
END;
$$;

-- 5. Trigger on client_ledger_entries to automatically sync trademark status
CREATE OR REPLACE FUNCTION public.trigger_sync_trademark_from_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_trademark_from_ledger(OLD.trademark_id);
    RETURN OLD;
  ELSE
    PERFORM public.sync_trademark_from_ledger(NEW.trademark_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_trademark_from_ledger ON public.client_ledger_entries;
CREATE TRIGGER trg_sync_trademark_from_ledger
  AFTER INSERT OR UPDATE OR DELETE ON public.client_ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_sync_trademark_from_ledger();

-- 6. Helper RPC to record a client receipt with automatic sequence generation
CREATE OR REPLACE FUNCTION public.record_client_receipt(
  p_trademark_id   uuid,
  p_stage          text,
  p_amount         numeric,
  p_entry_date     date DEFAULT CURRENT_DATE,
  p_payment_method text DEFAULT 'cash',
  p_bank_name      text DEFAULT NULL,
  p_cheque_no      text DEFAULT NULL,
  p_receipt_no     text DEFAULT NULL,
  p_details        text DEFAULT NULL,
  p_notes          text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rec_no text := p_receipt_no;
  v_entry_id uuid;
  v_user_id uuid := auth.uid();
  v_user_role text;
BEGIN
  -- Verify caller role (Admin only)
  SELECT role INTO v_user_role FROM public.profiles WHERE user_id = v_user_id;
  IF v_user_role IS NULL OR v_user_role <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can record client receipts.';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Receipt amount must be greater than zero.';
  END IF;

  IF p_stage NOT IN ('S1', 'S2', 'S3', 'S4') THEN
    RAISE EXCEPTION 'Invalid stage code: %. Must be S1, S2, S3, or S4.', p_stage;
  END IF;

  -- Generate receipt number if not provided
  IF v_rec_no IS NULL OR length(trim(v_rec_no)) = 0 THEN
    v_rec_no := 'REC-' || to_char(COALESCE(p_entry_date, CURRENT_DATE), 'YYYY') || '-' || lpad(nextval('public.client_receipt_seq')::text, 4, '0');
  END IF;

  INSERT INTO public.client_ledger_entries (
    trademark_id, entry_date, entry_type, stage,
    amount_due, amount_received,
    payment_method, bank_name, cheque_no, receipt_no,
    details, notes, created_by
  ) VALUES (
    p_trademark_id, COALESCE(p_entry_date, CURRENT_DATE), 'receiving', p_stage,
    0, p_amount,
    COALESCE(p_payment_method, 'cash'), p_bank_name, p_cheque_no, v_rec_no,
    p_details, p_notes, v_user_id
  ) RETURNING id INTO v_entry_id;

  RETURN jsonb_build_object(
    'id', v_entry_id,
    'receipt_no', v_rec_no,
    'amount', p_amount,
    'stage', p_stage,
    'entry_date', COALESCE(p_entry_date, CURRENT_DATE)
  );
END;
$$;

-- 7. Helper RPC to soft-void a client receipt with reason
CREATE OR REPLACE FUNCTION public.void_client_receipt(
  p_entry_id   uuid,
  p_reason     text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_role text;
  v_trademark_id uuid;
BEGIN
  SELECT role INTO v_user_role FROM public.profiles WHERE user_id = v_user_id;
  IF v_user_role IS NULL OR v_user_role <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can void client receipts.';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'A specific void reason is required (at least 3 characters).';
  END IF;

  SELECT trademark_id INTO v_trademark_id FROM public.client_ledger_entries WHERE id = p_entry_id;
  IF v_trademark_id IS NULL THEN
    RAISE EXCEPTION 'Ledger entry not found.';
  END IF;

  UPDATE public.client_ledger_entries
     SET voided_at = now(),
         void_reason = trim(p_reason),
         updated_at = now()
   WHERE id = p_entry_id;

  RETURN jsonb_build_object(
    'id', p_entry_id,
    'status', 'voided',
    'voided_at', now()
  );
END;
$$;

-- 8. Enable Row Level Security (RLS)
ALTER TABLE public.client_ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY client_ledger_select ON public.client_ledger_entries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE profiles.user_id = auth.uid()
         AND profiles.role IN ('admin', 'viewer')
    )
  );

CREATE POLICY client_ledger_insert ON public.client_ledger_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE profiles.user_id = auth.uid()
         AND profiles.role = 'admin'
    )
  );

CREATE POLICY client_ledger_update ON public.client_ledger_entries
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE profiles.user_id = auth.uid()
         AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE profiles.user_id = auth.uid()
         AND profiles.role = 'admin'
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.client_ledger_entries TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.client_receipt_seq TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_client_receipt TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_client_receipt TO authenticated;

COMMIT;
