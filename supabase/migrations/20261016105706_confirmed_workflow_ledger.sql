-- Local branch only. Preserve all legacy data; financial backfill is explicit.
begin;
create table public.billing_series (
 code text primary key check(code ~ '^[A-Z][A-Z0-9_-]*$'), name text not null, drive_root_id text
);
insert into public.billing_series(code,name) values('X','Regular clients'),('A','Ongoing clients'),('N','Other clients');
create table public.billing_clients (
 id uuid primary key default gen_random_uuid(), series text not null references public.billing_series(code),
 code text not null, name text not null, terms text not null default 'monthly' check(terms in ('monthly','advance')),
 rates jsonb not null default '{}', drive_folder_id text, unique(series,code),
 check(jsonb_typeof(rates)='object')
);
create table public.billing_case_links (
 trademark_id text primary key references public.trademarks(id) on delete restrict,
 client_id uuid not null references public.billing_clients(id) on delete restrict,
 case_reference text not null unique, drive_folder_id text
);
create table public.billing_charges (
 id uuid primary key default gen_random_uuid(), trademark_id text not null references public.trademarks(id) on delete restrict,
 stage integer check(stage between 1 and 4), description text not null,
 amount numeric(14,2) check(amount>=0), event_key text not null unique,
 entry_date date not null default current_date, voided_at timestamptz,
 created_at timestamptz not null default now()
);
create unique index billing_one_stage_charge on public.billing_charges(trademark_id,stage) where stage is not null and voided_at is null;
create table public.billing_receivings (
 id uuid primary key default gen_random_uuid(), client_id uuid not null references public.billing_clients(id),
 amount numeric(14,2) not null check(amount>0), entry_date date not null, method text not null,
 reference text, version integer not null default 1, voided_at timestamptz, created_at timestamptz not null default now()
);
create table public.billing_allocations (
 id uuid primary key default gen_random_uuid(), receiving_id uuid not null references public.billing_receivings(id) on delete cascade,
 charge_id uuid not null references public.billing_charges(id), amount numeric(14,2) not null check(amount>0), unique(receiving_id,charge_id)
);
create table public.billing_receipts (
 id bigint generated always as identity primary key, receiving_id uuid not null references public.billing_receivings(id),
 trademark_id text not null references public.trademarks(id), receipt_no text not null unique default ('BR-' || gen_random_uuid()::text),
 unique(receiving_id,trademark_id)
);
create table public.billing_audit (
 id bigint generated always as identity primary key, table_name text not null, record_id text not null,
 before_row jsonb, after_row jsonb, actor uuid default auth.uid(), event_at timestamptz not null default now()
);
create table public.case_operations (
 trademark_id text primary key references public.trademarks(id), event_date date, accepted_date date,
 reactivated_date date, fee_submitted_date date, previous_stage text, previous_sub_status text, tm57_date date, restoration_approved_date date,
 certificate_received_date date, drive_folder_id text
);
create table public.case_deliveries (
 id uuid primary key default gen_random_uuid(), trademark_id text not null references public.trademarks(id),
 method text not null check(method in ('courier','hand_collected')), company text, tracking_no text, destination text,
 dispatch_date date not null, delivered_date date, receipt_file_id text,
 check(delivered_date is null or delivered_date>=dispatch_date),
 check(method='hand_collected' or (nullif(trim(company),'') is not null and nullif(trim(tracking_no),'') is not null))
);
-- One trusted write boundary: only Admin writes; Viewer reads through RLS.
do $$ declare n text; begin
 foreach n in array array['billing_series','billing_clients','billing_case_links','billing_charges','billing_receivings','billing_allocations','billing_receipts','case_operations','case_deliveries'] loop
  execute format('alter table public.%I enable row level security',n);
  execute format('create policy staff_read on public.%I for select to authenticated using(public.current_brandex_role() in (''admin'',''viewer''))',n);
  execute format('create policy admin_write on public.%I for all to authenticated using(public.current_brandex_role()=''admin'') with check(public.current_brandex_role()=''admin'')',n);
  execute format('grant select,insert,update,delete on public.%I to authenticated',n);
 end loop;
