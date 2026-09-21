-- Migration: Trademark Workflow History
-- Adds a dedicated table for business-level workflow history, driven by changes to status or sub_status.

begin;

create table public.trademark_workflow_history (
  id bigint generated always as identity primary key,
  trademark_id text not null references public.trademarks(id) on delete cascade,
  event_type text not null, -- e.g., 'STATUS_CHANGE'
  from_status text,
  from_sub_status text,
  to_status text not null,
  to_sub_status text,
  event_at timestamptz not null default now(),
  changed_by uuid references public.profiles(user_id)
);

create index trademark_workflow_history_idx on public.trademark_workflow_history (trademark_id, event_at desc);

-- Trigger function to automatically log changes
create or replace function public.trademarks_workflow_history_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only log if status or sub_status actually changed
  if (old.status is distinct from new.status) or (old.sub_status is distinct from new.sub_status) then
    insert into public.trademark_workflow_history (
      trademark_id,
      event_type,
      from_status,
      from_sub_status,
      to_status,
      to_sub_status,
      changed_by
    ) values (
      new.id,
      'STATUS_CHANGE',
      old.status,
      old.sub_status,
      new.status,
      new.sub_status,
      auth.uid()
    );
  end if;
  
  return new;
end;
$$;

create trigger trademarks_workflow_history_trigger
after update on public.trademarks
for each row execute function public.trademarks_workflow_history_trigger();

-- Enable RLS and create read policy for authenticated users
alter table public.trademark_workflow_history enable row level security;

create policy "authenticated staff can read workflow history" on public.trademark_workflow_history
for select to authenticated using (true);

commit;
