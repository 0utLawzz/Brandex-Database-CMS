begin;

-- RLS does not constrain TRUNCATE, so authenticated users receive row privileges only.
revoke all privileges on all tables in schema public from authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all privileges on all sequences in schema public from authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Trigger functions are internal; only the application's five required RPCs remain callable.
do $$
declare
  function_signature regprocedure;
begin
  for function_signature in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  loop
    execute format('revoke all on function %s from public, anon, authenticated', function_signature);
  end loop;
end
$$;

grant execute on function public.current_brandex_role() to authenticated;
grant execute on function public.can_upload_case_object(text) to authenticated;
grant execute on function public.run_journal_match() to authenticated;
grant execute on function public.run_form_match() to authenticated;
grant execute on function public.record_agent_payment(uuid, numeric) to authenticated;

-- This policy helper only reads authenticated-visible case data; it needs no definer rights.
create or replace function public.can_upload_case_object(object_name text)
returns boolean language sql stable security invoker set search_path = public as $$
  select public.current_brandex_role() = 'admin' and (
    (split_part(object_name,'/',1) = 'pending' and split_part(object_name,'/',2) = auth.uid()::text)
    or split_part(object_name,'/',1) = 'branding'
    or exists(select 1 from public.trademarks t where t.id = split_part(object_name,'/',1) and t.status <> 'STOPPED' and replace(t.status,' ','_') = split_part(object_name,'/',2))
  );
$$;

commit;