begin;

alter table public.trademarks
  add column tm_cpr_number_norm text generated always as (
    nullif(regexp_replace(coalesce(tm_cpr_number, ''), '[^0-9]', '', 'g'), '')
  ) stored;

do $$
declare
  duplicate_count integer;
  deleted_count integer;
begin
  select count(*) into duplicate_count
  from public.trademarks
  where tm_cpr_number_norm = '121212';

  if duplicate_count = 0 then
    return;
  end if;

  if duplicate_count <> 2 or not exists (
    select 1 from public.trademarks
    where tm_cpr_number_norm = '121212'
      and type = 'X'
      and client_code = '100'
      and case_number = '2'
      and upper(application_name) = 'ZAHRA'
  ) then
    raise exception 'Unexpected duplicate state for TM 121212; refusing automatic cleanup';
  end if;

  -- Discard stale upserts; the DELETE trigger below queues the mirror deletion.
  delete from public.sheet_sync_outbox outbox
  using public.trademarks trademark
  where outbox.trademark_id = trademark.id
    and trademark.tm_cpr_number_norm = '121212'
    and trademark.type = 'X'
    and trademark.client_code = '100'
    and trademark.case_number = '2'
    and upper(trademark.application_name) = 'ZAHRA'
    and outbox.state = 'pending';

  delete from public.trademarks
  where tm_cpr_number_norm = '121212'
    and type = 'X'
    and client_code = '100'
    and case_number = '2'
    and upper(application_name) = 'ZAHRA';
  get diagnostics deleted_count = row_count;

  if deleted_count <> 1 then
    raise exception 'Expected to remove one approved dummy record for TM 121212; removed %', deleted_count;
  end if;
end;
$$;

create unique index trademarks_tm_cpr_number_norm_unique_idx
  on public.trademarks (tm_cpr_number_norm)
  where tm_cpr_number_norm is not null;

commit;
