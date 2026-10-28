import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  ExternalLink,
  Loader2,
  Search,
  Plus,
  RefreshCw,
  Printer,
  CheckCircle2,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { listTrademarkPage } from "@/lib/api";
import type { TrademarkPage, TrademarkRecord } from "@/lib/api";
import { getLedgerStagePayments, normalizeTmDigits, type LedgerStagePayment } from "@/lib/ledgerPayments";
import { RecordReceiptModal } from "@/components/RecordReceiptModal";
import { ReceiptPrintModal } from "@/components/ReceiptPrintModal";

const PAGE_SIZE = 50;
const STAGES = [1, 2, 3, 4] as const;

export function PaymentsPage() {
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [selectedCase, setSelectedCase] = useState<TrademarkRecord | null>(null);
  const [targetStage, setTargetStage] = useState<"S1" | "S2" | "S3" | "S4">("S1");
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [printedReceipt, setPrintedReceipt] = useState<any | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTerm(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isFetching, error } = useQuery<TrademarkPage>({
    queryKey: ["payments-case-page", page, term],
    queryFn: () => listTrademarkPage({ page, pageSize: PAGE_SIZE, search: term || undefined, signImages: false }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const cases = data?.records ?? [];
  const tmNumbers = useMemo(
    () => cases.map((record) => normalizeTmDigits(record.tmCprNo)).filter((tm): tm is string => Boolean(tm)),
    [cases]
  );

  const {
    data: ledgerPayments,
    isLoading: isLedgerLoading,
    isFetching: isLedgerFetching,
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

  const handleOpenRecordReceipt = (record: TrademarkRecord, stageNum: 1 | 2 | 3 | 4) => {
    setSelectedCase(record);
    setTargetStage(`S${stageNum}` as any);
    setRecordModalOpen(true);
  };

  const handleReceiptRecorded = (receiptData: any) => {
    setPrintedReceipt(receiptData);
  };

  return (
    <AppShell>
      <div className="flex-1 overflow-auto bg-[#F0E8D0]">
        <div className="mx-auto max-w-[1600px] p-4 md:p-8 space-y-6">
          {/* Header */}
          <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b-[3px] border-[#0C0C0C]">
            <div>
              <div className="mb-1 flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-widest text-[#0A6B52]">
                <CreditCard className="h-4 w-4" />
                <span>UNIFIED CLIENT LEDGER &middot; 1 DATABASE SYSTEM</span>
              </div>
              <h1 className="font-serif text-4xl sm:text-5xl font-bold uppercase leading-none text-[#0C0C0C]">
                CLIENT PAYMENTS &amp; RECEIPTS
              </h1>
              <p className="mt-2 text-xs font-mono text-stone-700 max-w-3xl">
                Integrated stage billing and receipts. Posting an official receipt directly unlocks the case's statutory workflow progression gate in real time.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex h-10 min-w-[260px] items-center gap-2 border-2 border-[#0C0C0C] bg-white px-3 shadow-[2px_2px_0_#0C0C0C]">
                <Search className="h-4 w-4 shrink-0 text-stone-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search case, client, TM number…"
                  className="w-full bg-transparent font-mono text-xs outline-none uppercase"
                  aria-label="Search payment cases"
                />
              </label>

              <button
                type="button"
                onClick={() => void refreshLedger()}
                disabled={isLedgerFetching}
                className="h-10 px-3 border-2 border-[#0C0C0C] bg-white font-mono text-xs font-bold uppercase shadow-[2px_2px_0_#0C0C0C] flex items-center gap-1.5 hover:bg-stone-100 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLedgerFetching ? "animate-spin" : ""}`} />
                <span>{isLedgerFetching ? "SYNCING…" : "REFRESH"}</span>
              </button>
            </div>
          </header>

          {/* Unified Ledger Banner */}
          <section className="flex flex-wrap items-start justify-between gap-3 border-2 border-[#0C0C0C] bg-[#FAF6EE] p-4 shadow-[4px_4px_0_#0C0C0C]">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#0A6B52]" />
              <div className="font-mono text-xs">
                <p className="font-bold uppercase text-[#0A6B52]">
                  Directly Unified in Primary Database
                </p>
                <p className="mt-0.5 text-stone-700">
                  Receipts are recorded directly into the <code className="bg-stone-200 px-1 py-0.5 text-[#0C0C0C]">client_ledger_entries</code> table. No separate Edge Function or cross-project token needed.
                </p>
              </div>
            </div>
            <div className="font-mono text-xs text-[#0A6B52] font-bold uppercase self-center bg-[#0D9970]/10 border border-[#0A6B52] px-3 py-1">
              LIVE DATABASE CONNECTION
            </div>
          </section>

          {/* Ledger Table */}
          <section className="overflow-hidden border-2 border-[#0C0C0C] bg-[#FAF6EE] shadow-[6px_6px_0_#0C0C0C]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#0C0C0C] bg-[#E8DFC7] px-4 py-3 font-mono text-xs font-bold uppercase">
              <span>
                Case Receipts &amp; Balances <span className="text-stone-600">({total} total cases)</span>
              </span>
              <span className="text-stone-600">
                {isFetching ? "LOADING CASES…" : isLedgerFetching ? "REFRESHING BALANCES…" : `PAGE ${page} OF ${pages}`}
              </span>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center gap-2 p-12 font-mono text-sm text-[#0C0C0C]">
                <Loader2 className="h-5 w-5 animate-spin text-[#C94A00]" />
                <span>LOADING CASE DATA…</span>
              </div>
            ) : error ? (
              <div className="p-8 text-center font-mono text-sm text-red-800">
                {(error as Error).message}
                <button
                  type="button"
                  onClick={() => void queryClient.invalidateQueries({ queryKey: ["payments-case-page"] })}
                  className="ml-3 underline font-bold"
                >
                  RETRY
                </button>
              </div>
            ) : cases.length === 0 ? (
              <div className="p-12 text-center font-mono text-sm text-stone-600">
                NO CASES MATCH THIS SEARCH QUERY.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1180px] border-collapse text-left">
                  <thead>
                    <tr className="border-b-2 border-[#0C0C0C] bg-white font-mono text-xs uppercase tracking-wide">
                      <th className="px-4 py-3">Case Information</th>
                      <th className="px-3 py-3">Workflow Stage</th>
                      {STAGES.map((s) => (
                        <th key={s} className="px-3 py-3 text-center">
                          Stage {s} Receipt
                        </th>
                      ))}
                      <th className="px-3 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cases.map((record) => {
                      const tm = normalizeTmDigits(record.tmCprNo);
                      const status = tm ? ledgerPayments?.[tm] : undefined;

                      return (
                        <tr
                          key={record.id}
                          className="border-b border-stone-300 align-middle last:border-0 hover:bg-[#F0E8D0]/60 transition-colors"
                        >
                          {/* Case Info */}
                          <td className="max-w-[340px] px-4 py-3">
                            <Link
                              href={`/record/${record.id}`}
                              className="group inline-flex items-center gap-1.5 font-sans font-bold text-sm text-[#0C0C0C] hover:text-[#C94A00] uppercase truncate block"
                            >
                              <span>{record.appName || "UNTITLED CASE"}</span>
                              <ExternalLink className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100 shrink-0" />
                            </Link>
                            <div className="mt-1 font-mono text-xs text-stone-600 truncate">
                              {record.clientCode ? `CLIENT: ${record.clientCode}` : "—"} &middot; CASE {record.caseNumber || "—"} &middot; TM {record.tmCprNo || "PENDING"}
                            </div>
                          </td>

                          {/* Current Stage */}
                          <td className="px-3 py-3">
                            <div className="font-mono text-xs font-bold uppercase text-[#0C0C0C]">
                              {record.stage}
                            </div>
                            <div className="mt-0.5 text-xs font-mono text-stone-600">
                              {record.subStage || "—"}
                            </div>
                          </td>

                          {/* Stages 1 to 4 */}
                          {STAGES.map((stageNum) => {
                            const stageKey = `S${stageNum}` as "S1" | "S2" | "S3" | "S4";
                            const stageStatus: LedgerStagePayment | undefined = status?.[stageKey];
                            const isPaid = stageStatus?.paid === true;
                            const paidDate = stageStatus?.paid_date ?? null;
                            const amountRec = Number(stageStatus?.amount_received || 0);

                            return (
                              <td key={stageNum} className="px-2 py-3 text-center">
                                <div
                                  className={`mx-auto flex min-w-[130px] flex-col items-center gap-1 border-2 p-2 font-mono text-xs shadow-[2px_2px_0_#0C0C0C] ${
                                    isPaid
                                      ? "border-[#0A6B52] bg-[#D8F2E8] text-[#0A6B52]"
                                      : "border-stone-400 bg-white text-stone-700"
                                  }`}
                                >
                                  <span className="font-bold uppercase tracking-wider">
                                    {isPaid ? "PAID" : "UNPAID"}
                                  </span>

                                  {isPaid ? (
                                    <>
                                      <span className="text-[11px] font-bold">
                                        {amountRec > 0 ? `PKR ${amountRec.toLocaleString()}` : "CLEARED"}
                                      </span>
                                      {paidDate && (
                                        <span className="text-[10px] opacity-80">{paidDate}</span>
                                      )}
                                      {stageStatus?.receipt_no && (
                                        <span className="text-[9px] bg-white px-1 border border-[#0A6B52]/40 text-[#0C0C0C] font-bold">
                                          {stageStatus.receipt_no}
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenRecordReceipt(record, stageNum)}
                                      className="mt-1 px-2 py-0.5 bg-[#C94A00] text-white border border-[#0C0C0C] text-[10px] font-bold uppercase shadow-[1px_1px_0_#0C0C0C] hover:brightness-110 cursor-pointer"
                                    >
                                      + RECEIVE
                                    </button>
                                  )}
                                </div>
                              </td>
                            );
                          })}

                          {/* Quick Actions */}
                          <td className="px-3 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleOpenRecordReceipt(record, 1)}
                                className="px-2.5 py-1 bg-[#0A6B52] text-white border-2 border-[#0C0C0C] font-mono text-xs font-bold uppercase shadow-[2px_2px_0_#0C0C0C] hover:brightness-110 flex items-center gap-1 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                                <span>RECEIPT</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            <div className="flex items-center justify-between border-t-2 border-[#0C0C0C] bg-white px-4 py-3 font-mono text-xs font-bold uppercase">
              <span>
                {total ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} OF ${total}` : "0 CASES"}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((v) => Math.max(1, v - 1))}
                  disabled={page <= 1 || isFetching}
                  className="border-2 border-[#0C0C0C] p-2 bg-white shadow-[2px_2px_0_#0C0C0C] disabled:opacity-40 cursor-pointer hover:bg-stone-100"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPage((v) => Math.min(pages, v + 1))}
                  disabled={page >= pages || isFetching}
                  className="border-2 border-[#0C0C0C] p-2 bg-white shadow-[2px_2px_0_#0C0C0C] disabled:opacity-40 cursor-pointer hover:bg-stone-100"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Record Receipt Modal */}
      {selectedCase && (
        <RecordReceiptModal
          isOpen={recordModalOpen}
          onClose={() => setRecordModalOpen(false)}
          trademarkId={selectedCase.id}
          caseTitle={selectedCase.appName || `Case ${selectedCase.caseNumber}`}
          tmNumber={selectedCase.tmCprNo}
          clientCode={selectedCase.clientCode}
          initialStage={targetStage}
          onReceiptRecorded={handleReceiptRecorded}
        />
      )}

      {/* Receipt Print Voucher Modal */}
      <ReceiptPrintModal
        isOpen={Boolean(printedReceipt)}
        onClose={() => setPrintedReceipt(null)}
        receipt={printedReceipt}
      />
    </AppShell>
  );
}
