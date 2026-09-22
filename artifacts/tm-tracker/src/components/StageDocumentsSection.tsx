import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FolderArchive, Upload, ExternalLink, X, Loader2,
  CheckCircle2, AlertCircle, Plus,
} from "lucide-react";
import {
  listStageDocuments,
  uploadStageDocument,
  STAGE_DOCUMENT_WORKFLOW,
  formatWorkflowLabel,
  getStaffRole,
  type StageDocument,
} from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

interface StageDocumentsSectionProps {
  trademarkId: string;
  currentStage?: string;
}

const STAGE_COLORS: Record<string, { bg: string; text: string }> = {
  "STAGE 1": { bg: "bg-[#0D9970]", text: "text-white" },
  "STAGE 2": { bg: "bg-[#B0740E]", text: "text-white" },
  "STAGE 3": { bg: "bg-[#6C1C1F]", text: "text-white" },
  "STAGE 4": { bg: "bg-[#0A6B52]", text: "text-white" },
};

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatMimeBadge(mime: string, fileName?: string): string {
  if (mime === "application/pdf") return "PDF";
  if (mime.includes("word") || fileName?.endsWith(".doc") || fileName?.endsWith(".docx")) return "Word";
  if (mime.includes("excel") || mime.includes("spreadsheet") || fileName?.endsWith(".xls") || fileName?.endsWith(".xlsx")) return "Excel";
  if (mime.startsWith("image/")) return mime.split("/")[1]?.toUpperCase() || "Image";
  if (mime === "text/plain") return "TXT";
  return "Document";
}