end $$;
alter table public.billing_audit enable row level security;
create policy audit_staff_read on public.billing_audit for select to authenticated using(public.current_brandex_role() in ('admin','viewer'));
grant select on public.billing_audit to authenticated;
grant usage,select on sequence public.billing_receipts_id_seq to authenticated;
create function public.billing_capture_audit() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into billing_audit(table_name,record_id,before_row,after_row) values(tg_table_name,coalesce(to_jsonb(new)->>'id',to_jsonb(old)->>'id',to_jsonb(new)->>'trademark_id',to_jsonb(old)->>'trademark_id'),case when tg_op<>'INSERT' then to_jsonb(old) end,case when tg_op<>'DELETE' then to_jsonb(new) end);
 return coalesce(new,old);
end $$;
revoke all on function public.billing_capture_audit() from public;
do $$ declare n text; begin foreach n in array array['billing_clients','billing_charges','billing_receivings','billing_allocations','billing_receipts','case_operations','case_deliveries'] loop
 execute format('create trigger billing_audit after insert or update or delete on public.%I for each row execute function public.billing_capture_audit()',n);
end loop; end $$;

create function public.billing_validate_allocation() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare r billing_receivings; c billing_charges; owner_id uuid; used numeric;
begin
 -- Serialize allocations against receiving and charge; prevents concurrent overspending.
 select * into r from billing_receivings where id=new.receiving_id for update;
 select * into c from billing_charges where id=new.charge_id for update;
 if r.id is null or c.id is null or r.voided_at is not null or c.voided_at is not null or c.amount is null then raise exception 'Choose active receiving and a priced charge'; end if;
 select client_id into owner_id from billing_case_links where trademark_id=c.trademark_id;
 if owner_id is distinct from r.client_id then raise exception 'Receiving and case must belong to same client'; end if;
 select coalesce(sum(amount),0) into used from billing_allocations where receiving_id=r.id and id<>new.id;
 if used+new.amount>r.amount then raise exception 'Allocations exceed receiving'; end if;
 select coalesce(sum(a.amount),0) into used from billing_allocations a join billing_receivings x on x.id=a.receiving_id where a.charge_id=c.id and a.id<>new.id and x.voided_at is null;
 if used+new.amount>c.amount then raise exception 'Allocation exceeds charge outstanding'; end if;
 return new;
end $$;
create trigger allocation_integrity before insert or update on public.billing_allocations for each row execute function public.billing_validate_allocation();
create function public.billing_protect_receiving() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if tg_op='DELETE' then raise exception 'Void receiving instead of deleting history'; end if;
 if new.client_id<>old.client_id then raise exception 'Cannot move receiving to another client'; end if;
 if new.amount<(select coalesce(sum(amount),0) from billing_allocations where receiving_id=old.id) then raise exception 'Reduce allocations before reducing receiving amount'; end if;
 new.version=old.version+1; return new;
end $$;
create trigger receiving_integrity before update or delete on public.billing_receivings for each row execute function public.billing_protect_receiving();
create function public.billing_make_receipt() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 insert into billing_receipts(receiving_id,trademark_id) select new.receiving_id,trademark_id from billing_charges where id=new.charge_id on conflict do nothing;
 return new;
end $$;
create trigger allocation_receipt after insert on public.billing_allocations for each row execute function public.billing_make_receipt();
create view public.billing_stage_position with(security_invoker=true) as
 select c.id,c.trademark_id,c.stage,c.description,c.amount as billed,c.entry_date,c.voided_at,
 coalesce(sum(a.amount) filter(where r.voided_at is null),0) as received,
 c.amount-coalesce(sum(a.amount) filter(where r.voided_at is null),0) as outstanding
 from billing_charges c left join billing_allocations a on a.charge_id=c.id left join billing_receivings r on r.id=a.receiving_id group by c.id;
grant select on public.billing_stage_position to authenticated;

create function public.billing_ensure_charge(p_case text,p_stage integer,p_event text) returns void language plpgsql set search_path=public,pg_temp as $$
declare t trademarks; b billing_clients; price numeric; client_key text;
begin
 select * into t from trademarks where id=p_case;
 if t.id is null then raise exception 'Case not found'; end if;
 insert into billing_series(code,name) values(upper(t.type),upper(t.type)) on conflict do nothing;
 client_key=regexp_replace(upper(trim(t.client_code)), '^' || upper(t.type) || '-', '');
 insert into billing_clients(series,code,name) values(upper(t.type),client_key,coalesce(nullif(t.client_name,''),client_key)) on conflict(series,code) do nothing;
 select * into b from billing_clients where series=upper(t.type) and code=client_key;
 insert into billing_case_links(trademark_id,client_id,case_reference) values(t.id,b.id,upper(t.type)||'-'||client_key||'-'||t.case_number) on conflict(trademark_id) do nothing;
 select * into b from billing_clients where id=(select client_id from billing_case_links where trademark_id=t.id);
 price=(b.rates->>p_stage::text)::numeric;
 insert into billing_charges(trademark_id,stage,description,amount,event_key) values(t.id,p_stage,'Stage '||p_stage,price,p_event) on conflict do nothing;
