-- App settings & branding configuration
-- Run after 202609220006_workflow_creation_trigger.sql

begin;

create table if not exists public.app_settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id)
);

alter table public.app_settings enable row level security;

-- Authenticated staff (viewer, editor, admin) can read app settings
create policy "authenticated staff can read app settings" on public.app_settings
for select to authenticated using (true);

-- Only admins can insert/update/delete app settings
create policy "admins can insert app settings" on public.app_settings
for insert to authenticated
with check (public.current_brandex_role() = 'admin');

create policy "admins can update app settings" on public.app_settings
for update to authenticated
using (public.current_brandex_role() = 'admin')
with check (public.current_brandex_role() = 'admin');

create policy "admins can delete app settings" on public.app_settings
for delete to authenticated
using (public.current_brandex_role() = 'admin');

-- Seed default branding row if not exists
insert into public.app_settings (key, value)
values (
  'branding',
  jsonb_build_object(
    'logo_url', '/brandex-wordmark.svg',
    'mark_url', '/brandex-mark.svg',
    'banner_url', '/brandex-banner.png',
    'favicon_url', '/brandex-mark.svg',
    'watermark_url', '/brandex-wordmark.svg',
    'custom_logo_url', null,
    'custom_mark_url', null,
    'custom_watermark_url', null,
    'updated_at', now()
  )
)
on conflict (key) do nothing;

commit;
