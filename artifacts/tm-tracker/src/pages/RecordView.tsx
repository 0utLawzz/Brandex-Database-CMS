import { getRecord, getWorkflowHistory, formatWorkflowLabel, getStaffRole, getWorkflowReminders } from "@/lib/api";
import type { TrademarkRecord, TmMatches } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { formatDateShort, formatDate } from "@/lib/utils";
import { useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  ArrowLeft, Edit2, Printer, CheckCircle2, MinusCircle,
  Image as ImageIcon, FileText, Bell,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RecordModal } from "@/components/RecordModal";
import { StageDocumentsSection } from "@/components/StageDocumentsSection";
import {
  CaseWorkflowSection,
  StagePaymentsSection,
  WorkflowHistorySection,
} from "@/components/CaseWorkflowSection";

const STAGE_BADGE: Record<string, string> = {
  "STAGE 1": "bg-[#0D9970] text-white",
  "STAGE 2": "bg-[#B0740E] text-white",
  "STAGE 3": "bg-[#6C1C1F] text-white",
  "STAGE 4": "bg-[#0A6B52] text-white",
  "STOPPED": "bg-[#CC0000] text-white",
};

function Field({ label, value, wide }: { label: string; value?: string | null; wide?: boolean }) {
  if (!value) return null;
  return (
    <div className={`${wide ? "col-span-2" : ""} border-2 border-[#0C0C0C] bg-[#F0E8D0] p-3 print:p-1.5 shadow-[3px_3px_0_#0C0C0C] print:shadow-none`}>
      <div className="font-mono text-[9px] print:text-[8px] font-bold uppercase tracking-widest text-[#6C1C1F] mb-1 print:mb-0.5">{label}</div>
      <div className="font-sans text-base sm:text-lg print:text-xs font-bold text-[#0C0C0C] break-words">{value}</div>
    </div>
  );
}

function TmFormBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 print:px-1.5 print:py-0.5 font-mono text-[10px] print:text-[8px] font-bold border-2 ${
        active
          ? "border-[#0A6B52] text-[#0A6B52] bg-[#D8F2E8] shadow-[3px_3px_0_#0A6B52] print:shadow-none"
          : "border-[#0C0C0C]/35 text-[#6d6658] bg-[#E8DFC7]"
      }`}
    >
      {active ? <CheckCircle2 className="w-4 h-4 print:w-3 print:h-3" /> : <MinusCircle className="w-4 h-4 print:w-3 print:h-3" />}
      {label}
    </span>
  );
}

export function RecordView() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const { data: staffRole } = useQuery({
    queryKey: ["staff-role"],
    queryFn: getStaffRole,
    staleTime: 5 * 60 * 1000,
  });
  const canEdit = staffRole === "editor" || staffRole === "admin";

  const { data: record, isLoading, error } = useQuery({
    queryKey: ["trademark", params.id],
    queryFn: () => getRecord(params.id!),
    enabled: Boolean(params.id),
  });

  const { data: workflowHistory = [] } = useQuery({
    queryKey: ["trademark-workflow-history", params.id],
    queryFn: () => getWorkflowHistory(params.id!),
    enabled: Boolean(params.id),
  });

  const handleEditSaved = () => {
    setEditOpen(false);
    queryClient.invalidateQueries({ queryKey: ["trademark", params.id] });
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-full font-mono text-[#6d6658] animate-pulse">
          LOADING RECORD…
        </div>
      </AppShell>
    );
  }

  if (error || !record) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-full gap-3">
          <div className="font-mono font-bold text-[#CC0000]">Record not found</div>
          <button
            onClick={() => navigate("/search")}
            className="px-4 py-2 border-2 border-[#0C0C0C] font-mono text-xs font-bold uppercase"
          >
            BACK TO SEARCH
          </button>
        </div>
      </AppShell>
    );
  }

  const matches: TmMatches = record.tmMatches ?? {
    TM5: false, TM6: false, TM11: false, TM16: false, TM56: false,
  };

  const reminders = getWorkflowReminders(record.stage, record.subStage, {
    filingDate: record.date || undefined,
    publicationDate: record.publicationDate || undefined,
    oppositionDeadline: record.oppositionDeadline || undefined,
  });

  return (
    <AppShell>
      <div className="flex flex-col h-full bg-[#F0E8D0]">
        {/* Top bar — hidden on print */}
        <div className="shrink-0 px-4 py-3 bg-[#E8DFC7] border-b-2 border-[#0C0C0C] flex items-center gap-3 flex-wrap print:hidden">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-1.5 px-3 py-1.5 border-2 border-[#0C0C0C] bg-white font-mono text-xs font-bold uppercase hover:bg-[#0C0C0C] hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> BACK
          </button>
          <div className="flex-1 min-w-0">
            <div className="font-serif text-lg uppercase tracking-wide text-[#0C0C0C] font-bold truncate">
              {record.appName || "—"}
            </div>
            <div className="font-mono text-[10px] text-[#6d6658]">
              {record.caseNumber} · {record.clientCode} · {record.type}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A6B52] text-white font-mono text-xs font-bold uppercase border-2 border-[#0A6B52] hover:brightness-110"
            >
              <Edit2 className="w-3.5 h-3.5" /> EDIT
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border-2 border-[#0C0C0C] font-mono text-xs font-bold uppercase hover:bg-[#0C0C0C] hover:text-white"
            >
              <Printer className="w-3.5 h-3.5" /> PRINT A4
            </button>
          </div>
        </div>

        {/* Scrollable / printable body */}
        <div
          id="record-view-body"
          className="flex-1 overflow-auto p-4 sm:p-6 print:p-0 print:overflow-visible print:bg-white"
        >
          <div className="max-w-4xl mx-auto space-y-4 print:max-w-none print:space-y-2">

            {/* Print-only header — Brandex letterhead banner */}
            <div className="hidden print:block border-b-2 border-[#6C1C1F] pb-2 mb-1.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-serif text-xl uppercase tracking-widest text-[#0C0C0C] font-bold">
                    Brandex Law Associates — Trademark Record
                  </div>
                  <div className="font-mono text-[9px] text-[#6d6658] mt-0.5">
                    {record.caseNumber} · {record.clientCode} · {record.type} · Printed {new Date().toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right font-mono text-[8px] text-[#6d6658] font-bold uppercase tracking-wider">
                  CONFIDENTIAL IP DOSSIER
                </div>
              </div>
            </div>

            {/* Image + Name priority */}
            <div className="print-avoid-break border-2 border-[#0C0C0C] bg-white shadow-[4px_4px_0_#0C0C0C] p-4 print:p-2 print:shadow-none flex gap-4 items-start">
              <div className="w-28 h-28 sm:w-36 sm:h-36 print:w-20 print:h-20 shrink-0 border-2 border-[#0C0C0C] bg-[#F0E8D0] flex items-center justify-center overflow-hidden">
                {record.image ? (
                  <img
                    src={record.image}
                    alt={record.appName}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <ImageIcon className="w-10 h-10 text-[#9d9488] print:w-6 print:h-6" />
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-2 print:space-y-1">
                <div className="font-serif text-2xl sm:text-3xl print:text-lg uppercase tracking-wide text-[#0C0C0C] font-bold leading-tight">
                  {record.appName || "—"}
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  {record.stage && (
                    <span className={`px-3 py-1 print:px-1.5 print:py-0.5 font-mono text-sm print:text-[9px] font-bold uppercase border-2 border-[#0C0C0C] ${STAGE_BADGE[record.stage] ?? "bg-[#E8DFC7]"}`}>
                      {record.stage}
                    </span>
                  )}
                  {record.subStage && (
                    <span className="px-2 py-0.5 print:px-1 print:py-0 font-mono text-[10px] print:text-[8px] font-bold uppercase border border-[#0C0C0C]/40 bg-[#F0E8D0]">
                      {formatWorkflowLabel(record.subStage)}
                    </span>
                  )}
                  <span className="font-serif text-2xl print:text-base font-bold text-[#6C1C1F]">{record.type || "—"}</span>
                </div>
                <div className="font-mono text-xs print:text-[9px] text-[#6d6658] flex flex-wrap gap-x-4 gap-y-0.5">
                  <span>TM: <strong className="text-[#0C0C0C]">{record.tmCprNo || "—"}</strong></span>
                  <span>CLASS: <strong className="text-[#0C0C0C]">{record.appClass || "—"}</strong></span>
                  <span>CASE: <strong className="text-[#0A6B52]">{record.caseNumber || "—"}</strong></span>
                </div>
              </div>
            </div>

            {/* Application Details */}
            <div className="print-avoid-break border-3 border-[#0C0C0C] bg-[#E8DFC7] text-[#0C0C0C] shadow-[5px_5px_0_#0C0C0C] p-4 print:p-2 print:shadow-none">
              <div className="font-mono text-[10px] print:text-[8px] font-bold uppercase tracking-widest text-[#6C1C1F] mb-3 print:mb-1">
                Application Details
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 print:gap-1.5">
                <Field label="Client Code" value={record.clientCode} />
                <Field label="Case Number" value={record.caseNumber} />
                <Field label="Filing Date" value={record.date ? formatDateShort(record.date) : undefined} />
                <Field label="Case Type" value={record.caseType} />
                <Field label="TM / CPR Number" value={record.tmCprNo} />
                <Field label="Class" value={record.appClass} />
                <Field label="Client Name" value={record.clientName} wide />
              </div>
            </div>

            {/* 1. Case Workflow & Status Control */}
            <CaseWorkflowSection
              record={record}
              canEdit={canEdit}
            />

            {/* 2. Stage Payments */}
            <StagePaymentsSection
              record={record}
              canEdit={canEdit}
            />

            {/* 3. Stage Documents */}
            <StageDocumentsSection
              trademarkId={record.id}
              currentStage={record.stage}
            />

            {/* 4. Document Status / TM Forms */}
            <div className="print-avoid-break border-3 border-[#0C0C0C] bg-[#F0E8D0] p-4 print:p-2 shadow-[5px_5px_0_#0C0C0C] print:shadow-none">
              <div className="font-mono text-[10px] print:text-[8px] font-bold uppercase tracking-widest text-[#6C1C1F] mb-3 print:mb-1.5">
                Document Status (TM Forms)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 print:gap-1.5">
                <TmFormBadge label="TM5" active={matches.TM5} />
                <TmFormBadge label="TM6" active={matches.TM6} />
                <TmFormBadge label="TM11" active={matches.TM11} />
                <TmFormBadge label="TM16" active={matches.TM16} />
                <TmFormBadge label="TM56" active={matches.TM56} />
              </div>
            </div>

            {/* 5. Office Notes & Manual Proceeding Remarks */}
            <div className="print-avoid-break border-2 border-[#0C0C0C] bg-white p-4 print:p-2 shadow-[3px_3px_0_#0C0C0C] print:shadow-none">
              <div className="text-[8px] font-bold uppercase tracking-widest text-[#6d6658] mb-2 print:mb-1 flex items-center gap-1.5">
                <FileText className="w-3 h-3" /> Office Notes & Manual Proceeding Remarks
              </div>
              <div className="font-mono text-sm print:text-xs text-[#0C0C0C] whitespace-pre-wrap min-h-[36px] print:min-h-[24px]">
                {record.notes || "—"}
              </div>
            </div>

            {/* 6. Workflow History */}
            <WorkflowHistorySection
              workflowHistory={workflowHistory}
            />

            {/* Workflow Reminders (informational only) */}
            <div className="print-avoid-break border-2 border-[#0C0C0C] bg-white p-4 print:p-2 shadow-[3px_3px_0_#0C0C0C] print:shadow-none">
              <div className="text-[8px] font-bold uppercase tracking-widest text-[#6C1C1F] mb-3 print:mb-1.5 flex items-center gap-1.5">
                <Bell className="w-3 h-3" /> Workflow Reminders (Informational Only)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 print:gap-1.5">
                {reminders.map((r) => (
                  <div
                    key={r.number}
                    className={`border-2 p-3 print:p-1.5 ${
                      r.active
                        ? "border-[#6C1C1F] bg-[#6C1C1F]/5"
                        : "border-[#0C0C0C]/20 bg-[#F0E8D0]"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1 print:mb-0.5">
                      <span className={`inline-block px-1.5 py-0.5 font-mono text-[9px] print:text-[8px] font-bold uppercase border ${
                        r.active ? "border-[#6C1C1F] text-[#6C1C1F] bg-[#6C1C1F]/10" : "border-[#0C0C0C]/30 text-[#6d6658]"
                      }`}>
                        REMINDER {r.number}
                      </span>
                      <span className="font-mono text-[10px] print:text-[9px] font-bold uppercase text-[#0C0C0C]">{r.title}</span>
                    </div>
                    <div className="font-mono text-[10px] print:text-[8px] text-[#6d6658] leading-snug">
                      {r.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Journal */}
            {record.journal && (
              <div className="print-avoid-break border-2 border-[#0A6B52] bg-[#0D9970]/5 p-4 print:p-2">
                <div className="text-[8px] font-bold uppercase tracking-widest text-[#0A6B52] mb-2 print:mb-1">Journal Record</div>
                <div className="font-mono text-xs print:text-[9px] space-y-1 print:space-y-0.5 text-[#0C0C0C]">
                  <div>Journal No: <strong>{String(record.journal["Journal No"] || "")}</strong></div>
                  <div>Date: <strong>{record.journal["Journal Date"] ? formatDateShort(String(record.journal["Journal Date"])) : ""}</strong></div>
                  {record.journal["Application No"] && (
                    <div>Application No: <strong>{String(record.journal["Application No"])}</strong></div>
                  )}
                  {record.journal.Title && (
                    <div>Title: <strong>{String(record.journal.Title)}</strong></div>
                  )}
                  {record.journal.Class && (
                    <div>Class: <strong>{String(record.journal.Class)}</strong></div>
                  )}
                  {record.journal["Applicant Name and Address"] && (
                    <div className="pt-1 print:pt-0.5">
                      <div className="text-[8px] uppercase tracking-widest text-[#6d6658]">Applicant</div>
                      <div className="whitespace-pre-wrap leading-tight">{String(record.journal["Applicant Name and Address"])}</div>
                    </div>
                  )}
                  {record.journal["Agent Name and Address"] && (
                    <div className="pt-1 print:pt-0.5">
                      <div className="text-[8px] uppercase tracking-widest text-[#6d6658]">Agent</div>
                      <div className="whitespace-pre-wrap leading-tight">{String(record.journal["Agent Name and Address"])}</div>
                    </div>
                  )}
                  {record.journal["Date of Filing"] && (
                    <div>Date of Filing: <strong>{formatDateShort(String(record.journal["Date of Filing"]))}</strong></div>
                  )}
                </div>
              </div>
            )}

            {/* CEO Signature / Stamp Block — professional block, no fake signature */}
            <div className="print-avoid-break border-2 border-[#0C0C0C] bg-white p-4 print:p-2 shadow-[3px_3px_0_#0C0C0C] print:shadow-none">
              <div className="text-[8px] font-bold uppercase tracking-widest text-[#6C1C1F] mb-3 print:mb-1.5">
                CEO BRANDEX — SIGNATURE / STAMP
              </div>
              <div className="flex flex-col sm:flex-row gap-6 print:gap-4 items-end">
                <div className="flex-1 w-full">
                  <div className="border-2 border-dashed border-[#0C0C0C]/30 p-4 print:p-2 text-center min-h-[56px] print:min-h-[42px] flex items-center justify-center">
                    <span className="font-mono text-[9px] print:text-[8px] text-[#9d9488] uppercase tracking-wider">
                      Official Signature / Stamp
                    </span>
                  </div>
                </div>
                <div className="font-mono text-[10px] print:text-[8px] text-[#6d6658] uppercase tracking-wider shrink-0">
                  Date: _______________
                </div>
              </div>
            </div>

            {/* Last modified — screen only */}
            <div className="font-mono text-[10px] text-[#6d6658] text-right print:hidden">
              Last modified: {record.updatedAt ? formatDate(record.updatedAt) : "—"}
            </div>

            {/* Print footer — brand tokens, no dark-blue */}
            <div className="hidden print:block border-t border-[#6C1C1F]/30 pt-1.5 mt-2 text-[#6d6658] font-mono text-[8px]">
              Brandex Law Associates · Confidential · Official Registry Dossier
            </div>
          </div>
        </div>
      </div>

      {editOpen && (
        <RecordModal
          recordId={record.id}
          onClose={() => setEditOpen(false)}
          onSaved={handleEditSaved}
        />
      )}
    </AppShell>
  );
}