end $$;
create function public.billing_case_events() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare target integer;
begin
 if tg_op='INSERT' then
  insert into case_operations(trademark_id,event_date) values(new.id,coalesce(new.filing_date,current_date));
  perform billing_ensure_charge(new.id,1,new.id||':stage:1');
 else
  if new.status is distinct from old.status or new.sub_status is distinct from old.sub_status then
   insert into case_operations(trademark_id,event_date,accepted_date,fee_submitted_date) values(new.id,current_date,case when new.sub_status='Accepted' then current_date end,case when new.sub_status='D-Note Submitted' then current_date end)
   on conflict(trademark_id) do update set event_date=current_date,reactivated_date=case when old.status='STOPPED' then case_operations.reactivated_date else null end,accepted_date=coalesce(excluded.accepted_date,case_operations.accepted_date),fee_submitted_date=coalesce(excluded.fee_submitted_date,case_operations.fee_submitted_date);
   if new.status='STAGE 2' then target=2; elsif new.status='STAGE 3' then target=3; elsif new.status='STAGE 4' then target=4; end if;
   if target is not null then perform billing_ensure_charge(new.id,target,new.id||':stage:'||target); end if;
   if new.sub_status='Accepted' then perform billing_ensure_charge(new.id,3,new.id||':stage:3'); end if;
  end if;
 end if;
 return new;
end $$;
create trigger integrated_billing_events after insert or update on public.trademarks for each row execute function public.billing_case_events();

-- Approved event-date correction: explicit operation, not updated_at as a clock.
create function public.set_case_event_date(p_case text,p_date date) returns void language plpgsql set search_path=public,pg_temp as $$
begin
 if current_brandex_role() is distinct from 'admin' then raise exception 'Admin required'; end if;
 if p_date is null or p_date>(now() at time zone 'Asia/Karachi')::date or p_date<(select filing_date from trademarks where id=p_case) then raise exception 'Choose an actual event date on or after filing'; end if;
 update case_operations set event_date=p_date,fee_submitted_date=case when (select sub_status from trademarks where id=p_case)='D-Note Submitted' then p_date else fee_submitted_date end,accepted_date=case when (select sub_status from trademarks where id=p_case)='Accepted' then p_date else accepted_date end where trademark_id=p_case;
end $$;

-- Authoritative case payment position; actual allocations, never manual flags.
create function public.case_payment_position(p_case text) returns jsonb language sql stable set search_path=public,pg_temp as $$
 select jsonb_build_object('case_reference',l.case_reference,'client_name',b.name,'terms',b.terms,'stages',coalesce((select jsonb_agg(to_jsonb(s) order by s.stage) from billing_stage_position s where s.trademark_id=p_case and s.voided_at is null),'[]'::jsonb))
 from billing_case_links l join billing_clients b on b.id=l.client_id where l.trademark_id=p_case;
$$;
-- RPCs are authenticated and invoker-scoped; no anonymous grants.
revoke all on function public.billing_validate_allocation(),public.billing_protect_receiving(),public.billing_make_receipt(),public.billing_case_events() from public;
revoke all on function public.billing_ensure_charge(text,integer,text),public.set_case_event_date(text,date),public.case_payment_position(text) from public;
grant execute on function public.billing_ensure_charge(text,integer,text),public.set_case_event_date(text,date),public.case_payment_position(text) to authenticated;
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
      when 'STAGE 2' then (fsub = 'Assigned' and tsub in ('Accepted','Hearing')) or (fsub = 'Hearing' and tsub = 'Accepted')
      when 'STAGE 3' then (fsub = 'Published' and tsub = 'D-Note Received') or (fsub = 'D-Note Received' and tsub = 'D-Note Submitted')
      when 'STAGE 4' then (fsub = 'CER Acknowledge' and tsub = 'CER Received') or (fsub = 'CER Received' and tsub = 'CER Dispatch')
      else false end, false);
  end if;
  return coalesce(case
    when fs = 'STAGE 1' and ts = 'STAGE 2' then fsub = 'Acknowledgment' and tsub = 'Assigned'
    when fs = 'STAGE 2' and ts = 'STAGE 3' then fsub = 'Accepted' and tsub = 'Published'
    when fs = 'STAGE 3' and ts = 'STAGE 4' then fsub = 'D-Note Submitted' and tsub = 'CER Acknowledge'
    else false end, false);