export function StageDocumentsSection({ trademarkId, currentStage }: StageDocumentsSectionProps) {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [targetStage, setTargetStage] = useState<string>("STAGE 1");
  const [targetSubStage, setTargetSubStage] = useState<string>("");
  const [title, setTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 1. Staff role (Viewer vs Editor/Admin)
  const { data: staffRole } = useQuery({
    queryKey: ["staff-role"],
    queryFn: getStaffRole,
    staleTime: 5 * 60 * 1000,
  });

  const canUpload = staffRole === "editor" || staffRole === "admin";

  // 2. Stage documents list
  const {
    data: documents = [],
    isLoading,
    error: loadError,
  } = useQuery({
    queryKey: ["stage-documents", trademarkId],
    queryFn: () => listStageDocuments(trademarkId),
    enabled: Boolean(trademarkId),
  });

  // 3. Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (args: { file: File; stage: string; subStage?: string; title?: string }) => {
      return uploadStageDocument(args.file, {
        trademarkId,
        stage: args.stage,
        subStage: args.subStage || undefined,
        title: args.title?.trim() || undefined,
      });
    },
    onSuccess: (newDoc) => {
      queryClient.invalidateQueries({ queryKey: ["stage-documents", trademarkId] });
      setSuccessMessage(`Document "${newDoc.title || newDoc.fileName}" uploaded successfully.`);
      setTimeout(() => {
        closeModal();
      }, 1200);
    },
    onError: (err: Error) => {
      setFormError(err.message || "Failed to upload document. Please try again.");
    },
  });

  const openModal = (defaultStage?: string) => {
    const stageToUse = defaultStage || currentStage || "STAGE 1";
    // Normalize stage matching STAGE_DOCUMENT_WORKFLOW
    const match = STAGE_DOCUMENT_WORKFLOW.find(
      (s) => s.stage === stageToUse.toUpperCase() || s.label.toUpperCase() === stageToUse.toUpperCase(),
    );
    setTargetStage(match ? match.stage : "STAGE 1");
    setTargetSubStage("");
    setTitle("");
    setSelectedFile(null);
    setFormError(null);
    setSuccessMessage(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (uploadMutation.isPending) return;
    setModalOpen(false);
    setSelectedFile(null);
    setTitle("");
    setFormError(null);
    setSuccessMessage(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormError(null);
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFormError("File must be 10 MB or smaller.");
      setSelectedFile(null);
      e.target.value = "";
      return;
    }
    setSelectedFile(file);
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!selectedFile) {
      setFormError("Please select a file to upload.");
      return;
    }
    uploadMutation.mutate({
      file: selectedFile,
      stage: targetStage,
      subStage: targetSubStage || undefined,
      title: title || undefined,
    });
  };

  const activeStageWorkflow = STAGE_DOCUMENT_WORKFLOW.find((s) => s.stage === targetStage);

  return (
    <div className="print-avoid-break border-3 border-[#0C0C0C] bg-[#E8DFC7] p-4 print:p-2 shadow-[5px_5px_0_#0C0C0C] print:shadow-none space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-b-2 border-[#0C0C0C] pb-3">
        <div className="flex items-center gap-2">
          <FolderArchive className="w-5 h-5 text-[#6C1C1F]" />
          <div className="font-mono text-xs sm:text-sm font-bold uppercase tracking-widest text-[#6C1C1F]">
            Stage Documents
          </div>
          <span className="font-mono text-[10px] font-bold px-2 py-0.5 border border-[#0C0C0C]/40 bg-white text-[#0C0C0C]">
            {documents.length} {documents.length === 1 ? "FILE" : "FILES"}
          </span>
        </div>

        {canUpload && (
          <button
            type="button"
            onClick={() => openModal()}
            className="print:hidden flex items-center gap-1.5 px-3 py-1.5 bg-[#0A6B52] text-white font-mono text-xs font-bold uppercase border-2 border-[#0C0C0C] shadow-[2px_2px_0_#0C0C0C] hover:brightness-110 active:translate-x-[1px] active:translate-y-[1px] transition-all"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Document</span>
          </button>
        )}
      </div>

      {isLoading && (
        <div className="p-4 font-mono text-xs text-[#6d6658] animate-pulse text-center">
          LOADING STAGE DOCUMENTS…
        </div>
      )}

      {loadError && (
        <div className="p-3 border-2 border-[#CC0000] bg-[#FFEEEE] text-[#CC0000] font-mono text-xs">
          Failed to load stage documents.
        </div>
      )}

      {/* Stage Cards Grid */}
      <div className="space-y-4">
        {STAGE_DOCUMENT_WORKFLOW.map((stageDef) => {
          const colors = STAGE_COLORS[stageDef.stage] ?? {
            bg: "bg-[#0C0C0C]",
            text: "text-white",
          };

          // Match documents for this stage
          const stageDocs = documents.filter((doc) => {
            const s = (doc.stage || "").trim().toUpperCase();
            return s === stageDef.stage || s === stageDef.label.toUpperCase();
          });

          return (
            <div
              key={stageDef.stage}
              className="border-2 border-[#0C0C0C] bg-white shadow-[3px_3px_0_#0C0C0C] print:shadow-none p-3.5 space-y-3"
            >
              {/* Stage Title and Available Sub-stages */}
              <div className="flex items-center justify-between gap-2 flex-wrap border-b border-[#0C0C0C]/20 pb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-1 font-mono text-xs font-bold uppercase border-2 border-[#0C0C0C] ${colors.bg} ${colors.text}`}
                  >
                    {stageDef.label}
                  </span>
                  <span className="font-mono text-[10px] text-[#6d6658]">
                    ({stageDocs.length} {stageDocs.length === 1 ? "document" : "documents"})
                  </span>
                </div>

                {canUpload && (
                  <button
                    type="button"
                    onClick={() => openModal(stageDef.stage)}
                    className="print:hidden flex items-center gap-1 text-[11px] font-mono font-bold uppercase px-2 py-1 border border-[#0C0C0C] bg-[#F0E8D0] hover:bg-[#0C0C0C] hover:text-white transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Upload to {stageDef.label}</span>
                  </button>
                )}
              </div>

              {/* Available Sub-stages listing */}
              <div>
                <div className="font-mono text-[9px] font-bold uppercase tracking-wider text-[#6d6658] mb-1.5">
                  Available Sub-stages:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {stageDef.subStages.map((sub) => (
                    <span
                      key={sub}
                      className="px-2 py-0.5 font-mono text-[10px] font-bold border border-[#0C0C0C]/30 bg-[#F0E8D0] text-[#0C0C0C]"
                    >
                      {sub}
                    </span>
                  ))}
                </div>
              </div>

              {/* Documents List */}
              <div className="space-y-2 pt-1">
                {stageDocs.length === 0 ? (
                  <div className="p-3 border border-dashed border-[#0C0C0C]/30 bg-[#F0E8D0]/40 font-mono text-xs text-[#6d6658] italic text-center">
                    No documents attached for {stageDef.label}.
                  </div>
                ) : (
                  stageDocs.map((doc: StageDocument) => (
                    <div
                      key={doc.id}
                      className="p-3 border-2 border-[#0C0C0C] bg-[#FDFBF7] shadow-[2px_2px_0_#0C0C0C] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-serif font-bold text-base text-[#0A1931] break-words">
                            {doc.title || doc.fileName}
                          </span>
                          {doc.subStage && (
                            <span className="px-2 py-0.5 font-mono text-[10px] font-bold uppercase border border-[#0C0C0C]/40 bg-[#E8DFC7] text-[#0C0C0C]">
                              {formatWorkflowLabel(doc.subStage)}
                            </span>
                          )}
                          <span className="px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase bg-[#6C1C1F]/10 text-[#6C1C1F] border border-[#6C1C1F]/30">
                            {formatMimeBadge(doc.mimeType, doc.fileName)}
                          </span>
                        </div>
                        <div className="font-mono text-[11px] text-[#6d6658] flex flex-wrap gap-x-3 gap-y-0.5">
                          <span className="truncate max-w-xs">
                            File: <strong className="text-[#0C0C0C]">{doc.fileName}</strong>
                          </span>
                          <span>
                            Size: <strong className="text-[#0C0C0C]">{formatBytes(doc.sizeBytes)}</strong>
                          </span>
                          <span>
                            Uploaded: <strong className="text-[#0C0C0C]">{formatDateShort(doc.createdAt)}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {doc.signedUrl ? (
                          <a
                            href={doc.signedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border-2 border-[#0C0C0C] font-mono text-xs font-bold uppercase text-[#0C0C0C] shadow-[2px_2px_0_#0C0C0C] hover:bg-[#0C0C0C] hover:text-white transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>View</span>
                          </a>
                        ) : (
                          <span className="font-mono text-[10px] text-[#9d9488] border border-dashed border-[#9d9488] px-2 py-1">
                            URL Unavailable
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Upload Document Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="border-3 border-[#0C0C0C] bg-[#F0E8D0] shadow-[8px_8px_0_#0C0C0C] max-w-md w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b-2 border-[#0C0C0C] pb-3">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#6C1C1F]" />
                <div className="font-serif text-lg font-bold uppercase text-[#0C0C0C]">
                  Upload Stage Document
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={uploadMutation.isPending}
                className="p-1 border border-[#0C0C0C] bg-white hover:bg-[#0C0C0C] hover:text-white transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error & Success Feedback */}
            {formError && (
              <div className="p-2.5 border-2 border-[#CC0000] bg-[#FFEEEE] text-[#CC0000] font-mono text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-2.5 border-2 border-[#0A6B52] bg-[#D8F2E8] text-[#0A6B52] font-mono text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Upload Form */}
            <form onSubmit={handleUploadSubmit} className="space-y-3.5">
              {/* Stage Selection */}
              <div>
                <label className="block font-mono text-[10px] font-bold uppercase text-[#6C1C1F] mb-1">
                  Workflow Stage *
                </label>
                <select
                  value={targetStage}
                  onChange={(e) => {
                    setTargetStage(e.target.value);
                    setTargetSubStage("");
                  }}
                  disabled={uploadMutation.isPending}
                  className="w-full h-9 px-2.5 border-2 border-[#0C0C0C] bg-white font-mono text-xs font-bold text-[#0C0C0C]"
                >
                  {STAGE_DOCUMENT_WORKFLOW.map((s) => (
                    <option key={s.stage} value={s.stage}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sub-stage Selection */}
              <div>
                <label className="block font-mono text-[10px] font-bold uppercase text-[#6C1C1F] mb-1">
                  Sub-stage (Optional)
                </label>
                <select
                  value={targetSubStage}
                  onChange={(e) => setTargetSubStage(e.target.value)}
                  disabled={uploadMutation.isPending}
                  className="w-full h-9 px-2.5 border-2 border-[#0C0C0C] bg-white font-mono text-xs text-[#0C0C0C]"
                >
                  <option value="">-- None / General Stage Document --</option>
                  {activeStageWorkflow?.subStages.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>

              {/* Document Title */}
              <div>
                <label className="block font-mono text-[10px] font-bold uppercase text-[#6C1C1F] mb-1">
                  Document Title (Optional)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Filing Receipt, Examination Report, Power of Attorney"
                  disabled={uploadMutation.isPending}
                  className="w-full h-9 px-2.5 border-2 border-[#0C0C0C] bg-white font-mono text-xs text-[#0C0C0C] placeholder:text-[#9d9488]"
                />
              </div>

              {/* File Input */}
              <div>
                <label className="block font-mono text-[10px] font-bold uppercase text-[#6C1C1F] mb-1">
                  Select File * (PDF, Word, Excel, Plain Text, Image — Max 10MB)
                </label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.gif,.webp"
                  onChange={handleFileChange}
                  disabled={uploadMutation.isPending}
                  className="w-full text-xs font-mono file:mr-3 file:py-1.5 file:px-3 file:border-2 file:border-[#0C0C0C] file:bg-white file:font-mono file:text-xs file:font-bold file:uppercase hover:file:bg-[#0C0C0C] hover:file:text-white file:transition-colors cursor-pointer"
                />
                {selectedFile && (
                  <div className="mt-1 font-mono text-[10px] text-[#0A6B52]">
                    Selected: {selectedFile.name} ({formatBytes(selectedFile.size)})
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#0C0C0C]/20">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={uploadMutation.isPending}
                  className="px-3 py-1.5 border-2 border-[#0C0C0C] bg-white font-mono text-xs font-bold uppercase hover:bg-[#0C0C0C] hover:text-white transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedFile || uploadMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-[#0A6B52] text-white font-mono text-xs font-bold uppercase border-2 border-[#0C0C0C] shadow-[2px_2px_0_#0C0C0C] hover:brightness-110 disabled:opacity-50 active:translate-x-[1px] active:translate-y-[1px] transition-all"
                >
                  {uploadMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Uploading…</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Document</span>
                    </>
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
