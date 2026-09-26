-- Forward-only workflow for every write path. Existing rows/history are retained.
begin;

alter table public.trademarks add column stopped_reason text;
alter table public.trademarks add column stopped_at timestamptz;
alter table public.trademarks add column demand_note_submitted_date date;
alter table public.trademarks add column certificate_due_date date;
alter table public.trademarks add column certificate_acknowledged_date date;
alter table public.trademarks add column assigned_agent_id uuid references public.agents(id) on delete restrict;
alter table public.trademarks add column agent_rate numeric(10,2) check (agent_rate >= 0);
alter table public.agent_fees add column source_event text;
create unique index agent_fees_accepted_once on public.agent_fees(trademark_id) where source_event = 'ACCEPTED';

-- Resolve only unambiguous existing names; preserve unmatched text for reconciliation.
update public.trademarks t set assigned_agent_id = a.id from public.agents a
where upper(trim(t.agent)) = upper(trim(a.name))
and (select count(*) from public.agents b where upper(trim(b.name)) = upper(trim(a.name))) = 1;

create or replace function public.workflow_transition_valid(fs text, fsub text, ts text, tsub text)
returns boolean language plpgsql immutable set search_path = public as $$
declare stages text[] := array['STAGE 1','STAGE 2','STAGE 3','STAGE 4'];
begin
  if fs is null or ts is null then return false; end if;
  if fs = 'STOPPED' then return ts = 'STOPPED' and coalesce(tsub,'') = ''; end if;
  if not fs = any(stages) then return false; end if;
  if ts = 'STOPPED' then return coalesce(tsub,'') = ''; end if;
  if fs = ts then
    if fsub is not distinct from tsub then return true; end if;
    return coalesce(case fs
      when 'STAGE 1' then (fsub = 'Filing' and tsub in ('Examination','Acknowledgment')) or (fsub = 'Examination' and tsub = 'Acknowledgment')
      when 'STAGE 2' then fsub = 'Assigned' and tsub in ('Accepted','Hearing')
      when 'STAGE 3' then (fsub = 'Published' and tsub = 'D-Note Received') or (fsub = 'D-Note Received' and tsub = 'D-Note Submitted')
      when 'STAGE 4' then (fsub = 'CER Acknowledge' and tsub = 'CER Received') or (fsub = 'CER Received' and tsub = 'CER Dispatch')
      else false end, false);
  end if;
  return coalesce(case
    when fs = 'STAGE 1' and ts = 'STAGE 2' then fsub = 'Acknowledgment' and tsub = 'Assigned'
    when fs = 'STAGE 2' and ts = 'STAGE 3' then fsub in ('Accepted','Hearing') and tsub = 'Published'
    when fs = 'STAGE 3' and ts = 'STAGE 4' then fsub = 'D-Note Submitted' and tsub = 'CER Acknowledge'
    else false end, false);
end $$;

