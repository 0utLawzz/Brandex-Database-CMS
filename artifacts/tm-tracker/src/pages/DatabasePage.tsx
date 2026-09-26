import {
  CASE_TYPES, CITIES, listAgents, listTrademarkPage, listTrademarksForExport,
  STAGES, TM_FORMS, VALID_TYPES, formatWorkflowLabel,
} from "@/lib/api";
import type { TrademarkListParams, TrademarkPage, TrademarkRecord, TmFormKey } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { RecordModal } from "@/components/RecordModal";
import { RegistryImportModal } from "@/components/RegistryImportModal";
import { formatDateShort, formatDateLong, getRelativeAge, getFormDate } from "@/lib/utils";
import { getStaffRole } from "@/lib/registryImport";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, ChevronRight, Database as DatabaseIcon, Download, Filter, Plus, Search, Upload, X } from "lucide-react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const;
const DEFAULT_PAGE_SIZE = 50;
const STAGE_BADGE: Record<string, string> = {
  "STAGE 1": "bg-[#0D9970] text-white", "STAGE 2": "bg-[#B0740E] text-white",
  "STAGE 3": "bg-[#6C1C1F] text-white", "STAGE 4": "bg-[#0A6B52] text-white", STOPPED: "bg-[#CC0000] text-white",
};

interface Filters {
  search: string; dateFrom: string; dateTo: string; type: string; clientCode: string;
  stage: string; subStage: string; appClass: string; caseType: string; city: string;
  agent: string; tmForm: "" | TmFormKey;
}
const EMPTY_FILTERS: Filters = {
  search: "", dateFrom: "", dateTo: "", type: "", clientCode: "", stage: "",
  subStage: "", appClass: "", caseType: "", city: "", agent: "", tmForm: "",
};

