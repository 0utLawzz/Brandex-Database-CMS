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
import {
  BookOpen,
  Clock,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Calendar,
  X,
  FileText,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  const isViewer = staffRole === "viewer";

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
    if (days <= 7) return "text-[#C94A00]";
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
              <button
                onClick={() => setShowMatchDialog(true)}
                className="inline-flex items-center gap-2 border-2 border-[#0A6B52] bg-[#D8F2E8] px-4 py-2 font-mono text-xs font-bold uppercase text-[#0A6B52] hover:bg-[#0A6B52] hover:text-white transition-colors"
              >
                <RefreshCw className="h-4 w-4" /> RUN MATCH ENGINE
              </button>
            ) : (
              <button
                disabled
                className="inline-flex items-center gap-2 border-2 border-[#0A6B52]/40 bg-[#D8F2E8]/40 px-4 py-2 font-mono text-xs font-bold uppercase text-[#0A6B52]/40 cursor-not-allowed"
                title="Editor or Admin role required"
              >
                <RefreshCw className="h-4 w-4" /> RUN MATCH ENGINE
              </button>
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

        {/* Table */}
        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full text-left font-mono text-xs whitespace-nowrap border-collapse">
            <thead className="bg-[#0C0C0C] text-[#F0E8D0] sticky top-0 z-10">
              <tr>
                {[
                  "CASE NO",
                  "TYPE",
                  "CLIENT CODE",
                  "APPLICATION",
                  "TM NO",
                  "CLASS",
                  "JOURNAL NO",
                  "STAGE",
                  "SUB-STAGE",
                  "AGENT",
                  "PUB DATE",
                  "DEADLINE",
                  "DAYS REM.",
                  "DEMAND NOTE",
                  "STATUS",
                  "ACTIONS",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-3 border-r border-[#1A1A1A] font-bold tracking-wider uppercase text-[10px] last:border-r-0"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={16} className="px-6 py-12 text-center font-bold text-[#6d6658] animate-pulse">
                    LOADING PUBLICATION PIPELINE\u2026
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={16} className="px-6 py-16 text-center">
                    <div className="font-mono font-bold text-[#6d6658] uppercase tracking-widest mb-1">
                      No journal-matched records found.
                    </div>
                    <div className="font-mono text-xs text-[#9d9488]">
                      Run the Match Engine to populate publication data from the journal registry.
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((record, i) => (
                  <tr
                    key={record.id}
                    className={`cursor-pointer border-b border-[#0C0C0C]/10 transition-colors ${
                      i % 2 === 0 ? "bg-[#F0E8D0]" : "bg-white"
                    } hover:bg-[#D9D0B7]`}
                    onClick={() => {
                      setSelectedRecord(record);
                      setDemandNoteDate(new Date().toISOString().slice(0, 10));
                    }}
                  >
                    <td className="px-3 py-2 border-r border-[#0C0C0C]/10 font-bold text-[#0A6B52]">
                      {record.caseNumber}
                    </td>
                    <td className="px-3 py-2 border-r border-[#0C0C0C]/10 font-bold">
                      {record.type}
                    </td>
                    <td className="px-3 py-2 border-r border-[#0C0C0C]/10 font-bold text-[#6C1C1F]">
                      {record.clientCode}
                    </td>
                    <td className="px-3 py-2 border-r border-[#0C0C0C]/10 max-w-[180px]">
                      <div className="font-bold truncate">{record.appName}</div>
                      <div className="text-[9px] text-[#6d6658] truncate">{record.clientName}</div>
                    </td>
                    <td className="px-3 py-2 border-r border-[#0C0C0C]/10 font-bold">
                      {record.tmCprNo}
                    </td>
                    <td className="px-3 py-2 border-r border-[#0C0C0C]/10">
                      {record.appClass}
                    </td>
                    <td className="px-3 py-2 border-r border-[#0C0C0C]/10 font-bold text-[#0A6B52]">
                      {record.journalNumber || <span className="text-[#9d9488]">\u2014</span>}
                    </td>
                    <td className="px-3 py-2 border-r border-[#0C0C0C]/10">
                      <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase border border-[#0C0C0C]/20 bg-[#E8DFC7]">
                        {record.stage}
                      </span>
                    </td>
                    <td className="px-3 py-2 border-r border-[#0C0C0C]/10 max-w-[150px]">
                      {record.subStage ? (
                        <span className="text-[#6C1C1F] font-bold truncate block">{record.subStage}</span>
                      ) : (
                        <span className="text-[#9d9488]">\u2014</span>
                      )}
                    </td>
                    <td className="px-3 py-2 border-r border-[#0C0C0C]/10">
                      {record.agent || <span className="italic text-[#9d9488]">unassigned</span>}
                    </td>
                    <td className="px-3 py-2 border-r border-[#0C0C0C]/10">
                      {record.publicationDate}
                    </td>
                    <td className="px-3 py-2 border-r border-[#0C0C0C]/10">
                      {record.oppositionDeadline}
                    </td>
                    <td className="px-3 py-2 border-r border-[#0C0C0C]/10 font-bold">
                      <span className={getDaysColor(record.daysRemaining)}>
                        {record.daysRemaining}d
                      </span>
                    </td>
                    <td className="px-3 py-2 border-r border-[#0C0C0C]/10">
                      {record.demandNoteReceived ? (
                        <span className="inline-flex items-center gap-1 text-[#0A6B52]">
                          <CheckCircle className="h-3 w-3" /> {record.demandNoteDate}
                        </span>
                      ) : (
                        <span className="text-[#9d9488]">\u2014</span>
                      )}
                    </td>
                    <td className="px-3 py-2 border-r border-[#0C0C0C]/10">
                      <span
                        className={`inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase border ${STATUS_BADGE[record.status]}`}
                      >
                        {STATUS_LABEL[record.status] ?? record.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
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
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
                        className="h-8 px-2 border-2 border-[#0C0C0C] font-mono text-xs focus:outline-2 focus:outline-[#C94A00]"
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
    </AppShell>
  );
}