end $$;


create or replace function public.enforce_case_workflow()
returns trigger language plpgsql set search_path = public as $$
declare changed boolean; payment_terms text; current_stage integer;
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
  if old.status='STOPPED' and new.status<>'STOPPED' then
    if not exists(select 1 from case_operations o where o.trademark_id=old.id and o.tm57_date is not null and o.reactivated_date=current_date and o.previous_stage=new.status and o.previous_sub_status is not distinct from new.sub_status) then raise exception 'Use TM-57 reactivation'; end if;
    return new;
  end if;
  changed := new.status is distinct from old.status or new.sub_status is distinct from old.sub_status;
  if changed and not public.workflow_transition_valid(old.status,old.sub_status,new.status,new.sub_status) then
    raise exception 'Invalid workflow transition: % / % -> % / %', old.status,old.sub_status,new.status,new.sub_status;
  end if;
  if new.status is distinct from old.status and new.status<>'STOPPED' then
    select b.terms into payment_terms from billing_case_links l join billing_clients b on b.id=l.client_id where l.trademark_id=new.id;
    if coalesce(payment_terms,'monthly')='advance' then
      current_stage=right(new.status,1)::integer;
      if not exists(select 1 from billing_stage_position where trademark_id=new.id and stage=current_stage and voided_at is null and billed is not null and outstanding<=0) then raise exception 'Advance Payment: clear required stage payment before entry'; end if;
    end if;
  end if;
  if new.status = 'STOPPED' and old.status <> 'STOPPED' then
    if nullif(trim(new.stopped_reason),'') is null then raise exception 'STOPPED requires a reason'; end if;
    insert into case_operations(trademark_id,previous_stage,previous_sub_status) values(old.id,old.status,old.sub_status) on conflict(trademark_id) do update set previous_stage=old.status,previous_sub_status=old.sub_status;
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
    new.certificate_due_date := (current_date + interval '1 month')::date;
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


-- The agreed payable starts at assignment. Existing Accepted fees remain historical.
drop trigger credit_accepted_agent on public.trademarks;
create function public.credit_assignment_associate() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if new.assigned_agent_id is not null and old.assigned_agent_id is null then
  insert into agent_fees(trademark_id,agent_id,description,amount_billed,source_event,created_by)
  values(new.id,new.assigned_agent_id,'Assigned case fee',coalesce(new.agent_rate,1000),'ASSIGNED',auth.uid());
 elsif old.assigned_agent_id is not null and new.assigned_agent_id is distinct from old.assigned_agent_id then
  raise exception 'Reassignment requires fee reconciliation';
 end if;
 return new;
end $$;
create trigger assignment_payable after update on public.trademarks for each row execute function public.credit_assignment_associate();
revoke all on function public.credit_assignment_associate() from public;
create function public.reactivate_case(p_case text,p_amount numeric,p_date date) returns void language plpgsql set search_path=public,pg_temp as $$
declare op case_operations;
begin
 if current_brandex_role() is distinct from 'admin' then raise exception 'Admin required'; end if;
 perform 1 from trademarks where id=p_case and status='STOPPED' for update;
 if not found then raise exception 'Choose a STOPPED case'; end if;
 select * into op from case_operations where trademark_id=p_case;
 if op.previous_stage is null then raise exception 'Previous stage needs reconciliation'; end if;
 if p_date is null or p_date>current_date or p_amount is null or p_amount<0 or round(p_amount,2)<>p_amount then raise exception 'Actual TM-57 filing date and amount required'; end if;
 update case_operations set tm57_date=p_date,reactivated_date=current_date where trademark_id=p_case;
 insert into billing_charges(trademark_id,description,amount,event_key,entry_date) values(p_case,'TM-57 restoration',p_amount,p_case||':tm57:'||gen_random_uuid(),p_date);
 update trademarks set status=op.previous_stage,sub_status=op.previous_sub_status where id=p_case;
