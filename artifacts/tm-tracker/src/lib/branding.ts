import { supabase, TRADEMARK_FILES_BUCKET } from "./supabase";
import { getStaffRole } from "./registryImport";

export interface BrandingConfig {
  logoUrl: string;
  markUrl: string;
  bannerUrl: string;
  faviconUrl: string;
  watermarkUrl: string;
  customLogoUrl?: string | null;
  customMarkUrl?: string | null;
  customWatermarkUrl?: string | null;
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_BRANDING: BrandingConfig = {
  logoUrl: "/brandex-wordmark.svg",
  markUrl: "/brandex-mark.svg",
  bannerUrl: "/brandex-banner.png",
  faviconUrl: "/brandex-mark.svg",
  watermarkUrl: "/brandex-wordmark.svg",
  customLogoUrl: null,
  customMarkUrl: null,
  customWatermarkUrl: null,
};

export const MAX_LOGO_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const ALLOWED_LOGO_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/svg+xml",
];

const LOCAL_STORAGE_KEY = "brandex_branding_config";

/**
 * Validates file size and format for logo uploads.
 */
export function validateLogoFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: "No file selected." };
  }

  // Type validation
  const isValidType =
    ALLOWED_LOGO_MIME_TYPES.includes(file.type) ||
    /\.(png|jpe?g|svg)$/i.test(file.name);

  if (!isValidType) {
    return {
      valid: false,
      error: "Unsupported file format. Please upload PNG, JPG, JPEG, or SVG.",
    };
  }

  // Size validation
  if (file.size > MAX_LOGO_FILE_SIZE) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size (${sizeMb}MB) exceeds the 5MB limit. Please upload a smaller image.`,
    };
  }

  return { valid: true };
}

/**
 * Basic security sanitization for SVG files to prevent script execution.
 */
export function sanitizeSvg(svgContent: string): { safe: boolean; error?: string; sanitized?: string } {
  if (!svgContent || typeof svgContent !== "string") {
    return { safe: false, error: "Invalid SVG content." };
  }

  // Check for malicious patterns
  const dangerousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // onerror, onload, onclick, etc.
    /<foreignObject\b/gi,
    /data:\s*text\/html/gi,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(svgContent)) {
      return {
        safe: false,
        error: "Security check failed: SVG contains executable scripts or prohibited elements.",
      };
    }
  }

  // Check for basic SVG structure
  if (!/<svg\b/i.test(svgContent) || !/<\/svg>/i.test(svgContent)) {
    return { safe: false, error: "Malformed SVG: Missing <svg> root element." };
  }

  return { safe: true, sanitized: svgContent };
}

/**
 * Fetches current branding configuration from Supabase app_settings table.
 * Falls back to localStorage and DEFAULT_BRANDING.
 */
export async function getBrandingConfig(): Promise<BrandingConfig> {
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value, updated_at")
      .eq("key", "branding")
      .maybeSingle();

    if (!error && data && data.value) {
      const val = data.value as Partial<BrandingConfig>;
      const config: BrandingConfig = {
        logoUrl: val.customLogoUrl || val.logoUrl || DEFAULT_BRANDING.logoUrl,
        markUrl: val.customMarkUrl || val.markUrl || DEFAULT_BRANDING.markUrl,
        bannerUrl: val.bannerUrl || DEFAULT_BRANDING.bannerUrl,
        faviconUrl: val.customMarkUrl || val.faviconUrl || DEFAULT_BRANDING.faviconUrl,
        watermarkUrl: val.customWatermarkUrl || val.customLogoUrl || val.watermarkUrl || DEFAULT_BRANDING.watermarkUrl,
        customLogoUrl: val.customLogoUrl ?? null,
        customMarkUrl: val.customMarkUrl ?? null,
        customWatermarkUrl: val.customWatermarkUrl ?? null,
        updatedAt: data.updated_at,
      };
      // Cache to local storage
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
      } catch {
        // Ignore localStorage write failures
      }
      return config;
    }
  } catch (err) {
    console.warn("Could not load branding settings from Supabase, checking local cache", err);
  }

  // Check localStorage cache
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      return { ...DEFAULT_BRANDING, ...parsed };
    }
  } catch {
    // Ignore parse errors
  }

  return { ...DEFAULT_BRANDING };
}

/**
 * Updates branding configuration in Supabase and local cache.
 * Strictly gated: Only Admin can update branding.
 */
export async function updateBrandingConfig(
  newConfig: Partial<BrandingConfig>
): Promise<BrandingConfig> {
  const role = await getStaffRole();
  if (role !== "admin") {
    throw new Error("Permission denied: Only administrators can update branding configuration.");
  }

  const current = await getBrandingConfig();
  const merged: BrandingConfig = {
    ...current,
    ...newConfig,
    logoUrl: newConfig.customLogoUrl || newConfig.logoUrl || current.logoUrl,
    markUrl: newConfig.customMarkUrl || newConfig.markUrl || current.markUrl,
    watermarkUrl: newConfig.customWatermarkUrl || newConfig.customLogoUrl || newConfig.watermarkUrl || current.watermarkUrl,
    faviconUrl: newConfig.customMarkUrl || newConfig.faviconUrl || current.faviconUrl,
  };

  const { data: auth } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("app_settings")
    .upsert({
      key: "branding",
      value: {
        logo_url: merged.logoUrl,
        mark_url: merged.markUrl,
        banner_url: merged.bannerUrl,
        favicon_url: merged.faviconUrl,
        watermark_url: merged.watermarkUrl,
        custom_logo_url: merged.customLogoUrl,
        custom_mark_url: merged.customMarkUrl,
        custom_watermark_url: merged.customWatermarkUrl,
      },
      updated_at: new Date().toISOString(),
      updated_by: auth?.user?.id ?? null,
    }, { onConflict: "key" });

  if (error) {
    console.warn("Supabase upsert failed, updating local storage only:", error.message);
  }

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // Ignore localStorage write failures
  }

  // Also apply favicon dynamically
  applyFavicon(merged.faviconUrl);

  return merged;
}

/**
 * Uploads a branding asset (logo, mark, watermark) to private storage bucket.
 * Strictly gated: Only Admin can upload branding assets.
 */
export async function uploadBrandingAsset(
  file: File,
  assetType: "logo" | "mark" | "watermark" = "logo"
): Promise<string> {
  const role = await getStaffRole();
  if (role !== "admin") {
    throw new Error("Permission denied: Only administrators can upload branding assets.");
  }

  const validation = validateLogoFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || "Invalid file.");
  }

  if (file.type === "image/svg+xml" || file.name.endsWith(".svg")) {
    const text = await file.text();
    const svgCheck = sanitizeSvg(text);
    if (!svgCheck.safe) {
      throw new Error(svgCheck.error || "SVG failed security checks.");
    }
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const storagePath = `branding/${assetType}_${Date.now()}.${ext}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(TRADEMARK_FILES_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.warn("Storage upload failed, attempting fallback URL conversion", uploadError.message);
    // Return base64/data URL fallback for local demonstration if storage is unreachable
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read file as fallback URL"));
      reader.readAsDataURL(file);
    });
  }

  // Create a 1-year signed URL or public URL
  const { data: signedData, error: signError } = await supabase.storage
    .from(TRADEMARK_FILES_BUCKET)
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365); // 1 year

  if (signError || !signedData?.signedUrl) {
    // Try public url
    const { data: pubData } = supabase.storage
      .from(TRADEMARK_FILES_BUCKET)
      .getPublicUrl(storagePath);
    return pubData.publicUrl;
  }

  return signedData.signedUrl;
}

