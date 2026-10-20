-- Claim one outbox row atomically. Later updates for the same trademark wait
-- until every earlier update is mirrored, including failed/dead-letter rows.
alter table public.sheet_sync_outbox
  add column claimed_at timestamptz,
  add column claim_token uuid;

create index sheet_sync_order_idx on public.sheet_sync_outbox(trademark_id,id)
  where state <> 'synced';

create function public.claim_sheet_sync_job(
  p_max_attempts integer,
  p_exclude_ids bigint[] default '{}'
)
returns setof public.sheet_sync_outbox
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required'; end if;
  if p_max_attempts is null or p_max_attempts<1 or p_max_attempts>100 then raise exception 'Invalid attempt limit'; end if;
  return query
  with candidate as (
    select o.id
    from public.sheet_sync_outbox o
    where o.attempt_count<p_max_attempts
      and o.id<>all(coalesce(p_exclude_ids,'{}'::bigint[]))
      and (
        o.state in ('pending','failed')
        or (o.state='processing' and coalesce(o.claimed_at,o.created_at)<now()-interval '5 minutes')
      )
      and not exists (
        select 1 from public.sheet_sync_outbox earlier
        where earlier.trademark_id=o.trademark_id
          and earlier.id<o.id
          and earlier.state<>'synced'
      )
    order by o.id
    for update of o skip locked
    limit 1
  )
  update public.sheet_sync_outbox o
     set state='processing',
         attempt_count=o.attempt_count+1,
         claimed_at=now(),
         claim_token=gen_random_uuid(),
         last_error=null
    from candidate c
   where o.id=c.id
  returning o.*;
end $$;
revoke all on function public.claim_sheet_sync_job(integer,bigint[]) from public,anon,authenticated;
grant execute on function public.claim_sheet_sync_job(integer,bigint[]) to service_role;

create function public.finish_sheet_sync_job(
  p_id bigint,
  p_claim_token uuid,
  p_success boolean,
  p_error text default null
)
returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare changed integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required'; end if;
  if p_success is null then raise exception 'Outcome required'; end if;
  update public.sheet_sync_outbox
     set state=case when p_success then 'synced'::public.sheet_sync_state else 'failed'::public.sheet_sync_state end,
         processed_at=case when p_success then now() else null end,
         last_error=case when p_success then null else left(coalesce(p_error,'Sheet mirror failed'),1000) end,
         claimed_at=null,
         claim_token=null
   where id=p_id and claim_token=p_claim_token and state='processing';
  get diagnostics changed=row_count;
  return changed=1;
end $$;
revoke all on function public.finish_sheet_sync_job(bigint,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.finish_sheet_sync_job(bigint,uuid,boolean,text) to service_role;
