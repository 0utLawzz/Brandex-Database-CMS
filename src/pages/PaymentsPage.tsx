import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ChevronLeft, ChevronRight, CreditCard, ExternalLink, Loader2, Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { listTrademarkPage } from "@/lib/api";
import type { TrademarkPage } from "@/lib/api";
import { getLedgerStagePayments, normalizeTmDigits } from "@/lib/ledgerPayments";

const PAGE_SIZE = 50;
const STAGES = [1, 2, 3, 4] as const;
const LEDGER_URL = "https://brandex-client-ledger.vercel.app";

export function PaymentsPage() {
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  useEffect(() => {
    const timer = window.setTimeout(() => { setTerm(search.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isFetching, error } = useQuery<TrademarkPage>({
    queryKey: ["payments-case-page", page, term],
    queryFn: () => listTrademarkPage({ page, pageSize: PAGE_SIZE, search: term || undefined, signImages: false }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const cases = data?.records ?? [];
  const tmNumbers = useMemo(() => cases.map((record) => normalizeTmDigits(record.tmCprNo)).filter((tm): tm is string => Boolean(tm)), [cases]);
  const {
    data: ledgerPayments,
    isLoading: isLedgerLoading,
    isFetching: isLedgerFetching,
    error: ledgerError,
    refetch: refreshLedger,
  } = useQuery({
    queryKey: ["payments-ledger-status", tmNumbers],
    queryFn: () => getLedgerStagePayments(tmNumbers),
    enabled: tmNumbers.length > 0,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AppShell>
      <div className="flex-1 overflow-auto bg-[#F0E8D0]">
        <div className="mx-auto max-w-[1600px] p-4 md:p-8">
          <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2 font-mono text-sm font-bold uppercase tracking-widest text-[#0A6B52]"><CreditCard className="h-4 w-4" /> Case Management</div>
              <h1 className="font-serif text-4xl font-bold uppercase leading-none text-[#0C0C0C] md:text-5xl">Payments</h1>
              <p className="mt-3 max-w-3xl text-sm text-stone-700">Live Stage 1–4 receipts from Brandex Client Ledger. Fully cleared Ledger stages unlock the matching CMS workflow gate.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <a href={LEDGER_URL} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 border-2 border-[#0C0C0C] bg-[#0A6B52] px-3 font-mono text-xs font-bold uppercase text-white shadow-[3px_3px_0_#0C0C0C] hover:brightness-110">Open Client Ledger <ExternalLink className="h-4 w-4" /></a>
              <label className="flex h-11 min-w-[260px] items-center gap-2 border-2 border-[#0C0C0C] bg-white px-3 shadow-[3px_3px_0_#0C0C0C]">
                <Search className="h-4 w-4 shrink-0 text-stone-500" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search case, client, TM number…" className="w-full bg-transparent font-mono text-sm outline-none" aria-label="Search payment cases" />
              </label>
            </div>
          </header>

          <section className="mb-5 flex flex-wrap items-start gap-3 border-2 border-[#0A6B52] bg-[#DDF2E9] p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#0A6B52]" />
            <div className="flex-1 font-mono text-sm">
              <p className="font-bold uppercase text-[#0A6B52]">Ledger is the payment source of truth</p>
              <p className="mt-1 text-stone-700">Payments are entered in Client Ledger. CMS reads the Ledger’s stage allocation and mirrors its verified paid status for workflow gates; this page cannot create or override a receipt.</p>
            </div>
            <button type="button" onClick={() => void refreshLedger()} disabled={!tmNumbers.length || isLedgerFetching} className="border-2 border-[#0C0C0C] bg-white px-3 py-2 font-mono text-xs font-bold uppercase disabled:opacity-50">{isLedgerFetching ? "Refreshing…" : "Refresh from Ledger"}</button>
          </section>

          <section className="overflow-hidden border-2 border-[#0C0C0C] bg-[#FAF6EE] shadow-[4px_4px_0_#0C0C0C]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#0C0C0C] bg-[#E8DFC7] px-4 py-3 font-mono text-sm font-bold uppercase">
              <span>Ledger stage receipts <span className="text-stone-600">({total} cases)</span></span>
              <span className="text-xs text-stone-600">{isFetching ? "LOADING CASES…" : isLedgerFetching ? "SYNCING LEDGER…" : `PAGE ${page} OF ${pages}`}</span>
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 p-12 font-mono text-sm"><Loader2 className="h-4 w-4 animate-spin" /> LOADING CASES…</div>
            ) : error ? (
              <div className="p-8 text-center font-mono text-sm text-red-800">{(error as Error).message}<button type="button" onClick={() => void queryClient.invalidateQueries({ queryKey: ["payments-case-page"] })} className="ml-3 underline">RETRY</button></div>
            ) : cases.length === 0 ? (
              <div className="p-12 text-center font-mono text-sm text-stone-600">NO CASES MATCH THIS SEARCH.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1140px] border-collapse text-left">
                  <thead><tr className="border-b-2 border-[#0C0C0C] bg-white font-mono text-xs uppercase tracking-wide">
                    <th className="px-3 py-3">Case</th><th className="px-3 py-3">Current stage</th>
                    {STAGES.map((stage) => <th key={stage} className="px-3 py-3 text-center">Stage {stage}</th>)}
                  </tr></thead>
                  <tbody>{cases.map((record) => {
                    const tm = normalizeTmDigits(record.tmCprNo);
                    const status = tm ? ledgerPayments?.[tm] : undefined;
                    return <tr key={record.id} className="border-b border-stone-300 align-middle last:border-0 hover:bg-[#F0E8D0]/60">
                      <td className="max-w-[360px] px-3 py-3">
                        <Link href={`/record/${record.id}`} className="group inline-flex items-center gap-1 font-bold text-[#0C0C0C] hover:text-[#0A6B52]">{record.appName || "UNTITLED CASE"}<ExternalLink className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100" /></Link>
                        <div className="mt-1 font-mono text-xs text-stone-600">{record.clientCode || "—"} · CASE {record.caseNumber || "—"} · TM {record.tmCprNo || "—"}</div>
                      </td>
                      <td className="px-3 py-3"><div className="font-mono text-xs font-bold uppercase">{record.stage}</div><div className="mt-1 text-sm text-stone-600">{record.subStage || "—"}</div></td>
                      {STAGES.map((stage) => {
                        const stageStatus = status?.[`S${stage}` as const];
                        const paid = stageStatus?.paid === true;
                        return <td key={stage} className="px-2 py-3 text-center">
                          <div className={`mx-auto flex min-w-[128px] flex-col items-center gap-1 border-2 px-2 py-2 font-mono text-xs ${paid ? "border-[#0A6B52] bg-[#D8F2E8] text-[#0A6B52]" : "border-stone-300 bg-white text-stone-600"}`}>
                            <span className="font-bold uppercase">{isLedgerLoading ? "Checking…" : paid ? "Paid" : tm && ledgerError ? "Unavailable" : !tm ? "TM Required" : "Unpaid"}</span>
                            <span>RECEIVED RS. {Number(stageStatus?.amount_received ?? 0).toLocaleString()}</span>
                            <span>DUE RS. {Number(stageStatus?.amount_due ?? 0).toLocaleString()}</span>
                            {stageStatus?.paid_date && <span>{stageStatus.paid_date}</span>}
                          </div>
                        </td>;
                      })}
                    </tr>;
                  })}</tbody>
                </table>
              </div>
            )}
            <div className="flex items-center justify-between border-t-2 border-[#0C0C0C] bg-white px-4 py-3 font-mono text-xs font-bold uppercase">
              <span>{total ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} OF ${total}` : "0 CASES"}</span>
              <div className="flex gap-2"><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || isFetching} className="border-2 border-[#0C0C0C] p-2 disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button><button type="button" onClick={() => setPage((value) => Math.min(pages, value + 1))} disabled={page >= pages || isFetching} className="border-2 border-[#0C0C0C] p-2 disabled:opacity-40" aria-label="Next page"><ChevronRight className="h-4 w-4" /></button></div>
            </div>
          </section>
          <p className="mt-4 text-right font-mono text-xs text-stone-600"><Link href="/assigned" className="underline underline-offset-2 hover:text-[#0A6B52]">Agent payables remain in Assigned → Accepted / Agent Payments.</Link></p>
        </div>
      </div>
    </AppShell>
  );
}
