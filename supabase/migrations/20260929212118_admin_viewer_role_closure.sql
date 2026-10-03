begin;

-- Keep the legacy enum value for historical compatibility, but no longer assign it.
update public.profiles set role = 'viewer' where role = 'editor';
alter table public.profiles
  add constraint profiles_active_role_not_editor check (role <> 'editor');

drop policy if exists "editors manage clients" on public.clients;
create policy "admins manage clients" on public.clients
  for all to authenticated
  using (public.current_brandex_role() = 'admin')
  with check (public.current_brandex_role() = 'admin');

drop policy if exists "editors create trademarks" on public.trademarks;
create policy "admins create trademarks" on public.trademarks
  for insert to authenticated
  with check (public.current_brandex_role() = 'admin');
drop policy if exists "editors update trademarks" on public.trademarks;
create policy "admins update trademarks" on public.trademarks
  for update to authenticated
  using (public.current_brandex_role() = 'admin')
  with check (public.current_brandex_role() = 'admin');

drop policy if exists "editors manage file metadata" on public.trademark_files;
create policy "admins manage file metadata" on public.trademark_files
  for all to authenticated
  using (public.current_brandex_role() = 'admin')
  with check (public.current_brandex_role() = 'admin');

drop policy if exists "editors_manage_agents" on public.agents;
create policy "admins_manage_agents" on public.agents
  for all to authenticated
  using (public.current_brandex_role() = 'admin')
  with check (public.current_brandex_role() = 'admin');
drop policy if exists "editors_manage_fees" on public.agent_fees;
create policy "admins_manage_fees" on public.agent_fees
  for all to authenticated
  using (public.current_brandex_role() = 'admin')
  with check (public.current_brandex_role() = 'admin');

drop policy if exists "editors upload trademark storage" on storage.objects;
create policy "admins upload trademark storage" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'trademark-files'
    and public.current_brandex_role() = 'admin'
    and public.can_upload_case_object(name)
  );
drop policy if exists "editors update trademark storage" on storage.objects;
create policy "admins update trademark storage" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'trademark-files'
    and public.current_brandex_role() = 'admin'
    and public.can_upload_case_object(name)
  )
  with check (
    bucket_id = 'trademark-files'
    and public.current_brandex_role() = 'admin'
    and public.can_upload_case_object(name)
  );

-- SECURITY DEFINER functions are not public RPCs unless explicitly granted below.
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
    execute format('revoke all on function %s from public, anon', function_signature);
  end loop;
end
$$;

grant execute on function public.current_brandex_role() to authenticated;
grant execute on function public.can_upload_case_object(text) to authenticated;
grant execute on function public.run_journal_match() to authenticated;
grant execute on function public.run_form_match() to authenticated;
grant execute on function public.record_agent_payment(uuid, numeric) to authenticated;

-- Supabase RLS remains the row-level boundary; remove direct anonymous table grants too.
revoke all privileges on all tables in schema public from public, anon;
revoke all privileges on all sequences in schema public from public, anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all privileges on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated;
grant all privileges on all sequences in schema public to service_role;

commit;