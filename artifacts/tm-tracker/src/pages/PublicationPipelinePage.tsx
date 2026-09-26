import {
  listPublicationPipeline,
  markDemandNoteReceived,
  clearDemandNoteReceived,
  runJournalMatch,
  runFormMatch,
  getStaffRole,
  type PublicationRecord,
} from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  BookOpen,
  Clock,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Calendar,
  X,
  FileText,
  ExternalLink,
  Upload,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { RegistryImportModal } from "@/components/RegistryImportModal";

// Pipeline status badge styles (computed)
const STATUS_BADGE: Record<string, string> = {
  pending: "bg-[#D8F2E8] text-[#0A6B52] border-[#0A6B52]",
  overdue: "bg-[#FFF0D0] text-[#6C1C1F] border-[#6C1C1F]",
  done: "bg-[#E8DFC7] text-[#6d6658] border-[#0C0C0C]",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "PENDING",
  overdue: "OVERDUE",
  done: "DONE",
};

export function PublicationPipelinePage() {
  const [selectedRecord, setSelectedRecord] = useState<PublicationRecord | null>(null);
  const [showMatchDialog, setShowMatchDialog] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [matchLoading, setMatchLoading] = useState(false);
  // Controlled date state for marking demand note received
  const [demandNoteDate, setDemandNoteDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: staffRole } = useQuery({
    queryKey: ["staff-role"],
    queryFn: getStaffRole,
    staleTime: 5 * 60_000,
  });
  const isViewer = staffRole !== "admin";

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["publication-pipeline"],
    queryFn: listPublicationPipeline,
    staleTime: 30_000,
  });

  const markReceivedMutation = useMutation({
    mutationFn: ({ id, date }: { id: string; date: string }) =>
      markDemandNoteReceived(id, date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["publication-pipeline"] });
      toast({ title: "Demand Note marked as received" });
      setSelectedRecord(null);
    },
    onError: (error) => {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    },
  });

  const clearReceivedMutation = useMutation({
    mutationFn: clearDemandNoteReceived,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["publication-pipeline"] });
      toast({ title: "Demand Note flag cleared" });
      setSelectedRecord(null);
    },
    onError: (error) => {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    },
  });

  const handleRunJournalMatch = async () => {
    setMatchLoading(true);
    try {
      const result = await runJournalMatch();
      toast({
        title: "Journal match completed",
        description: `Matched ${result.matched} trademarks`,
      });
      queryClient.invalidateQueries({ queryKey: ["publication-pipeline"] });
    } catch (error) {
      toast({
        title: "Match failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setMatchLoading(false);
      setShowMatchDialog(false);
    }
  };

  const handleRunFormMatch = async () => {
    setMatchLoading(true);
    try {
      const result = await runFormMatch();
      toast({
        title: "Form match completed",
        description: `Total: ${result.total} (TM5: ${result.tm5}, TM6: ${result.tm6}, TM11: ${result.tm11}, TM16: ${result.tm16}, TM56: ${result.tm56})`,
      });
      queryClient.invalidateQueries({ queryKey: ["publication-pipeline"] });
    } catch (error) {
      toast({
        title: "Match failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setMatchLoading(false);
      setShowMatchDialog(false);
    }
  };

  const getDaysColor = (days: number): string => {
    if (days < 0) return "text-[#CC0000]";
    if (days <= 7) return "text-[#6C1C1F]";
    if (days <= 30) return "text-[#B0740E]";
    return "text-[#0A6B52]";
  };

  const pendingCount = records.filter((r) => r.status === "pending").length;
  const overdueCount = records.filter((r) => r.status === "overdue").length;
  const doneCount = records.filter((r) => r.status === "done").length;

  return (
    <AppShell>
      <div className="flex flex-col h-full bg-white">
        {/* Header */}
        <div className="shrink-0 px-6 py-4 bg-[#E8DFC7] border-b-2 border-[#0C0C0C]">
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="w-5 h-5 text-[#0A6B52]" />
            <h1 className="font-serif text-2xl uppercase tracking-widest text-[#0C0C0C] leading-none">
              PUBLICATION PIPELINE
            </h1>
            <span className="ml-auto font-mono text-[10px] text-[#6d6658] font-bold uppercase tracking-widest">
              {isLoading ? "LOADING\u2026" : `${records.length} MATCHED`}
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {!isViewer ? (
              <>
                <button
                  onClick={() => setShowMatchDialog(true)}
                  className="inline-flex items-center gap-2 border-2 border-[#0A6B52] bg-[#D8F2E8] px-4 py-2 font-mono text-xs font-bold uppercase text-[#0A6B52] hover:bg-[#0A6B52] hover:text-white transition-colors"
                >
                  <RefreshCw className="h-4 w-4" /> RUN MATCH ENGINE
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="inline-flex items-center gap-2 border-2 border-[#6C1C1F] bg-[#FFF0D0] px-4 py-2 font-mono text-xs font-bold uppercase text-[#6C1C1F] hover:bg-[#6C1C1F] hover:text-white transition-colors"
                >
                  <Upload className="h-4 w-4" /> JOURNAL IMPORT
                </button>
              </>
            ) : (
              <>
                <button
                  disabled
                  className="inline-flex items-center gap-2 border-2 border-[#0A6B52]/40 bg-[#D8F2E8]/40 px-4 py-2 font-mono text-xs font-bold uppercase text-[#0A6B52]/40 cursor-not-allowed"
                  title="Admin role required"
                >
                  <RefreshCw className="h-4 w-4" /> RUN MATCH ENGINE
                </button>
                <button
                  disabled
                  className="inline-flex items-center gap-2 border-2 border-[#6C1C1F]/40 bg-[#FFF0D0]/40 px-4 py-2 font-mono text-xs font-bold uppercase text-[#6C1C1F]/40 cursor-not-allowed"
                  title="Admin role required"
                >
                  <Upload className="h-4 w-4" /> JOURNAL IMPORT
                </button>
              </>
            )}

            <div className="flex items-center gap-4 ml-auto flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-[#0A6B52] bg-[#D8F2E8]" />
                <span className="font-mono text-[10px] text-[#6d6658]">PENDING ({pendingCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-[#6C1C1F] bg-[#FFF0D0]" />
                <span className="font-mono text-[10px] text-[#6d6658]">OVERDUE ({overdueCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-[#0C0C0C] bg-[#E8DFC7]" />
                <span className="font-mono text-[10px] text-[#6d6658]">DONE ({doneCount})</span>
              </div>
            </div>
          </div>
        </div>

        {/* Records Grid - Compact Card Layout */}
        <div className="flex-1 overflow-auto bg-white p-4 print:hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full font-mono text-[#6d6658] animate-pulse">
              LOADING PUBLICATION PIPELINE\u2026
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
              <div className="font-mono font-bold text-[#6d6658] uppercase tracking-widest">
                No journal-matched records found.
              </div>
              <div className="font-mono text-xs text-[#9d9488]">
                Run the Match Engine to populate publication data from the journal registry.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="border-2 border-[#0C0C0C] bg-white shadow-[2px_2px_0_#0C0C0C] hover:shadow-[3px_3px_0_#0C0C0C] transition-shadow cursor-pointer"
                  onClick={() => {
                    setSelectedRecord(record);
                    setDemandNoteDate(new Date().toISOString().slice(0, 10));
                  }}
                >
                  {/* Primary hierarchy - Journal No and Publication Date */}
                  <div className="px-4 py-3 border-b-2 border-[#0C0C0C] bg-[#E8DFC7]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="text-[8px] uppercase tracking-widest text-[#6d6658] mb-0.5">JOURNAL NO</div>
                        <div className="font-serif text-lg font-bold text-[#0A6B52] leading-none">
                          {record.journalNumber || "—"}
                        </div>
                      </div>
                      <div className="flex-1 text-right">
                        <div className="text-[8px] uppercase tracking-widest text-[#6d6658] mb-0.5">PUB DATE</div>
                        <div className="font-serif text-lg font-bold text-[#6C1C1F] leading-none">
                          {record.publicationDate || "—"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Type, Client Code, Case No */}
                  <div className="px-4 py-2 border-b border-[#0C0C0C]/20 flex items-center gap-3 font-mono text-xs">
                    <span className="font-bold text-[#6C1C1F]">{record.type}</span>
                    <span className="text-[#6d6658]">·</span>
                    <span className="font-bold text-[#6C1C1F]">{record.clientCode}</span>
                    <span className="text-[#6d6658]">·</span>
                    <span className="font-bold text-[#0A6B52]">{record.caseNumber}</span>
                  </div>

                  {/* Application Name */}
                  <div className="px-4 py-2 border-b border-[#0C0C0C]/20">
                    <div className="font-bold text-sm text-[#0C0C0C] truncate">{record.appName}</div>
                  </div>

                  {/* Secondary information - TM Number and Class */}
                  <div className="px-4 py-2 border-b border-[#0C0C0C]/20 grid grid-cols-2 gap-2 font-mono text-[10px]">
                    <div>
                      <div className="text-[8px] uppercase tracking-widest text-[#6d6658]">TM NO</div>
                      <div className="font-bold text-[#0C0C0C]">{record.tmCprNo || "—"}</div>
                    </div>
                    <div>
                      <div className="text-[8px] uppercase tracking-widest text-[#6d6658]">CLASS</div>
                      <div className="font-bold text-[#0C0C0C]">{record.appClass || "—"}</div>
                    </div>
                  </div>

                  {/* Compact information - Applicant and Agent */}
                  <div className="px-4 py-2 border-b border-[#0C0C0C]/20 grid grid-cols-2 gap-2 font-mono text-[9px]">
                    <div>
                      <div className="text-[8px] uppercase tracking-widest text-[#6d6658]">APPLICANT</div>
                      <div className="text-[#0C0C0C] truncate">{record.clientName || "—"}</div>
                    </div>
                    <div>
                      <div className="text-[8px] uppercase tracking-widest text-[#6d6658]">AGENT</div>
                      <div className="text-[#0C0C0C] truncate">{record.agent || <span className="italic text-[#9d9488]">unassigned</span>}</div>
                    </div>
                  </div>

                  {/* Stage and Sub-stage */}
                  <div className="px-4 py-2 border-b border-[#0C0C0C]/20 flex items-center gap-2">
                    <span className="inline-block px-2 py-0.5 text-[9px] font-bold uppercase border border-[#0C0C0C]/20 bg-[#E8DFC7]">
                      {record.stage}
                    </span>
                    {record.subStage && (
                      <span className="text-[10px] font-bold text-[#6C1C1F] truncate">
                        {record.subStage}
                      </span>
                    )}
                  </div>

                  {/* Deadline and Days Remaining */}
                  <div className="px-4 py-2 border-b border-[#0C0C0C]/20 flex items-center justify-between font-mono text-[10px]">
                    <div>
                      <div className="text-[8px] uppercase tracking-widest text-[#6d6658]">DEADLINE</div>
                      <div className="font-bold text-[#0C0C0C]">{record.oppositionDeadline || "—"}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[8px] uppercase tracking-widest text-[#6d6658]">DAYS REM.</div>
                      <div className={`font-bold ${getDaysColor(record.daysRemaining)}`}>
                        {record.daysRemaining}d
                      </div>
                    </div>
                  </div>

                  {/* Demand Note Status */}
                  <div className="px-4 py-2 border-b border-[#0C0C0C]/20 flex items-center gap-2 font-mono text-[10px]">
                    {record.demandNoteReceived ? (
                      <span className="inline-flex items-center gap-1 text-[#0A6B52]">
                        <CheckCircle className="h-3 w-3" /> {record.demandNoteDate}
                      </span>
                    ) : (
                      <span className="text-[#9d9488]">Demand note not received</span>
                    )}
                  </div>

                  {/* Status and Actions */}
                  <div className="px-4 py-2 flex items-center justify-between">
                    <span
                      className={`inline-block px-2 py-0.5 text-[9px] font-bold uppercase border ${STATUS_BADGE[record.status]}`}
                    >
                      {STATUS_LABEL[record.status] ?? record.status}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRecord(record);
                          setDemandNoteDate(new Date().toISOString().slice(0, 10));
                        }}
                        className="inline-flex items-center gap-1 border-2 border-[#0C0C0C] bg-white px-2 py-1 font-mono text-[9px] font-bold uppercase hover:bg-[#0C0C0C] hover:text-white"
                      >
                        <Calendar className="h-3 w-3" /> DETAILS
                      </button>
                      <Link
                        href={`/record/${record.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 border-2 border-[#0C0C0C] bg-white px-2 py-1 font-mono text-[9px] font-bold uppercase hover:bg-[#0C0C0C] hover:text-white text-[#6C1C1F]"
                        title="Open full record"
                      >
                        <ExternalLink className="h-3 w-3" /> OPEN
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Print-friendly Table View */}
        <div className="flex-1 overflow-auto bg-white p-4 hidden print:block">
          {isLoading ? (
            <div className="font-mono text-[#6d6658]">Loading publication pipeline...</div>
          ) : records.length === 0 ? (
            <div className="font-mono text-[#6d6658]">No journal-matched records found.</div>
          ) : (
            <table className="w-full text-left font-mono text-[10px] border-collapse">
              <thead>
                <tr className="border-b-2 border-[#333]">
                  <th className="px-2 py-1 border-r border-[#333] font-bold">JOURNAL NO</th>
                  <th className="px-2 py-1 border-r border-[#333] font-bold">PUB DATE</th>
                  <th className="px-2 py-1 border-r border-[#333] font-bold">TYPE</th>
                  <th className="px-2 py-1 border-r border-[#333] font-bold">CLIENT CODE</th>
                  <th className="px-2 py-1 border-r border-[#333] font-bold">CASE NO</th>
                  <th className="px-2 py-1 border-r border-[#333] font-bold">APPLICATION</th>
                  <th className="px-2 py-1 border-r border-[#333] font-bold">TM NO</th>
                  <th className="px-2 py-1 border-r border-[#333] font-bold">CLASS</th>
                  <th className="px-2 py-1 border-r border-[#333] font-bold">STAGE</th>
                  <th className="px-2 py-1 border-r border-[#333] font-bold">DEADLINE</th>
                  <th className="px-2 py-1 border-r border-[#333] font-bold">DAYS REM.</th>
                  <th className="px-2 py-1 font-bold">DEMAND NOTE</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} className="border-b border-[#333]/30">
                    <td className="px-2 py-1 border-r border-[#333]/30">{record.journalNumber || "—"}</td>
                    <td className="px-2 py-1 border-r border-[#333]/30">{record.publicationDate || "—"}</td>
                    <td className="px-2 py-1 border-r border-[#333]/30">{record.type}</td>
                    <td className="px-2 py-1 border-r border-[#333]/30">{record.clientCode}</td>
                    <td className="px-2 py-1 border-r border-[#333]/30">{record.caseNumber}</td>
                    <td className="px-2 py-1 border-r border-[#333]/30 max-w-[120px] truncate">{record.appName}</td>
                    <td className="px-2 py-1 border-r border-[#333]/30">{record.tmCprNo || "—"}</td>
                    <td className="px-2 py-1 border-r border-[#333]/30">{record.appClass || "—"}</td>
                    <td className="px-2 py-1 border-r border-[#333]/30">{record.stage}</td>
                    <td className="px-2 py-1 border-r border-[#333]/30">{record.oppositionDeadline || "—"}</td>
                    <td className="px-2 py-1 border-r border-[#333]/30">{record.daysRemaining}d</td>
                    <td className="px-2 py-1">{record.demandNoteReceived ? `✓ ${record.demandNoteDate}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Print-friendly Table View */}
        <div className="flex-1 overflow-auto bg-white p-4 hidden print:block">
          {isLoading ? (
            <div className="font-mono text-[#6d6658]">Loading publication pipeline...</div>
          ) : records.length === 0 ? (
            <div className="font-mono text-[#6d6658]">No journal-matched records found.</div>
          ) : (
            <table className="w-full text-left font-mono text-[10px] border-collapse">
              <thead>
                <tr className="border-b-2 border-[#333]">
                  <th className="px-2 py-1 border-r border-[#333] font-bold">JOURNAL NO</th>
                  <th className="px-2 py-1 border-r border-[#333] font-bold">PUB DATE</th>
                  <th className="px-2 py-1 border-r border-[#333] font-bold">TYPE</th>
                  <th className="px-2 py-1 border-r border-[#333] font-bold">CLIENT CODE</th>
                  <th className="px-2 py-1 border-r border-[#333] font-bold">CASE NO</th>
                  <th className="px-2 py-1 border-r border-[#333] font-bold">APPLICATION</th>
                  <th className="px-2 py-1 border-r border-[#333] font-bold">TM NO</th>
                  <th className="px-2 py-1 border-r border-[#333] font-bold">CLASS</th>
                  <th className="px-2 py-1 border-r border-[#333] font-bold">STAGE</th>
                  <th className="px-2 py-1 border-r border-[#333] font-bold">DEADLINE</th>
                  <th className="px-2 py-1 border-r border-[#333] font-bold">DAYS REM.</th>
                  <th className="px-2 py-1 font-bold">DEMAND NOTE</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} className="border-b border-[#333]/30">
                    <td className="px-2 py-1 border-r border-[#333]/30">{record.journalNumber || "—"}</td>
                    <td className="px-2 py-1 border-r border-[#333]/30">{record.publicationDate || "—"}</td>
                    <td className="px-2 py-1 border-r border-[#333]/30">{record.type}</td>
                    <td className="px-2 py-1 border-r border-[#333]/30">{record.clientCode}</td>
                    <td className="px-2 py-1 border-r border-[#333]/30">{record.caseNumber}</td>
                    <td className="px-2 py-1 border-r border-[#333]/30 max-w-[120px] truncate">{record.appName}</td>
                    <td className="px-2 py-1 border-r border-[#333]/30">{record.tmCprNo || "—"}</td>
                    <td className="px-2 py-1 border-r border-[#333]/30">{record.appClass || "—"}</td>
                    <td className="px-2 py-1 border-r border-[#333]/30">{record.stage}</td>
                    <td className="px-2 py-1 border-r border-[#333]/30">{record.oppositionDeadline || "—"}</td>
                    <td className="px-2 py-1 border-r border-[#333]/30">{record.daysRemaining}d</td>
                    <td className="px-2 py-1">{record.demandNoteReceived ? `✓ ${record.demandNoteDate}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Record Detail Modal */}
      {selectedRecord && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#0C0C0C]/55 p-4"
          onClick={() => setSelectedRecord(null)}
        >
          <section
            className="w-full max-w-2xl border-3 border-[#0C0C0C] bg-[#F0E8D0] p-5 shadow-[8px_8px_0_#0C0C0C] max-h-[90vh] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-start gap-3 border-b-2 border-[#0C0C0C] pb-3 mb-4">
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#6C1C1F]">
                  PUBLICATION DETAILS
                </div>
                <h2 className="mt-1 font-serif text-2xl uppercase leading-none text-[#0C0C0C]">
                  {selectedRecord.appName}
                </h2>
                <div className="mt-1.5 font-mono text-[10px] font-bold uppercase text-[#6d6658]">
                  CASE: {selectedRecord.caseNumber} \u00B7 CLIENT: {selectedRecord.clientCode} \u00B7 TYPE: {selectedRecord.type}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="border-2 border-[#0C0C0C] bg-white p-1 hover:bg-[#0C0C0C] hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Case info grid */}
            <div className="grid grid-cols-2 gap-2.5 border-2 border-[#0C0C0C] bg-white p-3 font-mono text-xs uppercase mb-3">
              <div>
                <span className="block text-[9px] font-bold text-[#6d6658]">TM / CPR NO</span>
                <strong>{selectedRecord.tmCprNo || "\u2014"}</strong>
              </div>
              <div>
                <span className="block text-[9px] font-bold text-[#6d6658]">CLASS</span>
                <strong>{selectedRecord.appClass || "\u2014"}</strong>
              </div>
              <div>
                <span className="block text-[9px] font-bold text-[#6d6658]">CLIENT</span>
                <strong>{selectedRecord.clientName || "\u2014"}</strong>
              </div>
              <div>
                <span className="block text-[9px] font-bold text-[#6d6658]">AGENT</span>
                <strong>{selectedRecord.agent || <span className="italic text-[#9d9488] normal-case">Unassigned</span>}</strong>
              </div>
              <div>
                <span className="block text-[9px] font-bold text-[#6d6658]">STAGE</span>
                <strong>{selectedRecord.stage || "\u2014"}</strong>
              </div>
              <div>
                <span className="block text-[9px] font-bold text-[#6d6658]">SUB-STAGE</span>
                <strong>{selectedRecord.subStage || "\u2014"}</strong>
              </div>
            </div>

            {/* Journal / Publication info */}
            <div className="border-2 border-[#0A6B52] bg-[#D8F2E8]/30 p-3 font-mono text-xs uppercase mb-3">
              <div className="text-[9px] font-bold text-[#0A6B52] mb-2 flex items-center gap-1.5">
                <FileText className="h-3 w-3" /> JOURNAL / PUBLICATION INFO
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="block text-[9px] font-bold text-[#6d6658]">JOURNAL NO</span>
                  <strong>{selectedRecord.journalNumber || "\u2014"}</strong>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-[#6d6658]">PUBLICATION DATE</span>
                  <strong>{selectedRecord.publicationDate || "\u2014"}</strong>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-[#6d6658]">OPPOSITION DEADLINE</span>
                  <strong>{selectedRecord.oppositionDeadline || "\u2014"}</strong>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-[#6d6658]">DAYS REMAINING</span>
                  <strong className={getDaysColor(selectedRecord.daysRemaining)}>
                    {selectedRecord.daysRemaining} days
                  </strong>
                </div>
              </div>
            </div>

            {/* Demand Note section */}
            <div className="border-2 border-[#0C0C0C] bg-white p-3 mb-3">
              <h3 className="font-mono text-xs font-bold uppercase text-[#0C0C0C] mb-3">
                Demand Note Status
              </h3>
              {selectedRecord.demandNoteReceived ? (
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-[#0A6B52]">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-mono text-sm font-bold">
                      RECEIVED ON {selectedRecord.demandNoteDate}
                    </span>
                  </div>
                  <button
                    onClick={() => clearReceivedMutation.mutate(selectedRecord.id)}
                    disabled={clearReceivedMutation.isPending}
                    className="border-2 border-[#CC0000] bg-white px-3 py-1.5 font-mono text-[10px] font-bold uppercase text-[#CC0000] hover:bg-[#CC0000] hover:text-white transition-colors disabled:opacity-50"
                  >
                    CLEAR
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[#6d6658]">
                    <Clock className="h-4 w-4" />
                    <span className="font-mono text-xs">Not yet received</span>
                  </div>
                  {!isViewer ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="font-mono text-[10px] font-bold uppercase text-[#6d6658]">
                        Received Date:
                      </label>
                      <input
                        type="date"
                        value={demandNoteDate}
                        onChange={(e) => setDemandNoteDate(e.target.value)}
                        className="h-8 px-2 border-2 border-[#0C0C0C] font-mono text-xs focus:outline-2 focus:outline-[#6C1C1F]"
                      />
                      <button
                        onClick={() =>
                          markReceivedMutation.mutate({
                            id: selectedRecord.id,
                            date: demandNoteDate,
                          })
                        }
                        disabled={markReceivedMutation.isPending || !demandNoteDate}
                        className="border-2 border-[#0A6B52] bg-[#D8F2E8] px-3 py-1.5 font-mono text-[10px] font-bold uppercase text-[#0A6B52] hover:bg-[#0A6B52] hover:text-white transition-colors disabled:opacity-50"
                      >
                        MARK RECEIVED
                      </button>
                    </div>
                  ) : (
                    <div className="font-mono text-[10px] text-[#9d9488] uppercase italic">
                      Read-only mode — Editor or Admin required to update
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Opposition overdue alert */}
            {selectedRecord.status === "overdue" && (
              <div className="border-l-4 border-[#CC0000] bg-[#FFF0D0] p-3">
                <div className="flex items-center gap-2 text-[#6C1C1F]">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span className="font-mono text-[10px] font-bold uppercase">
                    Opposition deadline has passed. Action required.
                  </span>
                </div>
              </div>
            )}

            {/* Direct Link to Full Record */}
            <div className="mt-4 pt-3 border-t-2 border-[#0C0C0C] flex justify-end">
              <Link
                href={`/record/${selectedRecord.id}`}
                className="inline-flex items-center gap-1.5 border-2 border-[#0C0C0C] bg-[#6C1C1F] text-white px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-[#501416] transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" /> OPEN FULL RECORD
              </Link>
            </div>
          </section>
        </div>
      )}

      {/* Match Engine Dialog */}
      {showMatchDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0C0C0C]/55 p-4"
          onClick={() => setShowMatchDialog(false)}
        >
          <section
            className="w-full max-w-md border-3 border-[#0C0C0C] bg-[#F0E8D0] p-5 shadow-[8px_8px_0_#0C0C0C]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3 border-b-2 border-[#0C0C0C] pb-3 mb-4">
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#6C1C1F]">
                  MATCH ENGINE
                </div>
                <h2 className="mt-1 font-serif text-2xl uppercase leading-none text-[#0C0C0C]">
                  Run Data Matching
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowMatchDialog(false)}
                className="border-2 border-[#0C0C0C] bg-white p-1 hover:bg-[#0C0C0C] hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleRunJournalMatch}
                disabled={matchLoading}
                className="border-2 border-[#0A6B52] bg-[#D8F2E8] px-4 py-3 font-mono text-xs font-bold uppercase text-[#0A6B52] hover:bg-[#0A6B52] hover:text-white transition-colors disabled:opacity-50"
              >
                {matchLoading ? "RUNNING\u2026" : "RUN JOURNAL MATCH"}
              </button>
              <p className="font-mono text-[10px] text-[#6d6658]">
                Matches journal_registry rows to trademarks by TM number. Updates journal data,
                publication date, and opposition deadline.
              </p>

              <button
                onClick={handleRunFormMatch}
                disabled={matchLoading}
                className="border-2 border-[#0A6B52] bg-[#D8F2E8] px-4 py-3 font-mono text-xs font-bold uppercase text-[#0A6B52] hover:bg-[#0A6B52] hover:text-white transition-colors disabled:opacity-50"
              >
                {matchLoading ? "RUNNING\u2026" : "RUN FORM MATCH"}
              </button>
              <p className="font-mono text-[10px] text-[#6d6658]">
                Matches form_registry rows to trademarks by TM number. Sets TM5 / TM6 / TM11 /
                TM16 / TM56 boolean flags.
              </p>
            </div>
          </section>
        </div>
      )}

      {/* Journal Import Modal */}
      {showImportModal && (
        <RegistryImportModal
          onClose={() => setShowImportModal(false)}
          onCommitted={() => {
            queryClient.invalidateQueries({ queryKey: ["publication-pipeline"] });
          }}
          defaultKind="journal"
          showOnly="journal"
        />
      )}
    </AppShell>
  );
}
