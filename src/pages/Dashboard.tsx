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
  CreditCard,
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

  // Calculate counts for all stages from real database query
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

  const s1Count = getStageCount("STAGE 1");
  const s2Count = getStageCount("STAGE 2");
  const s3Count = getStageCount("STAGE 3");
  const s4Count = getStageCount("STAGE 4");
  const stoppedCount = getStageCount("STOPPED");

  const s1Pct = totalCount > 0 ? ((s1Count / totalCount) * 100).toFixed(0) : "0";
  const s2Pct = totalCount > 0 ? ((s2Count / totalCount) * 100).toFixed(0) : "0";
  const s3Pct = totalCount > 0 ? ((s3Count / totalCount) * 100).toFixed(0) : "0";
  const s4Pct = totalCount > 0 ? ((s4Count / totalCount) * 100).toFixed(0) : "0";

  // City breakdown calculation for jurisdiction focus
  const sortedCities = useMemo(() => {
    if (!stats?.byCity) return [];
    return [...stats.byCity]
      .filter((c) => Boolean(c.city))
      .sort((a, b) => b.count - a.count);
  }, [stats?.byCity]);

  return (
    <AppShell>
      <div className="main-layout flex-1 w-full overflow-hidden flex flex-col xl:grid xl:grid-cols-[250px_1fr_340px] bg-[#FFFDF0]">
        {/* ── LEFT SIDEBAR (Variation 6: .sidebar-block) ──────────────────── */}
        <aside className="sidebar-block border-b-[3px] xl:border-b-0 xl:border-r-[3px] border-[#000000] bg-[#fdfaf0] p-6 sm:p-7 flex flex-col gap-6 overflow-y-auto shrink-0 z-10">
          <div>
            <div className="section-tag">DIRECT ACTIONS</div>
            <div className="nav-stack">
              <Link
                href="/database?new=1"
                className="nav-item !bg-[#E14E27] !text-white !border-[#000000] shadow-[4px_4px_0_#000000] hover:shadow-[6px_6px_0_#000000] no-underline"
              >
                <span>ADD RECORD +</span>
                <Plus className="w-4 h-4 text-white" />
              </Link>

              <Link
                href="/assigned"
                className="nav-item no-underline text-[#000000] hover:text-[#E14E27]"
              >
                <span>ASSIGNED QUEUE</span>
                <Users2 className="w-3.5 h-3.5 text-[#000000]" />
              </Link>

              <Link
                href="/publication"
                className="nav-item no-underline text-[#000000] hover:text-[#E14E27]"
              >
                <span>PUBLICATION</span>
                <BookOpen className="w-3.5 h-3.5 text-[#000000]" />
              </Link>

              <Link
                href="/payments"
                className="nav-item no-underline text-[#000000] hover:text-[#E14E27]"
              >
                <span>PAYMENTS</span>
                <CreditCard className="w-3.5 h-3.5 text-[#000000]" />
              </Link>

              <Link
                href="/search"
                className="nav-item no-underline text-[#000000] hover:text-[#E14E27]"
              >
                <span>SEARCH REGISTRY</span>
                <Search className="w-3.5 h-3.5 text-[#000000]" />
              </Link>

              <Link
                href="/database"
                className="nav-item no-underline text-[#000000] hover:text-[#E14E27]"
              >
                <span>VIEW DATASHEET</span>
                <Database className="w-3.5 h-3.5 text-[#000000]" />
              </Link>
            </div>
          </div>

          <div>
            <div className="section-tag">JURISDICTION</div>
            {sortedCities.length === 0 ? (
              <div className="font-mono text-xs text-[#000000]/60 py-2">
                NO JURISDICTION DATA AVAILABLE
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {sortedCities.slice(0, 6).map((item) => {
                  const pct = totalCount > 0 ? ((item.count / totalCount) * 100).toFixed(1) : "0.0";
                  const numericPct = totalCount > 0 ? (item.count / totalCount) * 100 : 0;
                  return (
                    <div
                      key={item.city}
                      className="flex flex-col gap-1 font-mono text-xs pb-2 border-b border-[#000000]/15"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#000000] uppercase truncate pr-2">
                          {item.city}
                        </span>
                        <span className="shrink-0 text-[#000000]/80 font-bold">
                          {pct}% ({item.count})
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-[#000000]/10 border border-[#000000]/30 overflow-hidden">
                        <div
                          className="h-full bg-[#E14E27]"
                          style={{ width: `${Math.min(100, Math.max(0, numericPct))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-auto pt-4 border-t-2 border-[#000000]/15 flex items-center gap-2 font-mono text-[11px] font-bold uppercase text-[#000000]/70">
            <span className="w-2.5 h-2.5 rounded-full bg-[#008169] animate-pulse shrink-0" />
            <span>LIVE REGISTRY SYNC</span>
          </div>
        </aside>

        {/* ── CENTER STAGE (Variation 6: .center-stage) ───────────────────── */}
        <div className="center-stage flex-1 overflow-y-auto p-6 sm:p-8 lg:p-10 flex flex-col gap-8 bg-[#FFFDF0]">
          {/* Hero KPI Banner */}
          <section className="border-[3px] border-[#000000] bg-white p-6 sm:p-8 shadow-[8px_8px_0_#E14E27] relative overflow-hidden flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex flex-col">
              <div className="flex items-baseline gap-4">
                <span className="font-serif text-[5.5rem] sm:text-[7rem] leading-[0.85] text-[#000000] tracking-tight">
                  {String(totalCount).padStart(2, "0")}
                </span>
                <div className="flex flex-col">
                  <span className="font-serif text-3xl sm:text-4xl text-[#E14E27] tracking-wider leading-none">
                    ACTIVE RECORDS
                  </span>
                  <span className="font-mono text-xs uppercase font-bold text-[#000000]/60 mt-1.5 tracking-widest">
                    TOTAL STAFF REGISTRY &middot; LIVE DATASET &middot; {new Date().getFullYear()}
                  </span>
                </div>
              </div>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
              <select
                aria-label="Filter by Agent"
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="h-9 px-3 bg-white border-2 border-[#000000] font-mono text-xs font-bold text-[#000000] shadow-[2px_2px_0_#000000] focus:outline-none cursor-pointer uppercase"
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
                className="h-9 px-3 bg-white border-2 border-[#000000] font-mono text-xs font-bold text-[#000000] shadow-[2px_2px_0_#000000] focus:outline-none cursor-pointer uppercase"
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
                  className="h-9 px-3 bg-[#E14E27] text-white border-2 border-[#000000] font-mono text-xs font-bold uppercase shadow-[2px_2px_0_#000000] hover:brightness-110 flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  CLEAR
                </button>
              )}
            </div>
          </section>

          {/* Loading or Error State */}
          {isLoadingStats ? (
            <div className="p-8 border-2 border-[#000000] bg-white text-center font-mono font-bold text-[#000000]/60 space-y-2 animate-pulse shadow-[4px_4px_0_#000000]">
              <div className="text-sm uppercase tracking-widest">LOADING LIVE DATABASE METRICS…</div>
              <div className="text-xs opacity-75">Querying verified Supabase registry records</div>
            </div>
          ) : isStatsError || !stats ? (
            <div className="p-5 border-2 border-[#E14E27] bg-white text-[#E14E27] font-mono font-bold flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[4px_4px_0_#000000]">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <div className="text-xs uppercase tracking-wider">
                  FAILED TO LOAD DATABASE METRICS &mdash; RETRY QUERY
                </div>
              </div>
              <button
                onClick={() => refetchStats()}
                className="px-3 py-1.5 bg-[#E14E27] text-white border-2 border-[#000000] font-mono font-bold text-xs uppercase cursor-pointer"
              >
                RETRY
              </button>
            </div>
          ) : (
            <>
              {/* 3 Mini KPI Cards (Teal, Gold, Red) */}
              <section aria-label="Key Stage Metrics" className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* 1. Stage 1 - Teal Accent */}
                <div className="border-[3px] border-[#000000] bg-white p-5 shadow-[5px_5px_0_#008169] flex flex-col justify-between transition-transform hover:-translate-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs uppercase font-bold tracking-wider text-[#008169] border border-[#008169]/30 px-2 py-0.5 bg-[#008169]/10">
                      STAGE 1
                    </span>
                    <span className="font-mono text-[10px] text-[#000000]/50 uppercase font-bold">
                      INITIAL DOCKET
                    </span>
                  </div>
                  <div className="font-serif text-5xl leading-none my-3 text-[#000000]">
                    {s1Count}
                  </div>
                  <div className="font-mono text-xs uppercase font-bold text-[#000000]/70 pt-2 border-t border-[#000000]/10">
                    FILING / EXAMINATION
                  </div>
                </div>

                {/* 2. Stage 2 - Gold Accent */}
                <div className="border-[3px] border-[#000000] bg-white p-5 shadow-[5px_5px_0_#D6A200] flex flex-col justify-between transition-transform hover:-translate-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs uppercase font-bold tracking-wider text-[#D6A200] border border-[#D6A200]/30 px-2 py-0.5 bg-[#D6A200]/10">
                      STAGE 2
                    </span>
                    <span className="font-mono text-[10px] text-[#000000]/50 uppercase font-bold">
                      PROCEEDINGS
                    </span>
                  </div>
                  <div className="font-serif text-5xl leading-none my-3 text-[#000000]">
                    {s2Count}
                  </div>
                  <div className="font-mono text-xs uppercase font-bold text-[#000000]/70 pt-2 border-t border-[#000000]/10">
                    ASSIGNMENT / HEARING
                  </div>
                </div>

                {/* 3. Stage 3 - Red Accent */}
                <div className="border-[3px] border-[#000000] bg-white p-5 shadow-[5px_5px_0_#E14E27] flex flex-col justify-between transition-transform hover:-translate-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs uppercase font-bold tracking-wider text-[#E14E27] border border-[#E14E27]/30 px-2 py-0.5 bg-[#E14E27]/10">
                      STAGE 3
                    </span>
                    <span className="font-mono text-[10px] text-[#000000]/50 uppercase font-bold">
                      JOURNAL
                    </span>
                  </div>
                  <div className="font-serif text-5xl leading-none my-3 text-[#000000]">
                    {s3Count}
                  </div>
                  <div className="font-mono text-xs uppercase font-bold text-[#000000]/70 pt-2 border-t border-[#000000]/10">
                    PUBLICATION / OPPOSITION
                  </div>
                </div>
              </section>

              {/* Secondary Status Strip (Stage 4, Stopped, 7D Active) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="border-2 border-[#000000] bg-white p-3 shadow-[3px_3px_0_#000000] flex items-center justify-between">
                  <div className="font-mono text-xs uppercase font-bold text-[#000000]">STAGE 4 (CERTIFIED)</div>
                  <div className="font-serif text-2xl text-[#008169]">{s4Count}</div>
                </div>
                <div className="border-2 border-[#000000] bg-white p-3 shadow-[3px_3px_0_#000000] flex items-center justify-between">
                  <div className="font-mono text-xs uppercase font-bold text-[#000000]">INACTIVE / STOPPED</div>
                  <div className="font-serif text-2xl text-[#E14E27]">{stoppedCount}</div>
                </div>
                <div className="border-2 border-[#000000] bg-white p-3 shadow-[3px_3px_0_#000000] flex items-center justify-between">
                  <div className="font-mono text-xs uppercase font-bold text-[#000000]">7D MODIFIED</div>
                  <div className="font-serif text-2xl text-[#D6A200]">{stats.recentlyModified ?? 0}</div>
                </div>
              </div>

              {/* Black Workflow Progression Container */}
              <section className="bg-[#111111] text-white border-[3px] border-[#000000] p-6 shadow-[6px_6px_0_#000000]">
                <div className="flex items-center justify-between mb-5 border-b border-white/20 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="section-tag !bg-[#E14E27] !mb-0">PIPELINE</div>
                    <span className="font-mono text-xs uppercase font-bold tracking-[0.15em] text-white">
                      CASE WORKFLOW PROGRESSION
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-[#D6A200] uppercase tracking-wider">
                    {totalCount} TOTAL ACTIVE CASES
                  </span>
                </div>

                {/* Segmented Progress Bar */}
                <div className="mb-6">
                  <div className="h-6 w-full bg-[#222222] border-2 border-white flex overflow-hidden">
                    <div
                      style={{ width: `${s1Pct}%` }}
                      className="bg-[#008169] h-full transition-all duration-500"
                      title={`Stage 1: ${s1Pct}% (${s1Count})`}
                    />
                    <div
                      style={{ width: `${s2Pct}%` }}
                      className="bg-[#D6A200] h-full transition-all duration-500"
                      title={`Stage 2: ${s2Pct}% (${s2Count})`}
                    />
                    <div
                      style={{ width: `${s3Pct}%` }}
                      className="bg-[#E14E27] h-full transition-all duration-500"
                      title={`Stage 3: ${s3Pct}% (${s3Count})`}
                    />
                    <div
                      style={{ width: `${s4Pct}%` }}
                      className="bg-[#00604E] h-full transition-all duration-500"
                      title={`Stage 4: ${s4Pct}% (${s4Count})`}
                    />
                  </div>
                </div>

                {/* Stage Breakdown Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                  <div className="flex flex-col border-l-2 border-[#008169] pl-3">
                    <span className="font-mono text-[10px] text-[#008169] font-bold uppercase">STAGE 1 &middot; FILING</span>
                    <span className="font-serif text-2xl text-white mt-0.5">{s1Count}</span>
                    <span className="font-mono text-[11px] text-white/50">{s1Pct}% of total</span>
                  </div>
                  <div className="flex flex-col border-l-2 border-[#D6A200] pl-3">
                    <span className="font-mono text-[10px] text-[#D6A200] font-bold uppercase">STAGE 2 &middot; HEARING</span>
                    <span className="font-serif text-2xl text-white mt-0.5">{s2Count}</span>
                    <span className="font-mono text-[11px] text-white/50">{s2Pct}% of total</span>
                  </div>
                  <div className="flex flex-col border-l-2 border-[#E14E27] pl-3">
                    <span className="font-mono text-[10px] text-[#E14E27] font-bold uppercase">STAGE 3 &middot; OPPOSITION</span>
                    <span className="font-serif text-2xl text-white mt-0.5">{s3Count}</span>
                    <span className="font-mono text-[11px] text-white/50">{s3Pct}% of total</span>
                  </div>
                  <div className="flex flex-col border-l-2 border-[#00604E] pl-3">
                    <span className="font-mono text-[10px] text-[#008169] font-bold uppercase">STAGE 4 &middot; CERTIFIED</span>
                    <span className="font-serif text-2xl text-white mt-0.5">{s4Count}</span>
                    <span className="font-mono text-[11px] text-white/50">{s4Pct}% of total</span>
                  </div>
                </div>
              </section>

              {/* Statutory Matches Grid */}
              <section className="border-[3px] border-[#000000] bg-white p-6 shadow-[5px_5px_0_#000000]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="section-tag !mb-0">STATUTORY</div>
                    <span className="font-mono text-xs uppercase font-bold tracking-[0.15em] text-[#000000]">
                      IPO STATUTORY FORM MATCHES
                    </span>
                  </div>
                  <span className="font-mono text-[11px] font-bold text-[#000000]/50 uppercase">
                    TM5 &middot; TM6 &middot; TM11 &middot; TM16 &middot; TM56
                  </span>
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
                        className="border-2 border-[#000000] bg-[#FFFDF0] hover:bg-white p-4 text-center transition-all hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#000000] shadow-[2px_2px_0_#000000] block no-underline"
                      >
                        <span className="block font-serif text-3xl text-[#E14E27] leading-none">
                          {form}
                        </span>
                        <span className="block font-mono text-[11px] font-bold text-[#000000]/80 mt-1 uppercase">
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

        {/* ── RIGHT DRAWER (Variation 6: .right-drawer) ──────────────────── */}
        <aside className="right-drawer border-t-[3px] xl:border-t-0 xl:border-l-[3px] border-[#000000] bg-[#FAF9F6] flex flex-col overflow-hidden shrink-0 z-10 w-full xl:w-[340px]">
          <div className="bg-[#000000] text-white px-5 py-4 border-b-2 border-[#000000] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-2xl tracking-wider text-white m-0">
                EVENT LOGS
              </h2>
              <span className="px-2 py-0.5 bg-[#008169] text-white font-mono text-[10px] font-bold uppercase tracking-wider">
                SYSTEM ACTIVE
              </span>
            </div>
            <Link
              href="/logs"
              className="font-mono text-xs font-bold text-[#D6A200] hover:text-white uppercase tracking-wider transition-colors no-underline"
            >
              ALL EVENTS &rarr;
            </Link>
          </div>

          <div className="flex-1 overflow-y-auto p-4 divide-y-2 divide-dashed divide-[#000000]/15 max-h-[440px] xl:max-h-none">
            {isLoadingActivity ? (
              <div className="p-6 font-mono text-xs text-[#000000]/60 text-center animate-pulse">
                LOADING EVENT LOGS…
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="p-6 font-mono text-xs text-[#000000]/60 text-center">
                NO RECENT ACTIVITY RECORDED
              </div>
            ) : (
              recentActivity.map((log) => {
                const badgeColor =
                  log.action === "CREATE"
                    ? "bg-[#008169] text-white"
                    : log.action === "DELETE"
                    ? "bg-[#E14E27] text-white"
                    : "bg-[#D6A200] text-black";

                return (
                  <div key={log.id} className="py-3.5 flex flex-col gap-1.5 font-mono">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold px-2 py-0.5 border-2 border-[#000000] uppercase tracking-wider ${badgeColor} shadow-[1px_1px_0_#000000]`}>
                        {log.action}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-[#D6A200] text-black border border-black shadow-[1px_1px_0_#000000]">
                        {formatDate(log.changedAt)}
                      </span>
                    </div>

                    <Link
                      href={log.recordId ? `/record/${log.recordId}` : "/database"}
                      className="font-sans font-bold text-sm text-[#000000] hover:text-[#E14E27] hover:underline uppercase truncate block mt-0.5"
                    >
                      Case: {log.caseNo || log.record || "N/A"}{log.applicationName ? ` \u00B7 ${log.applicationName}` : ""}
                    </Link>

                    {log.clientCode && (
                      <div className="text-xs text-[#000000]/80">
                        Ref No: {log.clientCode}
                      </div>
                    )}

                    <div className="text-[11px] text-[#000000]/60 flex items-center justify-between mt-1">
                      <span>By {shortUser(log.changedBy)}</span>
                      {log.caseType && (
                        <span className="bg-[#000000]/10 px-1.5 py-0.5 font-bold text-[10px] text-[#000000] border border-[#000000]/20">
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