create or replace function public.enforce_case_workflow()
returns trigger language plpgsql set search_path = public as $$
declare changed boolean;
begin
  if tg_op = 'INSERT' then
    -- Existing server-side historical importer is allowed to preserve old workflow values.
    if auth.role() is distinct from 'service_role' then
      new.sub_status := coalesce(new.sub_status, 'Filing');
      if new.status <> 'STAGE 1' or new.sub_status <> 'Filing' then raise exception 'New cases must start at Stage 1 / Filing'; end if;
      if nullif(trim(new.agent),'') is not null or new.assigned_agent_id is not null then raise exception 'Assign agents in Stage 2 / Assigned'; end if;
    end if;
    return new;
  end if;
  changed := new.status is distinct from old.status or new.sub_status is distinct from old.sub_status;
  if changed and not public.workflow_transition_valid(old.status,old.sub_status,new.status,new.sub_status) then
    raise exception 'Invalid workflow transition: % / % -> % / %', old.status,old.sub_status,new.status,new.sub_status;
  end if;
  if new.status is distinct from old.status and new.status <> 'STOPPED' then
    if not new.stage1_paid or (new.status in ('STAGE 3','STAGE 4') and not new.stage2_paid) or (new.status = 'STAGE 4' and not new.stage3_paid) then
      raise exception 'Previous stage payment must clear before progression';
    end if;
  end if;
  if new.status = 'STOPPED' and old.status <> 'STOPPED' then
    if nullif(trim(new.stopped_reason),'') is null then raise exception 'STOPPED requires a reason'; end if;
    new.sub_status := null;
    new.stopped_at := now();
    new.notes := concat_ws(E'\n\n', nullif(new.notes,''), 'STOPPED: ' || trim(new.stopped_reason) || ' (' || new.stopped_at::text || ')');
  elsif old.status = 'STOPPED' then
    if new.stopped_reason is distinct from old.stopped_reason or new.stopped_at is distinct from old.stopped_at or new.notes is distinct from old.notes then
      raise exception 'STOPPED reason and notes are preserved';
    end if;
  end if;
  if new.agent is distinct from old.agent or new.assigned_agent_id is distinct from old.assigned_agent_id or new.agent_rate is distinct from old.agent_rate then
    if old.status <> 'STAGE 2' or old.sub_status <> 'Assigned' then raise exception 'Assign agents and rates in Stage 2 / Assigned'; end if;
    if new.assigned_agent_id is not null then
      select upper(name) into new.agent from public.agents where id = new.assigned_agent_id and is_active;
      if not found then raise exception 'Choose an active agent'; end if;
    elsif nullif(trim(new.agent),'') is not null then
      raise exception 'Choose an agent profile, not a free-text name';
    end if;
  end if;
  if changed and new.status = 'STAGE 2' and new.sub_status = 'Accepted' then
    if new.assigned_agent_id is null or new.agent_rate is null then raise exception 'Set an assigned agent and agreed rate before Accepted'; end if;
  end if;
  if changed and new.status = 'STAGE 3' and new.sub_status = 'Published' then
    new.publication_date := coalesce(new.publication_date, current_date);
    new.opposition_deadline := (new.publication_date + interval '2 months')::date;
  end if;
  if changed and new.status = 'STAGE 3' and new.sub_status = 'D-Note Received' then
    new.demand_note_received := true;
    new.demand_note_date := coalesce(new.demand_note_date,current_date);
  end if;
  if changed and new.status = 'STAGE 3' and new.sub_status = 'D-Note Submitted' then
    new.demand_note_submitted_date := current_date;
    new.certificate_due_date := current_date + 25;
  else
    new.demand_note_submitted_date := old.demand_note_submitted_date;
    new.certificate_due_date := old.certificate_due_date;
  end if;
  if changed and new.status = 'STAGE 4' and new.sub_status = 'CER Acknowledge' then
    new.certificate_acknowledged_date := current_date;
  else
    new.certificate_acknowledged_date := old.certificate_acknowledged_date;
  end if;
  return new;
end $$;
create trigger enforce_case_workflow before insert or update on public.trademarks for each row execute function public.enforce_case_workflow();

create or replace function public.credit_accepted_agent()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'STAGE 2' and new.sub_status = 'Accepted' and (old.status,old.sub_status) is distinct from (new.status,new.sub_status) then
    insert into public.agent_fees(trademark_id,agent_id,description,amount_billed,source_event,created_by)
    values(new.id,new.assigned_agent_id,'Accepted case payable',new.agent_rate,'ACCEPTED',auth.uid())
    on conflict (trademark_id) where source_event = 'ACCEPTED' do nothing;
  end if;
  return new;
end $$;
create trigger credit_accepted_agent after update on public.trademarks for each row execute function public.credit_accepted_agent();

create table public.agent_payments (
  id uuid primary key default gen_random_uuid(),
  fee_id uuid not null references public.agent_fees(id) on delete restrict,
  amount numeric(10,2) not null check(amount > 0),
  paid_at timestamptz not null default now(),
  recorded_by uuid references auth.users(id)
);
alter table public.agent_payments enable row level security;
create policy agent_payments_read on public.agent_payments for select to authenticated using(true);
grant select on public.agent_payments to authenticated;
create function public.record_agent_payment(p_fee_id uuid, p_amount numeric) returns void
language plpgsql security definer set search_path = public as $$
declare fee public.agent_fees;
begin
  if public.current_brandex_role() <> 'admin' then raise exception 'Admin required'; end if;
  select * into fee from public.agent_fees where id=p_fee_id for update;
  if not found then raise exception 'Fee not found'; end if;
  if p_amount is null or p_amount <= 0 or round(p_amount,2) <> p_amount or p_amount > fee.amount_billed-fee.amount_paid then raise exception 'Payment must be positive and no more than outstanding payable'; end if;
  insert into public.agent_payments(fee_id,amount,recorded_by) values(p_fee_id,p_amount,auth.uid());
  update public.agent_fees set amount_paid=amount_paid+p_amount, paid=(amount_paid+p_amount>=amount_billed), paid_date=current_date where id=p_fee_id;
