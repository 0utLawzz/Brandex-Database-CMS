begin;
alter table public.case_operations add column drive_sync_pending boolean not null default false;

create table public.case_drive_files (
 upload_id uuid primary key, trademark_id text not null references public.trademarks(id),
 drive_file_id text not null unique, original_name text not null, mime_type text not null,
 uploaded_by uuid not null default auth.uid(), uploaded_at timestamptz not null default now()
);
create table public.case_drive_leases (
 trademark_id text primary key references public.trademarks(id), operation uuid not null,
 expires_at timestamptz not null
);
alter table public.case_drive_files enable row level security;
alter table public.case_drive_leases enable row level security;
create policy read_staff on public.case_drive_files for select to authenticated using(current_brandex_role() in ('admin','viewer'));
create policy write_admin on public.case_drive_files for insert to authenticated with check(current_brandex_role()='admin');
grant select,insert on public.case_drive_files to authenticated;
create function public.claim_drive_case(p_case text,p_operation uuid) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if current_brandex_role()<>'admin' then raise exception 'Admin required'; end if;
 insert into case_drive_leases(trademark_id,operation,expires_at) values(p_case,p_operation,now()+interval '5 minutes')
 on conflict(trademark_id) do update set operation=p_operation,expires_at=excluded.expires_at where case_drive_leases.expires_at<now();
 return found;
end $$;
create function public.release_drive_case(p_case text,p_operation uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if current_brandex_role()<>'admin' then raise exception 'Admin required'; end if;
 delete from case_drive_leases where trademark_id=p_case and operation=p_operation;
end $$;
revoke all on function public.claim_drive_case(text,uuid),public.release_drive_case(text,uuid) from public;
grant execute on function public.claim_drive_case(text,uuid),public.release_drive_case(text,uuid) to authenticated;
create function public.validate_new_tm_identifier() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare digits text;
begin
 if tg_op='UPDATE' and new.tm_cpr_number is not distinct from old.tm_cpr_number then return new; end if;
 if nullif(trim(new.tm_cpr_number),'') is null then new.tm_cpr_number=null;return new;end if;
 digits=regexp_replace(new.tm_cpr_number,'[^0-9]','','g');
 if length(digits)<>6 then raise exception 'TM number must contain exactly six digits'; end if;
 new.tm_cpr_number=digits;return new;
end $$;
create trigger normalize_new_tm before insert or update on public.trademarks for each row execute function public.validate_new_tm_identifier();
revoke all on function public.validate_new_tm_identifier() from public;
create function public.queue_case_folder_sync() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if new.tm_cpr_number is distinct from old.tm_cpr_number then
  insert into case_operations(trademark_id,drive_sync_pending) values(new.id,true) on conflict(trademark_id) do update set drive_sync_pending=true;
 end if;
 return new;
end $$;
create trigger queue_drive_rename after update on public.trademarks for each row execute function public.queue_case_folder_sync();
revoke all on function public.queue_case_folder_sync() from public;
commit;
