-- Repair the verified missing live table without replaying unrelated migrations.
begin;
create table if not exists public.app_settings (
  key text primary key, value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
alter table public.app_settings enable row level security;
drop policy if exists "authenticated staff can read app settings" on public.app_settings;
drop policy if exists "admins can insert app settings" on public.app_settings;
drop policy if exists "admins can update app settings" on public.app_settings;
drop policy if exists "admins can delete app settings" on public.app_settings;
create policy "authenticated staff can read app settings" on public.app_settings for select to authenticated using(true);
create policy "admins can insert app settings" on public.app_settings for insert to authenticated with check(public.current_brandex_role()='admin');
create policy "admins can update app settings" on public.app_settings for update to authenticated using(public.current_brandex_role()='admin') with check(public.current_brandex_role()='admin');
create policy "admins can delete app settings" on public.app_settings for delete to authenticated using(public.current_brandex_role()='admin');
grant select,insert,update,delete on public.app_settings to authenticated;
insert into public.app_settings(key,value) values('branding','{}'::jsonb) on conflict(key) do nothing;
commit;
