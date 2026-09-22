import { listAuditLogs } from "@/lib/api";
import type { AuditLogEntry } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ScrollText, Filter, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

const PAGE_SIZE = 100;

function shortUser(id: string) {
  if (!id || id === "system") return "system";
  if (id.includes("@")) return id.split("@")[0];
  if (/^[0-9a-f-]{20,}$/i.test(id)) return "admin";
  return id.length > 24 ? id.slice(0, 20) + "…" : id;
}

function formatLogDateTime(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: "—", time: "—" };
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return { date: iso, time: "—" };
    return {
      date: format(d, "dd-MMM-yy"),
      time: format(d, "hh:mm a"),
    };
  } catch {
    return { date: iso, time: "—" };
  }
}

function summarizeValue(raw: string, other?: string): string {
  if (!raw) return "—";
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) {
    return trimmed.length > 80 ? trimmed.slice(0, 77) + "…" : trimmed;
  }
  try {
    const obj = JSON.parse(trimmed) as Record<string, unknown>;
    let otherObj: Record<string, unknown> | null = null;
    if (other && other.trim().startsWith("{")) {
      try { otherObj = JSON.parse(other); } catch { /* ignore */ }
    }
    const keys = ["status", "sub_status", "application_name", "case_number", "client_code", "tm_cpr_number", "nice_class", "agent", "city", "notes", "type"];
    const labels: Record<string, string> = {
      status: "STATUS",
      sub_status: "SUB-STATUS",
      application_name: "NAME",
      case_number: "CASE",
      client_code: "CLIENT",
      tm_cpr_number: "TM/CPR",
      nice_class: "CLASS",
      agent: "AGENT",
      city: "CITY",
      notes: "NOTES",
      type: "TYPE",
    };
    const parts: string[] = [];
    for (const k of keys) {
      if (!(k in obj)) continue;
      const v = obj[k];
      if (otherObj && otherObj[k] !== v) {
        parts.push(`${labels[k]}=${v ?? "NULL"}`);
      } else if (!otherObj) {
        parts.push(`${labels[k]}=${v ?? "NULL"}`);
      }
    }
    if (parts.length === 0) {
      if ("version" in obj) parts.push(`v${obj.version}`);
      if ("status" in obj) parts.push(String(obj.status));
      if ("application_name" in obj) parts.push(String(obj.application_name));
    }
    const s = parts.slice(0, 6).join(" · ");
    return s.length > 120 ? s.slice(0, 117) + "…" : s || "—";
  } catch {
    return trimmed.length > 80 ? trimmed.slice(0, 77) + "…" : trimmed;
  }
}