/**
 * Resets branding back to default Brandex identity.
 */
export async function resetBrandingConfig(): Promise<BrandingConfig> {
  const role = await getStaffRole();
  if (role !== "admin") {
    throw new Error("Permission denied: Only administrators can reset branding configuration.");
  }

  const resetConfig: BrandingConfig = {
    ...DEFAULT_BRANDING,
  };

  await supabase
    .from("app_settings")
    .upsert({
      key: "branding",
      value: {
        logo_url: DEFAULT_BRANDING.logoUrl,
        mark_url: DEFAULT_BRANDING.markUrl,
        banner_url: DEFAULT_BRANDING.bannerUrl,
        favicon_url: DEFAULT_BRANDING.faviconUrl,
        watermark_url: DEFAULT_BRANDING.watermarkUrl,
        custom_logo_url: null,
        custom_mark_url: null,
        custom_watermark_url: null,
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: "key" });

  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch {
    // Ignore
  }

  applyFavicon(DEFAULT_BRANDING.faviconUrl);

  return resetConfig;
}

/**
 * Dynamically updates the browser favicon links in document.head.
 */
export function applyFavicon(faviconUrl: string): void {
  if (typeof document === "undefined" || !faviconUrl) return;

  try {
    let iconLink = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!iconLink) {
      iconLink = document.createElement("link");
      iconLink.rel = "icon";
      document.head.appendChild(iconLink);
    }
    iconLink.href = faviconUrl;
    if (faviconUrl.endsWith(".svg")) {
      iconLink.type = "image/svg+xml";
    } else if (faviconUrl.endsWith(".png")) {
      iconLink.type = "image/png";
    }

    let appleLink = document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']");
    if (appleLink) {
      appleLink.href = faviconUrl;
    }
  } catch {
    // Ignore DOM errors
  }
}