end $$;
revoke all on function public.record_agent_payment(uuid,numeric) from public;
grant execute on function public.record_agent_payment(uuid,numeric) to authenticated;

create table public.opposition_events (
  id uuid primary key default gen_random_uuid(),
  trademark_id text not null references public.trademarks(id) on delete cascade,
  received_date date not null,
  description text not null check (length(trim(description)) > 0),
  extension_used boolean not null default false,
  response_due_date date not null,
  tm56_submitted_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id),
  check (tm56_submitted_date is null or tm56_submitted_date >= received_date)
);
create index opposition_events_case_idx on public.opposition_events(trademark_id,received_date);
alter table public.opposition_events enable row level security;
create policy opposition_staff_read on public.opposition_events for select to authenticated using (true);
create policy opposition_admin_insert on public.opposition_events for insert to authenticated with check (public.current_brandex_role() = 'admin');
create policy opposition_admin_update on public.opposition_events for update to authenticated using (public.current_brandex_role() = 'admin') with check (public.current_brandex_role() = 'admin');
grant select,insert,update on public.opposition_events to authenticated;

create or replace function public.enforce_opposition_event()
returns trigger language plpgsql set search_path = public as $$
declare case_stage text;
begin
  select status into case_stage from public.trademarks where id = new.trademark_id for update;
  if case_stage is distinct from 'STAGE 3' then raise exception 'Opposition tracking is available in Stage 3 only'; end if;
  if tg_op = 'UPDATE' then
    if new.trademark_id <> old.trademark_id or new.received_date <> old.received_date then raise exception 'Opposition case and received date cannot be rewritten'; end if;
    if old.extension_used and not new.extension_used then raise exception 'Recorded extension cannot be removed'; end if;
    if old.tm56_submitted_date is not null and new.tm56_submitted_date is distinct from old.tm56_submitted_date then raise exception 'Recorded submission cannot be rewritten'; end if;
  end if;
  new.response_due_date := (new.received_date + interval '1 month')::date;
  if new.extension_used then new.response_due_date := (new.response_due_date + interval '1 month')::date; end if;
  if new.tm56_submitted_date > new.response_due_date then raise exception 'TM56 submission is outside the applicable internal deadline'; end if;
  new.updated_at := now();
  return new;
end $$;
create trigger enforce_opposition_event before insert or update on public.opposition_events for each row execute function public.enforce_opposition_event();

-- Compatibility: retain editor enum/profile values, but treat them as read-only.
create or replace function public.current_brandex_role()
returns public.brandex_role language sql stable security definer set search_path = public as $$
  select case when exists(select 1 from public.profiles where user_id = auth.uid() and role = 'admin') then 'admin'::public.brandex_role else 'viewer'::public.brandex_role end;
$$;

-- Serialize metadata validation with stage transitions and preserve historical attachments.
create or replace function public.enforce_stage_document()
returns trigger language plpgsql set search_path = public as $$
declare case_stage text;
begin
  select status into case_stage from public.trademarks where id = new.trademark_id for update;
  if case_stage = 'STOPPED' then raise exception 'STOPPED cases cannot receive documents'; end if;
  if new.stage is not null and new.stage is distinct from case_stage then raise exception 'Documents must belong to the current stage'; end if;
  if new.stage is null and new.category <> 'logo' then raise exception 'A document stage is required'; end if;
  if tg_op = 'UPDATE' and (new.trademark_id,new.stage,new.storage_path) is distinct from (old.trademark_id,old.stage,old.storage_path) then raise exception 'Historical document identity cannot be changed'; end if;
  return new;
end $$;
create trigger enforce_stage_document before insert or update on public.trademark_files for each row execute function public.enforce_stage_document();

create or replace function public.can_upload_case_object(object_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_brandex_role() = 'admin' and (
    (split_part(object_name,'/',1) = 'pending' and split_part(object_name,'/',2) = auth.uid()::text)
    or split_part(object_name,'/',1) = 'branding'
    or exists(select 1 from public.trademarks t where t.id = split_part(object_name,'/',1) and t.status <> 'STOPPED' and replace(t.status,' ','_') = split_part(object_name,'/',2))
  );
$$;
alter policy "editors upload trademark storage" on storage.objects with check (bucket_id = 'trademark-files' and public.can_upload_case_object(name));
alter policy "editors update trademark storage" on storage.objects using (bucket_id = 'trademark-files' and public.can_upload_case_object(name)) with check (bucket_id = 'trademark-files' and public.can_upload_case_object(name));
update storage.buckets set allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif','image/svg+xml','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/plain'] where id = 'trademark-files';
commit;
