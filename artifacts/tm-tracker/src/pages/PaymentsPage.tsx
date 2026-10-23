import { useEffect, useState } from "react";
import { Link } from "wouter";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, ChevronLeft, ChevronRight, CreditCard, ExternalLink, Loader2, Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { getStaffRole, listTrademarkPage, updateStagePayment } from "@/lib/api";
import type { TrademarkPage } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 50;
const STAGES = [1, 2, 3, 4] as const;
type StageNumber = (typeof STAGES)[number];

export function PaymentsPage() {
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: role } = useQuery({ queryKey: ["staff-role"], queryFn: getStaffRole, staleTime: 5 * 60_000 });
  const canEdit = role === "admin";

  useEffect(() => {
    const timer = window.setTimeout(() => { setTerm(search.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isFetching, error } = useQuery<TrademarkPage>({
    queryKey: ["payments-case-page", page, term],
    queryFn: () => listTrademarkPage({ page, pageSize: PAGE_SIZE, search: term || undefined }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const paymentMutation = useMutation({
    mutationFn: ({ id, stage, paid, date }: { id: string; stage: StageNumber; paid: boolean; date?: string }) =>
      updateStagePayment(id, stage, paid, date ?? (paid ? new Date().toISOString().slice(0, 10) : null)),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["payments-case-page"] }),
        queryClient.invalidateQueries({ queryKey: ["trademark-page"] }),
        queryClient.invalidateQueries({ queryKey: ["trademark"] }),
        queryClient.invalidateQueries({ queryKey: ["record"] }),
      ]);
      toast({ title: "Case payment status updated", description: "Manual CMS flag saved. This does not verify receipt in the Ledger." });
    },
    onError: (mutationError: Error) => toast({ title: "Could not update payment status", description: mutationError.message, variant: "destructive" }),
  });

  const cases = data?.records ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const getPayment = (record: (typeof cases)[number], stage: StageNumber) => ({
    paid: record[`stage${stage}Paid` as const] ?? false,
    date: record[`stage${stage}PaidDate` as const] ?? null,
  });

  return (
    <AppShell>
      <div className="flex-1 overflow-auto bg-[#F0E8D0]">
        <div className="mx-auto max-w-[1600px] p-4 md:p-8">
          <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2 font-mono text-sm font-bold uppercase tracking-widest text-[#0A6B52]"><CreditCard className="h-4 w-4" /> Case Management</div>
              <h1 className="font-serif text-4xl font-bold uppercase leading-none text-[#0C0C0C] md:text-5xl">Payments</h1>
              <p className="mt-3 max-w-3xl text-sm text-stone-700">Track each case’s Stage 1–4 payment gate. Changes here update the same case payment flags used by workflow progression.</p>
            </div>
            <label className="flex h-11 min-w-[260px] items-center gap-2 border-2 border-[#0C0C0C] bg-white px-3 shadow-[3px_3px_0_#0C0C0C]">
              <Search className="h-4 w-4 shrink-0 text-stone-500" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search case, client, TM number…" className="w-full bg-transparent font-mono text-sm outline-none" aria-label="Search payment cases" />
            </label>
          </header>

          <section className="mb-5 flex flex-wrap items-start gap-3 border-2 border-[#B0740E] bg-[#FFF0D0] p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#8A5B00]" />
            <div className="font-mono text-sm">
              <p className="font-bold uppercase text-[#6D4A00]">Manual CMS flags — not Ledger verified</p>
              <p className="mt-1 text-stone-700">Recording a cleared flag unlocks the next workflow stage. It does not create or confirm a bank/client receipt. Actual client payment records remain in Brandex Ledger.</p>
            </div>
          </section>

          <section className="overflow-hidden border-2 border-[#0C0C0C] bg-[#FAF6EE] shadow-[4px_4px_0_#0C0C0C]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#0C0C0C] bg-[#E8DFC7] px-4 py-3 font-mono text-sm font-bold uppercase">
              <span>Case payment gates <span className="text-stone-600">({total} cases)</span></span>
              <span className="text-xs text-stone-600">{isFetching ? "UPDATING…" : `PAGE ${page} OF ${pages}`}</span>
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 p-12 font-mono text-sm"><Loader2 className="h-4 w-4 animate-spin" /> LOADING CASES…</div>
            ) : error ? (
              <div className="p-8 text-center font-mono text-sm text-red-800">{(error as Error).message}<button type="button" onClick={() => void queryClient.invalidateQueries({ queryKey: ["payments-case-page"] })} className="ml-3 underline">RETRY</button></div>
            ) : cases.length === 0 ? (
              <div className="p-12 text-center font-mono text-sm text-stone-600">NO CASES MATCH THIS SEARCH.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1040px] border-collapse text-left">
                  <thead><tr className="border-b-2 border-[#0C0C0C] bg-white font-mono text-xs uppercase tracking-wide">
                    <th className="px-3 py-3">Case</th><th className="px-3 py-3">Current stage</th>
                    {STAGES.map((stage) => <th key={stage} className="px-3 py-3 text-center">Stage {stage}</th>)}
                  </tr></thead>
                  <tbody>{cases.map((record) => <tr key={record.id} className="border-b border-stone-300 align-middle last:border-0 hover:bg-[#F0E8D0]/60">
                    <td className="max-w-[360px] px-3 py-3">
                      <Link href={`/record/${record.id}`} className="group inline-flex items-center gap-1 font-bold text-[#0C0C0C] hover:text-[#0A6B52]">
                        {record.appName || "UNTITLED CASE"}<ExternalLink className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100" />
                      </Link>
                      <div className="mt-1 font-mono text-xs text-stone-600">{record.clientCode || "—"} · CASE {record.caseNumber || "—"} · TM {record.tmCprNo || "—"}</div>
                    </td>
                    <td className="px-3 py-3"><div className="font-mono text-xs font-bold uppercase">{record.stage}</div><div className="mt-1 text-sm text-stone-600">{record.subStage || "—"}</div></td>
                    {STAGES.map((stage) => {
                      const payment = getPayment(record, stage);
                      return <td key={stage} className="px-2 py-3 text-center">
                        <button type="button" disabled={!canEdit || paymentMutation.isPending} aria-pressed={payment.paid} aria-label={`${payment.paid ? "Clear" : "Record"} Stage ${stage} payment for ${record.appName || record.caseNumber}`} onClick={() => paymentMutation.mutate({ id: record.id, stage, paid: !payment.paid })}
                          className={`inline-flex min-w-[112px] flex-col items-center justify-center gap-1 border-2 px-2 py-2 font-mono text-xs font-bold uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${payment.paid ? "border-[#0A6B52] bg-[#D8F2E8] text-[#0A6B52]" : "border-stone-400 bg-white text-stone-600 hover:border-[#B0740E] hover:bg-[#FFF0D0]"}`}>
                          {paymentMutation.isPending && paymentMutation.variables?.id === record.id && paymentMutation.variables?.stage === stage ? <Loader2 className="h-4 w-4 animate-spin" /> : payment.paid ? <Check className="h-4 w-4" /> : <span className="h-4 w-4 leading-4">—</span>}
                          {payment.paid ? "Cleared" : "Pending"}
                          {payment.date && <span className="text-[10px] font-medium normal-case">{payment.date}</span>}
                        </button>
                      </td>;
                    })}
                  </tr>)}</tbody>
                </table>
              </div>
            )}
            <div className="flex items-center justify-between border-t-2 border-[#0C0C0C] bg-white px-4 py-3 font-mono text-xs font-bold uppercase">
              <span>{total ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} OF ${total}` : "0 CASES"}</span>
              <div className="flex gap-2"><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || isFetching} className="border-2 border-[#0C0C0C] p-2 disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button><button type="button" onClick={() => setPage((value) => Math.min(pages, value + 1))} disabled={page >= pages || isFetching} className="border-2 border-[#0C0C0C] p-2 disabled:opacity-40" aria-label="Next page"><ChevronRight className="h-4 w-4" /></button></div>
            </div>
            {!canEdit && role === "viewer" && <p className="border-t border-stone-300 px-4 py-2 font-mono text-xs text-stone-600">Viewer access is read-only. Ask an Admin to update payment status.</p>}
          </section>
          <p className="mt-4 text-right font-mono text-xs text-stone-600"><Link href="/assigned" className="underline underline-offset-2 hover:text-[#0A6B52]">Agent payables are managed in Assigned → Accepted / Agent Payments.</Link></p>
        </div>
      </div>
    </AppShell>
  );
}
