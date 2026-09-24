import React, { useState, useRef } from "react";
import { useBranding } from "@/hooks/useBranding";
import { getStaffRole } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import {
  X,
  Upload,
  RotateCcw,
  Check,
  AlertTriangle,
  ImageIcon,
  Eye,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import { validateLogoFile, sanitizeSvg, DEFAULT_BRANDING } from "@/lib/branding";

interface BrandingSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_VARIANTS = [
  {
    id: "svg-wordmark",
    name: "Classic Wordmark (SVG)",
    description: "Official transparent vector banner",
    logoUrl: "/brandex-wordmark.svg",
    markUrl: "/brandex-mark.svg",
    watermarkUrl: "/brandex-wordmark.svg",
    previewUrl: "/brandex-wordmark.svg",
  },
  {
    id: "cream-banner",
    name: "Cream & Maroon Banner (PNG)",
    description: "Rich editorial banner with gold accent",
    logoUrl: "/branding/brandex-banner-cream.png",
    markUrl: "/branding/brandex-square-maroon.png",
    watermarkUrl: "/brandex-wordmark.svg",
    previewUrl: "/branding/brandex-banner-cream.png",
  },
  {
    id: "capsule-wide",
    name: "Horizontal Capsule (PNG)",
    description: "Modern curved border capsule",
    logoUrl: "/branding/brandex-capsule-wide.png",
    markUrl: "/branding/brandex-capsule-square.png",
    watermarkUrl: "/brandex-wordmark.svg",
    previewUrl: "/branding/brandex-capsule-wide.png",
  },
  {
    id: "square-maroon",
    name: "Square Maroon Badge (PNG)",
    description: "Square border with maroon monogram",
    logoUrl: "/branding/brandex-square-maroon.png",
    markUrl: "/branding/brandex-square-maroon.png",
    watermarkUrl: "/branding/brandex-square-maroon.png",
    previewUrl: "/branding/brandex-square-maroon.png",
  },
  {
    id: "square-gold",
    name: "Square Gold Badge (PNG)",
    description: "Square border with gold monogram",
    logoUrl: "/branding/brandex-square-gold.png",
    markUrl: "/branding/brandex-square-gold.png",
    watermarkUrl: "/branding/brandex-square-gold.png",
    previewUrl: "/branding/brandex-square-gold.png",
  },
];

export function BrandingSettingsModal({ isOpen, onClose }: BrandingSettingsModalProps) {
  const { branding, updateBranding, uploadAsset, resetBranding } = useBranding();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: staffRole } = useQuery({
    queryKey: ["staff-role"],
    queryFn: getStaffRole,
    staleTime: 5 * 60_000,
  });

  const isAdmin = staffRole === "admin";

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [targetSlot, setTargetSlot] = useState<"logo" | "mark" | "watermark">("logo");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!file) return;

    const validation = validateLogoFile(file);
    if (!validation.valid) {
      setErrorMsg(validation.error || "Invalid file format or size.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.type === "image/svg+xml" || file.name.endsWith(".svg")) {
      const text = await file.text();
      const svgCheck = sanitizeSvg(text);
      if (!svgCheck.safe) {
        setErrorMsg(svgCheck.error || "SVG contains invalid or prohibited elements.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setFilePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadAndSave = async () => {
    if (!isAdmin) {
      setErrorMsg("Only administrators can update branding configuration.");
      return;
    }

    if (!selectedFile) {
      setErrorMsg("Please select a valid image file to upload.");
      return;
    }

    try {
      setSaving(true);
      setErrorMsg(null);
      const uploadedUrl = await uploadAsset(selectedFile, targetSlot);

      const updates: Partial<typeof branding> = {};
      if (targetSlot === "logo") {
        updates.customLogoUrl = uploadedUrl;
        updates.logoUrl = uploadedUrl;
      } else if (targetSlot === "mark") {
        updates.customMarkUrl = uploadedUrl;
        updates.markUrl = uploadedUrl;
        updates.faviconUrl = uploadedUrl;
      } else if (targetSlot === "watermark") {
        updates.customWatermarkUrl = uploadedUrl;
        updates.watermarkUrl = uploadedUrl;
      }

      await updateBranding(updates);
      setSuccessMsg(`Brandex ${targetSlot.toUpperCase()} updated successfully!`);
      setSelectedFile(null);
      setFilePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to upload and save branding.");
    } finally {
      setSaving(false);
    }
  };

  const handleApplyPreset = async (preset: typeof PRESET_VARIANTS[0]) => {
    if (!isAdmin) {
      setErrorMsg("Only administrators can apply branding presets.");
      return;
    }

    try {
      setSaving(true);
      setErrorMsg(null);
      await updateBranding({
        logoUrl: preset.logoUrl,
        markUrl: preset.markUrl,
        watermarkUrl: preset.watermarkUrl,
        faviconUrl: preset.markUrl,
        customLogoUrl: preset.logoUrl,
        customMarkUrl: preset.markUrl,
        customWatermarkUrl: preset.watermarkUrl,
      });
      setSuccessMsg(`Applied preset: ${preset.name}`);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to apply preset.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    if (!isAdmin) {
      setErrorMsg("Only administrators can reset branding.");
      return;
    }

    try {
      setSaving(true);
      setErrorMsg(null);
      await resetBranding();
      setSelectedFile(null);
      setFilePreview(null);
      setSuccessMsg("Branding restored to official Brandex default assets.");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to reset branding.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-page-in">
      <div className="bg-[#FFF9F0] border-2 border-[#0C0C0C] w-full max-w-3xl max-h-[90vh] flex flex-col shadow-[8px_8px_0_#0C0C0C] overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-[#6C1C1F] text-white border-b-2 border-[#0C0C0C] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-[#B0740E]" />
            <div>
              <h2 className="font-serif text-2xl uppercase tracking-wider leading-none">
                BRANDING & LOGO SYSTEM
              </h2>
              <p className="font-mono text-[10px] text-[#F0E8D0] uppercase tracking-widest mt-0.5 font-bold">
                Configurable Logo, Mark, Favicon & Print Watermark
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 border-2 border-white text-white hover:bg-white hover:text-[#6C1C1F] transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Role Alert if not admin */}
          {!isAdmin && (
            <div className="border-2 border-[#B0740E] bg-[#FFF0D0] p-3.5 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-[#B0740E] shrink-0 mt-0.5" />
              <div className="font-mono text-xs text-[#0C0C0C]">
                <strong className="uppercase">Read-Only View:</strong> Only users with the{" "}
                <strong className="text-[#6C1C1F]">ADMIN</strong> role can upload or change
                branding assets. You are currently viewing the active configuration.
              </div>
            </div>
          )}

          {/* Feedback Messages */}
          {errorMsg && (
            <div className="border-2 border-[#CC0000] bg-[#FFEEEE] p-3 text-[#CC0000] font-mono text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="border-2 border-[#0A6B52] bg-[#D8F2E8] p-3 text-[#0A6B52] font-mono text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Section 1: Live Active Branding Preview */}
          <div className="border-2 border-[#0C0C0C] bg-white p-4 shadow-[2px_2px_0_#0C0C0C]">
            <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#6C1C1F] mb-3 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" /> ACTIVE BRANDING PREVIEW
              </span>
              <span className="text-[#6d6658]">
                {branding.updatedAt ? `Updated ${new Date(branding.updatedAt).toLocaleDateString()}` : "Default Brandex Assets"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Dashboard Logo Preview */}
              <div className="border border-[#0C0C0C]/20 p-3 bg-[#F0E8D0] flex flex-col items-center justify-between text-center min-h-[140px]">
                <div className="font-mono text-[9px] font-bold text-[#6C1C1F] uppercase mb-2">
                  1. Dashboard Logo
                </div>
                <div className="h-16 w-full flex items-center justify-center p-1 bg-white/70 border border-[#0C0C0C]/10">
                  <img
                    src={branding.logoUrl}
                    alt="Dashboard Logo"
                    className="max-h-14 max-w-full object-contain"
                  />
                </div>
                <div className="font-mono text-[8px] text-[#6d6658] mt-2 truncate w-full">
                  Primary banner
                </div>
              </div>

              {/* Header Mark Preview */}
              <div className="border border-[#0C0C0C]/20 p-3 bg-[#0C0C0C] text-white flex flex-col items-center justify-between text-center min-h-[140px]">
                <div className="font-mono text-[9px] font-bold text-[#D6A64B] uppercase mb-2">
                  2. Top Header & Favicon
                </div>
                <div className="h-16 w-full flex items-center justify-center p-1 bg-[#1A1A1A] border border-[#333]">
                  <img
                    src={branding.markUrl}
                    alt="Header Mark"
                    className="h-10 w-10 object-contain"
                  />
                </div>
                <div className="font-mono text-[8px] text-[#C5B89A] mt-2 truncate w-full">
                  Compact square mark
                </div>
              </div>

              {/* Print Watermark Preview */}
              <div className="border border-[#0C0C0C]/20 p-3 bg-white flex flex-col items-center justify-between text-center min-h-[140px]">
                <div className="font-mono text-[9px] font-bold text-[#0C0C0C] uppercase mb-2">
                  3. Print Watermark (10%)
                </div>
                <div className="h-16 w-full flex items-center justify-center p-1 bg-white border border-[#0C0C0C]/10 relative overflow-hidden">
                  <span className="font-mono text-[8px] text-[#999] absolute top-1 left-1">A4 PAGE CONTENT</span>
                  <img
                    src={branding.watermarkUrl}
                    alt="Print Watermark"
                    className="max-h-14 max-w-full object-contain opacity-10 filter grayscale"
                  />
                </div>
                <div className="font-mono text-[8px] text-[#6d6658] mt-2 truncate w-full">
                  Subtle print background
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Supplied Brandex Logo Variants */}
          <div className="border-2 border-[#0C0C0C] bg-white p-4 shadow-[2px_2px_0_#0C0C0C]">
            <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#6C1C1F] mb-3">
              SUPPLIED BRANDEX LOGO STYLES (1-CLICK SWITCH)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {PRESET_VARIANTS.map((preset) => {
                const isActive = branding.logoUrl === preset.logoUrl;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleApplyPreset(preset)}
                    disabled={!isAdmin || saving}
                    className={`text-left p-3 border-2 transition-all flex flex-col justify-between ${
                      isActive
                        ? "border-[#6C1C1F] bg-[#FFF0D0] shadow-[3px_3px_0_#6C1C1F]"
                        : "border-[#0C0C0C]/30 bg-[#FFF9F0] hover:border-[#0C0C0C] hover:bg-white"
                    } ${!isAdmin ? "opacity-75 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <div className="h-14 w-full flex items-center justify-center bg-white/90 border border-[#0C0C0C]/10 p-1 mb-2">
                      <img
                        src={preset.previewUrl}
                        alt={preset.name}
                        className="max-h-12 max-w-full object-contain"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-serif text-sm font-bold uppercase text-[#0C0C0C]">
                          {preset.name}
                        </span>
                        {isActive && <Check className="w-4 h-4 text-[#6C1C1F]" />}
                      </div>
                      <p className="font-mono text-[8px] text-[#6d6658] mt-0.5">
                        {preset.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Custom File Upload (Admin Only) */}
          {isAdmin && (
            <div className="border-2 border-[#0C0C0C] bg-white p-4 shadow-[2px_2px_0_#0C0C0C] space-y-4">
              <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#6C1C1F] flex items-center justify-between">
                <span>UPLOAD CUSTOM LOGO FILE (PNG, JPG, JPEG, SVG)</span>
                <span className="text-[#6d6658]">Max: 5MB</span>
              </div>

              {/* Target slot selector */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[10px] uppercase font-bold text-[#0C0C0C]">Apply to:</span>
                {(["logo", "mark", "watermark"] as const).map((slot) => (
                  <button
                    key={slot}
                    onClick={() => setTargetSlot(slot)}
                    className={`px-3 py-1 font-mono text-[10px] uppercase font-bold border-2 transition-all ${
                      targetSlot === slot
                        ? "bg-[#6C1C1F] text-white border-[#6C1C1F]"
                        : "bg-[#FFF9F0] text-[#0C0C0C] border-[#0C0C0C]/30 hover:border-[#0C0C0C]"
                    }`}
                  >
                    {slot === "logo" ? "Main Logo" : slot === "mark" ? "Header Mark / Favicon" : "Print Watermark"}
                  </button>
                ))}
              </div>

              {/* File Input & Drop Area */}
              <div className="border-2 border-dashed border-[#0C0C0C]/40 p-5 bg-[#FFF9F0] text-center space-y-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
                  className="hidden"
                />

                {filePreview ? (
                  <div className="space-y-3">
                    <div className="h-24 w-full flex items-center justify-center p-2 bg-white border border-[#0C0C0C]/20">
                      <img
                        src={filePreview}
                        alt="Upload Preview"
                        className="max-h-20 max-w-full object-contain"
                      />
                    </div>
                    <div className="font-mono text-[10px] text-[#0C0C0C]">
                      Selected: <strong>{selectedFile?.name}</strong> ({(selectedFile!.size / 1024).toFixed(0)} KB)
                    </div>
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 border border-[#0C0C0C] bg-white font-mono text-[10px] font-bold uppercase hover:bg-[#E8DFC7]"
                      >
                        Change File
                      </button>
                      <button
                        onClick={handleUploadAndSave}
                        disabled={saving}
                        className="px-4 py-1.5 bg-[#0A6B52] text-white border-2 border-[#0A6B52] font-mono text-[10px] font-bold uppercase hover:brightness-110 flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {saving ? "SAVING..." : `UPLOAD & SET AS ${targetSlot.toUpperCase()}`}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="cursor-pointer space-y-2 py-4"
                  >
                    <div className="w-10 h-10 mx-auto rounded-full bg-[#E8DFC7] flex items-center justify-center text-[#6C1C1F]">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div className="font-mono text-xs font-bold text-[#0C0C0C] uppercase">
                      Click to choose logo file
                    </div>
                    <p className="font-mono text-[9px] text-[#6d6658]">
                      Supports PNG, JPG, JPEG, and sanitized vector SVG up to 5MB
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-[#E8DFC7] border-t-2 border-[#0C0C0C] flex items-center justify-between shrink-0">
          <div>
            {isAdmin && (
              <button
                onClick={handleResetDefaults}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 border-2 border-[#0C0C0C] bg-white font-mono text-[10px] font-bold uppercase text-[#CC0000] hover:bg-[#CC0000] hover:text-white transition-colors disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" /> RESET TO BRANDEX DEFAULTS
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-5 py-1.5 bg-[#0C0C0C] text-white font-mono text-xs font-bold uppercase hover:bg-[#333] transition-colors"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
