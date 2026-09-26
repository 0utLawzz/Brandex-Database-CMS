import { listTrademarkPage, searchTm, STAGES, CITIES, VALID_TYPES, listAgents, formatWorkflowLabel } from "@/lib/api";
import type { TrademarkRecord, TmSearchResult, TrademarkPage } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { formatDateShort, formatDateLong, getRelativeAge, getFormDate } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  SearchIcon, X, Filter, CheckCircle2, MinusCircle,
  ArrowRight, AlertCircle, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";

const STAGE_BADGE: Record<string, string> = {
  "STAGE 1": "bg-[#0D9970] text-white",
  "STAGE 2": "bg-[#B0740E] text-white",
  "STAGE 3": "bg-[#6C1C1F] text-white",
  "STAGE 4": "bg-[#0A6B52] text-white",
  "STOPPED": "bg-[#CC0000] text-white",
};

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── TM Result Card ────────────────────────────────────────────────────────────

function TmCard({ result, onViewRecord }: {
  result: TmSearchResult;
  onViewRecord: (id: string) => void;
}) {
  const { records, tmMatches, journal } = result;

  if (records.length === 0) {
    return (
      <div className="border-2 border-dashed border-[#0C0C0C]/30 p-6 bg-[#F0E8D0] flex flex-col items-center gap-3 text-center animate-in fade-in duration-200">
        <AlertCircle className="w-8 h-8 text-[#9d9488]" />
        <div className="font-mono font-bold text-sm text-[#6d6658] uppercase tracking-widest">
          No trademark record found.
        </div>
        <div className="font-mono text-sm text-[#9d9488]">
          The TM number was not found in the DATABASE.
        </div>
        {/* Still show TM sheet matches */}
        <div className="mt-2 flex flex-wrap gap-2 justify-center">
          {(["TM5", "TM6", "TM11", "TM16", "TM56"] as const).map((s) => {
            const hasForm = tmMatches[s];
            const formDate = getFormDate(tmMatches, s);
            const formattedDate = formDate ? formatDateLong(formDate) : null;
            const relativeAge = formDate ? getRelativeAge(formDate) : null;
            return (
              <div key={s} className="flex flex-col gap-0.5">
                <span
                  className={`flex items-center gap-1 px-2 py-1 font-mono text-sm font-bold border-2 ${
                    hasForm
                      ? "border-[#0A6B52] text-[#0A6B52] bg-[#0D9970]/10"
                      : "border-[#0C0C0C]/20 text-[#9d9488] bg-white"
                  }`}
                >
                  {hasForm ? <CheckCircle2 className="w-3 h-3" /> : <MinusCircle className="w-3 h-3" />}
                  {s}
                </span>
                {hasForm && formattedDate && (
                  <div className="font-mono text-sm text-[#6d6658]">
                    {formattedDate} · {relativeAge}
                  </div>
                )}
                {hasForm && !formattedDate && (
                  <div className="font-mono text-sm text-[#6d6658]">
                    Date not available
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
      {records.map((rec) => (
        <div
          key={rec.id}
          className="border border-stone-300 bg-white shadow-none"
        >
          {/* Card: thumbnail | name/class/tm/case | type X right | stage badges */}
          <div className="flex gap-3 p-3 sm:p-4">
            {/* Thumbnail */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 border border-stone-300 bg-[#F0E8D0] flex items-center justify-center overflow-hidden">
              {rec.image ? (
                <img src={rec.image} alt={rec.appName || ""} className="w-full h-full object-contain" />
              ) : (
                <span className="font-mono text-sm text-[#9d9488] uppercase">No Img</span>
              )}
            </div>

            {/* Main content */}
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-serif text-xl sm:text-2xl uppercase tracking-wide leading-snug text-[#0C0C0C] font-bold truncate">
                    {rec.appName || "—"}
                  </div>
                  <div className="font-mono text-sm text-[#6d6658] mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    {rec.appClass && <span className="font-bold text-[#0C0C0C]">CLASS: {rec.appClass}</span>}
                    {rec.tmCprNo && <span>TM: <strong className="text-[#0C0C0C]">{rec.tmCprNo}</strong></span>}
                  </div>
                  <div className="font-mono text-sm text-[#6d6658] mt-0.5 flex flex-wrap gap-x-3">
                    <span>CASE: <strong className="text-[#0A6B52]">{rec.caseNumber || "—"}</strong></span>
                    <span>CLIENT: <strong className="text-[#0C0C0C]">{rec.clientCode || "—"}</strong></span>
                  </div>
                </div>
                {/* Type big on right */}
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <span className="font-serif text-3xl sm:text-4xl font-bold leading-none text-[#6C1C1F]">
                    {rec.type || "—"}
                  </span>
                  <span className="font-mono text-sm font-bold text-[#0D9970] uppercase tracking-wider">
                    ✓ FOUND
                  </span>
                </div>
              </div>

              {/* Stage larger, Sub-stage smaller */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {rec.stage && (
                  <span className={`inline-block px-3 py-1.5 font-mono text-sm font-bold uppercase tracking-wider border border-stone-300 shadow-none ${STAGE_BADGE[rec.stage] ?? "bg-[#E8DFC7]"}`}>
                    {rec.stage}
                  </span>
                )}
                {rec.subStage && (
                  <span className="inline-block px-2 py-0.5 font-mono text-sm font-bold uppercase tracking-wider border border-[#0C0C0C]/40 text-[#0C0C0C] bg-[#F0E8D0]">
                    {formatWorkflowLabel(rec.subStage)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Card Body extras */}
          <div className="px-4 pb-4 space-y-3 border-t border-[#0C0C0C]/10 pt-3">
            {/* TM Sheet Matches */}
            <div>
              <div className="font-mono text-sm font-bold uppercase tracking-widest text-[#6d6658] mb-1.5">
                TM FORM IPO (REGISTRY MATCHES)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(["TM5", "TM6", "TM11", "TM16", "TM56"] as const).map((s) => {
                  const hasForm = tmMatches[s];
                  const formDate = getFormDate(tmMatches, s);
                  const formattedDate = formDate ? formatDateLong(formDate) : null;
                  const relativeAge = formDate ? getRelativeAge(formDate) : null;
                  return (
                    <div key={s} className="flex flex-col gap-0.5">
                      <span
                        className={`flex items-center gap-1 px-2.5 py-1 font-mono text-sm font-bold border-2 ${
                          hasForm
                            ? "border-[#0A6B52] text-[#0A6B52] bg-[#0D9970]/10"
                            : "border-[#0C0C0C]/20 text-[#9d9488] bg-[#F0E8D0]"
                        }`}
                      >
                        {hasForm ? <CheckCircle2 className="w-3 h-3" /> : <MinusCircle className="w-3 h-3" />}
                        {s}
                      </span>
                      {hasForm && formattedDate && (
                        <div className="font-mono text-sm text-[#6d6658]">
                          {formattedDate} · {relativeAge}
                        </div>
                      )}
                      {hasForm && !formattedDate && (
                        <div className="font-mono text-sm text-[#6d6658]">
                          Date not available
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Journal */}
            {journal ? (
              <div className="border-2 border-[#0A6B52] bg-[#0D9970]/5 px-3 py-2">
                <div className="flex items-center gap-2 font-mono text-sm font-bold text-[#0A6B52] mb-1">
                  <CheckCircle2 className="w-3 h-3" /> JOURNAL FOUND
                </div>
                <div className="font-mono text-sm text-[#0C0C0C] space-x-3">
                  <span>Journal No: <strong>{String(journal["Journal No"] || "")}</strong></span>
                  <span>Date: <strong>{journal["Journal Date"] ? formatDateShort(journal["Journal Date"] as string) : ""}</strong></span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 font-mono text-sm text-[#9d9488]">
                <MinusCircle className="w-3 h-3" /> No published journal record found.
              </div>
            )}

            {/* View Record button */}
            <div className="pt-1">
              <button
                onClick={() => onViewRecord(rec.id)}
                className="flex items-center gap-2 px-4 py-2 bg-[#6C1C1F] text-white font-mono font-bold text-sm uppercase tracking-wider hover:brightness-110 transition-all border-2 border-[#6C1C1F]"
              >
                VIEW RECORD <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── SearchPage ────────────────────────────────────────────────────────────────

export function SearchPage() {
  const [, navigate] = useLocation();

  // TM number search
  const [tmQuery, setTmQuery] = useState("");
  const debouncedTmQuery = useDebounce(tmQuery.trim(), 500);
  const isTmSearch = debouncedTmQuery.length > 0;

  // General text search
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);

  // General filters
  const [typeFilter,     setTypeFilter]     = useState("");
  const [stageFilter,    setStageFilter]    = useState("");
  const [cityFilter,     setCityFilter]     = useState("");
  const [caseTypeFilter, setCaseTypeFilter] = useState("");
  const [agentFilter,    setAgentFilter]    = useState("");
  const [showFilters,    setShowFilters]    = useState(false);
  const [page,           setPage]           = useState(1);

  const hasFilters  = Boolean(typeFilter || stageFilter || cityFilter || caseTypeFilter || agentFilter);
  const hasGenSearch = debouncedQuery.trim().length > 0 || hasFilters;

  // TM Number search query
  const { data: tmResult, isLoading: tmLoading, error: tmError } = useQuery<TmSearchResult>({
    queryKey: ["search-tm", debouncedTmQuery],
    queryFn: () => searchTm(debouncedTmQuery),
    enabled: isTmSearch,
    staleTime: 30_000,
  });

  // Agents list query
  const { data: agents = [] } = useQuery<string[]>({
    queryKey: ["agents"],
    queryFn: listAgents,
    staleTime: 5 * 60_000,
  });

  // General search query with pagination
  const { data: generalPage, isLoading: genLoading, isFetching: genFetching } = useQuery<TrademarkPage>({
    queryKey: ["trademarks-search", page, debouncedQuery, typeFilter, stageFilter, cityFilter, caseTypeFilter, agentFilter],
    queryFn: () =>
      listTrademarkPage({
        page,
        pageSize: 50,
        search:    debouncedQuery.trim() || undefined,
        type:      typeFilter     || undefined,
        stage:     stageFilter    || undefined,
        city:      cityFilter     || undefined,
        caseType:  caseTypeFilter || undefined,
        agent:     agentFilter    || undefined,
      }),
    enabled: hasGenSearch,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const generalResults = generalPage?.records ?? [];
  const totalResults = generalPage?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalResults / 50));

  const goToRecord = (id: string) => navigate(`/record/${id}`);
  const clearAll   = () => {
    setQuery(""); setTypeFilter(""); setStageFilter(""); setCityFilter(""); setCaseTypeFilter(""); setAgentFilter(""); setPage(1);
  };
  const clearTm = () => setTmQuery("");
  
  // Reset page when search query changes
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery]);

  const CASE_TYPES = ["Trademark", "Copyright", "Design", "Patent", "Renewal", "Opposition", "Other"];

  return (
    <AppShell>
      <div className="flex flex-col h-full bg-white">
        {/* Header */}
        <div className="shrink-0 px-6 py-4 bg-[#E8DFC7] border-b border-stone-300">
          <h1 className="font-serif text-2xl uppercase tracking-widest text-[#0C0C0C] mb-4">SEARCH TM</h1>

          {/* TM Number Search */}
          <div className="mb-3">
            <div className="font-mono text-sm font-bold uppercase tracking-widest text-[#6d6658] mb-1.5">
              TM / CPR NUMBER LOOKUP
            </div>
            <div className="relative max-w-sm">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm font-bold text-[#6d6658]">TM</span>
              <input
                type="text"
                placeholder="e.g. 633710"
                value={tmQuery}
                onChange={(e) => setTmQuery(e.target.value)}
                className="w-full h-11 pl-10 pr-10 bg-white border border-stone-300 font-mono text-sm font-bold focus:outline-2 focus:outline-[#6C1C1F] focus:outline-offset-0 placeholder:text-[#9d9488] placeholder:font-normal"
              />
              {tmQuery && (
                <button
                  onClick={clearTm}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6d6658] hover:text-[#0C0C0C]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="border-t border-[#0C0C0C]/15 pt-3 mt-3">
            <div className="font-mono text-sm font-bold uppercase tracking-widest text-[#6d6658] mb-1.5">
              GENERAL SEARCH
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <div className="relative flex-1 max-w-3xl">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6d6658]" />
                <input
                  type="text"
                  placeholder="Name, Client Code, Case No, Application Name, Class..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full h-11 pl-10 pr-10 bg-white border border-stone-300 font-mono text-sm focus:outline-2 focus:outline-[#6C1C1F] focus:outline-offset-0 placeholder:text-[#6d6658]"
                />
                {query && (
                  <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6d6658] hover:text-[#0C0C0C]">
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowFilters((v) => !v)}
                  className={`flex items-center justify-center gap-2 px-4 h-11 border border-stone-300 font-mono font-bold text-sm uppercase tracking-wider transition-colors ${
                    showFilters || hasFilters ? "bg-[#0C0C0C] text-[#F0E8D0]" : "bg-white"
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  FILTER{hasFilters ? " ●" : ""}
                </button>
                {(query || hasFilters) && (
                  <button
                    onClick={clearAll}
                    className="px-4 h-11 border-2 border-[#CC0000] text-[#CC0000] font-mono font-bold text-sm uppercase tracking-wider hover:bg-[#CC0000] hover:text-white transition-colors"
                  >
                    CLEAR
                  </button>
                )}
              </div>
            </div>

            {showFilters && (
              <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-[#0C0C0C]/10">
                {[
                  { label: "TYPE",      value: typeFilter,     set: setTypeFilter,     options: VALID_TYPES },
                  { label: "STATUS",    value: stageFilter,    set: setStageFilter,    options: STAGES },
                  { label: "AGENT",     value: agentFilter,    set: setAgentFilter,    options: agents },
                  { label: "CITY",      value: cityFilter,     set: setCityFilter,     options: CITIES },
                  { label: "CASE TYPE", value: caseTypeFilter, set: setCaseTypeFilter, options: CASE_TYPES },
                ].map(({ label, value, set, options }) => (
                  <div key={label} className="flex flex-col gap-1.5">
                    <label className="font-mono text-sm font-bold uppercase tracking-widest text-[#6d6658]">{label}</label>
                    <select
                      value={value}
                      onChange={(e) => { set(e.target.value); setPage(1); }}
                      className="h-9 px-3 bg-white border border-stone-300 font-mono text-sm focus:outline-2 focus:outline-[#6C1C1F] min-w-[140px]"
                    >
                      <option value="">ALL</option>
                      {options.map((o) => <option key={o} value={o}>{o.toUpperCase()}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-auto">
          {/* TM Number results */}
          {isTmSearch && (
            <div className="p-6 border-b border-stone-300 bg-[#F0E8D0]">
              <div className="font-mono text-sm font-bold uppercase tracking-widest text-[#6d6658] mb-3">
                TM LOOKUP — {debouncedTmQuery}
              </div>
              {tmLoading ? (
                <div className="font-mono text-sm text-[#6d6658] animate-pulse">
                  Searching TM {debouncedTmQuery}…
                </div>
              ) : tmError ? (
                <div className="flex items-center gap-2 font-mono text-sm text-[#CC0000]">
                  <AlertCircle className="w-4 h-4" />
                  Unable to search. Check your connection.
                </div>
              ) : tmResult ? (
                <TmCard result={tmResult} onViewRecord={goToRecord} />
              ) : null}
            </div>
          )}

          {/* General search results */}
          {hasGenSearch ? (
            <div className="bg-white p-4">
              {genLoading || genFetching ? (
                <div className="px-6 py-12 text-center font-bold font-mono text-[#6d6658] animate-pulse">
                  SEARCHING…
                </div>
              ) : generalResults.length === 0 ? (
                <div className="px-6 py-12 text-center space-y-2">
                  <div className="font-mono font-bold text-[#6d6658] uppercase tracking-widest">No results found.</div>
                  <div className="font-mono text-sm text-[#9d9488]">
                    Try adjusting your search terms or filters.
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {generalResults.map((tm) => (
                    <div
                      key={tm.id}
                      onClick={() => goToRecord(tm.id)}
                      className="border border-stone-300 bg-white shadow-none hover:shadow-[5px_5px_0_#0C0C0C] transition-shadow cursor-pointer"
                    >
                      {/* Primary: Status / Sub-Status */}
                      <div className="px-4 py-3 border-b border-stone-300 bg-[#E8DFC7]">
                        <div className="flex items-center gap-2">
                          {tm.stage && (
                            <span className={`inline-block px-3 py-1.5 font-mono text-sm font-bold uppercase tracking-wider border border-stone-300 shadow-none ${STAGE_BADGE[tm.stage] ?? "bg-[#E8DFC7]"}`}>
                              {tm.stage}
                            </span>
                          )}
                          {tm.subStage && (
                            <span className="inline-block px-2 py-0.5 font-mono text-sm font-bold uppercase tracking-wider border border-[#0C0C0C]/40 text-[#0C0C0C] bg-[#F0E8D0]">
                              {formatWorkflowLabel(tm.subStage)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Image + Identity */}
                      <div className="flex gap-3 p-4">
                        {/* Thumbnail */}
                        <div className="w-16 h-16 shrink-0 border border-stone-300 bg-[#F0E8D0] flex items-center justify-center overflow-hidden">
                          {tm.image ? (
                            <img src={tm.image} alt={tm.appName || ""} className="w-full h-full object-contain" />
                          ) : (
                            <span className="font-mono text-sm text-[#9d9658] uppercase">No Img</span>
                          )}
                        </div>

                        {/* Main content */}
                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                          <div className="font-serif text-lg uppercase tracking-wide leading-snug text-[#0C0C0C] font-bold truncate">
                            {tm.appName || "—"}
                          </div>
                          <div className="font-mono text-sm text-[#6d6658] flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="font-bold text-[#6C1C1F]">{tm.type || "—"}</span>
                            <span>·</span>
                            <span>CLIENT: <strong className="text-[#0C0C0C]">{tm.clientCode || "—"}</strong></span>
                            <span>·</span>
                            <span>CASE: <strong className="text-[#0A6B52]">{tm.caseNumber || "—"}</strong></span>
                          </div>
                          <div className="font-mono text-sm text-[#6d6658] flex flex-wrap gap-x-2">
                            <span>TM: <strong className="text-[#0C0C0C]">{tm.tmCprNo || "—"}</strong></span>
                            <span>·</span>
                            <span>CLASS: <strong className="text-[#0C0C0C]">{tm.appClass || "—"}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Supporting info */}
                      <div className="px-4 pb-4 space-y-2 border-t border-[#0C0C0C]/10 pt-3">
                        <div className="font-mono text-sm text-[#6d6658] flex flex-wrap gap-x-3">
                          <span>CITY: <strong className="text-[#0C0C0C]">{tm.city || "—"}</strong></span>
                          <span>AGENT: <strong className="text-[#0C0C0C]">{tm.agent || <span className="italic">unassigned</span>}</strong></span>
                        </div>

                        {/* TM Forms */}
                        <div>
                          <div className="font-mono text-sm font-bold uppercase tracking-widest text-[#6d6658] mb-1">
                            TM FORM IPO (REGISTRY MATCHES)
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {(["TM5", "TM6", "TM11", "TM16", "TM56"] as const).map((s) => {
                              const hasForm = tm[s.toLowerCase() as keyof typeof tm] === "YES";
                              const formDate = getFormDate(tm.tmMatches, s);
                              const formattedDate = formDate ? formatDateLong(formDate) : null;
                              const relativeAge = formDate ? getRelativeAge(formDate) : null;
                              return hasForm ? (
                                <div key={s} className="flex flex-col gap-0.5">
                                  <span className="flex items-center gap-1 px-2 py-0.5 font-mono text-sm font-bold border-2 border-[#0A6B52] text-[#0A6B52] bg-[#0D9970]/10">
                                    <CheckCircle2 className="w-2.5 h-2.5" /> {s}
                                  </span>
                                  {formattedDate && (
                                    <div className="font-mono text-sm text-[#6d6658]">
                                      {formattedDate} · {relativeAge}
                                    </div>
                                  )}
                                  {!formattedDate && (
                                    <div className="font-mono text-sm text-[#6d6658]">
                                      Date not available
                                    </div>
                                  )}
                                </div>
                              ) : null;
                            })}
                            {![tm.tm5, tm.tm6, tm.tm11, tm.tm16, tm.tm56].some(v => v === "YES") && (
                              <span className="font-mono text-sm text-[#9d9488] italic">No forms found</span>
                            )}
                          </div>
                        </div>

                        {/* Journal */}
                        {tm.journalNumber ? (
                          <div className="border-2 border-[#0A6B52] bg-[#0D9970]/5 px-3 py-2">
                            <div className="flex items-center gap-2 font-mono text-sm font-bold text-[#0A6B52] mb-1">
                              <CheckCircle2 className="w-3 h-3" /> JOURNAL
                            </div>
                            <div className="font-mono text-sm text-[#0C0C0C] space-x-3">
                              <span>NO: <strong>{tm.journalNumber}</strong></span>
                              <span>DATE: <strong>{tm.journalDate ? formatDateShort(tm.journalDate) : "—"}</strong></span>
                            </div>
                          </div>
                        ) : null}

                        {/* Filing Date */}
                        <div className="font-mono text-sm text-[#6d6658]">
                          FILED: <strong className="text-[#0C0C0C]">{tm.date || "—"}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : !isTmSearch ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-[#F0E8D0]">
              <SearchIcon className="w-16 h-16 text-[#C5B89A] mb-4" />
              <div className="font-serif text-2xl text-[#0C0C0C] uppercase tracking-widest">SEARCH TRADEMARK RECORDS</div>
              <div className="font-mono text-sm text-[#6d6658] mt-2 max-w-md">
                Enter a TM number above for a quick lookup card, or use the general search for full-text results.
              </div>
            </div>
          ) : null}
        </div>

        {hasGenSearch && (
          <div className="shrink-0 px-6 py-3 bg-[#E8DFC7] border-t-2 border-[#0C0C0C]">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm text-[#6d6658] font-bold uppercase tracking-widest">
                PAGE {page} OF {totalPages} · {totalResults} RESULT{totalResults !== 1 ? "S" : ""}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(1)}
                  disabled={page === 1 || genFetching}
                  className="flex items-center gap-1 px-3 py-1.5 border border-stone-300 bg-white font-mono text-sm font-bold uppercase disabled:opacity-40"
                >
                  FIRST
                </button>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || genFetching}
                  className="flex items-center gap-1 px-3 py-1.5 border border-stone-300 bg-white font-mono text-sm font-bold uppercase disabled:opacity-40"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> PREV
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || genFetching}
                  className="flex items-center gap-1 px-3 py-1.5 border border-stone-300 bg-white font-mono text-sm font-bold uppercase disabled:opacity-40"
                >
                  NEXT <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={page >= totalPages || genFetching}
                  className="flex items-center gap-1 px-3 py-1.5 border border-stone-300 bg-white font-mono text-sm font-bold uppercase disabled:opacity-40"
                >
                  LAST
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