end $$;
revoke all on function public.reactivate_case(text,numeric,date) from public;
grant execute on function public.reactivate_case(text,numeric,date) to authenticated;

create function public.save_client_receiving(p_id uuid,p_client uuid,p_amount numeric,p_date date,p_method text,p_allocations jsonb,p_version integer default 0)
returns uuid language plpgsql set search_path=public,pg_temp as $$
declare r billing_receivings; item jsonb;
begin
 if current_brandex_role() is distinct from 'admin' then raise exception 'Admin required'; end if;
 if p_amount is null or p_amount<=0 or round(p_amount,2)<>p_amount or p_date is null or nullif(trim(p_method),'') is null or jsonb_typeof(p_allocations) is distinct from 'array' then raise exception 'Valid amount, date, method and allocations required'; end if;
 -- Lock client before receiving/charges for consistent concurrent operation order.
 perform 1 from billing_clients where id=p_client for update;
 if not found then raise exception 'Client not found'; end if;
 select * into r from billing_receivings where id=p_id for update;
 if found then
  if r.client_id<>p_client or r.version<>p_version or r.voided_at is not null then raise exception 'Receiving changed; reload'; end if;
  delete from billing_allocations where receiving_id=p_id;
  update billing_receivings set amount=p_amount,entry_date=p_date,method=trim(p_method) where id=p_id;
 else
  if p_version<>0 then raise exception 'Receiving not found'; end if;
  insert into billing_receivings(id,client_id,amount,entry_date,method) values(p_id,p_client,p_amount,p_date,trim(p_method));
 end if;
 for item in select value from jsonb_array_elements(p_allocations) loop
  if (item->>'amount')::numeric<>round((item->>'amount')::numeric,2) then raise exception 'Two decimal places required'; end if;
  insert into billing_allocations(receiving_id,charge_id,amount) values(p_id,(item->>'charge_id')::uuid,(item->>'amount')::numeric);
 end loop;
 return p_id;
end $$;
revoke all on function public.save_client_receiving(uuid,uuid,numeric,date,text,jsonb,integer) from public;
grant execute on function public.save_client_receiving(uuid,uuid,numeric,date,text,jsonb,integer) to authenticated;

create table public.associate_settlements (
 id uuid primary key default gen_random_uuid(), associate_id uuid not null references public.agents(id),
 amount numeric(12,2) not null check(amount>0), payment_date date not null, version integer not null default 1,
 voided_at timestamptz, created_at timestamptz not null default now()
);
create table public.associate_settlement_allocations (
 id uuid primary key default gen_random_uuid(), settlement_id uuid not null references public.associate_settlements(id),
 fee_id uuid not null references public.agent_fees(id), amount numeric(12,2) not null check(amount>0)
);
alter table public.associate_settlements enable row level security;
alter table public.associate_settlement_allocations enable row level security;
create policy staff_read on public.associate_settlements for select to authenticated using(current_brandex_role() in ('admin','viewer'));
create policy staff_read on public.associate_settlement_allocations for select to authenticated using(current_brandex_role() in ('admin','viewer'));
grant select on public.associate_settlements,public.associate_settlement_allocations to authenticated;
-- Settlement mutations are RPC-only, keeping FIFO and fee totals atomic.
create trigger settlement_audit after insert or update or delete on public.associate_settlements for each row execute function public.billing_capture_audit();
create trigger settlement_allocation_audit after insert or update or delete on public.associate_settlement_allocations for each row execute function public.billing_capture_audit();
create function public.save_associate_settlement(p_id uuid,p_associate uuid,p_amount numeric,p_date date,p_version integer default 0,p_void boolean default false)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare s associate_settlements; a record; f agent_fees; left_amount numeric; old_amount numeric;
begin
 if current_brandex_role() is distinct from 'admin' then raise exception 'Admin required'; end if;
 perform 1 from agents where id=p_associate for update;
 if not found then raise exception 'Associate not found'; end if;
 select * into s from associate_settlements where id=p_id for update;
 if found then
  if s.associate_id<>p_associate or s.version<>p_version or s.voided_at is not null then raise exception 'Settlement changed; reload'; end if;
  for a in select * from associate_settlement_allocations where settlement_id=p_id loop
   update agent_fees set amount_paid=amount_paid-a.amount,paid=false where id=a.fee_id;
  end loop;
  delete from associate_settlement_allocations where settlement_id=p_id;
  if p_void then update associate_settlements set voided_at=now(),version=version+1 where id=p_id; return p_id; end if;
 else
  if p_version<>0 or p_void then raise exception 'Settlement not found'; end if;
 end if;
 if p_amount is null or p_amount<=0 or round(p_amount,2)<>p_amount or p_date is null then raise exception 'Valid payment required'; end if;
 if p_amount>(select coalesce(sum(amount_billed-amount_paid),0) from agent_fees where agent_id=p_associate) then raise exception 'Payment exceeds outstanding'; end if;
 insert into associate_settlements(id,associate_id,amount,payment_date) values(p_id,p_associate,p_amount,p_date)
 on conflict(id) do update set amount=p_amount,payment_date=p_date,version=associate_settlements.version+1;
 left_amount=p_amount;
 for f in select * from agent_fees where agent_id=p_associate and amount_billed>amount_paid order by created_at,id for update loop
  old_amount=least(left_amount,f.amount_billed-f.amount_paid);
  insert into associate_settlement_allocations(settlement_id,fee_id,amount) values(p_id,f.id,old_amount);
  update agent_fees set amount_paid=amount_paid+old_amount,paid=(amount_paid+old_amount>=amount_billed),paid_date=p_date where id=f.id;
  left_amount=left_amount-old_amount; exit when left_amount=0;
 end loop;
 return p_id;
