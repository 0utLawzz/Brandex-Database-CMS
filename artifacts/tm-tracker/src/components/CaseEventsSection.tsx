import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { listFeesForTrademark, type TrademarkRecord } from '@/lib/api';
import { formatDateShort } from '@/lib/utils';

interface Opposition { id: string; description: string; received_date: string; response_due_date: string; extension_used: boolean; tm56_submitted_date: string | null }
export function CaseEventsSection({ record, canEdit }: { record: TrademarkRecord; canEdit: boolean }) {
  const cache = useQueryClient();
  const [description,setDescription] = useState('');
  const [received,setReceived] = useState('');
  const [submission,setSubmission] = useState<Record<string,string>>({});
  const [payments,setPayments] = useState<Record<string,string>>({});
  const { data: events = [], error: loadError } = useQuery({ queryKey: ['oppositions',record.id], queryFn: async () => {
    const { data,error } = await supabase.from('opposition_events').select('*').eq('trademark_id',record.id).order('received_date');
    if(error) throw error; return data as Opposition[];
  }});
  const { data: fees = [] } = useQuery({queryKey:['case-fees',record.id],queryFn:()=>listFeesForTrademark(record.id)});
  const change = useMutation({mutationFn: async (operation: () => PromiseLike<{error: {message:string} | null}>) => {
    const {error} = await operation(); if(error) throw new Error(error.message);
  },onSuccess:()=>{ cache.invalidateQueries({queryKey:['oppositions',record.id]}); cache.invalidateQueries({queryKey:['case-fees',record.id]}); cache.invalidateQueries({queryKey:['agent-summary']}); }});
  const editable = canEdit && record.stage === 'STAGE 3';
  return <section className="space-y-5 rounded-lg border border-stone-300 bg-white p-5 print:break-inside-avoid">
    <h2 className="text-lg font-semibold text-[#6C1C1F]">Opposition & internal deadlines</h2>
    <p className="text-sm text-stone-600">Internal workflow timers. These are not verified statutory deadlines.</p>
    {record.certificateDueDate && <p className="text-base"><strong>Certificate acknowledgement target:</strong> {formatDateShort(record.certificateDueDate)} — 25 days from Demand Note Submitted ({formatDateShort(record.demandNoteSubmittedDate)}). {record.certificateAcknowledgedDate ? `Acknowledged ${formatDateShort(record.certificateAcknowledgedDate)}` : 'Awaiting acknowledgement.'}</p>}
    {(loadError || change.error) && <p role="alert" className="text-red-700">{(loadError || change.error)?.message}</p>}
    {events.length === 0 && <p>No opposition events recorded.</p>}
    {events.map(event=><article key={event.id} className="border-t border-stone-200 pt-4 space-y-2">
      <h3 className="font-semibold">{event.description}</h3>
      <p>Received {formatDateShort(event.received_date)} · TM56 due <strong>{formatDateShort(event.response_due_date)}</strong> {event.extension_used ? '(one-month extension recorded)' : '(initial one-month period)'}</p>
      {event.tm56_submitted_date ? <p className="text-green-800">TM56 submitted {formatDateShort(event.tm56_submitted_date)}</p> : <>
        {event.response_due_date < new Date().toISOString().slice(0,10) && <p className="text-red-700 font-semibold">Response overdue</p>}
        {editable && <div className="flex flex-wrap items-end gap-3 print:hidden">
          {!event.extension_used && <button disabled={change.isPending} className="rounded border px-3 py-2" onClick={()=>change.mutate(()=>supabase.from('opposition_events').update({extension_used:true}).eq('id',event.id))}>Use one-month extension</button>}
          <label>TM56 submitted date<input aria-label={`TM56 submitted date for ${event.description}`} type="date" min={event.received_date} max={event.response_due_date} value={submission[event.id] || ''} onChange={e=>setSubmission({...submission,[event.id]:e.target.value})} className="block border rounded px-3 py-2" /></label>
          <button className="rounded bg-[#6C1C1F] text-white px-3 py-2" disabled={change.isPending || !submission[event.id]} onClick={()=>change.mutate(()=>supabase.from('opposition_events').update({tm56_submitted_date:submission[event.id]}).eq('id',event.id))}>Record submission</button>
        </div>}
      </>}
    </article>)}
    {editable && <form className="flex flex-wrap items-end gap-3 border-t pt-4 print:hidden" onSubmit={e=>{e.preventDefault();change.mutate(()=>supabase.from('opposition_events').insert({trademark_id:record.id,description:description.trim(),received_date:received}),{onSuccess:()=>{setDescription('');setReceived('');}});}}>
      <label>Opposition description<input required value={description} onChange={e=>setDescription(e.target.value)} className="block border rounded px-3 py-2" /></label>
      <label>Opposition received date<input required type="date" value={received} onChange={e=>setReceived(e.target.value)} className="block border rounded px-3 py-2" /></label>
      <button disabled={change.isPending || !description.trim()} className="rounded bg-[#6C1C1F] text-white px-3 py-2">Add opposition</button>
    </form>}
    <h2 className="text-lg font-semibold text-[#6C1C1F] border-t pt-4">Agent payable — separate from client payments</h2>
    <p>Agreed case rate: {record.agentRate == null ? 'Not set' : `Rs. ${Number(record.agentRate).toLocaleString()}`}. Payable is created once when Accepted.</p>
    {fees.map(fee=><article key={fee.id} className="border-t pt-3">
      <p><strong>{fee.description}</strong> · Billed Rs. {fee.amountBilled} · Paid Rs. {fee.amountPaid} · Outstanding <strong>Rs. {fee.balanceDue}</strong></p>
      {canEdit && fee.balanceDue > 0 && <form className="flex gap-3 items-end mt-2 print:hidden" onSubmit={e=>{e.preventDefault();change.mutate(()=>supabase.rpc('record_agent_payment',{p_fee_id:fee.id,p_amount:Number(payments[fee.id])}),{onSuccess:()=>setPayments({...payments,[fee.id]:''})});}}>
        <label>Agent payment (Rs.)<input aria-label={`Payment for ${fee.description}`} required type="number" min="0.01" step="0.01" max={fee.balanceDue} value={payments[fee.id] || ''} onChange={e=>setPayments({...payments,[fee.id]:e.target.value})} className="block border rounded px-3 py-2" /></label>
        <button disabled={change.isPending} className="rounded border px-3 py-2">Record agent payment</button>
      </form>}
    </article>)}
  </section>;
}