export function LogsPage() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState<"" | "CREATE" | "UPDATE" | "DELETE">("");

  const offset = (page - 1) * PAGE_SIZE;
  const { data: logs = [], isLoading } = useQuery<AuditLogEntry[]>({
    queryKey: ["change-log", page],
    queryFn: () => listAuditLogs(PAGE_SIZE, offset),
    staleTime: 30_000,
  });

  const filtered = actionFilter
    ? logs.filter((l) => l.action === actionFilter)
    : logs;

  const hasPrev = page > 1;
  const hasNext = logs.length === PAGE_SIZE;

  function getAction(action: string): { label: string; color: string } {
    if (action === "CREATE") return { label: "CREATE", color: "bg-[#0A6B52] text-white" };
    if (action === "DELETE") return { label: "DELETE", color: "bg-[#CC0000] text-white" };
    return { label: "UPDATE", color: "bg-[#B0740E] text-white" };
  }

  return (
    <AppShell>
      <div className="flex flex-col h-full bg-white">
        {/* Header */}
        <div className="shrink-0 flex items-center gap-4 px-6 py-4 bg-[#E8DFC7] border-b-2 border-[#0C0C0C]">
          <ScrollText className="w-5 h-5 text-[#0C0C0C] hidden sm:block" />
          <h1 className="font-serif text-2xl uppercase tracking-widest text-[#0C0C0C] mr-auto leading-none">AUDIT LOGS</h1>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#6d6658]" />
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value as any); setPage(1); }}
              className="h-10 px-3 bg-white border-2 border-[#0C0C0C] font-mono text-xs focus:outline-2 focus:outline-[#6C1C1F] min-w-[140px]"
            >
              <option value="">ALL ACTIONS</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>
        </div>

        {/* 8-Column Audit Table */}
        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead className="bg-[#0C0C0C] text-[#F0E8D0] sticky top-0 z-10">
              <tr>
                <th className="px-3 py-3 border-r border-[#1A1A1A] font-bold tracking-wider uppercase text-[10px] w-24">DATE</th>
                <th className="px-3 py-3 border-r border-[#1A1A1A] font-bold tracking-wider uppercase text-[10px] w-20">TIME</th>
                <th className="px-3 py-3 border-r border-[#1A1A1A] font-bold tracking-wider uppercase text-[10px] w-28">USER</th>
                <th className="px-3 py-3 border-r border-[#1A1A1A] font-bold tracking-wider uppercase text-[10px] w-24">ACTION</th>
                <th className="px-3 py-3 border-r border-[#1A1A1A] font-bold tracking-wider uppercase text-[10px] w-32">RECORD</th>
                <th className="px-3 py-3 border-r border-[#1A1A1A] font-bold tracking-wider uppercase text-[10px] w-32">APP NUMBER</th>
                <th className="px-3 py-3 border-r border-[#1A1A1A] font-bold tracking-wider uppercase text-[10px] w-48">NAME</th>
                <th className="px-4 py-3 font-bold tracking-wider uppercase text-[10px]">CHANGES</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center font-bold text-[#6d6658] animate-pulse">LOADING SECURE AUDIT LOG…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center font-bold text-[#6d6658]">NO LOG ENTRIES FOUND.</td></tr>
              ) : (
                filtered.map((log, i) => {
                  const action = getAction(log.action);
                  const { date, time } = formatLogDateTime(log.changedAt);
                  const summary = summarizeValue(log.newValue, log.oldValue);
                  const oldSummary = log.action === "UPDATE" ? summarizeValue(log.oldValue, log.newValue) : "";
                  const recordLabel = log.record || (log.recordId ? log.recordId.slice(0, 8) + "…" : "—");

                  return (
                    <tr key={log.id} className={`border-b border-[#0C0C0C]/10 ${i % 2 === 0 ? "bg-[#F0E8D0]" : "bg-white"} hover:bg-[#D9D0B7] transition-colors`}>
                      <td className="px-3 py-2.5 border-r border-[#0C0C0C]/10 text-[#6d6658] whitespace-nowrap">{date}</td>
                      <td className="px-3 py-2.5 border-r border-[#0C0C0C]/10 text-[#6d6658] whitespace-nowrap">{time}</td>
                      <td className="px-3 py-2.5 border-r border-[#0C0C0C]/10 font-bold whitespace-nowrap" title={log.changedBy || ""}>
                        {shortUser(log.changedBy || "")}
                      </td>
                      <td className="px-3 py-2.5 border-r border-[#0C0C0C]/10">
                        <span className={`inline-block px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border border-[#0C0C0C]/20 ${action.color}`}>{action.label}</span>
                      </td>
                      <td className="px-3 py-2.5 border-r border-[#0C0C0C]/10 font-bold whitespace-nowrap">
                        {log.recordId ? (
                          <Link
                            href={`/record/${log.recordId}`}
                            className="inline-flex items-center gap-1 text-[#6C1C1F] hover:underline font-bold"
                            title={`Open record ${recordLabel}`}
                          >
                            <span>{recordLabel}</span>
                            <ExternalLink className="w-3 h-3 opacity-60" />
                          </Link>
                        ) : (
                          <span className="text-[#0C0C0C]">{recordLabel}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 border-r border-[#0C0C0C]/10 font-bold text-[#0C0C0C] whitespace-nowrap">
                        {log.applicationNumber || "—"}
                      </td>
                      <td className="px-3 py-2.5 border-r border-[#0C0C0C]/10 font-bold text-[#0C0C0C] max-w-[200px] truncate" title={log.applicationName || ""}>
                        {log.applicationName || "—"}
                      </td>
                      <td className="px-4 py-2.5 max-w-[440px]">
                        {log.action === "UPDATE" && oldSummary && (
                          <div className="text-[#CC0000] text-[10px] truncate mb-0.5">was: {oldSummary}</div>
                        )}
                        <div className="text-[#0A6B52] font-bold text-[10px] truncate">{summary}</div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between px-6 py-3 bg-[#E8DFC7] border-t-2 border-[#0C0C0C]">
          <span className="font-mono text-[10px] text-[#6d6658] font-bold uppercase tracking-widest">
            PAGE {page} · {filtered.length} ENTRIES SHOWN · DATABASE AUDIT TRAIL
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!hasPrev}
              className="flex items-center gap-1 px-3 py-1.5 border-2 border-[#0C0C0C] bg-white font-mono text-[10px] font-bold uppercase tracking-wider disabled:opacity-40 hover:bg-[#0C0C0C] hover:text-[#F0E8D0] transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> PREV
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasNext}
              className="flex items-center gap-1 px-3 py-1.5 border-2 border-[#0C0C0C] bg-white font-mono text-[10px] font-bold uppercase tracking-wider disabled:opacity-40 hover:bg-[#0C0C0C] hover:text-[#F0E8D0] transition-colors"
            >
              NEXT <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
