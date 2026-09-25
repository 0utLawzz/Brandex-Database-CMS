import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Workflow, ArrowRight, CheckCircle2, Clock, User, MapPin,
  AlertCircle, Loader2, X, Edit3, ShieldAlert, Check, CreditCard,
} from "lucide-react";
import {
  STATUS_WORKFLOW,
  STAGES,
  CITIES,
  formatWorkflowLabel,
  isStage2PaymentRequired,
  isValidStageTransition,
  availableWorkflowSubStages,
  updateTrademarkStatus,
  updateTrademarkAgent,
  updateStagePayment,
  listAgentProfiles,
  type TrademarkRecord,
  type TrademarkWorkflowEvent,
} from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

const STAGE_ORDER = ["STAGE 1", "STAGE 2", "STAGE 3", "STAGE 4"] as const;

const STAGE_BADGE: Record<string, string> = {
  "STAGE 1": "bg-[#0D9970] text-white",
  "STAGE 2": "bg-[#B0740E] text-white",
  "STAGE 3": "bg-[#6C1C1F] text-white",
  "STAGE 4": "bg-[#0A6B52] text-white",
  "STOPPED": "bg-[#CC0000] text-white",
};

// ── 1. CASE WORKFLOW & STATUS CONTROL ────────────────────────────────────────

interface CaseWorkflowSectionProps {
  record: TrademarkRecord;
  canEdit: boolean;
}

