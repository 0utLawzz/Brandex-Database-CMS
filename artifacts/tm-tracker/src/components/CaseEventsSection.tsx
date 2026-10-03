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
  const { data: events = [], error: loadError } = useQuery({ queryKey: ['oppositions',record.id], queryFn: async () => {
    const { data,error } = await supabase.from('opposition_events').select('*').eq('trademark_id',record.id).order('received_date');
    if(error) throw error; return data as Opposition[];
  }});
  const { data: fees = [] } = useQuery({queryKey:['case-fees',record.id],queryFn:()=>listFeesForTrademark(record.id)});
  const change = useMutation({mutationFn: async (operation: () => PromiseLike<{error: {message:string} | null}>) => {
    const {error} = await operation(); if(error) throw new Error(error.message);
  },onSuccess:()=>{ cache.invalidateQueries({queryKey:['oppositions',record.id]}); cache.invalidateQueries({queryKey:['case-fees',record.id]}); cache.invalidateQueries({queryKey:['agent-summary']}); }});
  const editable = canEdit && record.stage === 'STAGE 3';
  return <section className="space-y-4 rounded-lg border border-stone-300 bg-white p-4 print:break-inside-avoid">
    <div className="flex items-center justify-between gap-3 border-b border-stone-300 pb-2">
      <h2 className="text-lg font-semibold text-[#6C1C1F]">Opposition & Internal Deadlines</h2>
      <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#6d6658]">Internal timers</span>
    </div>
    <p className="text-sm text-stone-600">Internal workflow timers. These are not verified statutory deadlines.</p>
    {record.certificateDueDate && <p className="text-base"><strong>Certificate acknowledgement target:</strong> {formatDateShort(record.certificateDueDate)} — 25 days from Demand Note Submitted ({formatDateShort(record.demandNoteSubmittedDate)}). {record.certificateAcknowledgedDate ? `Acknowledged ${formatDateShort(record.certificateAcknowledgedDate)}` : 'Awaiting acknowledgement.'}</p>}
    {(loadError || change.error) && <p role="alert" className="text-red-700">{(loadError || change.error)?.message}</p>}
    {events.length === 0 && <p className="italic text-stone-600">No opposition events recorded.</p>}
    <div className="grid gap-3 md:grid-cols-2">
      {events.map(event=><article key={event.id} className="border border-stone-200 bg-[#FFF9F0] p-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-mono text-sm font-bold uppercase tracking-widest text-[#0C0C0C]">Opposition No</h3>
          <span className={`px-2 py-1 text-[10px] font-mono font-bold uppercase ${event.tm56_submitted_date ? 'bg-[#0A6B52] text-white' : 'bg-[#F0E8D0] text-[#0C0C0C]'}`}>
            {event.tm56_submitted_date ? 'Active / received' : 'Pending'}
          </span>
        </div>
        <div className="font-semibold text-[#0C0C0C]">{event.description}</div>
        <div className="font-mono text-xs text-[#6d6658] space-y-1">
          <p>Received: <strong>{formatDateShort(event.received_date)}</strong></p>
          <p>TM56 due: <strong>{formatDateShort(event.response_due_date)}</strong> {event.extension_used ? '(1 month extension used)' : '(1 month from receipt)'}</p>
          {event.tm56_submitted_date ? <p className="text-[#0A6B52] font-bold">TM56 submitted: {formatDateShort(event.tm56_submitted_date)}</p> : <>
            {event.response_due_date < new Date().toISOString().slice(0,10) && <p className="text-red-700 font-semibold">Response overdue</p>}
            {editable && <div className="flex flex-wrap items-end gap-3 print:hidden pt-2">
              {!event.extension_used && <button disabled={change.isPending} className="rounded border px-3 py-2" onClick={()=>change.mutate(()=>supabase.from('opposition_events').update({extension_used:true}).eq('id',event.id))}>Use 1 month extension</button>}
              <label className="block">TM56 date<input aria-label={`TM56 submitted date for ${event.description}`} type="date" min={event.received_date} max={event.response_due_date} value={submission[event.id] || ''} onChange={e=>setSubmission({...submission,[event.id]:e.target.value})} className="mt-1 block border rounded px-3 py-2" /></label>
              <button className="rounded bg-[#6C1C1F] text-white px-3 py-2" disabled={change.isPending || !submission[event.id]} onClick={()=>change.mutate(()=>supabase.from('opposition_events').update({tm56_submitted_date:submission[event.id]}).eq('id',event.id))}>Record submission</button>
            </div>}
          </>}
        </div>
      </article>)}
    </div>
    {editable && <form className="flex flex-wrap items-end gap-3 border-t pt-4 print:hidden" onSubmit={e=>{e.preventDefault();change.mutate(()=>supabase.from('opposition_events').insert({trademark_id:record.id,description:description.trim(),received_date:received}),{onSuccess:()=>{setDescription('');setReceived('');}});}}>
      <label className="block">Opposition No<input required value={description} onChange={e=>setDescription(e.target.value)} className="mt-1 block border rounded px-3 py-2" /></label>
      <label className="block">Received date<input required type="date" value={received} onChange={e=>setReceived(e.target.value)} className="mt-1 block border rounded px-3 py-2" /></label>
      <button disabled={change.isPending || !description.trim()} className="rounded bg-[#6C1C1F] text-white px-3 py-2">Add opposition</button>
    </form>}
    <div className="border-t pt-4 space-y-3">
      <h2 className="text-lg font-semibold text-[#6C1C1F]">Agent Payable — Separate from client payments</h2>
      <p className="text-sm text-stone-600">The agent credit is tracked separately from client payment flags and is created when the case reaches Accepted.</p>
      <p className="font-mono text-sm">Agreed case rate: {record.agentRate == null ? 'Not set' : `Rs. ${Number(record.agentRate).toLocaleString()}`}</p>
      {fees.map(fee=><article key={fee.id} className="border border-stone-200 bg-[#F8F6F1] p-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <strong>{fee.description}</strong>
            <div className="font-mono text-xs text-[#6d6658]">Billed Rs. {fee.amountBilled} · Paid Rs. {fee.amountPaid} · Outstanding Rs. {fee.balanceDue}</div>
          </div>
          {fee.balanceDue > 0 && <span className="px-2 py-1 font-mono text-[10px] font-bold uppercase bg-[#FFF0D0] text-[#B0740E] border border-[#B0740E]">Due</span>}
        </div>
      </article>)}
    </div>
  </section>;
}
