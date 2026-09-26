import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  Plus,
  Search,
  Database,
  ScrollText,
  Clock,
  AlertCircle,
  Users2,
  Filter,
  X,
  Building2,
  FileCheck,
  ExternalLink,
  ChevronRight,
  Layers,
} from "lucide-react";
import { getStats, listAuditLogs, listAgents, STAGES } from "@/lib/api";
import type { TrademarkStats, AuditLogEntry } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { formatDate } from "@/lib/utils";
import { useBranding } from "@/hooks/useBranding";

const STAGE_CONFIG: Record<
  string,
  { label: string; subLabel: string; bg: string; text: string; barBg: string; border: string }
> = {
  "STAGE 1": {
    label: "STAGE 1",
    subLabel: "Filing → optional Examination → Acknowledgment",
    bg: "bg-[#0D9970] text-white",
    text: "text-[#0D9970]",
    barBg: "bg-[#0D9970]",
    border: "border-[#0D9970]",
  },
  "STAGE 2": {
    label: "STAGE 2",
    subLabel: "Assigned → Accepted → Hearing",
    bg: "bg-[#B0740E] text-white",
    text: "text-[#B0740E]",
    barBg: "bg-[#B0740E]",
    border: "border-[#B0740E]",
  },
  "STAGE 3": {
    label: "STAGE 3",
    subLabel: "Demand Note → Opposition → Published",
    bg: "bg-[#6C1C1F] text-white",
    text: "text-[#6C1C1F]",
    barBg: "bg-[#6C1C1F]",
    border: "border-[#6C1C1F]",
  },
  "STAGE 4": {
    label: "STAGE 4",
    subLabel: "CER Dispatch / Received / Acknowledge",
    bg: "bg-[#0A6B52] text-white",
    text: "text-[#0A6B52]",
    barBg: "bg-[#0A6B52]",
    border: "border-[#0A6B52]",
  },
  STOPPED: {
    label: "STOPPED",
    subLabel: "Case Stopped",
    bg: "bg-[#CC0000] text-white",
    text: "text-[#CC0000]",
    barBg: "bg-[#CC0000]",
    border: "border-[#CC0000]",
  },
};

const WORKFLOW_ORDER = ["STAGE 1", "STAGE 2", "STAGE 3", "STAGE 4", "STOPPED"] as const;

const NICE_CLASSES = Array.from({ length: 45 }, (_, i) => String(i + 1));

