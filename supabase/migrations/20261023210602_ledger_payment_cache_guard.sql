-- Stage payment fields are a mirror of the separately hosted Brandex Client Ledger.
-- Only the trusted CMS Edge Function (service_role) may refresh this cache.
BEGIN;

CREATE OR REPLACE FUNCTION public.prevent_unverified_stage_payment_changes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF coalesce(auth.jwt() ->> 'role', '') = 'authenticated' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.stage1_paid OR NEW.stage1_paid_date IS NOT NULL
         OR NEW.stage2_paid OR NEW.stage2_paid_date IS NOT NULL
         OR NEW.stage3_paid OR NEW.stage3_paid_date IS NOT NULL
         OR NEW.stage4_paid OR NEW.stage4_paid_date IS NOT NULL THEN
        RAISE EXCEPTION 'Stage payment status is managed by Brandex Client Ledger';
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
      RAISE EXCEPTION 'Stage payment status is managed by Brandex Client Ledger';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_unverified_stage_payment_changes ON public.trademarks;
CREATE TRIGGER prevent_unverified_stage_payment_changes
  BEFORE INSERT OR UPDATE OF stage1_paid, stage1_paid_date,
                             stage2_paid, stage2_paid_date,
                             stage3_paid, stage3_paid_date,
                             stage4_paid, stage4_paid_date
  ON public.trademarks
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_unverified_stage_payment_changes();

REVOKE ALL ON FUNCTION public.prevent_unverified_stage_payment_changes() FROM PUBLIC, anon, authenticated;

COMMIT;