export function CaseWorkflowSection({ record, canEdit }: CaseWorkflowSectionProps) {
  const queryClient = useQueryClient();

  // Modals state
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [agentModalOpen, setAgentModalOpen] = useState(false);

  // Status form state
  const [targetStage, setTargetStage] = useState<string>(record.stage || "STAGE 1");
  const [targetSubStage, setTargetSubStage] = useState<string>(record.subStage || "");
  const [statusError, setStatusError] = useState<string | null>(null);
  const [stoppedReason, setStoppedReason] = useState<string>("");

  // Agent form state
  const [selectedAgent, setSelectedAgent] = useState<string>(record.agent || "");
  const [selectedCity, setSelectedCity] = useState<string>(record.city || "Islamabad");
  const [agentError, setAgentError] = useState<string | null>(null);

  // Agents list for assignment
  const { data: agents = [] } = useQuery({
    queryKey: ["agents-master"],
    queryFn: listAgentProfiles,
    staleTime: 5 * 60 * 1000,
    enabled: agentModalOpen,
  });

  // Status Transition mutation
  const statusMutation = useMutation({
    mutationFn: async () => {
      await updateTrademarkStatus(record.id, targetStage, targetSubStage || null, targetStage === "STOPPED" ? stoppedReason : undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trademark", record.id] });
      queryClient.invalidateQueries({ queryKey: ["trademark-workflow-history", record.id] });
      setStatusModalOpen(false);
      setStatusError(null);
    },
    onError: (err: Error) => {
      setStatusError(err.message || "Failed to update workflow status.");
    },
  });

  // Agent Assignment mutation
  const agentMutation = useMutation({
    mutationFn: async () => {
      await updateTrademarkAgent(record.id, selectedAgent.trim(), selectedCity.trim() || undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trademark", record.id] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      setAgentModalOpen(false);
      setAgentError(null);
    },
    onError: (err: Error) => {
      setAgentError(err.message || "Failed to assign agent.");
    },
  });

  const openStatusModal = () => {
    setTargetStage(record.stage || "STAGE 1");
    setTargetSubStage(record.subStage || "");
    setStoppedReason("");
    setStatusError(null);
    setStatusModalOpen(true);
  };

  const openAgentModal = () => {
    setSelectedAgent(record.agent || "");
    setSelectedCity(record.city || "Islamabad");
    setAgentError(null);
    setAgentModalOpen(true);
  };

  const currentStageIndex = STAGE_ORDER.indexOf(record.stage as any);
  const isStopped = record.stage === "STOPPED";

  const getPaymentGateWarning = (target: string): string | null => {
    if (target === "STAGE 2" && !record.stage1Paid) {
      return "Stage 2 cannot be started until Stage 1 payment is cleared.";
    }
    if (target === "STAGE 3" && !record.stage2Paid) {
      return "Stage 3 cannot be started until Stage 2 payment is cleared.";
    }
    if (target === "STAGE 4" && !record.stage3Paid) {
      return "Stage 4 cannot be started until Stage 3 payment is cleared.";
    }
    return null;
  };

  const getStoppedWarning = (): string | null => {
    if (targetStage === "STOPPED" && !stoppedReason.trim()) {
      return "STOPPED requires a reason. Please explain why this case is being stopped.";
    }
    return null;
  };

  const paymentGateWarning = getPaymentGateWarning(targetStage);
  const stoppedWarning = getStoppedWarning();
  const targetStageRequiresPayment = Boolean(paymentGateWarning);
  const validTargetStages = STAGES.filter((s) => isValidStageTransition(record.stage, s) && (s === "STOPPED" || s === record.stage || availableWorkflowSubStages(record.stage, record.subStage, s).length > 0));
  const availableSubStages = availableWorkflowSubStages(record.stage, record.subStage, targetStage);

  return (
    <div className="print-avoid-break border-2 border-[#0C0C0C] bg-white shadow-[4px_4px_0_#0C0C0C] print:shadow-none">
      {/* Section Header */}
      <div className="px-4 py-3 border-b-2 border-[#0C0C0C] bg-[#E8DFC7] flex items-center justify-between print:px-2 print:py-1">
        <div className="flex items-center gap-2 font-mono font-bold text-xs uppercase tracking-wider text-[#0C0C0C] print:text-[10px]">
          <Workflow className="w-4 h-4 text-[#6C1C1F] print:w-3.5 print:h-3.5" />
          <span>Case Workflow & Status Control</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`px-2.5 py-0.5 font-mono text-xs print:text-[8px] font-bold uppercase border-2 border-[#0C0C0C] ${STAGE_BADGE[record.stage] ?? "bg-white text-[#0C0C0C]"}`}
          >
            {record.stage || "STAGE 1"}
          </span>
          {record.subStage && (
            <span className="px-2 py-0.5 font-mono text-[10px] print:text-[8px] font-bold uppercase border border-[#0C0C0C]/40 bg-white text-[#0C0C0C]">
              {formatWorkflowLabel(record.subStage)}
            </span>
          )}
        </div>
      </div>

      <div className="p-4 print:p-2 space-y-3 print:space-y-1.5">
        {/* Lifecycle Progression Track */}
        <div className="border-2 border-[#0C0C0C] bg-[#FFF9F0] p-3 print:p-1.5 shadow-[2px_2px_0_#0C0C0C] print:shadow-none">
          <div className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#6d6658] mb-2 print:mb-1">
            Workflow Progression
          </div>
          {isStopped ? (
            <div className="p-2.5 print:p-1.5 border-2 border-[#CC0000] bg-[#FFEEEE] text-[#CC0000] font-mono text-xs print:text-[10px] font-bold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>CASE IS STOPPED — Workflow lifecycle halted</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 print:gap-1.5">
              {STAGE_ORDER.map((stageName, idx) => {
                const isPast = currentStageIndex > idx;
                const isCurrent = currentStageIndex === idx;

                return (
                  <div
                    key={stageName}
                    className={`p-2 print:p-1 border-2 transition-all ${
                      isCurrent
                        ? "border-[#0C0C0C] bg-[#F0E8D0] shadow-[2px_2px_0_#0C0C0C] print:shadow-none"
                        : isPast
                          ? "border-[#0A6B52] bg-[#D8F2E8]/40"
                          : "border-[#0C0C0C]/20 bg-white opacity-65"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1 print:mb-0">
                      <span className="font-mono text-xs print:text-[10px] font-bold text-[#0C0C0C]">
                        {stageName}
                      </span>
                      {isPast ? (
                        <Check className="w-3.5 h-3.5 text-[#0A6B52]" />
                      ) : isCurrent ? (
                        <span className="w-2 h-2 rounded-full bg-[#6C1C1F] animate-pulse" />
                      ) : null}
                    </div>
                    <div className="font-mono text-[9px] print:text-[8px] text-[#6d6658]">
                      {isCurrent ? "● ACTIVE" : isPast ? "✓ COMPLETED" : "UPCOMING"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Control Grid: Status & Agent Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 print:gap-2">
          {/* Status Card */}
          <div className="border-2 border-[#0C0C0C] bg-[#FFF9F0] p-3.5 print:p-2 shadow-[2px_2px_0_#0C0C0C] print:shadow-none flex flex-col justify-between gap-2.5 print:gap-1">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#6d6658]">
                  Current Status & Sub-Status
                </span>
                {canEdit && !isStopped && (
                  <button
                    type="button"
                    onClick={openStatusModal}
                    className="print:hidden text-[10px] font-mono font-bold uppercase px-2 py-0.5 border border-[#0C0C0C] bg-white hover:bg-[#0C0C0C] hover:text-white transition-colors flex items-center gap-1 shadow-[1px_1px_0_#0C0C0C]"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Update Status</span>
                  </button>
                )}
              </div>
              <div className="space-y-1 print:space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs print:text-[10px] text-[#6d6658]">Stage:</span>
                  <span className="font-mono text-sm print:text-xs font-bold text-[#0C0C0C]">
                    {record.stage || "—"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs print:text-[10px] text-[#6d6658]">Sub-status:</span>
                  <span className="font-mono text-sm print:text-xs font-bold text-[#0C0C0C]">
                    {formatWorkflowLabel(record.subStage) || "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Agent Details Card */}
          <div className="border-2 border-[#0C0C0C] bg-[#FFF9F0] p-3.5 print:p-2 shadow-[2px_2px_0_#0C0C0C] print:shadow-none flex flex-col justify-between gap-2.5 print:gap-1">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#6d6658] flex items-center gap-1">
                  <User className="w-3 h-3" /> Agent Details
                </span>
                {canEdit && record.stage === "STAGE 2" && record.subStage === "Assigned" && (
                  <button
                    type="button"
                    onClick={openAgentModal}
                    className="print:hidden text-[10px] font-mono font-bold uppercase px-2 py-0.5 border border-[#0C0C0C] bg-white hover:bg-[#0C0C0C] hover:text-white transition-colors flex items-center gap-1 shadow-[1px_1px_0_#0C0C0C]"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>{record.agent ? "Change Agent" : "Assign Agent"}</span>
                  </button>
                )}
              </div>
              <div className="space-y-1 print:space-y-0.5">
                <div className="flex items-center gap-2">
                <span className="font-mono text-xs print:text-[10px] text-[#6d6658]">Agent:</span>
                <span className={`font-mono text-sm print:text-xs font-bold text-[#0C0C0C] ${!record.agent ? "italic text-[#9d9488]" : ""}`}>
                  {record.agent || "Unassigned"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs print:text-[10px] text-[#6d6658] flex items-center gap-0.5">
                  <MapPin className="w-3 h-3" /> City:
                </span>
                <span className="font-mono text-sm print:text-xs font-bold text-[#0C0C0C]">
                  {record.city || "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

      {/* Status Transition Modal */}
      {statusModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="border-3 border-[#0C0C0C] bg-[#F0E8D0] shadow-[8px_8px_0_#0C0C0C] max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-[#0C0C0C] pb-3">
              <div className="flex items-center gap-2">
                <Workflow className="w-4 h-4 text-[#6C1C1F]" />
                <div className="font-serif text-lg font-bold uppercase text-[#0C0C0C]">
                  Update Workflow Status
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStatusModalOpen(false)}
                disabled={statusMutation.isPending}
                className="p-1 border border-[#0C0C0C] bg-white hover:bg-[#0C0C0C] hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {statusError && (
              <div className="p-2.5 border-2 border-[#CC0000] bg-[#FFEEEE] text-[#CC0000] font-mono text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{statusError}</span>
              </div>
            )}

            {paymentGateWarning && (
              <div className="p-2.5 border-2 border-[#B0740E] bg-[#FFF0D0] text-[#6C1C1F] font-mono text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{paymentGateWarning}</span>
              </div>
            )}

            {stoppedWarning && (
              <div className="p-2.5 border-2 border-[#CC0000] bg-[#FFEEEE] text-[#CC0000] font-mono text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{stoppedWarning}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setStatusError(null);
                if (paymentGateWarning) {
                  setStatusError(paymentGateWarning);
                  return;
                }
                if (stoppedWarning) {
                  setStatusError(stoppedWarning);
                  return;
                }
                statusMutation.mutate();
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="block font-mono text-[10px] font-bold uppercase text-[#6C1C1F] mb-1">
                  Target Stage *
                </label>
                <select
                  value={targetStage}
                  onChange={(e) => {
                    setTargetStage(e.target.value);
                    const validSubs = availableWorkflowSubStages(record.stage, record.subStage, e.target.value);
                    if (!validSubs.includes(targetSubStage)) {
                      setTargetSubStage(validSubs[0] || "");
                    }
                  }}
                  disabled={statusMutation.isPending}
                  className="w-full h-9 px-2.5 border-2 border-[#0C0C0C] bg-white font-mono text-xs font-bold text-[#0C0C0C]"
                >
                  {validTargetStages.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-mono text-[10px] font-bold uppercase text-[#6C1C1F] mb-1">
                  Target Sub-stage
                </label>
                <select
                  value={targetSubStage}
                  onChange={(e) => setTargetSubStage(e.target.value)}
                  disabled={statusMutation.isPending || targetStage === "STOPPED"}
                  className="w-full h-9 px-2.5 border-2 border-[#0C0C0C] bg-white font-mono text-xs text-[#0C0C0C]"
                >
                  {targetStage === "STOPPED" && <option value="">No sub-stage</option>}
                  {availableSubStages.map((s) => (
                    <option key={s} value={s}>
                      {formatWorkflowLabel(s)}
                    </option>
                  ))}
                </select>
              </div>

              {targetStage === "STOPPED" && (
                <div>
                  <label className="block font-mono text-[10px] font-bold uppercase text-[#6C1C1F] mb-1">
                    STOPPED Reason *
                  </label>
                  <input
                    type="text"
                    value={stoppedReason}
                    onChange={(e) => setStoppedReason(e.target.value)}
                    disabled={statusMutation.isPending}
                    placeholder="Enter reason for stopping this case..."
                    className="w-full h-9 px-2.5 border-2 border-[#0C0C0C] bg-white font-mono text-xs text-[#0C0C0C]"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#0C0C0C]/20">
                <button
                  type="button"
                  onClick={() => setStatusModalOpen(false)}
                  disabled={statusMutation.isPending}
                  className="px-3 py-1.5 border-2 border-[#0C0C0C] bg-white font-mono text-xs font-bold uppercase hover:bg-[#0C0C0C] hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={targetStageRequiresPayment || Boolean(stoppedWarning) || statusMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-[#0A6B52] text-white font-mono text-xs font-bold uppercase border-2 border-[#0C0C0C] shadow-[2px_2px_0_#0C0C0C] hover:brightness-110 disabled:opacity-50 transition-all"
                >
                  {statusMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving…</span>
                    </>
                  ) : (
                    <span>Save Status</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Agent Assignment Modal */}
      {agentModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="border-3 border-[#0C0C0C] bg-[#F0E8D0] shadow-[8px_8px_0_#0C0C0C] max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-[#0C0C0C] pb-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-[#6C1C1F]" />
                <div className="font-serif text-lg font-bold uppercase text-[#0C0C0C]">
                  {record.agent ? "Change Agent Assignment" : "Assign Case Agent"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAgentModalOpen(false)}
                disabled={agentMutation.isPending}
                className="p-1 border border-[#0C0C0C] bg-white hover:bg-[#0C0C0C] hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {agentError && (
              <div className="p-2.5 border-2 border-[#CC0000] bg-[#FFEEEE] text-[#CC0000] font-mono text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{agentError}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setAgentError(null);
                if (!selectedAgent.trim()) {
                  setAgentError("Please select or enter an agent name.");
                  return;
                }
                agentMutation.mutate();
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="block font-mono text-[10px] font-bold uppercase text-[#6C1C1F] mb-1">
                  Assign Agent *
                </label>
                <select
                  value={selectedAgent}
                  onChange={(e) => {
                    const agentName = e.target.value;
                    setSelectedAgent(agentName);
                    const match = agents.find((a) => a.name === agentName);
                    if (match?.city) {
                      setSelectedCity(match.city);
                    }
                  }}
                  disabled={agentMutation.isPending}
                  className="w-full h-9 px-2.5 border-2 border-[#0C0C0C] bg-white font-mono text-xs font-bold text-[#0C0C0C]"
                >
                  <option value="">-- Select Agent from Master List --</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.name}>
                      {a.name} ({a.city || "No City"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-mono text-[10px] font-bold uppercase text-[#6C1C1F] mb-1">
                  Agent City
                </label>
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  disabled={agentMutation.isPending}
                  className="w-full h-9 px-2.5 border-2 border-[#0C0C0C] bg-white font-mono text-xs text-[#0C0C0C]"
                >
                  {CITIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#0C0C0C]/20">
                <button
                  type="button"
                  onClick={() => setAgentModalOpen(false)}
                  disabled={agentMutation.isPending}
                  className="px-3 py-1.5 border-2 border-[#0C0C0C] bg-white font-mono text-xs font-bold uppercase hover:bg-[#0C0C0C] hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedAgent.trim() || agentMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-[#0A6B52] text-white font-mono text-xs font-bold uppercase border-2 border-[#0C0C0C] shadow-[2px_2px_0_#0C0C0C] hover:brightness-110 disabled:opacity-50 transition-all"
                >
                  {agentMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving…</span>
                    </>
                  ) : (
                    <span>Assign Agent</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 2. STAGE PAYMENTS (MANUAL — NOT VERIFIED) ────────────────────────────────

interface StagePaymentsSectionProps {
  record: TrademarkRecord;
  canEdit: boolean;
}

export function StagePaymentsSection({ record, canEdit }: StagePaymentsSectionProps) {
  const queryClient = useQueryClient();

  const paymentMutation = useMutation({
    mutationFn: (args: { stage: 1 | 2 | 3 | 4; paid: boolean; date: string }) =>
      updateStagePayment(record.id, args.stage, args.paid, args.date || null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trademark", record.id] });
      queryClient.invalidateQueries({ queryKey: ["trademark-workflow-history", record.id] });
    },
  });

  return (
    <div className="print-avoid-break border-2 border-[#0C0C0C] bg-white shadow-[4px_4px_0_#0C0C0C] print:shadow-none">
      <div className="px-4 py-3 border-b-2 border-[#0C0C0C] bg-[#E8DFC7] flex items-center justify-between print:px-2 print:py-1">
        <div className="flex items-center gap-2 font-mono font-bold text-xs uppercase tracking-wider text-[#0C0C0C] print:text-[10px]">
          <CreditCard className="w-4 h-4 text-[#6C1C1F] print:w-3.5 print:h-3.5" />
          <span>Stage Payments</span>
        </div>
        <span className="font-mono text-[9px] print:text-[8px] font-bold uppercase text-[#B0740E] border border-[#B0740E] px-2 py-0.5 bg-white shadow-[1px_1px_0_#B0740E] print:shadow-none">
          MANUAL CMS FLAGS — NOT LEDGER VERIFIED
        </span>
      </div>

      <div className="p-4 print:p-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:grid-cols-4 print:gap-1.5">
          {(
            [
              { label: "STAGE 1", stageNum: 1 as const, paid: record.stage1Paid ?? false, date: record.stage1PaidDate ?? "" },
              { label: "STAGE 2", stageNum: 2 as const, paid: record.stage2Paid ?? false, date: record.stage2PaidDate ?? "" },
              { label: "STAGE 3", stageNum: 3 as const, paid: record.stage3Paid ?? false, date: record.stage3PaidDate ?? "" },
              { label: "STAGE 4", stageNum: 4 as const, paid: record.stage4Paid ?? false, date: record.stage4PaidDate ?? "" },
            ] as const
          ).map(({ label, stageNum, paid, date }) => (
            <div
              key={label}
              className={`border-2 p-3 print:p-1.5 shadow-[2px_2px_0_#0C0C0C] print:shadow-none ${
                paid ? "border-[#0A6B52] bg-[#0D9970]/10" : "border-[#0C0C0C] bg-[#FFF9F0]"
              }`}
            >
              <div className="font-mono text-[10px] print:text-[8px] font-bold uppercase mb-2 print:mb-0.5">{label}</div>
              <label className={`flex items-center gap-2 mb-2 print:mb-0.5 ${canEdit ? "cursor-pointer" : "cursor-not-allowed opacity-75"}`}>
                <input
                  type="checkbox"
                  checked={paid}
                  disabled={!canEdit || paymentMutation.isPending}
                  onChange={() =>
                    paymentMutation.mutate({
                      stage: stageNum,
                      paid: !paid,
                      date: paid ? "" : (date || new Date().toISOString().slice(0, 10)),
                    })
                  }
                  className="w-4 h-4 print:w-3 print:h-3 accent-[#0A6B52]"
                />
                <span className={`font-mono text-xs print:text-[9px] font-bold ${paid ? "text-[#0A6B52]" : "text-[#6d6658]"}`}>
                  {paid ? "PAID" : "UNPAID"}
                </span>
              </label>
              <input
                type="date"
                value={date}
                disabled={!canEdit || !paid || paymentMutation.isPending}
                onChange={(e) =>
                  paymentMutation.mutate({ stage: stageNum, paid: true, date: e.target.value })
                }
                className="w-full h-8 print:h-5 px-2 print:px-1 border border-[#0C0C0C]/40 font-mono text-xs print:text-[8px] bg-white disabled:opacity-40"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 3. WORKFLOW HISTORY ──────────────────────────────────────────────────────

interface WorkflowHistorySectionProps {
  workflowHistory: TrademarkWorkflowEvent[];
}

export function WorkflowHistorySection({ workflowHistory }: WorkflowHistorySectionProps) {
  return (
    <div className="print-avoid-break border-2 border-[#0C0C0C] bg-white shadow-[4px_4px_0_#0C0C0C] print:shadow-none">
      <div className="px-4 py-3 border-b-2 border-[#0C0C0C] bg-[#E8DFC7] flex items-center justify-between print:px-2 print:py-1">
        <div className="flex items-center gap-2 font-mono font-bold text-xs uppercase tracking-wider text-[#0C0C0C] print:text-[10px]">
          <Clock className="w-4 h-4 text-[#6C1C1F] print:w-3.5 print:h-3.5" />
          <span>Workflow History</span>
        </div>
        <span className="font-mono text-[10px] print:text-[8px] font-bold text-[#6d6658] uppercase tracking-wider bg-white px-2 py-0.5 border border-[#0C0C0C]/20">
          {workflowHistory.length} {workflowHistory.length === 1 ? "EVENT" : "EVENTS"}
        </span>
      </div>

      <div className="p-4 print:p-2 space-y-2.5 print:space-y-1">
        {workflowHistory.length === 0 ? (
          <div className="p-3 print:p-1.5 border border-dashed border-[#0C0C0C]/30 bg-[#FFF9F0] font-mono text-xs print:text-[9px] text-[#6d6658] italic text-center">
            No workflow history recorded.
          </div>
        ) : (
          <div className="space-y-2.5 print:space-y-1 max-h-60 print:max-h-none overflow-y-auto print:overflow-visible pr-1">
            {workflowHistory.map((event) => {
              const toLabel = formatWorkflowLabel(event.toSubStatus) || formatWorkflowLabel(event.toStatus);
              const fromLabel = formatWorkflowLabel(event.fromSubStatus) || formatWorkflowLabel(event.fromStatus);

              return (
                <div key={event.id} className="border-l-2 border-[#0A6B52] pl-3 print:pl-2 py-1 print:py-0.5 bg-[#FFF9F0]/60">
                  <div className="font-mono text-sm print:text-xs font-bold text-[#0C0C0C]">
                    {fromLabel ? `${fromLabel} → ${toLabel}` : toLabel}
                  </div>
                  <div className="font-mono text-[10px] print:text-[8px] text-[#6d6658] flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    <span>{formatDateShort(event.eventAt)}</span>
                    <span>Changed by: <strong className="text-[#0C0C0C]">{event.changedByName}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