end $$;
revoke all on function public.save_associate_settlement(uuid,uuid,numeric,date,integer,boolean) from public;
grant execute on function public.save_associate_settlement(uuid,uuid,numeric,date,integer,boolean) to authenticated;
create function public.case_followup_flag(p_case text,p_today date default (now() at time zone 'Asia/Karachi')::date)
returns jsonb language plpgsql stable set search_path=public,pg_temp as $$
declare t trademarks; o case_operations; base date; due date; label text; color text; elapsed integer;
begin
 select * into t from trademarks where id=p_case;
 if t.id is null or t.status='STOPPED' then return null; end if;
 select * into o from case_operations where trademark_id=p_case;
 base=coalesce(o.reactivated_date,o.event_date);
 if t.status='STAGE 1' and t.sub_status='Filing' then base=coalesce(o.reactivated_date,t.filing_date);due=base+15;label='Filing follow-up';
 elsif t.status='STAGE 1' and t.sub_status='Examination' then due=base+7;label='Acknowledgement after reply';
 elsif t.status='STAGE 2' and t.sub_status='Assigned' then due=base+10;label='Assignment outcome pending';
 elsif t.sub_status='Accepted' and o.accepted_date is not null then
  if o.reactivated_date is not null then return jsonb_build_object('tone','review','reason','Restored journal cycle needs confirmation'); end if;
  base=o.accepted_date;due=(date_trunc('month',base)+case when extract(day from base)>20 then interval '1 month' else interval '0 months' end+interval '28 days')::date;label='Expected journal publication';
 elsif t.status='STAGE 3' and t.sub_status='Published' and not exists(select 1 from opposition_events where trademark_id=t.id) then base=coalesce(o.reactivated_date,t.publication_date);due=(base+interval '2 months')::date;label='Demand Note pending';
 elsif coalesce(o.fee_submitted_date,t.demand_note_submitted_date) is not null and o.certificate_received_date is null and t.sub_status not in ('CER Received','CER Dispatch') then base=coalesce(o.reactivated_date,o.fee_submitted_date,t.demand_note_submitted_date);due=(base+interval '1 month')::date;label='Certificate receipt pending';
 else return null; end if;
 if due is null then return null; end if;
 if p_today<due and not(t.status='STAGE 2' and t.sub_status='Assigned') then return null; end if;
 elapsed=p_today-base;color=case when p_today>=due then 'red' when t.status='STAGE 2' and t.sub_status='Assigned' and elapsed>=8 then 'yellow' else 'green' end;
 return jsonb_build_object('tone',color,'reason',label,'dueDate',due,'elapsedDays',elapsed);
end $$;
revoke all on function public.case_followup_flag(text,date) from public;
grant execute on function public.case_followup_flag(text,date) to authenticated;
create view public.trademark_followup with(security_invoker=true) as
 select t.*,f.flag->>'tone' as followup_tone,f.flag->>'reason' as followup_reason,f.flag->>'dueDate' as followup_due
 from trademarks t left join lateral(select case_followup_flag(t.id) as flag) f on true;
grant select on public.trademark_followup to authenticated;
commit;
