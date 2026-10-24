import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  Plus,
  Search,
  Database,
  Users2,
  Filter,
  X,
  BookOpen,
  ScrollText,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { getStats, listAuditLogs, listAgents, STAGES } from "@/lib/api";
import type { TrademarkStats, AuditLogEntry } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { formatDate } from "@/lib/utils";

const NICE_CLASSES = Array.from({ length: 45 }, (_, i) => String(i + 1));

function shortUser(id: string) {
  if (!id || id === "system") return "system";
  if (id.includes("@")) return id.split("@")[0];
  if (/^[0-9a-f-]{20,}$/i.test(id)) return "admin";
  return id.length > 20 ? id.slice(0, 16) + "…" : id;
}

export function Dashboard() {
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");

  const hasActiveFilters = Boolean(selectedAgent || selectedClass);

  const clearFilters = () => {
    setSelectedAgent("");
    setSelectedClass("");
  };

  const {
    data: stats,
    isLoading: isLoadingStats,
    isError: isStatsError,
    refetch: refetchStats,
  } = useQuery<TrademarkStats>({
    queryKey: ["stats", selectedAgent, selectedClass],
    queryFn: () =>
      getStats({
        agent: selectedAgent || undefined,
        appClass: selectedClass || undefined,
      }),
    staleTime: 30_000,
  });

  const { data: agents = [] } = useQuery<string[]>({
    queryKey: ["agents"],
    queryFn: listAgents,
    staleTime: 5 * 60_000,
  });

  const { data: recentActivity = [], isLoading: isLoadingActivity } = useQuery<AuditLogEntry[]>({
    queryKey: ["recent-activity"],
    queryFn: () => listAuditLogs(12, 0),
    staleTime: 30_000,
  });

  // Calculate counts for all 5 stages from real database query
  const stageCountsMap = useMemo(() => {
    const map = new Map<string, number>();
    STAGES.forEach((stage) => map.set(stage, 0));
    stats?.byStage?.forEach(({ stage, count }) => {
      map.set(stage, count);
    });
    return map;
  }, [stats]);

  const getStageCount = (stage: string) => stageCountsMap.get(stage) ?? 0;
  const totalCount = stats?.total ?? 0;

  // City breakdown calculation for regional focus
  const sortedCities = useMemo(() => {
    if (!stats?.byCity) return [];
    return [...stats.byCity]
      .filter((c) => Boolean(c.city))
      .sort((a, b) => b.count - a.count);
  }, [stats?.byCity]);

  return (
    <AppShell>
      <div className="flex-1 w-full overflow-hidden flex flex-col xl:grid xl:grid-cols-[280px_1fr_340px] bg-[#F0E8D0]">
        {/* ── LEFT COLUMN / SIDEBAR ────────────────────────────────────────── */}
        <aside className="border-b-[3px] xl:border-b-0 xl:border-r-[3px] border-[#0C0C0C] bg-[#E8DFC7] p-5 sm:p-6 flex flex-col gap-6 overflow-y-auto shrink-0 z-10">
          <div>
            <div className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#0C0C0C] opacity-60 mb-3">
              Commands
            </div>
            <div className="flex flex-col gap-2.5">
              <Link
                href="/database?new=1"
                className="bg-[#C94A00] text-white border-2 border-[#0C0C0C] p-3 font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-between shadow-[3px_3px_0_#0C0C0C] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_#0C0C0C] active:translate-x-0.5 active:translate-y-0.5 transition-all"
              >
                <span>ADD NEW RECORD</span>
                <span className="font-serif text-lg leading-none">+</span>
              </Link>

              <Link
                href="/search"
                className="bg-[#FAF6EE] text-[#0C0C0C] border-2 border-[#0C0C0C] p-3 font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-between shadow-[3px_3px_0_#0C0C0C] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_#0C0C0C] active:translate-x-0.5 active:translate-y-0.5 transition-all"
              >
                <span>SEARCH REGISTRY</span>
                <Search className="w-3.5 h-3.5" />
              </Link>

              <Link
                href="/database"
                className="bg-[#0A6B52] text-white border-2 border-[#0C0C0C] p-3 font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-between shadow-[3px_3px_0_#0C0C0C] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_#0C0C0C] active:translate-x-0.5 active:translate-y-0.5 transition-all"
              >
                <span>VIEW DATASHEET</span>
                <Database className="w-3.5 h-3.5" />
              </Link>

              <Link
                href="/assigned"
                className="bg-[#FAF6EE] text-[#0C0C0C] border-2 border-[#0C0C0C] p-3 font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-between shadow-[3px_3px_0_#0C0C0C] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_#0C0C0C] active:translate-x-0.5 active:translate-y-0.5 transition-all"
              >
                <span>ASSIGNED QUEUE</span>
                <Users2 className="w-3.5 h-3.5" />
              </Link>

              <Link
                href="/publication"
                className="bg-[#FAF6EE] text-[#0C0C0C] border-2 border-[#0C0C0C] p-3 font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-between shadow-[3px_3px_0_#0C0C0C] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_#0C0C0C] active:translate-x-0.5 active:translate-y-0.5 transition-all"
              >
                <span>PUBLICATION</span>
                <BookOpen className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          <div>
            <div className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#0C0C0C] opacity-60 mb-3">
              Regional Focus
            </div>
            {sortedCities.length === 0 ? (
              <div className="font-mono text-xs text-[#0C0C0C]/60 py-2">
                NO REGIONAL DATA AVAILABLE
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {sortedCities.slice(0, 6).map((item) => {
                  const pct = totalCount > 0 ? ((item.count / totalCount) * 100).toFixed(1) : "0.0";
                  return (
                    <div
                      key={item.city}
                      className="flex items-center justify-between font-mono text-xs pb-1.5 border-b border-[#0C0C0C]/15"
                    >
                      <span className="font-bold text-[#0C0C0C] uppercase truncate pr-2">
                        {item.city}
                      </span>
                      <span className="shrink-0 text-[#0C0C0C]/80">
                        {pct}% ({item.count})
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-auto pt-4 border-t border-[#0C0C0C]/20 flex items-center gap-2 font-mono text-[11px] font-bold uppercase text-[#0C0C0C]/70">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0D9970] animate-pulse" />
            <span>LIVE REGISTRY SYNC</span>
          </div>
        </aside>

        {/* ── CENTER WORKSPACE ────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 lg:p-8 flex flex-col gap-6">
          {/* Header & Filter Controls */}
          <section className="flex flex-col sm:flex-row justify-between sm:items-end gap-4 pb-4 border-b-[3px] border-[#0C0C0C]">
            <div className="space-y-1">
              <h1 className="font-serif text-5xl sm:text-6xl text-[#0C0C0C] leading-[0.9] tracking-tight">
                REGISTRY OVERVIEW
              </h1>
              <p className="font-mono text-xs uppercase tracking-widest text-[#0C0C0C]/70">
                Real-time Registry Status &middot; {format(new Date(), "EEEE, d MMMM yyyy")}
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filter by Agent"
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="h-8 px-2.5 bg-[#FAF6EE] border-2 border-[#0C0C0C] font-mono text-xs font-bold text-[#0C0C0C] shadow-[2px_2px_0_#0C0C0C] focus:outline-none cursor-pointer"
              >
                <option value="">ALL AGENTS</option>
                {agents.map((agent) => (
                  <option key={agent} value={agent}>
                    {agent}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by Class"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="h-8 px-2.5 bg-[#FAF6EE] border-2 border-[#0C0C0C] font-mono text-xs font-bold text-[#0C0C0C] shadow-[2px_2px_0_#0C0C0C] focus:outline-none cursor-pointer"
              >
                <option value="">ALL CLASSES</option>
                {NICE_CLASSES.map((cls) => (
                  <option key={cls} value={cls}>
                    CLASS {cls}
                  </option>
                ))}
              </select>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="h-8 px-2.5 bg-[#CC0000] text-white border-2 border-[#0C0C0C] font-mono text-xs font-bold uppercase shadow-[2px_2px_0_#0C0C0C] hover:brightness-110 flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  CLEAR
                </button>
              )}
            </div>
          </section>

          {/* Loading / Error or Live Content */}
          {isLoadingStats ? (
            <div className="p-8 border-2 border-[#0C0C0C] bg-[#FAF6EE] text-center font-mono font-bold text-[#6d6658] space-y-2 animate-pulse shadow-[4px_4px_0_#0C0C0C]">
              <div className="text-sm uppercase tracking-widest">LOADING LIVE DATABASE METRICS…</div>
              <div className="text-xs opacity-75">Querying verified Supabase registry records</div>
            </div>
          ) : isStatsError || !stats ? (
            <div className="p-5 border-2 border-[#CC0000] bg-[#FAF6EE] text-[#CC0000] font-mono font-bold flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[4px_4px_0_#0C0C0C]">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <div className="text-xs uppercase tracking-wider">
                  FAILED TO LOAD DATABASE METRICS &mdash; RETRY QUERY
                </div>
              </div>
              <button
                onClick={() => refetchStats()}
                className="px-3 py-1.5 bg-[#CC0000] text-white border-2 border-[#0C0C0C] font-mono font-bold text-xs uppercase"
              >
                RETRY
              </button>
            </div>
          ) : (
            <>
              {/* 7-Card Stats Row */}
              <section aria-label="Key Registry Metrics" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-3">
                {/* 1. Total Records */}
                <div className="bg-[#C94A00] text-white border-2 border-[#0C0C0C] p-3 shadow-[4px_4px_0_#0C0C0C] flex flex-col justify-between">
                  <div className="font-mono text-[10px] uppercase font-bold tracking-wider opacity-90">
                    TOTAL RECORDS
                  </div>
                  <div className="font-serif text-3xl sm:text-4xl leading-none mt-1">
                    {stats.total}
                  </div>
                  <div className="font-mono text-[10px] uppercase font-medium mt-1 opacity-90">
                    Active Cases
                  </div>
                </div>

                {/* 2. Stage 1 */}
                <div className="bg-[#0D9970] text-white border-2 border-[#0C0C0C] p-3 shadow-[4px_4px_0_#0C0C0C] flex flex-col justify-between">
                  <div className="font-mono text-[10px] uppercase font-bold tracking-wider opacity-90">
                    STAGE 1
                  </div>
                  <div className="font-serif text-3xl sm:text-4xl leading-none mt-1">
                    {getStageCount("STAGE 1")}
                  </div>
                  <div className="font-mono text-[10px] uppercase font-medium mt-1 opacity-90">
                    Filing/Exam
                  </div>
                </div>

                {/* 3. Stage 2 */}
                <div className="bg-[#D4A800] text-white border-2 border-[#0C0C0C] p-3 shadow-[4px_4px_0_#0C0C0C] flex flex-col justify-between">
                  <div className="font-mono text-[10px] uppercase font-bold tracking-wider opacity-90">
                    STAGE 2
                  </div>
                  <div className="font-serif text-3xl sm:text-4xl leading-none mt-1">
                    {getStageCount("STAGE 2")}
                  </div>
                  <div className="font-mono text-[10px] uppercase font-medium mt-1 opacity-90">
                    Assign/Hear
                  </div>
                </div>

                {/* 4. Stage 3 */}
                <div className="bg-[#0A6B52] text-white border-2 border-[#0C0C0C] p-3 shadow-[4px_4px_0_#0C0C0C] flex flex-col justify-between">
                  <div className="font-mono text-[10px] uppercase font-bold tracking-wider opacity-90">
                    STAGE 3
                  </div>
                  <div className="font-serif text-3xl sm:text-4xl leading-none mt-1">
                    {getStageCount("STAGE 3")}
                  </div>
                  <div className="font-mono text-[10px] uppercase font-medium mt-1 opacity-90">
                    Pub/Opp
                  </div>
                </div>

                {/* 5. Stage 4 */}
                <div className="bg-[#0D9970] text-white border-2 border-[#0C0C0C] p-3 shadow-[4px_4px_0_#0C0C0C] flex flex-col justify-between">
                  <div className="font-mono text-[10px] uppercase font-bold tracking-wider opacity-90">
                    STAGE 4
                  </div>
                  <div className="font-serif text-3xl sm:text-4xl leading-none mt-1">
                    {getStageCount("STAGE 4")}
                  </div>
                  <div className="font-mono text-[10px] uppercase font-medium mt-1 opacity-90">
                    CER Disp
                  </div>
                </div>

                {/* 6. Stopped */}
                <div className="bg-[#CC0000] text-white border-2 border-[#0C0C0C] p-3 shadow-[4px_4px_0_#0C0C0C] flex flex-col justify-between">
                  <div className="font-mono text-[10px] uppercase font-bold tracking-wider opacity-90">
                    STOPPED
                  </div>
                  <div className="font-serif text-3xl sm:text-4xl leading-none mt-1">
                    {getStageCount("STOPPED")}
                  </div>
                  <div className="font-mono text-[10px] uppercase font-medium mt-1 opacity-90">
                    Inactive
                  </div>
                </div>

                {/* 7. 7D Active */}
                <div className="bg-[#FAF6EE] text-[#0C0C0C] border-2 border-[#0C0C0C] p-3 shadow-[4px_4px_0_#0C0C0C] flex flex-col justify-between">
                  <div className="font-mono text-[10px] uppercase font-bold tracking-wider opacity-80">
                    7D ACTIVE
                  </div>
                  <div className="font-serif text-3xl sm:text-4xl leading-none mt-1 text-[#0C0C0C]">
                    {stats.recentlyModified ?? 0}
                  </div>
                  <div className="font-mono text-[10px] uppercase font-medium mt-1 text-[#6d6658]">
                    Modifications
                  </div>
                </div>
              </section>

              {/* Case Workflow Progression Container */}
              <section className="bg-[#FAF6EE] border-[3px] border-[#0C0C0C] p-5 sm:p-6 shadow-[6px_6px_0_#0C0C0C]">
                <div className="flex items-center justify-between mb-5">
                  <div className="font-mono text-xs uppercase font-bold tracking-[0.15em] text-[#C94A00]">
                    Case Workflow Progression
                  </div>
                  <span className="font-mono text-xs font-bold text-[#6d6658] uppercase">
                    {totalCount} Total Active Cases
                  </span>
                </div>

                <div className="flex flex-col gap-4">
                  {[
                    { key: "STAGE 1", label: "STAGE 1", fill: "bg-[#0D9970]" },
                    { key: "STAGE 2", label: "STAGE 2", fill: "bg-[#D4A800]" },
                    { key: "STAGE 3", label: "STAGE 3", fill: "bg-[#C94A00]" },
                    { key: "STAGE 4", label: "STAGE 4", fill: "bg-[#0A6B52]" },
                  ].map((row) => {
                    const count = getStageCount(row.key);
                    const pct = totalCount > 0 ? ((count / totalCount) * 100).toFixed(0) : "0";
                    const numericPct = totalCount > 0 ? (count / totalCount) * 100 : 0;

                    return (
                      <div key={row.key} className="grid grid-cols-[80px_1fr_50px] sm:grid-cols-[100px_1fr_60px] items-center gap-3 sm:gap-4">
                        <span className="font-mono text-xs font-bold uppercase text-[#0C0C0C]">
                          {row.label}
                        </span>
                        <div className="h-4 bg-[#E8DFC7] border-2 border-[#0C0C0C] relative overflow-hidden">
                          <div
                            className={`h-full ${row.fill} transition-all duration-500`}
                            style={{ width: `${Math.min(100, Math.max(0, numericPct))}%` }}
                          />
                        </div>
                        <span className="font-serif text-xl sm:text-2xl text-right text-[#0C0C0C] leading-none">
                          {pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* IPO Statutory Form Matches */}
              <section className="bg-[#E8DFC7] border-[3px] border-[#0C0C0C] p-5 sm:p-6 shadow-[4px_4px_0_#0C0C0C]">
                <div className="font-mono text-xs uppercase font-bold tracking-[0.15em] text-[#0C0C0C] mb-3">
                  IPO Statutory Form Matches
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {stats.byTmForm.map(({ form, count }) => {
                    const filterParams = new URLSearchParams();
                    filterParams.set("tmForm", form);
                    if (selectedAgent) filterParams.set("agent", selectedAgent);
                    if (selectedClass) filterParams.set("appClass", selectedClass);

                    return (
                      <Link
                        key={form}
                        href={`/database?${filterParams.toString()}`}
                        className="border-2 border-[#0C0C0C] bg-[#FAF6EE] hover:bg-white p-3.5 text-center transition-all hover:scale-[1.02] shadow-[2px_2px_0_#0C0C0C] block no-underline"
                      >
                        <span className="block font-serif text-2xl text-[#C94A00] leading-none">
                          {form}
                        </span>
                        <span className="block font-mono text-[11px] font-bold text-[#0C0C0C]/70 mt-1 uppercase">
                          {count} MATCHES
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </div>

        {/* ── RIGHT COLUMN / RECENT LOGS FEED ─────────────────────────────── */}
        <aside className="border-t-[3px] xl:border-t-0 xl:border-l-[3px] border-[#0C0C0C] bg-[#FAF6EE] flex flex-col overflow-hidden shrink-0 z-10">
          <div className="bg-[#0C0C0C] text-[#FAF6EE] px-4 py-3 border-b-2 border-[#0C0C0C] flex items-center justify-between shrink-0">
            <h2 className="font-serif text-2xl tracking-wider text-[#FAF6EE]">
              RECENT LOGS
            </h2>
            <Link
              href="/logs"
              className="font-mono text-xs font-bold text-[#FAF6EE] hover:text-[#D4A800] uppercase tracking-wider transition-colors"
            >
              ALL EVENTS &rarr;
            </Link>
          </div>

          <div className="flex-1 overflow-y-auto px-4 divide-y-2 divide-dashed divide-[#0C0C0C]/10 max-h-[420px] xl:max-h-none">
            {isLoadingActivity ? (
              <div className="p-6 font-mono text-xs text-[#6d6658] text-center animate-pulse">
                LOADING RECENT LOGS…
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="p-6 font-mono text-xs text-[#6d6658] text-center">
                NO RECENT ACTIVITY RECORDED
              </div>
            ) : (
              recentActivity.map((log) => {
                const badgeColor =
                  log.action === "CREATE"
                    ? "bg-[#0D9970] text-white"
                    : log.action === "DELETE"
                    ? "bg-[#CC0000] text-white"
                    : "bg-[#D4A800] text-[#0C0C0C]";

                return (
                  <div key={log.id} className="py-3.5 flex flex-col gap-1 font-mono">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 border-2 border-[#0C0C0C] uppercase tracking-wider ${badgeColor} shadow-[1px_1px_0_#0C0C0C]`}>
                        {log.action}
                      </span>
                      <span className="text-[11px] text-[#0C0C0C]/50">
                        {formatDate(log.changedAt)}
                      </span>
                    </div>

                    <Link
                      href={log.recordId ? `/record/${log.recordId}` : "/database"}
                      className="font-sans font-bold text-sm text-[#0C0C0C] hover:text-[#C94A00] hover:underline uppercase truncate block"
                    >
                      Case: {log.caseNo || log.record || "N/A"}{log.applicationName ? ` \u00B7 ${log.applicationName}` : ""}
                    </Link>

                    {log.clientCode && (
                      <div className="text-xs text-[#0C0C0C]/80">
                        Ref No: {log.clientCode}
                      </div>
                    )}

                    <div className="text-[11px] text-[#0C0C0C]/60 flex items-center justify-between mt-1">
                      <span>By {shortUser(log.changedBy)}</span>
                      {log.caseType && (
                        <span className="bg-[#0C0C0C]/10 px-1.5 py-0.5 rounded-[2px] font-bold text-[10px] text-[#0C0C0C]">
                          {log.caseType}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
