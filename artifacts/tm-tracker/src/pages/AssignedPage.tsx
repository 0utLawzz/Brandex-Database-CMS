import { listAgents, listAgentProfiles, assignStage2Agent, listTrademarkPage, CITIES } from "@/lib/api";
import type { TrademarkPage } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { formatDateShort } from "@/lib/utils";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Users2, ChevronLeft, ChevronRight, ExternalLink, ClipboardCheck, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 50;

const STAGE_BADGE: Record<string, string> = {
  "STAGE 1": "bg-[#0D9970] text-white",
  "STAGE 2": "bg-[#D4A800] text-[#0C0C0C]",
  "STAGE 3": "bg-[#C94A00] text-white",
  "STAGE 4": "bg-[#0A6B52] text-white",
  "STOPPED": "bg-[#CC0000] text-white",
};

interface Filters {
  agent: string;
  city: string;
  appClass: string;
}

const EMPTY: Filters = { agent: "", city: "", appClass: "" };

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[] | readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#6d6658]">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 px-2 bg-white border-2 border-[#0C0C0C] font-mono text-xs focus:outline-2 focus:outline-[#C94A00] min-w-[130px]"
      >
        <option value="">ALL</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

export function AssignedPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);
  const [assignmentRecord, setAssignmentRecord] = useState<TrademarkPage["records"][number] | null>(null);
  const [selectedAgentName, setSelectedAgentName] = useState("");
  const [selectedAgentCity, setSelectedAgentCity] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);

  // Assigned page only shows STAGE 2 + Sub-status Assigned
  const { data, isLoading } = useQuery<TrademarkPage>({
    queryKey: ["assigned-page", page, filters],
    queryFn: () => listTrademarkPage({
      page,
      pageSize: PAGE_SIZE,
      stage: "STAGE 2",
      subStage: "Assigned",
      agent: filters.agent || undefined,
      city: filters.city || undefined,
      appClass: filters.appClass || undefined,
    }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  const { data: agents = [] } = useQuery({ queryKey: ["agents"], queryFn: listAgents, staleTime: 5 * 60_000 });
  const { data: agentProfiles = [] } = useQuery({
    queryKey: ["agent-profiles"],
    queryFn: listAgentProfiles,
    staleTime: 5 * 60_000,
  });
  const activeAgentProfiles = useMemo(
    () => agentProfiles.filter((a) => a.isActive !== false),
    [agentProfiles]
  );
  const completedQuery = useQuery({
    queryKey: ["assigned-completed", filters],
    queryFn: async () => {
      const [stage3, stage4] = await Promise.all([
        listTrademarkPage({ page: 1, pageSize: 1, stage: "STAGE 3", agent: filters.agent || undefined, city: filters.city || undefined, appClass: filters.appClass || undefined }),
        listTrademarkPage({ page: 1, pageSize: 1, stage: "STAGE 4", agent: filters.agent || undefined, city: filters.city || undefined, appClass: filters.appClass || undefined }),
      ]);
      return stage3.total + stage4.total;
    },
    staleTime: 60_000,
  });
  const paged = data?.records ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Object.values(filters).some(Boolean);

  const setFilter = (key: keyof Filters, val: string) => {
    setFilters((f) => ({ ...f, [key]: val }));
    setPage(1);
  };

  const goToRecord = (id: string) => navigate(`/record/${id}`);

  const openAssignmentModal = (record: TrademarkPage["records"][number]) => {
    setAssignmentRecord(record);
    setSelectedAgentName(record.agent || "");
    setSelectedAgentCity(record.city || "");
  };

  const handleAssignAgent = async () => {
    if (!assignmentRecord) return;
    if (!assignmentRecord.stage2Paid) {
      toast({
        title: "⚠ Payment Required",
        description: "Stage 2 payment is required before proceeding.",
        variant: "destructive",
      });
      return;
    }
    if (!selectedAgentName.trim()) {
      toast({
        title: "Agent Required",
        description: "Please select an agent from the Agents master list.",
        variant: "destructive",
      });
      return;
    }

    setIsAssigning(true);
    try {
      await assignStage2Agent(
        assignmentRecord.id,
        selectedAgentName.trim(),
        selectedAgentCity.trim() || undefined,
      );
      toast({
        title: "Agent Assigned",
        description: `Successfully assigned to ${selectedAgentName}.`,
      });
      setAssignmentRecord((prev) =>
        prev
          ? {
              ...prev,
              agent: selectedAgentName.trim(),
              city: selectedAgentCity.trim() || prev.city,
            }
          : null,
      );
      queryClient.invalidateQueries({ queryKey: ["assigned-page"] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    } catch (err: any) {
      toast({
        title: "Assignment Error",
        description: err?.message || "Failed to assign agent.",
        variant: "destructive",
      });
    } finally {
      setIsAssigning(false);
    }
  };


  return (
    <AppShell>
      <div className="flex flex-col h-full bg-white">
        <div className="shrink-0 px-6 py-4 bg-[#E8DFC7] border-b-2 border-[#0C0C0C]">
          <div className="flex items-center gap-3 mb-4">
            <Users2 className="w-5 h-5 text-[#0A6B52]" />
            <h1 className="font-serif text-2xl uppercase tracking-widest text-[#0C0C0C] leading-none">ASSIGNED</h1>
            <span className="ml-2 font-mono text-[10px] text-[#6d6658] uppercase tracking-widest">
              STAGE 2 · SUB-STATUS: ASSIGNED
            </span>
            <span className="ml-auto font-mono text-[10px] text-[#6d6658] font-bold uppercase tracking-widest">
              {isLoading ? "LOADING…" : `${total} RECORDS`}
            </span>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <FilterSelect label="AGENT" value={filters.agent} options={agents} onChange={(v) => setFilter("agent", v)} />
            <FilterSelect label="CITY" value={filters.city} options={CITIES} onChange={(v) => setFilter("city", v)} />
            <FilterSelect
              label="CLASS"
              value={filters.appClass}
              options={Array.from({ length: 45 }, (_, index) => String(index + 1))}
              onChange={(v) => setFilter("appClass", v)}
            />
            {hasFilters && (
              <button
                onClick={() => { setFilters(EMPTY); setPage(1); }}
                className="self-end flex items-center gap-1.5 h-9 px-4 border-2 border-[#CC0000] text-[#CC0000] font-mono font-bold text-xs uppercase tracking-wider hover:bg-[#CC0000] hover:text-white transition-colors"
              >
                CLEAR
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full text-left font-mono text-xs whitespace-nowrap border-collapse">
            <thead className="bg-[#0C0C0C] text-[#F0E8D0] sticky top-0 z-10">
              <tr>
                {["", "CASE NUMBER", "CLIENT", "APPLICATION NAME", "TM/CPR NUMBER", "CLASS", "STATUS", "SUB-STATUS", "CITY", "AGENT", "DATE", "ACTIONS"].map((h) => (
                  <th key={h || "img"} className="px-3 py-3 border-r border-[#1A1A1A] font-bold tracking-wider uppercase text-[10px] last:border-r-0">
                    {h || "IMG"}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center font-bold text-[#6d6658] animate-pulse">
                    LOADING ASSIGNED RECORDS…
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-16 text-center">
                    <div className="font-mono font-bold text-[#6d6658] uppercase tracking-widest mb-1">
                      No assigned records found.
                    </div>
                    <div className="font-mono text-xs text-[#9d9488]">
                      Only Stage 2 with Sub-status Assigned are listed here.
                    </div>
                  </td>
                </tr>
              ) : (
                paged.map((r, i) => (
                    <tr
                      key={r.id}
                      className={`cursor-pointer border-b border-[#0C0C0C]/10 transition-colors ${
                      i % 2 === 0 ? "bg-[#F0E8D0]" : "bg-white"
                    } hover:bg-[#D9D0B7]`}
                  >
                    <td className="px-2 py-1.5 border-r border-[#0C0C0C]/10">
                      <div className="w-9 h-9 border border-[#0C0C0C]/30 bg-[#F0E8D0] overflow-hidden flex items-center justify-center">
                        {r.image ? <img src={r.image} alt="" className="w-full h-full object-contain" /> : <span className="text-[8px] text-[#9d9488]">—</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 border-r border-[#0C0C0C]/10 font-bold text-[#0A6B52]">
                      {r.caseNumber || ""}
                    </td>
                    <td className="px-3 py-2 border-r border-[#0C0C0C]/10 max-w-[140px]">
                      <div className="font-bold truncate">{r.clientName || ""}</div>
                      <div className="text-[#6d6658] text-[10px]">{r.clientCode || ""}</div>
                    </td>
                    <td className="px-3 py-2 border-r border-[#0C0C0C]/10 max-w-[200px] truncate">
                      {r.appName || ""}
                    </td>
                    <td className="px-3 py-2 border-r border-[#0C0C0C]/10 font-bold">
                      {r.tmCprNo || ""}
                    </td>
                    <td className="px-3 py-2 border-r border-[#0C0C0C]/10">
                      {r.appClass || ""}
                    </td>
                    <td className="px-3 py-2 border-r border-[#0C0C0C]/10">
                      {r.stage && (
                        <span className={`inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase border border-[#0C0C0C]/20 ${STAGE_BADGE[r.stage] ?? "bg-[#E8DFC7]"}`}>
                          {r.stage}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 border-r border-[#0C0C0C]/10 text-[#6d6658] max-w-[120px] truncate">
                      {r.subStage || ""}
                    </td>
                    <td className="px-3 py-2 border-r border-[#0C0C0C]/10">
                      {r.city || ""}
                    </td>
                    <td className="px-3 py-2 border-r border-[#0C0C0C]/10 font-bold">
                      {r.agent || ""}
                    </td>
                    <td className="px-3 py-2 text-[#6d6658]">
                      {formatDateShort(r.date)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => goToRecord(r.id)} className="inline-flex items-center gap-1 border-2 border-[#0C0C0C] bg-white px-2 py-1 font-mono text-[9px] font-bold uppercase hover:bg-[#0C0C0C] hover:text-white" title="Open complete record detail">
                          <ExternalLink className="h-3 w-3" /> RECORD
                        </button>
                        <button type="button" onClick={() => openAssignmentModal(r)} className="inline-flex items-center gap-1 border-2 border-[#0A6B52] bg-[#D8F2E8] px-2 py-1 font-mono text-[9px] font-bold uppercase text-[#0A6B52] hover:bg-[#0A6B52] hover:text-white" title="Open assignment acceptance summary">
                          <ClipboardCheck className="h-3 w-3" /> ASSIGNMENT
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="shrink-0 flex items-center justify-between px-6 py-3 bg-[#E8DFC7] border-t-2 border-[#0C0C0C]">
            <span className="font-mono text-[10px] text-[#6d6658] font-bold uppercase tracking-widest">
              PAGE {page} OF {totalPages} · {total} RECORDS
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-1.5 border-2 border-[#0C0C0C] bg-white font-mono text-[10px] font-bold uppercase tracking-wider disabled:opacity-40 hover:bg-[#0C0C0C] hover:text-[#F0E8D0] transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> PREV
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1 px-3 py-1.5 border-2 border-[#0C0C0C] bg-white font-mono text-[10px] font-bold uppercase tracking-wider disabled:opacity-40 hover:bg-[#0C0C0C] hover:text-[#F0E8D0] transition-colors"
              >
                NEXT <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
        {assignmentRecord && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0C0C0C]/55 p-4" onClick={() => setAssignmentRecord(null)}>
            <section className="w-full max-w-2xl border-3 border-[#0C0C0C] bg-[#F0E8D0] p-5 shadow-[8px_8px_0_#0C0C0C]" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-start gap-3 border-b-2 border-[#0C0C0C] pb-3">
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#6C1C1F]">AGENT ASSIGNMENT / ACCEPTANCE SUMMARY</div>
                  <h2 className="mt-1 font-serif text-3xl uppercase leading-none text-[#0C0C0C]">{assignmentRecord.appName || "UNTITLED CASE"}</h2>
                  <div className="mt-2 font-mono text-xs font-bold uppercase">CLIENT CODE: {assignmentRecord.clientCode || "—"} · CASE NO: {assignmentRecord.caseNumber || "—"} · TM NO: {assignmentRecord.tmCprNo || "—"}</div>
                </div>
                <button type="button" onClick={() => setAssignmentRecord(null)} className="border-2 border-[#0C0C0C] bg-white p-1 hover:bg-[#0C0C0C] hover:text-white" aria-label="Close assignment summary"><X className="h-4 w-4" /></button>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="border-2 border-[#0C0C0C] bg-white p-3 shadow-[3px_3px_0_#0C0C0C]"><div className="font-mono text-[9px] font-bold uppercase text-[#6d6658]">ASSIGNED QUEUE</div><div className="mt-1 font-serif text-3xl">{total}</div></div>
                <div className="border-2 border-[#0C0C0C] bg-[#D8F2E8] p-3 shadow-[3px_3px_0_#0A6B52]"><div className="font-mono text-[9px] font-bold uppercase text-[#0A6B52]">COMPLETED STAGE 3/4</div><div className="mt-1 font-serif text-3xl text-[#0A6B52]">{completedQuery.data ?? "—"}</div></div>
                <div className="border-2 border-[#0C0C0C] bg-[#FFF0D0] p-3 shadow-[3px_3px_0_#C94A00]"><div className="font-mono text-[9px] font-bold uppercase text-[#6C1C1F]">PENDING IN ASSIGNED QUEUE</div><div className="mt-1 font-serif text-3xl text-[#6C1C1F]">{total}</div></div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-2 border-[#0C0C0C] bg-white p-3 font-mono text-xs uppercase sm:grid-cols-4">
                <div><span className="block text-[9px] font-bold text-[#6d6658]">AGENT</span><strong>{assignmentRecord.agent || "—"}</strong></div>
                <div><span className="block text-[9px] font-bold text-[#6d6658]">CITY</span><strong>{assignmentRecord.city || "—"}</strong></div>
                <div><span className="block text-[9px] font-bold text-[#6d6658]">STATUS</span><strong>{assignmentRecord.stage || "—"}</strong></div>
                <div><span className="block text-[9px] font-bold text-[#6d6658]">SUB-STATUS</span><strong>{assignmentRecord.subStage || "—"}</strong></div>
              </div>
              {!assignmentRecord.stage2Paid ? (
                <>
                  <div className="mt-3 p-3 bg-[#FFF0D0] border-2 border-[#C94A00] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-[#C94A00] shrink-0" />
                      <span className="font-mono text-xs font-bold text-[#6C1C1F]">
                        Stage 2 payment is required before proceeding.
                      </span>
                    </div>
                    <span className="font-mono text-[9px] font-bold text-[#B0740E] border border-[#B0740E] px-1.5 py-0.5 bg-white shrink-0">
                      MANUAL — NOT VERIFIED
                    </span>
                  </div>
                  <div className="mt-3 p-3 bg-white/70 border-2 border-[#0C0C0C]/30 opacity-70">
                    <div className="font-mono text-[10px] font-bold uppercase text-[#6d6658] mb-1">
                      ASSIGN AGENT (BLOCKED)
                    </div>
                    <div className="font-mono text-xs text-[#6C1C1F]">
                      Agent assignment is locked until Stage 2 payment is cleared.
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-3 p-3 bg-[#D8F2E8] border-2 border-[#0A6B52] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#0A6B52] shrink-0" />
                      <span className="font-mono text-xs font-bold text-[#0A6B52]">
                        Stage 2 Payment Confirmed ({assignmentRecord.stage2PaidDate || "Recorded"})
                      </span>
                    </div>
                    <span className="font-mono text-[9px] font-bold text-[#B0740E] border border-[#B0740E] px-1.5 py-0.5 bg-white shrink-0">
                      MANUAL — NOT VERIFIED
                    </span>
                  </div>
                  <div className="mt-3 p-3 bg-white border-2 border-[#0C0C0C] shadow-[3px_3px_0_#0C0C0C]">
                    <div className="font-mono text-[10px] font-bold uppercase text-[#6C1C1F] mb-2 font-bold">
                      SELECT AGENT FROM AGENTS MASTER SYSTEM
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-mono text-[9px] font-bold text-[#6d6658] mb-1">AGENT</label>
                        <select
                          value={selectedAgentName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSelectedAgentName(val);
                            const matched = activeAgentProfiles.find((a) => a.name === val);
                            if (matched?.city && CITIES.includes(matched.city as any)) {
                              setSelectedAgentCity(matched.city);
                            }
                          }}
                          className="w-full h-9 px-2 bg-white border-2 border-[#0C0C0C] font-mono text-xs focus:outline-2 focus:outline-[#C94A00]"
                        >
                          <option value="">-- SELECT AGENT --</option>
                          {selectedAgentName && !activeAgentProfiles.some((a) => a.name === selectedAgentName) && (
                            <option value={selectedAgentName}>{selectedAgentName} (Current)</option>
                          )}
                          {activeAgentProfiles.map((a) => (
                            <option key={a.id} value={a.name}>
                              {a.name} {a.city ? `(${a.city})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block font-mono text-[9px] font-bold text-[#6d6658] mb-1">AGENT CITY</label>
                        <select
                          value={selectedAgentCity}
                          onChange={(e) => setSelectedAgentCity(e.target.value)}
                          className="w-full h-9 px-2 bg-white border-2 border-[#0C0C0C] font-mono text-xs focus:outline-2 focus:outline-[#C94A00]"
                        >
                          <option value="">-- SELECT CITY --</option>
                          {CITIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={handleAssignAgent}
                        disabled={isAssigning || !selectedAgentName.trim()}
                        className="inline-flex items-center gap-1.5 border-2 border-[#0A6B52] bg-[#0A6B52] px-4 py-1.5 font-mono text-xs font-bold uppercase text-white hover:bg-[#074F3C] disabled:opacity-50 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {isAssigning ? "ASSIGNING…" : "CONFIRM ASSIGNMENT"}
                      </button>
                    </div>
                  </div>
                </>
              )}
              <p className="mt-4 border-l-4 border-[#C94A00] bg-[#FFF0D0] p-3 font-mono text-[10px] uppercase leading-relaxed">This view reports the current assignment queue from the trusted trademark status fields. Complete acceptance workflow history is available in the case detail record.</p>
              <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => goToRecord(assignmentRecord.id)} className="inline-flex items-center gap-2 border-2 border-[#6C1C1F] bg-[#6C1C1F] px-3 py-2 font-mono text-xs font-bold uppercase text-white"><ExternalLink className="h-4 w-4" /> OPEN RECORD</button></div>
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
