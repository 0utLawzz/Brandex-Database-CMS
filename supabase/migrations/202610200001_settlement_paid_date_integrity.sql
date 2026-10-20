-- A date in agent_fees.paid_date means the fee became fully paid.
-- Partial settlements and void reversals must not leave a stale full-payment date.
create or replace function public.save_associate_settlement(
  p_id uuid,p_associate uuid,p_amount numeric,p_date date,p_version integer default 0,p_void boolean default false
)
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
      update agent_fees
      set amount_paid=amount_paid-a.amount,
          paid=(amount_paid-a.amount>=amount_billed),
          paid_date=case when amount_paid-a.amount>=amount_billed then paid_date else null end
      where id=a.fee_id;
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
    update agent_fees
    set amount_paid=amount_paid+old_amount,
        paid=(amount_paid+old_amount>=amount_billed),
        paid_date=case when amount_paid+old_amount>=amount_billed then p_date else null end
    where id=f.id;
    left_amount=left_amount-old_amount; exit when left_amount=0;
  end loop;
  return p_id;
end $$;
revoke all on function public.save_associate_settlement(uuid,uuid,numeric,date,integer,boolean) from public;
grant execute on function public.save_associate_settlement(uuid,uuid,numeric,date,integer,boolean) to authenticated;

-- The older direct-payment path is still used by the legacy Agent screen.
-- Keep its completion date consistent with the settlement path above.
create or replace function public.record_agent_payment(p_fee_id uuid, p_amount numeric) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare fee public.agent_fees;
begin
  if public.current_brandex_role() is distinct from 'admin' then raise exception 'Admin required'; end if;
  select * into fee from public.agent_fees where id=p_fee_id for update;
  if not found then raise exception 'Fee not found'; end if;
  if p_amount is null or p_amount <= 0 or round(p_amount,2) <> p_amount or p_amount > fee.amount_billed-fee.amount_paid then
    raise exception 'Payment must be positive and no more than outstanding payable';
  end if;
  insert into public.agent_payments(fee_id,amount,recorded_by) values(p_fee_id,p_amount,auth.uid());
  update public.agent_fees
  set amount_paid=amount_paid+p_amount,
      paid=(amount_paid+p_amount>=amount_billed),
      paid_date=case when amount_paid+p_amount>=amount_billed then current_date else null end
  where id=p_fee_id;
end $$;
revoke all on function public.record_agent_payment(uuid,numeric) from public;
grant execute on function public.record_agent_payment(uuid,numeric) to authenticated;