const CSV_COLUMNS: Array<[string, (record: TrademarkRecord) => string]> = [
  ["DATE", (r) => r.date], ["TYPE", (r) => r.type], ["CLIENT CODE", (r) => r.clientCode],
  ["CASE NUMBER", (r) => r.caseNumber],
  ["APPLICATION NAME", (r) => r.appName], ["TM/CPR NUMBER", (r) => r.tmCprNo],
  ["CLASS", (r) => r.appClass], ["STATUS", (r) => r.stage], ["SUB STATUS", (r) => formatWorkflowLabel(r.subStage)],
  ["CASE TYPE", (r) => r.caseType], ["AGENT", (r) => r.agent], ["CITY", (r) => r.city],
  ["TM5", (r) => r.tm5], ["TM6", (r) => r.tm6], ["TM11", (r) => r.tm11],
  ["TM16", (r) => r.tm16], ["TM56", (r) => r.tm56],
  ["JOURNAL NUMBER", (r) => r.journalNumber], ["JOURNAL DATE", (r) => r.journalDate],
  ["NOTES", (r) => r.notes], ["IMAGE", (r) => r.imagePath ?? ""], ["LAST MODIFIED", (r) => r.updatedAt],
];
function csvCell(value: string) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }
function downloadCsv(records: TrademarkRecord[]) {
  const rows = [CSV_COLUMNS.map(([label]) => csvCell(label)).join(","), ...records.map((record) => CSV_COLUMNS.map(([, read]) => csvCell(read(record))).join(","))];
  const blob = new Blob(["\uFEFF", rows.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `brandex-datasheet-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1.5"><span className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#6d6658]">{label}</span>{children}</label>;
}
const filterControl = "h-9 px-2 bg-white border-2 border-[#0C0C0C] font-mono text-xs focus:outline-2 focus:outline-[#6C1C1F] min-w-[105px]";

export function DatabasePage() {
  const [location, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [staffRole, setStaffRole] = useState<"viewer" | "editor" | "admin" | null>(null);

  useEffect(() => { const timer = window.setTimeout(() => setDebouncedSearch(filters.search.trim()), 300); return () => window.clearTimeout(timer); }, [filters.search]);
  useEffect(() => {
    let cancelled = false;
    getStaffRole().then((role) => { if (!cancelled) setStaffRole(role); }).catch(() => { if (!cancelled) setStaffRole(null); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "1") setModalOpen(true);
    const tmForm = params.get("tmForm");
    const agent = params.get("agent");
    const appClass = params.get("appClass");
    setFilters((current) => {
      const next = { ...current };
      let changed = false;
      if (tmForm && TM_FORMS.includes(tmForm as TmFormKey)) { next.tmForm = tmForm as TmFormKey; changed = true; }
      if (agent) { next.agent = agent; changed = true; }
      if (appClass) { next.appClass = appClass; changed = true; }
      if (changed) setShowFilters(true);
      return changed ? next : current;
    });
  }, [location]);

  const apiFilters = useMemo<Omit<TrademarkListParams, "page" | "pageSize">>(() => ({
    search: debouncedSearch || undefined, dateFrom: filters.dateFrom || undefined, dateTo: filters.dateTo || undefined,
    type: filters.type || undefined, clientCode: filters.clientCode || undefined, stage: filters.stage || undefined,
    subStage: filters.subStage || undefined, appClass: filters.appClass || undefined, caseType: filters.caseType || undefined,
    city: filters.city || undefined, agent: filters.agent || undefined, tmForm: filters.tmForm || undefined,
  }), [debouncedSearch, filters]);

  const { data, isLoading, isFetching, error } = useQuery<TrademarkPage>({
    queryKey: ["trademark-page", page, pageSize, apiFilters], queryFn: () => listTrademarkPage({ ...apiFilters, page, pageSize }),
    placeholderData: keepPreviousData, staleTime: 60_000,
  });
  const { data: agents = [] } = useQuery<string[]>({ queryKey: ["agents"], queryFn: listAgents, staleTime: 5 * 60_000 });
  const records = data?.records ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = Object.entries(filters).some(([key, value]) => key !== "search" && Boolean(value));
  const setFilter = (key: keyof Filters, value: string) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  const handlePageSizeChange = (newSize: number) => { setPageSize(newSize); setPage(1); };
  const clearFilters = () => { setFilters(EMPTY_FILTERS); setDebouncedSearch(""); setPage(1); };
  const closeModal = () => { setModalOpen(false); navigate("/database"); };
  const handleSaved = async () => { await queryClient.invalidateQueries({ queryKey: ["trademark-page"] }); await queryClient.invalidateQueries({ queryKey: ["stats"] }); closeModal(); };
  const handleExport = async () => { setExporting(true); try { downloadCsv(await listTrademarksForExport(apiFilters)); } finally { setExporting(false); } };

  return (
    <AppShell>
      <div className="flex flex-col h-full bg-white">
        <div className="shrink-0 flex flex-wrap items-center gap-3 px-4 sm:px-6 py-3 bg-[#E8DFC7] border-b-2 border-[#0C0C0C]">
          <DatabaseIcon className="w-5 h-5 text-[#6C1C1F] hidden sm:block" />
          <h1 className="font-serif text-2xl uppercase tracking-widest text-[#0C0C0C] leading-none mr-auto">DATABASE</h1>
          <span className="font-mono text-[10px] text-[#6d6658] font-bold uppercase tracking-widest hidden md:inline">{isLoading || isFetching ? "LOADING…" : `${total} RECORDS`}</span>
          <div className="relative order-last sm:order-none w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6d6658]" />
            <input value={filters.search} onChange={(event) => setFilter("search", event.target.value)} placeholder="Search any key field…" className="w-full h-10 pl-9 pr-9 bg-white border-2 border-[#0C0C0C] font-mono text-xs focus:outline-2 focus:outline-[#6C1C1F]" />
            {filters.search && <button onClick={() => setFilter("search", "")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1" aria-label="Clear search"><X className="w-3.5 h-3.5" /></button>}
          </div>
          <button onClick={() => setShowFilters((value) => !value)} className={`flex items-center gap-2 px-3 h-10 border-2 border-[#0C0C0C] font-mono font-bold text-xs uppercase tracking-wider ${showFilters || hasFilters ? "bg-[#0C0C0C] text-[#F0E8D0]" : "bg-white"}`}><Filter className="w-4 h-4" /> FILTERS{hasFilters ? " ●" : ""}</button>
          <button onClick={handleExport} disabled={exporting || total === 0} className="flex items-center gap-2 px-3 h-10 bg-white border-2 border-[#6C1C1F] text-[#6C1C1F] font-mono font-bold text-xs uppercase tracking-wider disabled:opacity-40"><Download className="w-4 h-4" /> {exporting ? "EXPORTING…" : "EXPORT"}</button>
          {staffRole === "admin" ? (
            <button onClick={() => setImportOpen(true)} className="flex items-center gap-2 px-3 h-10 bg-white border-2 border-[#0A6B52] text-[#0A6B52] font-mono font-bold text-xs uppercase tracking-wider hover:bg-[#0A6B52] hover:text-white"><Upload className="w-4 h-4" /> DATABASE IMPORT</button>
          ) : (
            <button onClick={() => alert("CSV Import is admin-only.")} className="flex items-center gap-2 px-3 h-10 bg-white border-2 border-[#0A6B52] text-[#0A6B52] font-mono font-bold text-xs uppercase tracking-wider opacity-60" title="Admin only">DATABASE IMPORT</button>
          )}
          {staffRole === "admin" ? (
            <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 px-4 h-10 bg-[#6C1C1F] text-white border-2 border-[#6C1C1F] font-mono font-bold text-xs uppercase tracking-wider hover:brightness-110"><Plus className="w-4 h-4" /> ADD RECORD</button>
          ) : (
            <button onClick={() => alert("Adding records requires Admin role.")} className="flex items-center gap-2 px-4 h-10 bg-[#6C1C1F] text-white border-2 border-[#6C1C1F] font-mono font-bold text-xs uppercase tracking-wider opacity-60" title="Admin role required"><Plus className="w-4 h-4" /> ADD RECORD</button>
          )}
        </div>

        {showFilters && (
          <div className="shrink-0 flex flex-wrap items-end gap-3 px-4 sm:px-6 py-4 bg-[#F0E8D0] border-b-2 border-[#0C0C0C]">
            <FilterField label="FROM"><input type="date" value={filters.dateFrom} onChange={(e) => setFilter("dateFrom", e.target.value)} className={filterControl} /></FilterField>
            <FilterField label="TO"><input type="date" value={filters.dateTo} onChange={(e) => setFilter("dateTo", e.target.value)} className={filterControl} /></FilterField>
            <FilterField label="TYPE"><select value={filters.type} onChange={(e) => setFilter("type", e.target.value)} className={filterControl}><option value="">ALL</option>{VALID_TYPES.map((value) => <option key={value}>{value}</option>)}</select></FilterField>
            <FilterField label="CLIENT CODE"><input value={filters.clientCode} onChange={(e) => setFilter("clientCode", e.target.value)} placeholder="Code…" className={`${filterControl} w-28`} /></FilterField>
            <FilterField label="STATUS"><select value={filters.stage} onChange={(e) => setFilter("stage", e.target.value)} className={filterControl}><option value="">ALL</option>{STAGES.map((value) => <option key={value}>{value}</option>)}</select></FilterField>
            <FilterField label="SUB-STATUS"><input value={filters.subStage} onChange={(e) => setFilter("subStage", e.target.value)} placeholder="Contains…" className={filterControl} /></FilterField>
            <FilterField label="CLASS"><select value={filters.appClass} onChange={(e) => setFilter("appClass", e.target.value)} className={filterControl}><option value="">ALL</option>{Array.from({ length: 45 }, (_, i) => String(i + 1)).map((value) => <option key={value}>{value}</option>)}</select></FilterField>
            <FilterField label="CASE TYPE"><select value={filters.caseType} onChange={(e) => setFilter("caseType", e.target.value)} className={filterControl}><option value="">ALL</option>{CASE_TYPES.map((value) => <option key={value}>{value}</option>)}</select></FilterField>
            <FilterField label="CITY"><select value={filters.city} onChange={(e) => setFilter("city", e.target.value)} className={filterControl}><option value="">ALL</option>{CITIES.map((value) => <option key={value}>{value}</option>)}</select></FilterField>
            <FilterField label="AGENT"><select value={filters.agent} onChange={(e) => setFilter("agent", e.target.value)} className={filterControl}><option value="">ALL</option>{agents.map((value) => <option key={value}>{value}</option>)}</select></FilterField>
            <FilterField label="TM FORM"><select value={filters.tmForm} onChange={(e) => setFilter("tmForm", e.target.value)} className={filterControl}><option value="">ALL</option>{TM_FORMS.map((value) => <option key={value}>{value}</option>)}</select></FilterField>
            {hasFilters && <button onClick={clearFilters} className="flex items-center gap-1.5 h-9 px-4 border-2 border-[#CC0000] text-[#CC0000] font-mono font-bold text-xs uppercase hover:bg-[#CC0000] hover:text-white"><X className="w-3.5 h-3.5" /> CLEAR</button>}
          </div>
        )}

        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full text-left font-mono text-xs whitespace-nowrap border-collapse">
            <thead className="bg-[#1A1A1A] text-[#F0E8D0] sticky top-0 z-10">
              <tr>
                {["DATE", "IMAGE", "MODIFIED", "TYPE", "CLIENT CODE", "CASE NO", "TM/CPR", "CLASS", "APPLICATION", "STATUS", "SUB-STATUS", "AGENT", "CITY", "TM FORM IPO (REGISTRY MATCHES)", "JOURNAL"].map((heading) => (
                  <th key={heading} className="px-3 py-2.5 border-r border-[#333] font-bold tracking-wider text-[10px] last:border-r-0 select-none">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={15} className="px-6 py-12 text-center font-bold text-[#6d6658] animate-pulse">LOADING OPTIMIZED RECORD PAGE…</td></tr>
              ) : error ? (
                <tr><td colSpan={15} className="px-6 py-12 text-center font-bold text-[#CC0000]">FAILED TO LOAD RECORDS. PLEASE REFRESH.</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={15} className="px-6 py-12 text-center font-bold text-[#6d6658]">NO RECORDS MATCH THE CURRENT SEARCH OR FILTERS.</td></tr>
              ) : (
                records.map((record, index) => {
                  const activeForms = TM_FORMS.filter((form) => record.tmMatches?.[form]);
                  return (
                    <tr
                      key={record.id}
                      onClick={() => navigate(`/record/${record.id}`)}
                      className={`cursor-pointer border-b border-[#0C0C0C]/10 hover:bg-[#E5D8C8] transition-colors ${index % 2 === 0 ? "bg-[#FFF9F0]" : "bg-white"}`}
                    >
                      <td className="px-3 py-2 border-r border-[#0C0C0C]/10 text-[#6d6658] uppercase">{formatDateShort(record.date)}</td>
                      <td className="px-2 py-1 border-r border-[#0C0C0C]/10"><div className="w-9 h-9 border border-[#0C0C0C]/30 bg-[#F0E8D0] overflow-hidden flex items-center justify-center">{record.image ? <img src={record.image} alt="" className="w-full h-full object-contain" /> : <span className="text-[8px] text-[#9d9488]">—</span>}</div></td>
                      <td className="px-3 py-2 border-r border-[#0C0C0C]/10 text-[#6d6658] text-[10px] uppercase">{formatDateShort(record.updatedAt)}</td>
                      <td className="px-3 py-2 border-r border-[#0C0C0C]/10 font-bold text-[#6C1C1F] uppercase">{record.type}</td>
                      <td className="px-3 py-2 border-r border-[#0C0C0C]/10 font-bold uppercase">{record.clientCode}</td>
                      <td className="px-3 py-2 border-r border-[#0C0C0C]/10 font-bold text-[#0A6B52] uppercase">{record.caseNumber}</td>
                      <td className="px-3 py-2 border-r border-[#0C0C0C]/10 font-bold uppercase">{record.tmCprNo || "—"}</td>
                      <td className="px-3 py-2 border-r border-[#0C0C0C]/10 uppercase">{record.appClass || "—"}</td>
                      <td className="px-3 py-2 border-r border-[#0C0C0C]/10 max-w-[200px] truncate font-bold uppercase text-[#0C0C0C]" title={record.appName}>{record.appName || "—"}</td>
                      <td className="px-3 py-2 border-r border-[#0C0C0C]/10"><span className={`inline-block px-1.5 py-0.5 text-[9px] font-bold border border-[#0C0C0C]/30 uppercase ${STAGE_BADGE[record.stage] ?? "bg-[#E8DFC7]"}`}>{record.stage}</span></td>
                      <td className="px-3 py-2 border-r border-[#0C0C0C]/10 text-[#6d6658] max-w-[130px] truncate uppercase" title={formatWorkflowLabel(record.subStage)}>{formatWorkflowLabel(record.subStage) || "—"}</td>
                      <td className="px-3 py-2 border-r border-[#0C0C0C]/10 max-w-[120px] truncate uppercase text-[#0C0C0C]" title={record.agent || undefined}>{record.agent || "—"}</td>
                      <td className="px-3 py-2 border-r border-[#0C0C0C]/10 uppercase">{record.city || "—"}</td>
                      <td className="px-3 py-2 border-r border-[#0C0C0C]/10">
                        <div className="flex flex-col gap-1">
                          {activeForms.length ? activeForms.map((form) => {
                            const formDate = getFormDate(record.tmMatches, form);
                            const formattedDate = formDate ? formatDateLong(formDate) : null;
                            const relativeAge = formDate ? getRelativeAge(formDate) : null;
                            return (
                              <div key={form} className="flex flex-col gap-0.5">
                                <span className="px-1.5 py-0.5 bg-[#B0740E]/15 border border-[#B0740E] text-[#6C1C1F] text-[9px] font-bold uppercase inline-block w-fit">{form}</span>
                                {formattedDate && (
                                  <div className="font-mono text-[8px] text-[#6d6658]">
                                    {formattedDate} · {relativeAge}
                                  </div>
                                )}
                                {!formattedDate && (
                                  <div className="font-mono text-[8px] text-[#6d6658]">
                                    Date not available
                                  </div>
                                )}
                              </div>
                            );
                          }) : <span className="text-[#9d9488]">—</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[#6d6658] uppercase">{record.journalNumber || "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 bg-[#E8DFC7] border-t-2 border-[#0C0C0C]">
          <span className="font-mono text-[10px] text-[#6d6658] font-bold uppercase tracking-widest">PAGE {page} OF {totalPages} · {total} RECORDS · SORTED BY DATE (NEWEST FIRST)</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="font-mono text-[10px] text-[#6d6658] font-bold uppercase">SHOW:</label>
              <select 
                value={pageSize} 
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="h-8 px-2 bg-white border-2 border-[#0C0C0C] font-mono text-xs focus:outline-2 focus:outline-[#6C1C1F]"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPage(1)} disabled={page === 1 || isFetching} className="flex items-center gap-1 px-3 py-1.5 border-2 border-[#0C0C0C] bg-white font-mono text-[10px] font-bold uppercase disabled:opacity-40">FIRST</button>
              <button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1 || isFetching} className="flex items-center gap-1 px-3 py-1.5 border-2 border-[#0C0C0C] bg-white font-mono text-[10px] font-bold uppercase disabled:opacity-40"><ChevronLeft className="w-3.5 h-3.5" /> PREV</button>
              <button onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages || isFetching} className="flex items-center gap-1 px-3 py-1.5 border-2 border-[#0C0C0C] bg-white font-mono text-[10px] font-bold uppercase disabled:opacity-40">NEXT <ChevronRight className="w-3.5 h-3.5" /></button>
              <button onClick={() => setPage(totalPages)} disabled={page >= totalPages || isFetching} className="flex items-center gap-1 px-3 py-1.5 border-2 border-[#0C0C0C] bg-white font-mono text-[10px] font-bold uppercase disabled:opacity-40">LAST</button>
            </div>
          </div>
        </div>
      </div>
      {modalOpen && <RecordModal isNew onClose={closeModal} onSaved={handleSaved} />}
      {importOpen && staffRole === "admin" && (
        <RegistryImportModal
          onClose={() => setImportOpen(false)}
          onCommitted={() => {
            queryClient.invalidateQueries({ queryKey: ["trademark-page"] });
          }}
          defaultKind="trademark"
          showOnly={null}
        />
      )}
    </AppShell>
  );
}