function MetricCard({
  label,
  value,
  subLabel,
  colorClass,
}: {
  label: string;
  value: number | string;
  subLabel?: string;
  colorClass: string;
}) {
  return (
    <div
      className={`border border-stone-300 p-3 sm:p-3.5 flex flex-col justify-between shadow-none min-h-[90px] ${colorClass}`}
    >
      <div>
        <div className="font-mono text-sm sm:text-[11px] font-bold uppercase tracking-wider opacity-90 truncate">
          {label}
        </div>
      </div>
      <div className="mt-1">
        <div className="font-serif text-3xl sm:text-4xl leading-none tracking-wide">{value}</div>
        {subLabel && (
          <div className="font-mono text-sm uppercase tracking-widest opacity-80 mt-1 truncate">
            {subLabel}
          </div>
        )}
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
  color,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between p-3 sm:p-3.5 border border-stone-300 font-mono font-bold text-sm uppercase tracking-wider transition-all shadow-none hover:-translate-y-0.5 hover:shadow-[5px_5px_0_#0C0C0C] active:translate-y-0 active:shadow-none ${color}`}
    >
      <div className="flex items-center gap-2.5 truncate">
        <Icon className="w-4 h-4 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <ChevronRight className="w-4 h-4 shrink-0 opacity-70" />
    </Link>
  );
}

function shortUser(id: string) {
  if (!id || id === "system") return "system";
  if (id.includes("@")) return id.split("@")[0];
  if (/^[0-9a-f-]{20,}$/i.test(id)) return "admin";
  return id.length > 24 ? id.slice(0, 20) + "…" : id;
}

export function Dashboard() {
  const { branding } = useBranding();
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
    queryFn: () => listAuditLogs(10, 0),
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

  return (
    <AppShell>
      <div className="flex-1 overflow-auto bg-[#F0E8D0] p-4 sm:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* ── A. BRAND & HEADER AREA ────────────────────────────────────────── */}
          <div className="border-b border-stone-300 pb-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <img
                  src={branding.logoUrl || "/brandex-wordmark.svg"}
                  alt="Brandex Law Associates"
                  className="w-40 sm:w-48 h-12 sm:h-14 object-contain object-left"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/brandex-wordmark.svg";
                  }}
                />
                <div className="border-l-2 border-[#0C0C0C]/20 pl-3">
                  <h1 className="font-serif text-2xl sm:text-3xl text-[#0C0C0C] uppercase tracking-wide leading-none">
                    BRANDEX LAW ASSOCIATES
                  </h1>
                  <p className="font-mono text-sm text-[#6d6658] mt-1 uppercase tracking-widest font-bold">
                    TRADEMARK REGISTRY · {format(new Date(), "EEEE, d MMMM yyyy")}
                  </p>
                </div>
              </div>

              {/* Status context pill */}
              <div className="inline-flex items-center gap-2 self-start sm:self-auto bg-white border border-stone-300 px-3 py-1.5 shadow-none">
                <div className="w-2 h-2 rounded-full bg-[#0D9970] animate-pulse" />
                <span className="font-mono text-sm font-bold uppercase tracking-wider text-[#0C0C0C]">
                  LIVE REGISTRY DATA
                </span>
              </div>
            </div>

            {/* ── D. DASHBOARD FILTERS BAR ────────────────────────────────────── */}
            <div className="bg-[#E8DFC7] border border-stone-300 p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-none">
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-[#0C0C0C] uppercase tracking-wider">
                  <Filter className="w-4 h-4 text-[#6C1C1F]" />
                  <span>DASHBOARD FILTERS:</span>
                </div>

                {/* Agent filter */}
                <div className="flex items-center gap-1">
                  <label htmlFor="agent-filter" className="sr-only">
                    Filter by Agent
                  </label>
                  <select
                    id="agent-filter"
                    value={selectedAgent}
                    onChange={(e) => setSelectedAgent(e.target.value)}
                    className="h-9 px-3 bg-white border border-stone-300 font-mono text-sm font-medium text-[#0C0C0C] focus:outline-2 focus:outline-[#6C1C1F] cursor-pointer"
                  >
                    <option value="">ALL AGENTS</option>
                    {agents.map((agentName) => (
                      <option key={agentName} value={agentName}>
                        {agentName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Class filter */}
                <div className="flex items-center gap-1">
                  <label htmlFor="class-filter" className="sr-only">
                    Filter by Class
                  </label>
                  <select
                    id="class-filter"
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="h-9 px-3 bg-white border border-stone-300 font-mono text-sm font-medium text-[#0C0C0C] focus:outline-2 focus:outline-[#6C1C1F] cursor-pointer"
                  >
                    <option value="">ALL CLASSES</option>
                    {NICE_CLASSES.map((cls) => (
                      <option key={cls} value={cls}>
                        CLASS {cls}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Clear filters button */}
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1 h-9 px-3 bg-white border-2 border-[#CC0000] text-[#CC0000] font-mono font-bold text-sm uppercase tracking-wider hover:bg-[#CC0000] hover:text-white transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    CLEAR FILTERS
                  </button>
                )}
              </div>

              {/* Active Filter summary tags */}
              {hasActiveFilters && (
                <div className="flex items-center gap-2 font-mono text-sm font-bold text-[#6C1C1F]">
                  <span>FILTERED BY:</span>
                  {selectedAgent && (
                    <span className="bg-white border border-[#6C1C1F] px-2 py-0.5 uppercase">
                      AGENT: {selectedAgent}
                    </span>
                  )}
                  {selectedClass && (
                    <span className="bg-white border border-[#6C1C1F] px-2 py-0.5 uppercase">
                      CLASS: {selectedClass}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── LOADING & ERROR STATES ────────────────────────────────────────── */}
          {isLoadingStats ? (
            <div className="p-8 border border-stone-300 bg-white text-center font-mono font-bold text-[#6d6658] space-y-2 animate-pulse shadow-none">
              <div className="text-sm uppercase tracking-widest">LOADING LIVE DATABASE METRICS...</div>
              <div className="text-sm opacity-75">Querying verified Supabase registry records</div>
            </div>
          ) : isStatsError || !stats ? (
            <div className="p-6 border-2 border-[#CC0000] bg-white text-[#CC0000] font-mono font-bold flex flex-col sm:flex-row items-center justify-between gap-4 shadow-none">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6 shrink-0" />
                <div>
                  <div className="text-sm uppercase tracking-wider">FAILED TO LOAD DATABASE METRICS</div>
                  <div className="text-sm font-normal text-[#0C0C0C] mt-0.5">
                    Please verify your connection and permissions.
                  </div>
                </div>
              </div>
              <button
                onClick={() => refetchStats()}
                className="px-4 py-2 bg-[#CC0000] text-white border border-stone-300 font-mono font-bold text-sm uppercase tracking-wider hover:brightness-110"
              >
                RETRY QUERY
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* ── B. KEY METRICS GRID (7 CARDS) ────────────────────────────── */}
              <section aria-label="Key Trademark Metrics">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  {/* 1. Total Records */}
                  <MetricCard
                    label="TOTAL RECORDS"
                    value={stats.total}
                    subLabel={hasActiveFilters ? "Filtered Total" : "All Case Records"}
                    colorClass="bg-[#E8DFC7] text-[#0C0C0C]"
                  />

                  {/* 2. Stage 1 */}
                  <MetricCard
                    label="STAGE 1"
                    value={getStageCount("STAGE 1")}
                    subLabel="Filing / Exam"
                    colorClass={STAGE_CONFIG["STAGE 1"].bg}
                  />

                  {/* 3. Stage 2 */}
                  <MetricCard
                    label="STAGE 2"
                    value={getStageCount("STAGE 2")}
                    subLabel="Assign / Hearing"
                    colorClass={STAGE_CONFIG["STAGE 2"].bg}
                  />

                  {/* 4. Stage 3 */}
                  <MetricCard
                    label="STAGE 3"
                    value={getStageCount("STAGE 3")}
                    subLabel="Pub / Opposition"
                    colorClass={STAGE_CONFIG["STAGE 3"].bg}
                  />

                  {/* 5. Stage 4 */}
                  <MetricCard
                    label="STAGE 4"
                    value={getStageCount("STAGE 4")}
                    subLabel="CER Dispatch"
                    colorClass={STAGE_CONFIG["STAGE 4"].bg}
                  />

                  {/* 6. STOPPED */}
                  <MetricCard
                    label="STOPPED"
                    value={getStageCount("STOPPED")}
                    subLabel="Case Stopped"
                    colorClass={STAGE_CONFIG["STOPPED"].bg}
                  />

                  {/* 7. Modified 7D */}
                  <MetricCard
                    label="MODIFIED (7D)"
                    value={stats.recentlyModified ?? 0}
                    subLabel="Active Past 7D"
                    colorClass="bg-white text-[#0C0C0C]"
                  />
                </div>
              </section>

              {/* ── MAIN DASHBOARD CONTENT (2 COLUMNS) ────────────────────────── */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* ── LEFT COLUMN (WORKFLOW & TM FORMS) ──────────────────────── */}
                <div className="lg:col-span-8 space-y-6">
                  {/* ── C. WORKFLOW DISTRIBUTION / OVERVIEW ──────────────────── */}
                  <div className="border border-stone-300 bg-white shadow-none">
                    <div className="px-4 py-3 border-b border-stone-300 bg-[#E8DFC7] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-mono font-bold text-sm uppercase tracking-wider text-[#0C0C0C]">
                        <Layers className="w-4 h-4 text-[#6C1C1F]" />
                        <span>WORKFLOW PROGRESSION & DISTRIBUTION</span>
                      </div>
                      <span className="font-mono text-sm font-bold text-[#6d6658] uppercase tracking-wider bg-white px-2 py-0.5 border border-[#0C0C0C]/20">
                        {totalCount} TOTAL ACTIVE CASES
                      </span>
                    </div>

                    <div className="p-4 sm:p-5 space-y-4">
                      {WORKFLOW_ORDER.map((stageKey) => {
                        const count = getStageCount(stageKey);
                        const percentage = totalCount > 0 ? ((count / totalCount) * 100).toFixed(1) : "0.0";
                        const numericPct = totalCount > 0 ? (count / totalCount) * 100 : 0;
                        const config = STAGE_CONFIG[stageKey];

                        return (
                          <div key={stageKey} className="space-y-1.5">
                            <div className="flex items-center justify-between text-sm font-mono">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-block w-2.5 h-2.5 border border-[#0C0C0C] ${config.barBg}`}
                                />
                                <strong className="font-bold text-[#0C0C0C] uppercase tracking-wide">
                                  {config.label}
                                </strong>
                                <span className="text-[#6d6658] hidden sm:inline text-sm">
                                  · {config.subLabel}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 font-bold shrink-0">
                                <span className="text-sm font-serif text-[#0C0C0C]">{count}</span>
                                <span className="text-sm text-[#6d6658] bg-[#F0E8D0] px-1.5 py-0.5 border border-[#0C0C0C]/15 min-w-[42px] text-right">
                                  {percentage}%
                                </span>
                              </div>
                            </div>

                            {/* Horizontal progress bar */}
                            <div className="h-3.5 bg-[#E8DFC7] border border-[#0C0C0C]/30 overflow-hidden relative">
                              <div
                                className={`h-full ${config.barBg} transition-all duration-500 ease-out`}
                                style={{ width: `${Math.min(100, Math.max(0, numericPct))}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Workflow overview footer */}
                    <div className="px-4 py-2.5 border-t-2 border-[#0C0C0C] bg-[#FFF9F0] flex items-center justify-between font-mono text-sm text-[#6d6658]">
                      <span>Stages strictly progress STAGE 1 → STAGE 2 → STAGE 3 → STAGE 4.</span>
                      <Link
                        href="/database"
                        className="font-bold text-[#6C1C1F] uppercase hover:underline flex items-center gap-1"
                      >
                        EXPLORE IN DATABASE <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>

                  {/* ── E. TM DOCUMENT CONTROL ────────────────────────────────── */}
                  <div className="border border-stone-300 bg-white shadow-none">
                    <div className="px-4 py-3 border-b border-stone-300 bg-[#E8DFC7] flex items-center justify-between">
                      <div className="flex items-center gap-2 font-mono font-bold text-sm uppercase tracking-wider text-[#0C0C0C]">
                        <FileCheck className="w-4 h-4 text-[#6C1C1F]" />
                        <span>TM FORM IPO (REGISTRY MATCHES)</span>
                      </div>
                      <span className="font-mono text-sm font-bold text-[#6d6658] uppercase tracking-wider bg-white px-2 py-0.5 border border-[#0C0C0C]/20 hidden sm:inline">
                        STATUTORY FORM REGISTRY
                      </span>
                    </div>

                    <div className="p-4 sm:p-5">
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        {stats.byTmForm.map(({ form, count }) => {
                          const filterParams = new URLSearchParams();
                          filterParams.set("tmForm", form);
                          if (selectedAgent) filterParams.set("agent", selectedAgent);
                          if (selectedClass) filterParams.set("appClass", selectedClass);

                          return (
                            <Link
                              key={form}
                              href={`/database?${filterParams.toString()}`}
                              className="group p-3 sm:p-3.5 border border-stone-300 bg-[#FFF9F0] hover:bg-[#B0740E]/10 transition-all flex flex-col justify-between shadow-none hover:-translate-y-0.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-bold text-sm text-[#6C1C1F] group-hover:underline">
                                  {form}
                                </span>
                                <ExternalLink className="w-3.5 h-3.5 text-[#6d6658] opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                              <div className="mt-3 pt-2 border-t border-[#0C0C0C]/10 flex items-baseline justify-between">
                                <span className="font-mono text-sm font-bold uppercase tracking-wider text-[#6d6658]">
                                  MATCHED
                                </span>
                                <span className="font-serif text-3xl text-[#0C0C0C] leading-none">
                                  {count}
                                </span>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>

                    <div className="px-4 py-2 border-t-2 border-[#0C0C0C] bg-[#FFF9F0] font-mono text-sm text-[#6d6658]">
                      Click any statutory form box to view matching trademark records in the primary datasheet.
                    </div>
                  </div>

                  {/* ── REGIONAL DISTRIBUTION (RECORDS BY CITY) ──────────────── */}
                  <div className="border border-stone-300 bg-white shadow-none">
                    <div className="px-4 py-3 border-b border-stone-300 bg-[#E8DFC7] flex items-center justify-between">
                      <div className="flex items-center gap-2 font-mono font-bold text-sm uppercase tracking-wider text-[#0C0C0C]">
                        <Building2 className="w-4 h-4 text-[#6C1C1F]" />
                        <span>REGIONAL DISTRIBUTION (RECORDS BY CITY)</span>
                      </div>
                      <span className="font-mono text-sm font-bold text-[#6d6658] uppercase">
                        {stats.byCity.length} CITIES REPRESENTED
                      </span>
                    </div>

                    <div className="p-4 sm:p-5">
                      {stats.byCity.length === 0 ? (
                        <div className="font-mono text-sm text-[#6d6658] py-4 text-center">
                          NO REGIONAL DATA AVAILABLE
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {stats.byCity
                            .sort((a, b) => b.count - a.count)
                            .map((c) => {
                              const cityPct =
                                totalCount > 0 ? ((c.count / totalCount) * 100).toFixed(1) : "0.0";
                              return (
                                <div
                                  key={c.city || "UNSPECIFIED"}
                                  className="p-2.5 border border-[#0C0C0C]/20 bg-[#FFF9F0] flex items-center justify-between font-mono"
                                >
                                  <div className="truncate pr-2">
                                    <div className="text-sm font-bold text-[#0C0C0C] uppercase truncate">
                                      {c.city || "UNSPECIFIED"}
                                    </div>
                                    <div className="text-sm text-[#6d6658]">{cityPct}% of total</div>
                                  </div>
                                  <span className="font-serif text-xl text-[#0C0C0C] leading-none shrink-0">
                                    {c.count}
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── RIGHT COLUMN (ACTIONS & RECENT ACTIVITY) ──────────────── */}
                <div className="lg:col-span-4 space-y-6">
                  {/* ── G. QUICK ACTIONS ──────────────────────────────────────── */}
                  <div className="border border-stone-300 bg-white shadow-none">
                    <div className="px-4 py-3 border-b border-stone-300 bg-[#E8DFC7] font-mono font-bold text-sm uppercase tracking-wider text-[#0C0C0C]">
                      QUICK ACTIONS
                    </div>
                    <div className="p-4 space-y-2.5">
                      <QuickAction
                        href="/database?new=1"
                        icon={Plus}
                        label="ADD NEW RECORD"
                        color="bg-[#6C1C1F] text-white"
                      />
                      <QuickAction
                        href="/search"
                        icon={Search}
                        label="SEARCH REGISTRY"
                        color="bg-[#E8DFC7] text-[#0C0C0C]"
                      />
                      <QuickAction
                        href="/database"
                        icon={Database}
                        label="DATASHEET DATABASE"
                        color="bg-[#0A6B52] text-white"
                      />
                      <QuickAction
                        href="/assigned"
                        icon={Users2}
                        label="ASSIGNED QUEUE"
                        color="bg-[#B0740E] text-white"
                      />
                      <QuickAction
                        href="/logs"
                        icon={ScrollText}
                        label="AUDIT & SYNC LOGS"
                        color="bg-[#0C0C0C] text-[#F0E8D0]"
                      />
                    </div>
                  </div>

                  {/* ── F. RECENT ACTIVITY (AUDIT LOGS) ───────────────────────── */}
                  <div className="border border-stone-300 bg-white shadow-none">
                    <div className="px-4 py-3 border-b border-stone-300 bg-[#E8DFC7] font-mono font-bold text-sm uppercase tracking-wider flex items-center justify-between text-[#0C0C0C]">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[#6C1C1F]" />
                        <span>RECENT ACTIVITY</span>
                      </div>
                      <span className="font-mono text-sm font-bold text-[#6d6658]">LAST 10 EVENTS</span>
                    </div>

                    <div>
                      {isLoadingActivity ? (
                        <div className="p-6 font-mono text-sm text-[#6d6658] text-center animate-pulse">
                          LOADING ACTIVITY FEED...
                        </div>
                      ) : recentActivity.length === 0 ? (
                        <div className="p-6 font-mono text-sm text-[#6d6658] text-center">
                          NO RECENT AUDIT LOGS FOUND
                        </div>
                      ) : (
                        <div className="divide-y divide-[#0C0C0C]/10 max-h-[520px] overflow-y-auto">
                          {recentActivity.map((log) => {
                            const badgeStyle =
                              log.action === "CREATE"
                                ? "bg-[#0A6B52]/15 text-[#0A6B52] border-[#0A6B52]/30"
                                : log.action === "DELETE"
                                ? "bg-[#CC0000]/15 text-[#CC0000] border-[#CC0000]/30"
                                : "bg-[#B0740E]/15 text-[#B0740E] border-[#B0740E]/30";

                            return (
                              <div
                                key={log.id}
                                className="p-3.5 hover:bg-[#F0E8D0]/60 transition-colors space-y-1"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span
                                    className={`font-mono text-sm font-bold px-1.5 py-0.5 border uppercase ${badgeStyle}`}
                                  >
                                    {log.action}
                                  </span>
                                  <span className="font-mono text-sm text-[#6d6658]">
                                    {formatDate(log.changedAt)}
                                  </span>
                                </div>

                                <div className="font-mono text-sm font-bold text-[#0C0C0C]">
                                  {log.recordId ? (
                                    <Link
                                      href={`/record/${log.recordId}`}
                                      className="hover:text-[#6C1C1F] hover:underline flex items-center gap-1 truncate"
                                      title="Open record view"
                                    >
                                      <span>CASE: {log.caseNo || log.record || log.recordId}</span>
                                      <ExternalLink className="w-2.5 h-2.5 opacity-60 inline" />
                                    </Link>
                                  ) : (
                                    <span className="truncate">
                                      CASE: {log.caseNo || log.record || "N/A"}
                                    </span>
                                  )}
                                </div>

                                {(log.applicationName || log.clientCode) && (
                                  <div className="font-mono text-sm text-[#0C0C0C]/80 truncate">
                                    {log.applicationName && <span>{log.applicationName}</span>}
                                    {log.clientCode && (
                                      <span className="text-[#6d6658]"> [{log.clientCode}]</span>
                                    )}
                                  </div>
                                )}

                                <div className="font-mono text-sm text-[#6d6658] pt-0.5 flex items-center justify-between">
                                  <span>by {shortUser(log.changedBy)}</span>
                                  {log.caseType && (
                                    <span className="uppercase text-sm bg-black/5 px-1 rounded-xs">
                                      {log.caseType}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <Link
                      href="/logs"
                      className="block text-center border-t-2 border-[#0C0C0C] bg-[#F0E8D0] py-2.5 font-mono text-sm font-bold uppercase tracking-widest text-[#0C0C0C] hover:bg-[#0C0C0C] hover:text-[#F0E8D0] transition-colors"
                    >
                      VIEW ALL AUDIT LOGS →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
