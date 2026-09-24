import { getRecord, getWorkflowHistory, formatWorkflowLabel, getStaffRole } from "@/lib/api";
import type { TrademarkRecord, TmMatches } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { formatDateShort, formatDate, formatDateLong, getRelativeAge, getFormDate } from "@/lib/utils";
import { useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  ArrowLeft, Edit2, Printer, CheckCircle2, MinusCircle,
  Image as ImageIcon, FileText,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RecordModal } from "@/components/RecordModal";
import { StageDocumentsSection } from "@/components/StageDocumentsSection";
import {
  CaseWorkflowSection,
  StagePaymentsSection,
  WorkflowHistorySection,
} from "@/components/CaseWorkflowSection";
import { useBranding } from "@/hooks/useBranding";

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
    <div className={`${wide ? "col-span-2" : ""} border-2 border-[#0C0C0C] bg-[#FFF9F0] p-3 print:p-1.5 shadow-[2px_2px_0_#0C0C0C] print:shadow-none`}>
      <div className="font-mono text-[9px] print:text-[8px] font-bold uppercase tracking-widest text-[#6C1C1F] mb-1 print:mb-0.5">{label}</div>
      <div className="font-sans text-base sm:text-lg print:text-xs font-bold text-[#0C0C0C] break-words">{value}</div>
    </div>
  );
}

