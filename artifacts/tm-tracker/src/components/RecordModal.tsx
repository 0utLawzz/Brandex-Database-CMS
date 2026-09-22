import {
  createTrademark,
  updateTrademark,
  deleteTrademark,
  getTrademark,
  listTrademarks,
  listClients,
  uploadImage,
  ConflictError,
  STAGES,
  STATUS_WORKFLOW,
  CITIES,
  VALID_TYPES,
  isStage2PaymentRequired,
  listAgentProfiles,
  formatWorkflowLabel,
  normalizeWorkflowValue,
} from "@/lib/api";
import type { TrademarkInput, TrademarkRecord } from "@/lib/api";
import { useEffect, useState, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  X,
  Save,
  Trash2,
  AlertCircle,
  UploadCloud,
  Eye,
  Image as ImageIcon,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";

const CASE_TYPES = ["Trademark", "Copyright", "Design", "Patent", "Renewal", "Opposition", "Other"];

const schema = z.object({
  date:       z.string().min(1, "Date is required"),
  type:       z.string().min(1, "Type is required"),
  clientCode: z.string().min(1, "Client Code is required"),
  clientName: z.string().optional(),
  caseNumber: z.string().min(1, "Case Number is required"),
  appName:    z.string().min(1, "Application Name is required"),
  tmCprNo:    z.string().optional(),
  appClass:   z.string().optional(),
  stage:      z.string().min(1, "Status is required"),
  subStage:   z.string().optional(),
  caseType:   z.string().optional(),
  agent:      z.string().optional(),
  city:       z.string().min(1, "City is required"),
  notes:      z.string().optional(),
  image:      z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface RecordModalProps {
  recordId?: string;
  isNew?: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block font-mono text-[10px] font-bold uppercase tracking-widest text-[#6d6658] mb-1.5">
      {children}{required && <span className="text-[#CC0000] ml-0.5">*</span>}
    </label>
  );
}

function FormInput({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full h-10 px-3 bg-white border-2 border-[#0C0C0C] font-mono text-sm focus:outline-2 focus:outline-[#C94A00] focus:outline-offset-0 disabled:opacity-40 disabled:bg-[#E8DFC7] ${className}`}
    />
  );
}

function FormSelect({ children, className = "", ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full h-10 px-3 bg-white border-2 border-[#0C0C0C] font-mono text-sm focus:outline-2 focus:outline-[#C94A00] focus:outline-offset-0 disabled:opacity-40 disabled:bg-[#E8DFC7] ${className}`}
    >
      {children}
    </select>
  );
}

function SectionHead({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="font-mono text-xs font-bold uppercase tracking-widest text-[#0C0C0C]">{title}</div>
      <div className="flex-1 h-0.5 bg-[#0C0C0C]/10" />
    </div>
  );
}

export function RecordModal({ recordId, isNew: forceNew, onClose, onSaved }: RecordModalProps) {
  const creating = forceNew || !recordId;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState("");

  const { data: trademark, isLoading } = useQuery<TrademarkRecord | null>({
    queryKey: ["trademark", recordId],
    queryFn: () => getTrademark(recordId!),
    enabled: !creating && !!recordId,
    staleTime: 30_000,
  });

  // Client references for auto-population
  const { data: clientRefs = [] } = useQuery({
    queryKey: ["clients-ref"],
    queryFn: listClients,
    staleTime: 5 * 60_000,
  });

  const { data: allTrademarks = [] } = useQuery<TrademarkRecord[]>({
    queryKey: ["trademarks"],
    queryFn: () => listTrademarks(),
    staleTime: 60_000,
  });

  // Build client code -> client name map
  const clientMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clientRefs) {
      if (c.code && c.name) map.set(c.code.trim().toUpperCase(), c.name.trim());
    }
    for (const tm of allTrademarks) {
      if (tm.clientCode && tm.clientName && !map.has(tm.clientCode.trim().toUpperCase())) {
        map.set(tm.clientCode.trim().toUpperCase(), tm.clientName.trim());
      }
    }
    return map;
  }, [clientRefs, allTrademarks]);

  const { data: agentProfiles = [] } = useQuery({
    queryKey: ["agent-profiles"],
    queryFn: listAgentProfiles,
    staleTime: 5 * 60_000,
  });

  const activeAgentProfiles = useMemo(
    () => agentProfiles.filter((a) => a.isActive !== false),
    [agentProfiles]
  );

  const createMutation = useMutation({
    mutationFn: (input: TrademarkInput) => createTrademark(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trademarks"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["recent-activity"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: TrademarkInput) =>
      updateTrademark(recordId!, input, trademark?.version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trademarks"] });
      queryClient.invalidateQueries({ queryKey: ["trademark", recordId] });
      queryClient.invalidateQueries({ queryKey: ["record", recordId] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["recent-activity"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTrademark(recordId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trademarks"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      date:       format(new Date(), "yyyy-MM-dd"),
      type:       "X",
      clientCode: "",
      clientName: "",
      caseNumber: "",
      appName:    "",
      tmCprNo:    "",
      appClass:   "",
      stage:      "STAGE 1",
      subStage:   "",
      caseType:   "Trademark",
      agent:      "",
      city:       "Islamabad",
      notes:      "",
      image:      "",
    },
  });

  useEffect(() => {
    if (trademark && !creating) {
      form.reset({
        date:       trademark.date?.split("T")[0] ?? format(new Date(), "yyyy-MM-dd"),
        type:       trademark.type || "X",
        clientCode: trademark.clientCode ?? "",
        clientName: trademark.clientName ?? "",
        caseNumber: trademark.caseNumber ?? "",
        appName:    trademark.appName ?? "",
        tmCprNo:    trademark.tmCprNo ?? "",
        appClass:   trademark.appClass ?? "",
        stage:      trademark.stage || "STAGE 1",
        subStage:   normalizeWorkflowValue(trademark.subStage ?? ""),
        caseType:   trademark.caseType || "Trademark",
        agent:      trademark.agent ?? "",
        city:       trademark.city || "Islamabad",
        notes:      trademark.notes ?? "",
        image:      trademark.imagePath ?? "",
      });
      setImagePreview(trademark.image ?? "");
    }
  }, [trademark, creating, form]);

  const watchStage = form.watch("stage");
  const watchImage = form.watch("image");
  const availableSubStages = STATUS_WORKFLOW[watchStage] ?? [];
  const isStage2Paid = !creating && Boolean(trademark?.stage2Paid);

  // Auto-populate Client Name when Client Code changes
  const handleClientCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    form.setValue("clientCode", val);
    if (val.trim()) {
      const match = clientMap.get(val.trim().toUpperCase());
      if (match) {
        form.setValue("clientName", match);
      } else {
        form.setValue("clientName", "");
      }
    } else {
      form.setValue("clientName", "");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    try {
      setUploading(true);
      setUploadProgress(20);
      const res = await uploadImage(file, (pct) => setUploadProgress(pct));
      form.setValue("image", res.fileId);
      setImagePreview(res.thumbnailUrl);
      toast({
        title: "✓ Image Uploaded",
        description: `Uploaded ${file.name} to secure storage.`,
      });
    } catch (err: any) {
      toast({
        title: "⚠ Upload Failed",
        description: err?.message || "Failed to upload image.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onSubmit = (data: FormValues) => {
    // Stage 2 Payment Gate: Assigned -> Accepted -> Hearing requires stage2_paid = true
    if (data.stage === "STAGE 2" && !isStage2Paid) {
      toast({
        title: "⚠ Payment Required",
        description: "Stage 2 payment is required before proceeding.",
        variant: "destructive",
      });
      return;
    }
    const payload: TrademarkInput = {
      date:       data.date,
      type:       data.type,
      clientCode: data.clientCode,
      clientName: data.clientName || undefined,
      caseNumber: data.caseNumber,
      appName:    data.appName,
      tmCprNo:    data.tmCprNo   || undefined,
      appClass:   data.appClass  || undefined,
      caseType:   data.caseType  || undefined,
      stage:      data.stage,
      subStage:   data.subStage  || undefined,
      agent:      data.agent     || undefined,
      city:       data.city,
      notes:      data.notes     || undefined,
      image:      data.image     || undefined,
    };

    if (creating) {
      createMutation.mutate(payload, {
        onSuccess: () => {
          toast({
            title: "✓ Record Created",
            description: `${data.appName} saved to the secure Datasheet.`,
          });
          onSaved?.();
          onClose();
        },
        onError: () =>
          toast({
            title: "⚠ Save Failed",
            description: "Unable to save record. Please check your connection and try again.",
            variant: "destructive",
          }),
      });
    } else {
      updateMutation.mutate(payload, {
        onSuccess: () => {
          toast({
            title: "✓ Record Updated",
            description: "Changes saved to the secure Datasheet.",
          });
          onSaved?.();
          onClose();
        },
        onError: (err: unknown) => {
          if (err instanceof ConflictError) {
            toast({
              title: "⚠ Conflict",
              description: err.message,
              variant: "destructive",
            });
            return;
          }
          toast({
            title: "⚠ Update Failed",
            description: "Unable to update record. Please check your connection and try again.",
            variant: "destructive",
          });
        },
      });
    }
  };

  const handleDelete = () => {
    if (!confirm("Delete this record permanently?\n\nThis action cannot be undone.")) return;
    deleteMutation.mutate(undefined, {
      onSuccess: () => {
        toast({ title: "Record Deleted" });
        onClose();
      },
      onError: () =>
        toast({
          title: "⚠ Delete Failed",
          description: "Unable to delete record. Please check your connection and try again.",
          variant: "destructive",
        }),
    });
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  // Types list: include standard series ["X", "A", "N"] plus any existing record type
  const availableTypes = useMemo(() => {
    const set = new Set<string>(VALID_TYPES);
    if (trademark?.type) set.add(trademark.type);
    return Array.from(set);
  }, [trademark]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl max-h-full bg-[#F0E8D0] border-2 border-[#0C0C0C] flex flex-col shadow-[8px_8px_0_#0C0C0C] overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#0C0C0C] text-[#F0E8D0] shrink-0">
          <div>
            <div className="font-serif text-2xl uppercase tracking-widest leading-none">
              {creating ? "ADD RECORD" : "EDIT RECORD"}
            </div>
            {!creating && trademark && (
              <div className="font-mono text-[10px] text-[#C5B89A] uppercase tracking-widest mt-1">
                {trademark.caseNumber || trademark.id} · SECURE DATASHEET
              </div>
            )}
          </div>
          <button onClick={onClose} disabled={isPending} className="text-[#C5B89A] hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {!creating && isLoading ? (
          <div className="flex-1 flex items-center justify-center p-12 font-mono font-bold text-[#6d6658] animate-pulse">
            LOADING SECURE RECORD…
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-8">

              {/* Basic Information */}
              <div>
                <SectionHead title="Basic Information" />
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <FieldLabel required>DATE</FieldLabel>
                    <FormInput type="date" {...form.register("date")} />
                    {form.formState.errors.date && (
                      <p className="mt-1 text-[10px] font-mono text-[#CC0000]">{form.formState.errors.date.message}</p>
                    )}
                  </div>
                  <div>
                    <FieldLabel required>TYPE (Series)</FieldLabel>
                    <FormSelect {...form.register("type")}>
                      {availableTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                    </FormSelect>
                  </div>
                  <div>
                    <FieldLabel required>CLIENT CODE</FieldLabel>
                    <FormInput
                      placeholder="e.g. 284"
                      {...form.register("clientCode")}
                      onChange={handleClientCodeChange}
                    />
                    {form.formState.errors.clientCode && (
                      <p className="mt-1 text-[10px] font-mono text-[#CC0000]">{form.formState.errors.clientCode.message}</p>
                    )}
                  </div>
                  <div>
                    <FieldLabel required>CASE NUMBER</FieldLabel>
                    <FormInput placeholder="e.g. 001" {...form.register("caseNumber")} />
                    {form.formState.errors.caseNumber && (
                      <p className="mt-1 text-[10px] font-mono text-[#CC0000]">{form.formState.errors.caseNumber.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Case Information */}
              <div>
                <SectionHead title="Case Information" />
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <FieldLabel>CASE TYPE</FieldLabel>
                    <FormSelect {...form.register("caseType")}>
                      {CASE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </FormSelect>
                  </div>
                  <div className="sm:col-span-2">
                    <FieldLabel required>APPLICATION NAME</FieldLabel>
                    <FormInput placeholder="Trademark / Application name" {...form.register("appName")} />
                    {form.formState.errors.appName && (
                      <p className="mt-1 text-[10px] font-mono text-[#CC0000]">{form.formState.errors.appName.message}</p>
                    )}
                  </div>
                  <div>
                    <FieldLabel>CLASS</FieldLabel>
                    <FormSelect {...form.register("appClass")}>
                      <option value="">SELECT</option>
                      {Array.from({ length: 45 }, (_, i) => String(i + 1)).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </FormSelect>
                  </div>
                  <div className="sm:col-span-2">
                    <FieldLabel>TM / CPR NUMBER</FieldLabel>
                    <FormInput placeholder="e.g. 633710" {...form.register("tmCprNo")} />
                  </div>
                </div>
              </div>

              {/* Status */}
              <div>
                <SectionHead title="Status" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel required>STAGE</FieldLabel>
                    <FormSelect
                      {...form.register("stage")}
                      onChange={(e) => {
                        const newStage = e.target.value;
                        form.setValue("stage", newStage);
                        const validSubs = STATUS_WORKFLOW[newStage] ?? [];
                        const currentSub = normalizeWorkflowValue(form.getValues("subStage"));
                        if (!currentSub || !validSubs.includes(currentSub)) {
                          form.setValue("subStage", "");
                        }
                      }}
                    >
                      {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </FormSelect>
                  </div>
                  <div>
                    <FieldLabel>SUB-STAGE</FieldLabel>
                    <FormSelect {...form.register("subStage")}>
                      <option value="">SELECT SUB-STAGE</option>
                      {availableSubStages.map((s) => (
                        <option key={s} value={s}>
                          {formatWorkflowLabel(s)}
                        </option>
                      ))}
                    </FormSelect>
                  </div>
                </div>
                {watchStage === "STAGE 2" && (
                  <div
                    className={`mt-3 p-3 border-2 flex items-center justify-between ${
                      isStage2Paid
                        ? "bg-[#D8F2E8] border-[#0A6B52]"
                        : "bg-[#FFF0D0] border-[#C94A00]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isStage2Paid ? (
                        <CheckCircle2 className="w-4 h-4 text-[#0A6B52] shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-[#C94A00] shrink-0" />
                      )}
                      <span
                        className={`font-mono text-xs font-bold ${
                          isStage2Paid ? "text-[#0A6B52]" : "text-[#6C1C1F]"
                        }`}
                      >
                        {isStage2Paid
                          ? `Stage 2 Payment Confirmed (${trademark?.stage2PaidDate || "Recorded"})`
                          : "Stage 2 payment is required before proceeding."}
                      </span>
                    </div>
                    <span className="font-mono text-[9px] font-bold text-[#B0740E] border border-[#B0740E] px-1.5 py-0.5 bg-white shrink-0">
                      MANUAL — NOT VERIFIED
                    </span>
                  </div>
                )}
              </div>

              {/* Assignment */}
              <div>
                <SectionHead title="Assignment" />
                {watchStage === "STAGE 2" && !isStage2Paid ? (
                  <div className="p-3 bg-[#FFF0D0] border-2 border-[#C94A00] space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-[#C94A00] shrink-0" />
                        <span className="font-mono text-xs font-bold text-[#6C1C1F]">
                          Stage 2 payment is required before proceeding.
                        </span>
                      </div>
                      <span className="font-mono text-[9px] font-bold text-[#B0740E] border border-[#B0740E] px-1.5 py-0.5 bg-white shrink-0">
                        MANUAL — NOT VERIFIED
                      </span>
                    </div>
                    <div className="font-mono text-xs text-[#6d6658]">
                      Agent assignment is locked until Stage 2 payment is cleared.
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <FieldLabel>AGENT (MASTER SYSTEM)</FieldLabel>
                      <FormSelect
                        {...form.register("agent")}
                        onChange={(e) => {
                          const val = e.target.value;
                          form.setValue("agent", val);
                          const matched = activeAgentProfiles.find((a) => a.name === val);
                          if (matched?.city && CITIES.includes(matched.city as any)) {
                            form.setValue("city", matched.city);
                          }
                        }}
                      >
                        <option value="">-- SELECT AGENT --</option>
                        {form.watch("agent") &&
                          !activeAgentProfiles.some((a) => a.name === form.watch("agent")) && (
                            <option value={form.watch("agent")}>
                              {form.watch("agent")} (Current)
                            </option>
                          )}
                        {activeAgentProfiles.map((a) => (
                          <option key={a.id} value={a.name}>
                            {a.name} {a.city ? `(${a.city})` : ""}
                          </option>
                        ))}
                      </FormSelect>
                    </div>
                    <div>
                      <FieldLabel required>AGENT CITY</FieldLabel>
                      <FormSelect {...form.register("city")}>
                        {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </FormSelect>
                    </div>
                  </div>
                )}
              </div>

              {/* Additional */}
              <div>
                <SectionHead title="Additional" />
                <div className="space-y-4">
                  <div>
                    <FieldLabel>NOTES</FieldLabel>
                    <textarea
                      {...form.register("notes")}
                      rows={3}
                      placeholder="Enter any notes here..."
                      className="w-full p-3 bg-white border-2 border-[#0C0C0C] font-mono text-sm focus:outline-2 focus:outline-[#C94A00] focus:outline-offset-0 resize-none"
                    />
                  </div>

                  {/* Image Upload / Preview */}
                  <div>
                    <FieldLabel>TRADEMARK IMAGE</FieldLabel>
                    <div className="border-2 border-[#0C0C0C] bg-white p-4 space-y-3">
                      {/* Hidden File Input */}
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/png, image/jpeg, image/webp"
                        className="hidden"
                        onChange={handleFileUpload}
                      />

                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          className="flex items-center gap-2 px-4 h-10 bg-[#0C0C0C] text-[#F0E8D0] border-2 border-[#0C0C0C] font-mono font-bold text-xs uppercase tracking-wider hover:bg-[#C94A00] hover:border-[#C94A00] hover:text-white transition-colors disabled:opacity-50"
                        >
                          <UploadCloud className="w-4 h-4" />
                          {uploading ? "UPLOADING…" : watchImage ? "REPLACE IMAGE" : "BROWSE / UPLOAD IMAGE"}
                        </button>

                        {watchImage && (
                          <button
                            type="button"
                            onClick={() => { form.setValue("image", ""); setImagePreview(""); }}
                            className="px-3 h-10 border-2 border-[#CC0000] text-[#CC0000] font-mono font-bold text-xs uppercase tracking-wider hover:bg-[#CC0000] hover:text-white transition-colors"
                          >
                            REMOVE IMAGE
                          </button>
                        )}
                      </div>

                      {/* Upload Progress Bar */}
                      {uploading && (
                        <div className="space-y-1">
                          <div className="flex justify-between font-mono text-[10px] text-[#6d6658]">
                            <span>Uploading to secure storage…</span>
                            <span>{uploadProgress}%</span>
                          </div>
                          <div className="w-full h-2 bg-[#E8DFC7] border border-[#0C0C0C] overflow-hidden">
                            <div
                              className="h-full bg-[#C94A00] transition-all duration-300"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Thumbnail Preview */}
                      {watchImage && (
                        <div className="flex items-center gap-4 pt-2 border-t border-[#0C0C0C]/10">
                          <div
                            onClick={() => setPreviewModalOpen(true)}
                            className="w-16 h-16 border-2 border-[#0C0C0C] bg-[#F0E8D0] flex items-center justify-center cursor-pointer hover:border-[#C94A00] overflow-hidden"
                            title="Click to enlarge"
                          >
                            <img
                              src={imagePreview || watchImage}
                              alt="Preview"
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                          </div>
                          <div className="flex flex-col gap-1 font-mono text-xs">
                            <div className="flex items-center gap-1.5 text-[#0A6B52] font-bold text-[10px] uppercase">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Image Attached
                            </div>
                            <button
                              type="button"
                              onClick={() => setPreviewModalOpen(true)}
                              className="flex items-center gap-1 text-[#C94A00] text-[11px] font-bold hover:underline"
                            >
                              <Eye className="w-3.5 h-3.5" /> View Large Preview
                            </button>
                          </div>
                        </div>
                      )}

                      <input type="hidden" {...form.register("image")} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Enlarged Image Preview Modal */}
            {previewModalOpen && watchImage && (
              <div
                className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4"
                onClick={() => setPreviewModalOpen(false)}
              >
                <div
                  className="relative max-w-3xl max-h-[85vh] bg-[#F0E8D0] border-4 border-[#0C0C0C] shadow-[10px_10px_0_#0C0C0C] overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between px-4 py-2 bg-[#0C0C0C] text-[#F0E8D0]">
                    <span className="font-mono font-bold text-xs uppercase tracking-widest">Image Preview</span>
                    <button
                      onClick={() => setPreviewModalOpen(false)}
                      className="font-mono text-xs text-[#C5B89A] hover:text-white"
                    >
                      ✕ CLOSE
                    </button>
                  </div>
                  <img
                    src={imagePreview || watchImage}
                    alt="Full Preview"
                    className="max-h-[75vh] w-auto mx-auto block p-2"
                  />
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="shrink-0 flex items-center justify-between px-6 py-4 bg-[#E8DFC7] border-t-2 border-[#0C0C0C]">
              {!creating ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending || isPending}
                  className="flex items-center gap-2 bg-white text-[#CC0000] border-2 border-[#CC0000] px-4 h-10 font-mono font-bold text-xs uppercase tracking-wider hover:bg-[#CC0000] hover:text-white transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" /> DELETE
                </button>
              ) : <div />}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isPending}
                  className="px-5 h-10 bg-white border-2 border-[#0C0C0C] font-mono font-bold text-xs uppercase tracking-wider hover:bg-[#0C0C0C] hover:text-[#F0E8D0] transition-colors disabled:opacity-50"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex items-center gap-2 bg-[#C94A00] text-white border-2 border-[#C94A00] px-6 h-10 font-mono font-bold text-xs uppercase tracking-wider hover:brightness-110 transition-all disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isPending ? "SAVING TO DATABASE…" : creating ? "SAVE RECORD" : "UPDATE RECORD"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
