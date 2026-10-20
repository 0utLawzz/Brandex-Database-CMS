-- Execute on an installed schema. All synthetic case/agent/audit/outbox writes roll back.
begin;
select set_config('request.jwt.claim.sub',(select user_id::text from public.profiles where role='admin' limit 1),true);
set local role authenticated;
do $$
declare case_id text := 'verification-' || gen_random_uuid()::text; advance_case text := 'verification-' || gen_random_uuid()::text;
  agent_id uuid := gen_random_uuid(); fee_id uuid; receiving_id uuid; charge_id uuid; client_id uuid; result_date date; denied boolean;
begin
  if public.current_brandex_role() <> 'admin' then raise exception 'Admin fixture unavailable'; end if;
  insert into public.trademarks(id,type,client_code,case_number,application_name,city,sub_status)
    values(case_id,'X','VERIFICATION','ROLLBACK','Rollback-only verification','TEST','Filing');
  denied := false;
  begin update public.trademarks set status='STAGE 3',sub_status='Published' where id=case_id;
  exception when others then denied := true; end;
  if not denied then raise exception 'Stage skipping was not blocked'; end if;
  update public.trademarks set sub_status='Acknowledgment' where id=case_id;
  -- Monthly Billing is the default and permits stage progression with a visible debt.
  update public.trademarks set status='STAGE 2',sub_status='Assigned' where id=case_id;
  insert into public.agents(id,name) values(agent_id,'ROLLBACK ONLY AGENT');
  update public.trademarks set assigned_agent_id=agent_id,agent_rate=1000 where id=case_id;
  select id into strict fee_id from public.agent_fees where trademark_id=case_id and source_event='ASSIGNED' and amount_billed=1000;
  update public.trademarks set sub_status='Accepted' where id=case_id;
  if (select count(*) from public.agent_fees where trademark_id=case_id) <> 1 then raise exception 'Assignment fee duplicated'; end if;
  if not exists(select 1 from public.billing_charges where trademark_id=case_id and stage=3 and voided_at is null) then raise exception 'Accepted did not create Stage 3 charge'; end if;
  perform public.record_agent_payment(fee_id,400);
  if not exists(select 1 from public.agent_fees where id=fee_id and amount_paid=400) then raise exception 'Agent payment failed'; end if;
  update public.trademarks set status='STAGE 3',sub_status='Published' where id=case_id;
  insert into public.opposition_events(trademark_id,received_date,description) values(case_id,'2026-01-31','ROLLBACK opposition');
  update public.opposition_events set extension_used=true where trademark_id=case_id;
  select response_due_date into strict result_date from public.opposition_events where trademark_id=case_id;
  if result_date <> '2026-03-28'::date then raise exception 'Calendar month extension failed'; end if;
  denied := false;
  begin insert into public.trademark_files(trademark_id,stage,file_name,mime_type,size_bytes,storage_path)
    values(case_id,'STAGE 1','test.pdf','application/pdf',1,case_id||'/STAGE_1/test.pdf');
  exception when others then denied := true; end;
  if not denied then raise exception 'Historical upload was not blocked'; end if;
  update public.trademarks set sub_status='D-Note Received' where id=case_id;
  update public.trademarks set sub_status='D-Note Submitted' where id=case_id;
  if not exists(select 1 from public.trademarks where id=case_id and certificate_due_date=(demand_note_submitted_date+interval '1 month')::date) then raise exception 'Certificate timer failed'; end if;
  update public.trademarks set status='STOPPED',sub_status=null,stopped_reason='Verification only' where id=case_id;
  denied := false;
  begin update public.trademarks set status='STAGE 4',sub_status='CER Acknowledge' where id=case_id;
  exception when others then denied := true; end;
  if not denied then raise exception 'STOPPED exit was not blocked'; end if;
  if public.can_upload_case_object(case_id||'/STAGE_3/test.pdf') then raise exception 'STOPPED storage guard failed'; end if;

  -- Advance is an optional per-client term and requires a fully allocated charge.
  insert into public.trademarks(id,type,client_code,case_number,application_name,city,sub_status)
    values(advance_case,'X','ADV-' || substr(gen_random_uuid()::text,1,8),'ROLLBACK','Advance verification','TEST','Filing');
  select l.client_id into strict client_id from public.billing_case_links l where l.trademark_id=advance_case;
  update public.billing_clients set terms='advance',rates='{"2":1000}'::jsonb where id=client_id;
  perform public.billing_ensure_charge(advance_case,2,advance_case||':stage:2');
  update public.trademarks set sub_status='Acknowledgment' where id=advance_case;
  denied := false;
  begin update public.trademarks set status='STAGE 2',sub_status='Assigned' where id=advance_case;
  exception when others then denied := true; end;
  if not denied then raise exception 'Advance gate did not block unpaid Stage 2'; end if;
  select id into strict charge_id from public.billing_charges where trademark_id=advance_case and stage=2 and voided_at is null;
  insert into public.billing_receivings(client_id,amount,entry_date,method) values(client_id,1000,current_date,'Bank') returning id into receiving_id;
  insert into public.billing_allocations(receiving_id,charge_id,amount) values(receiving_id,charge_id,1000);
  update public.trademarks set status='STAGE 2',sub_status='Assigned' where id=advance_case;
end $$;
reset role;
rollback;
select 'PASS: monthly flow, Advance allocation gate, assignment fee, Accepted charge, calendar timers, document guard and STOPPED; fixtures rolled back' as result;