function TmFormBadge({ label, active, tmMatches }: { label: string; active: boolean; tmMatches?: Record<string, any> }) {
  const formDate = getFormDate(tmMatches, label);
  const formattedDate = formDate ? formatDateLong(formDate) : null;
  const relativeAge = formDate ? getRelativeAge(formDate) : null;

  return (
    <div className="flex flex-col gap-0.5">
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-1.5 print:px-1.5 print:py-0.5 font-mono text-[10px] print:text-[8px] font-bold border-2 ${
          active
            ? "border-[#0A6B52] text-[#0A6B52] bg-[#D8F2E8] shadow-[2px_2px_0_#0A6B52] print:shadow-none"
            : "border-[#0C0C0C]/35 text-[#6d6658] bg-[#FFF9F0]"
        }`}
      >
        {active ? <CheckCircle2 className="w-4 h-4 print:w-3 print:h-3" /> : <MinusCircle className="w-4 h-4 print:w-3 print:h-3" />}
        {label}
      </span>
      {active && formattedDate && (
        <div className="font-mono text-[9px] print:text-[8px] text-[#6d6658] pl-1">
          {formattedDate} · {relativeAge}
        </div>
      )}
      {active && !formattedDate && (
        <div className="font-mono text-[9px] print:text-[8px] text-[#6d6658] pl-1">
          Date not available
        </div>
      )}
    </div>
  );
}

export function RecordView() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const { branding } = useBranding();

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
          className="flex-1 overflow-auto p-4 sm:p-6 print:p-0 print:overflow-visible print:bg-white relative"
        >
          {/* Full-Page Print Watermark (10% opacity, centered behind content, print-only) */}
          <div className="print-watermark-container" aria-hidden="true">
            <img
              src={branding.watermarkUrl || branding.logoUrl || "/brandex-wordmark.svg"}
              alt=""
              className="print-watermark-image"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/brandex-wordmark.svg";
              }}
            />
          </div>

          <div className="max-w-4xl mx-auto space-y-4 print:max-w-none print:space-y-2">

            {/* Print-only header — Brandex letterhead banner */}
            <div className="hidden print:block border-b-2 border-[#6C1C1F] pb-2 mb-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={branding.logoUrl || "/brandex-wordmark.svg"}
                    alt="Brandex Law Associates"
                    className="h-9 max-w-[160px] object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/brandex-wordmark.svg";
                    }}
                  />
                  <div>
                    <div className="font-serif text-lg uppercase tracking-widest text-[#0C0C0C] font-bold leading-none">
                      Brandex Law Associates — Trademark Record
                    </div>
                    <div className="font-mono text-[9px] text-[#6d6658] mt-0.5">
                      {record.caseNumber} · {record.clientCode} · {record.type} · Printed {new Date().toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="text-right font-mono text-[8px] text-[#6d6658] font-bold uppercase tracking-wider">
                  CONFIDENTIAL IP DOSSIER
                </div>
              </div>
            </div>

            {/* ===== RECORD HEADER — Two-Column Layout ===== */}
            <div className="print-avoid-break border-2 border-[#0C0C0C] bg-white shadow-[4px_4px_0_#0C0C0C] print:shadow-none print:border-[#0C0C0C]">
              {/* Top: Left (image+name) | Right (client info) */}
              <div className="flex flex-col sm:flex-row gap-0 divide-y sm:divide-y-0 sm:divide-x-2 divide-[#0C0C0C]/15">
                {/* LEFT — Logo + Application Name + TM + Class */}
                <div className="flex gap-3 p-4 print:p-2 sm:w-[55%] items-start">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 print:w-16 print:h-16 shrink-0 border-2 border-[#0C0C0C] bg-[#F0E8D0] flex items-center justify-center overflow-hidden">
                    {record.image ? (
                      <img src={record.image} alt={record.appName} className="w-full h-full object-contain" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-[#9d9488] print:w-5 print:h-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5 print:space-y-0.5">
                    <div className="font-serif text-xl sm:text-2xl print:text-base uppercase tracking-wide text-[#0C0C0C] font-bold leading-tight break-words">
                      {record.appName || "—"}
                    </div>
                    <div className="font-mono text-xs print:text-[9px] text-[#6d6658] space-y-0.5">
                      {record.tmCprNo && (
                        <div>
                          <span className="text-[#9d9488]">TM / CPR&nbsp;</span>
                          <strong className="text-[#0C0C0C]">{record.tmCprNo}</strong>
                        </div>
                      )}
                      {record.appClass && (
                        <div>
                          <span className="text-[#9d9488]">CLASS&nbsp;</span>
                          <strong className="text-[#0C0C0C]">{record.appClass}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* RIGHT — Client Info */}
                <div className="flex-1 p-4 print:p-2 space-y-2 print:space-y-1">
                  <div className="font-mono text-[9px] print:text-[8px] font-bold uppercase tracking-widest text-[#6C1C1F]">
                    Client Information
                  </div>
                  <div className="space-y-1.5 print:space-y-1">
                    {/* Type as prominent H1-level identifier */}
                    {record.type && (
                      <div>
                        <div className="font-serif text-2xl sm:text-3xl print:text-base font-bold uppercase tracking-wide text-[#6C1C1F] leading-none">
                          {record.type}
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 print:gap-x-2 print:gap-y-0.5">
                      {record.clientCode && (
                        <div>
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#9d9488]">Client Code</div>
                          <div className="font-mono font-bold text-sm print:text-[9px] text-[#0C0C0C]">{record.clientCode}</div>
                        </div>
                      )}
                      {record.caseNumber && (
                        <div>
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#9d9488]">Case No</div>
                          <div className="font-mono font-bold text-sm print:text-[9px] text-[#0A6B52]">{record.caseNumber}</div>
                        </div>
                      )}
                      {record.caseType && (
                        <div className="col-span-2">
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#9d9488]">Case Type</div>
                          <div className="font-mono font-bold text-xs print:text-[8px] text-[#0C0C0C]">{record.caseType}</div>
                        </div>
                      )}
                      {record.clientName && (
                        <div className="col-span-2">
                          <div className="font-mono text-[8px] uppercase tracking-widest text-[#9d9488]">Client Name</div>
                          <div className="font-sans font-bold text-sm print:text-[10px] text-[#0C0C0C] break-words">{record.clientName}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Divider + Stage / Sub-stage / Previous Action */}
              <div className="border-t-2 border-[#0C0C0C]/15 px-4 py-3 print:px-2 print:py-1.5 flex flex-col sm:flex-row sm:items-start gap-3 print:gap-1.5 bg-[#F8F4EC]">
                {/* Current Stage + Sub Stage */}
                <div className="flex-1 flex items-start gap-2 flex-wrap">
                  <div>
                    <div className="font-mono text-[8px] uppercase tracking-widest text-[#9d9488] mb-0.5">Current Stage</div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {record.stage && (
                        <span className={`px-2.5 py-0.5 font-mono text-xs print:text-[8px] font-bold uppercase border-2 border-[#0C0C0C] ${STAGE_BADGE[record.stage] ?? "bg-[#E8DFC7]"}`}>
                          {record.stage}
                        </span>
                      )}
                      {record.subStage && (
                        <span className="px-2 py-0.5 font-mono text-[10px] print:text-[8px] font-bold uppercase border border-[#0C0C0C]/40 bg-white text-[#0C0C0C]">
                          {formatWorkflowLabel(record.subStage)}
                        </span>
                      )}
                      {record.date && (
                        <span className="font-mono text-[10px] print:text-[8px] text-[#9d9488]">
                          Filed: <strong className="text-[#0C0C0C]">{formatDateShort(record.date)}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Previous Action from workflow history */}
                {workflowHistory.length > 1 && (() => {
                  const prev = workflowHistory[1]; // index 0 = latest, 1 = previous
                  return (
                    <div className="shrink-0 text-right print:text-left">
                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#9d9488] mb-0.5">Previous Action</div>
                      <div className="font-mono text-[10px] print:text-[8px] text-[#6d6658]">
                        {prev.fromStatus && (
                          <span>{prev.fromStatus}{prev.fromSubStatus ? ` / ${formatWorkflowLabel(prev.fromSubStatus)}` : ""} → </span>
                        )}
                        <span className="font-bold text-[#0C0C0C]">
                          {prev.toStatus}{prev.toSubStatus ? ` / ${formatWorkflowLabel(prev.toSubStatus)}` : ""}
                        </span>
                        {prev.eventAt && (
                          <span className="ml-1.5 text-[#9d9488]">{formatDateShort(prev.eventAt)}</span>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Application Details */}
            <div className="print-avoid-break border-2 border-[#0C0C0C] bg-white shadow-[4px_4px_0_#0C0C0C] print:shadow-none">
              <div className="px-4 py-3 border-b-2 border-[#0C0C0C] bg-[#E8DFC7] flex items-center justify-between print:px-2 print:py-1">
                <div className="flex items-center gap-2 font-mono font-bold text-xs uppercase tracking-wider text-[#0C0C0C] print:text-[10px]">
                  <FileText className="w-4 h-4 text-[#6C1C1F] print:w-3.5 print:h-3.5" />
                  <span>Application Details</span>
                </div>
              </div>
              <div className="p-4 print:p-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 print:gap-1.5">
                {/* IMPORTANT / PRIMARY fields */}
                <Field label="Filing Date" value={record.date ? formatDateShort(record.date) : undefined} />
                <Field label="TM / CPR Number" value={record.tmCprNo} />
                <Field label="Class" value={record.appClass} />
                <Field label="City / Agent City" value={record.city} />
                <Field label="Assigned Agent" value={record.agent} />
                <Field label="Applicant Name" value={record.clientName} wide />
                {record.caseType && <Field label="Case Type" value={record.caseType} />}
                {/* Secondary fields - compact */}
                <Field label="Client Code" value={record.clientCode} />
                <Field label="Case Number" value={record.caseNumber} />
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

            {/* 3. Workflow History — immediately after Stage Payments */}
            <WorkflowHistorySection
              workflowHistory={workflowHistory}
            />

            {/* 4. Case Documents */}
            <StageDocumentsSection
              trademarkId={record.id}
              currentStage={record.stage}
            />

            {/* 5. Document Status / TM Forms */}
            <div className="print-avoid-break border-2 border-[#0C0C0C] bg-white shadow-[4px_4px_0_#0C0C0C] print:shadow-none">
              <div className="px-4 py-3 border-b-2 border-[#0C0C0C] bg-[#E8DFC7] flex items-center justify-between print:px-2 print:py-1">
                <div className="flex items-center gap-2 font-mono font-bold text-xs uppercase tracking-wider text-[#0C0C0C] print:text-[10px]">
                  <CheckCircle2 className="w-4 h-4 text-[#6C1C1F] print:w-3.5 print:h-3.5" />
                  <span>Document Status (TM Forms)</span>
                </div>
                <span className="font-mono text-[10px] print:text-[8px] font-bold text-[#6d6658] uppercase tracking-wider bg-white px-2 py-0.5 border border-[#0C0C0C]/20 hidden sm:inline">
                  Statutory Registry Matches
                </span>
              </div>
              <div className="p-4 print:p-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 print:gap-1.5">
                <TmFormBadge label="TM5" active={matches.TM5} tmMatches={matches} />
                <TmFormBadge label="TM6" active={matches.TM6} tmMatches={matches} />
                <TmFormBadge label="TM11" active={matches.TM11} tmMatches={matches} />
                <TmFormBadge label="TM16" active={matches.TM16} tmMatches={matches} />
                <TmFormBadge label="TM56" active={matches.TM56} tmMatches={matches} />
              </div>
            </div>

            {/* 6. Office Notes & Manual Proceeding Remarks */}
            <div className="print-avoid-break border-2 border-[#0C0C0C] bg-white shadow-[4px_4px_0_#0C0C0C] print:shadow-none">
              <div className="px-4 py-3 border-b-2 border-[#0C0C0C] bg-[#E8DFC7] flex items-center justify-between print:px-2 print:py-1">
                <div className="flex items-center gap-2 font-mono font-bold text-xs uppercase tracking-wider text-[#0C0C0C] print:text-[10px]">
                  <FileText className="w-4 h-4 text-[#6C1C1F] print:w-3.5 print:h-3.5" />
                  <span>Office Notes & Manual Proceeding Remarks</span>
                </div>
              </div>
              <div className="p-4 print:p-2 font-mono text-sm print:text-xs text-[#0C0C0C] whitespace-pre-wrap min-h-[48px] print:min-h-[24px]">
                {record.notes || "—"}
              </div>
            </div>

            {/* Journal */}
            {record.journal && (
              <div className="print-avoid-break border-2 border-[#0C0C0C] bg-white shadow-[4px_4px_0_#0C0C0C] print:shadow-none">
                <div className="px-4 py-3 border-b-2 border-[#0C0C0C] bg-[#E8DFC7] flex items-center justify-between print:px-2 print:py-1">
                  <div className="flex items-center gap-2 font-mono font-bold text-xs uppercase tracking-wider text-[#0C0C0C] print:text-[10px]">
                    <FileText className="w-4 h-4 text-[#0A6B52] print:w-3.5 print:h-3.5" />
                    <span>Journal Record</span>
                  </div>
                </div>
                <div className="p-4 print:p-2 font-mono text-xs print:text-[9px] text-[#0C0C0C]">
                  {/* Primary hierarchy - Journal No and Publication Date */}
                  <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-4 mb-3 print:mb-2">
                    <div className="flex-1">
                      <div className="text-[8px] uppercase tracking-widest text-[#6d6658] mb-0.5">JOURNAL NO</div>
                      <div className="font-serif text-lg sm:text-xl print:text-sm font-bold text-[#0A6B52] leading-none">
                        {String(record.journal["Journal No"] || "—")}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="text-[8px] uppercase tracking-widest text-[#6d6658] mb-0.5">PUBLICATION DATE</div>
                      <div className="font-serif text-lg sm:text-xl print:text-sm font-bold text-[#6C1C1F] leading-none">
                        {record.journal["Journal Date"] ? formatDateShort(String(record.journal["Journal Date"])) : "—"}
                      </div>
                    </div>
                  </div>

                  {/* Secondary information - TM/CPR, Class, Filing Date */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3 print:mb-2 border-t border-[#0C0C0C]/20 pt-3 print:pt-2">
                    {record.journal["Application No"] && (
                      <div>
                        <div className="text-[8px] uppercase tracking-widest text-[#6d6658]">TM / CPR NO</div>
                        <div className="font-bold text-sm print:text-[10px]">{String(record.journal["Application No"])}</div>
                      </div>
                    )}
                    {record.journal.Class && (
                      <div>
                        <div className="text-[8px] uppercase tracking-widest text-[#6d6658]">CLASS</div>
                        <div className="font-bold text-sm print:text-[10px]">{String(record.journal.Class)}</div>
                      </div>
                    )}
                    {record.journal["Date of Filing"] && (
                      <div>
                        <div className="text-[8px] uppercase tracking-widest text-[#6d6658]">FILING DATE</div>
                        <div className="font-bold text-sm print:text-[10px]">{formatDateShort(String(record.journal["Date of Filing"]))}</div>
                      </div>
                    )}
                  </div>

                  {/* Compact information - Applicant and Agent */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 print:mb-2 border-t border-[#0C0C0C]/20 pt-3 print:pt-2">
                    {record.journal["Applicant Name and Address"] && (
                      <div>
                        <div className="text-[8px] uppercase tracking-widest text-[#6d6658] mb-0.5">APPLICANT</div>
                        <div className="text-[10px] print:text-[8px] text-[#0C0C0C] leading-tight">
                          {String(record.journal["Applicant Name and Address"])}
                        </div>
                      </div>
                    )}
                    {record.journal["Agent Name and Address"] && (
                      <div>
                        <div className="text-[8px] uppercase tracking-widest text-[#6d6658] mb-0.5">AGENT</div>
                        <div className="text-[10px] print:text-[8px] text-[#0C0C0C] leading-tight">
                          {String(record.journal["Agent Name and Address"])}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Additional details */}
                  {record.journal.Title && (
                    <div className="border-t border-[#0C0C0C]/20 pt-3 print:pt-2">
                      <div className="text-[8px] uppercase tracking-widest text-[#6d6658] mb-0.5">TITLE</div>
                      <div className="text-[10px] print:text-[8px] text-[#0C0C0C] leading-tight">
                        {String(record.journal.Title)}
                      </div>
                    </div>
                  )}

                  {/* End of record - Modified and Created */}
                  <div className="border-t border-[#0C0C0C]/20 pt-3 print:pt-2 mt-3 print:mt-2 text-[9px] print:text-[8px] text-[#6d6658]">
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                      <div>Last Modified: <span className="text-[#0C0C0C]">{record.updatedAt ? formatDate(record.updatedAt) : "—"}</span></div>
                      <div>Date Created: <span className="text-[#0C0C0C]">{record.date ? formatDate(record.date) : "—"}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CEO Signature / Stamp Block — professional block, no fake signature */}
            <div className="print-avoid-break border-2 border-[#0C0C0C] bg-white shadow-[4px_4px_0_#0C0C0C] print:shadow-none">
              <div className="px-4 py-2 border-b-2 border-[#0C0C0C] bg-[#E8DFC7] flex items-center justify-between print:px-2 print:py-1">
                <div className="font-mono text-[9px] print:text-[8px] font-bold uppercase tracking-widest text-[#6C1C1F]">
                  CEO BRANDEX — SIGNATURE / STAMP
                </div>
              </div>
              <div className="p-4 print:p-2 flex flex-col sm:flex-row gap-6 print:gap-4 items-end">
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
