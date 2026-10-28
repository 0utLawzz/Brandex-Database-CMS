-- Tighten RPC exposure and avoid overlapping admin/read RLS policies.
BEGIN;

REVOKE EXECUTE ON FUNCTION public.sync_trademark_for_ledger_entry() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_trademark_for_ledger_case_link() FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS ledger_entries_client_idx ON public.ledger_entries(client_id);
CREATE INDEX IF NOT EXISTS ledger_case_link_audit_changed_by_idx ON public.ledger_case_link_audit(changed_by) WHERE changed_by IS NOT NULL;

DROP POLICY IF EXISTS ledger_series_admin ON public.ledger_series;
CREATE POLICY ledger_series_insert_admin ON public.ledger_series FOR INSERT TO authenticated
  WITH CHECK ((select public.current_brandex_role())::text='admin');
CREATE POLICY ledger_series_update_admin ON public.ledger_series FOR UPDATE TO authenticated
  USING ((select public.current_brandex_role())::text='admin')
  WITH CHECK ((select public.current_brandex_role())::text='admin');

DROP POLICY IF EXISTS ledger_clients_admin ON public.ledger_clients;
CREATE POLICY ledger_clients_insert_admin ON public.ledger_clients FOR INSERT TO authenticated
  WITH CHECK ((select public.current_brandex_role())::text='admin');
CREATE POLICY ledger_clients_update_admin ON public.ledger_clients FOR UPDATE TO authenticated
  USING ((select public.current_brandex_role())::text='admin')
  WITH CHECK ((select public.current_brandex_role())::text='admin');

DROP POLICY IF EXISTS ledger_rates_admin ON public.ledger_client_stage_rates;
CREATE POLICY ledger_rates_insert_admin ON public.ledger_client_stage_rates FOR INSERT TO authenticated
  WITH CHECK ((select public.current_brandex_role())::text='admin');
CREATE POLICY ledger_rates_update_admin ON public.ledger_client_stage_rates FOR UPDATE TO authenticated
  USING ((select public.current_brandex_role())::text='admin')
  WITH CHECK ((select public.current_brandex_role())::text='admin');

DROP POLICY IF EXISTS ledger_cases_admin ON public.ledger_cases;
CREATE POLICY ledger_cases_insert_admin ON public.ledger_cases FOR INSERT TO authenticated
  WITH CHECK ((select public.current_brandex_role())::text='admin');
CREATE POLICY ledger_cases_update_admin ON public.ledger_cases FOR UPDATE TO authenticated
  USING ((select public.current_brandex_role())::text='admin')
  WITH CHECK ((select public.current_brandex_role())::text='admin');

DROP POLICY IF EXISTS ledger_entries_admin ON public.ledger_entries;
CREATE POLICY ledger_entries_insert_admin ON public.ledger_entries FOR INSERT TO authenticated
  WITH CHECK ((select public.current_brandex_role())::text='admin');
CREATE POLICY ledger_entries_update_admin ON public.ledger_entries FOR UPDATE TO authenticated
  USING ((select public.current_brandex_role())::text='admin')
  WITH CHECK ((select public.current_brandex_role())::text='admin');

COMMIT;
