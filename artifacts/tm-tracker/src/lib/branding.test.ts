import { supabase } from "./supabase";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateLogoFile,
  sanitizeSvg,
  getBrandingConfig,
  updateBrandingConfig,
  uploadBrandingAsset,
  resetBrandingConfig,
  DEFAULT_BRANDING,
  MAX_LOGO_FILE_SIZE,
} from "./branding";

// Mock supabase and registryImport
vi.mock("./supabase", () => {
  return {
    isSupabaseConfigured: true,
    TRADEMARK_FILES_BUCKET: "trademark-files",
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          })),
        })),
        upsert: vi.fn().mockResolvedValue({ error: null }),
      })),
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "admin-user-id" } },
        }),
      },
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn().mockResolvedValue({ data: { path: "branding/logo.png" }, error: null }),
          createSignedUrl: vi.fn().mockResolvedValue({
            data: { signedUrl: "https://example.com/branding/logo.png" },
            error: null,
          }),
          getPublicUrl: vi.fn().mockReturnValue({
            data: { publicUrl: "https://example.com/branding/logo.png" },
          }),
        })),
      },
    },
  };
});

let mockStaffRole: "admin" | "editor" | "viewer" | null = "admin";

const storageMap = new Map<string, string>();
const localStorageMock = {
  getItem: vi.fn((key: string) => storageMap.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => { storageMap.set(key, String(value)); }),
  removeItem: vi.fn((key: string) => { storageMap.delete(key); }),
  clear: vi.fn(() => { storageMap.clear(); }),
  get length() { return storageMap.size; },
  key: vi.fn((index: number) => Array.from(storageMap.keys())[index] ?? null),
};

if (typeof globalThis.localStorage === "undefined") {
  Object.defineProperty(globalThis, "localStorage", {
    value: localStorageMock,
    writable: true,
  });
}

vi.mock("./registryImport", () => {
  return {
    getStaffRole: vi.fn(async () => mockStaffRole),
  };
});

describe("Batch 6B: Branding & Logo System", () => {
  beforeEach(() => {
    mockStaffRole = "admin";
    vi.clearAllMocks();
    storageMap.clear();
  });

  describe("A. File Validation (validateLogoFile)", () => {
    it("accepts valid PNG files", () => {
      const file = new File(["dummy content"], "logo.png", { type: "image/png" });
      const result = validateLogoFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("accepts valid JPG and JPEG files", () => {
      const jpg = new File(["dummy content"], "photo.jpg", { type: "image/jpeg" });
      const jpeg = new File(["dummy content"], "photo.jpeg", { type: "image/jpeg" });
      expect(validateLogoFile(jpg).valid).toBe(true);
      expect(validateLogoFile(jpeg).valid).toBe(true);
    });

    it("accepts valid SVG files", () => {
      const svg = new File(["<svg></svg>"], "vector.svg", { type: "image/svg+xml" });
      expect(validateLogoFile(svg).valid).toBe(true);
    });

    it("rejects unsupported file formats (e.g. PDF, GIF, EXE, TXT)", () => {
      const pdf = new File(["%PDF"], "doc.pdf", { type: "application/pdf" });
      const gif = new File(["GIF89a"], "anim.gif", { type: "image/gif" });
      const exe = new File(["MZ"], "app.exe", { type: "application/x-msdownload" });
      const txt = new File(["hello"], "note.txt", { type: "text/plain" });

      expect(validateLogoFile(pdf).valid).toBe(false);
      expect(validateLogoFile(pdf).error).toContain("Unsupported file format");
      expect(validateLogoFile(gif).valid).toBe(false);
      expect(validateLogoFile(exe).valid).toBe(false);
      expect(validateLogoFile(txt).valid).toBe(false);
    });

    it("rejects files exceeding 5MB size limit", () => {
      // Create a mock large file
      const largeFile = new File([new ArrayBuffer(MAX_LOGO_FILE_SIZE + 1024)], "large-logo.png", {
        type: "image/png",
      });
      const result = validateLogoFile(largeFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceeds the 5MB limit");
    });

    it("handles null or undefined file safely", () => {
      // @ts-expect-error test undefined
      const result = validateLogoFile(undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("No file selected");
    });
  });

  describe("B. SVG Security Sanitization (sanitizeSvg)", () => {
    it("accepts clean SVG content", () => {
      const cleanSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="red"/></svg>`;
      const result = sanitizeSvg(cleanSvg);
      expect(result.safe).toBe(true);
      expect(result.sanitized).toBe(cleanSvg);
    });

    it("rejects SVG with embedded <script> tags", () => {
      const scriptSvg = `<svg><script>alert('xss')</script><circle cx="10" cy="10" r="5"/></svg>`;
      const result = sanitizeSvg(scriptSvg);
      expect(result.safe).toBe(false);
      expect(result.error).toContain("executable scripts");
    });

    it("rejects SVG with javascript: URI schemes", () => {
      const jsSvg = `<svg><a href="javascript:alert(1)"><text>Click</text></a></svg>`;
      const result = sanitizeSvg(jsSvg);
      expect(result.safe).toBe(false);
      expect(result.error).toContain("executable scripts");
    });

    it("rejects SVG with inline event handlers (onload, onerror)", () => {
      const eventSvg = `<svg onload="alert(1)"><rect width="10" height="10"/></svg>`;
      const result = sanitizeSvg(eventSvg);
      expect(result.safe).toBe(false);
      expect(result.error).toContain("executable scripts");
    });

    it("rejects SVG with <foreignObject>", () => {
      const foSvg = `<svg><foreignObject width="100" height="100"><body xmlns="http://www.w3.org/1999/xhtml"><script>alert(1)</script></body></foreignObject></svg>`;
      const result = sanitizeSvg(foSvg);
      expect(result.safe).toBe(false);
      expect(result.error).toContain("executable scripts");
    });

    it("rejects malformed SVG without root tags", () => {
      const notSvg = `<div>This is not an SVG</div>`;
      const result = sanitizeSvg(notSvg);
      expect(result.safe).toBe(false);
      expect(result.error).toContain("Missing <svg> root element");
    });
  });

  describe("C. Branding Configuration & Defaults", () => {
    it("provides complete DEFAULT_BRANDING constants", () => {
      expect(DEFAULT_BRANDING.logoUrl).toBe("/brandex-wordmark.svg");
      expect(DEFAULT_BRANDING.markUrl).toBe("/brandex-mark.svg");
      expect(DEFAULT_BRANDING.bannerUrl).toBe("/brandex-banner.png");
      expect(DEFAULT_BRANDING.faviconUrl).toBe("/brandex-mark.svg");
      expect(DEFAULT_BRANDING.watermarkUrl).toBe("/brandex-wordmark.svg");
    });

    it("getBrandingConfig returns default branding when no custom settings are stored", async () => {
      const config = await getBrandingConfig();
      expect(config.logoUrl).toBe(DEFAULT_BRANDING.logoUrl);
      expect(config.markUrl).toBe(DEFAULT_BRANDING.markUrl);
      expect(config.watermarkUrl).toBe(DEFAULT_BRANDING.watermarkUrl);
    });
  });

  describe("D. Role Gating & Permissions", () => {
    it("allows Admin to update branding configuration", async () => {
      mockStaffRole = "admin";
      const updated = await updateBrandingConfig({
        customLogoUrl: "/custom-logo.png",
      });
      expect(updated.logoUrl).toBe("/custom-logo.png");
    });

    it("rejects Viewer role from updating branding configuration", async () => {
      mockStaffRole = "viewer";
      await expect(
        updateBrandingConfig({ customLogoUrl: "/hacked.png" })
      ).rejects.toThrow("Permission denied: Only administrators can update branding configuration.");
    });

    it("rejects Editor role from updating branding configuration", async () => {
      mockStaffRole = "editor";
      await expect(
        updateBrandingConfig({ customLogoUrl: "/hacked.png" })
      ).rejects.toThrow("Permission denied: Only administrators can update branding configuration.");
    });

    it("allows Admin to reset branding to default", async () => {
      mockStaffRole = "admin";
      const reset = await resetBrandingConfig();
      expect(reset.logoUrl).toBe(DEFAULT_BRANDING.logoUrl);
      expect(reset.customLogoUrl).toBeNull();
    });

    it("rejects Viewer from resetting branding", async () => {
      mockStaffRole = "viewer";
      await expect(resetBrandingConfig()).rejects.toThrow(
        "Permission denied: Only administrators can reset branding configuration."
      );
    });

    it("rejects Viewer from uploading branding assets", async () => {
      mockStaffRole = "viewer";
      const file = new File(["content"], "logo.png", { type: "image/png" });
      await expect(uploadBrandingAsset(file)).rejects.toThrow(
        "Permission denied: Only administrators can upload branding assets."
      );
    });
  });
});


describe("Shared branding persistence", () => {
  beforeEach(() => { mockStaffRole = "admin"; });
  it("reads the snake-case settings written by the migration", async () => {
    vi.mocked(supabase.from).mockReturnValueOnce({select:()=>({eq:()=>({maybeSingle:async()=>({data:{value:{custom_logo_url:"/saved-logo.svg"}},error:null})})})} as any);
    expect((await getBrandingConfig()).logoUrl).toBe("/saved-logo.svg");
  });
  it("reports failed shared save instead of silently succeeding locally", async () => {
    vi.mocked(supabase.from).mockReturnValueOnce({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})})} as any)
      .mockReturnValueOnce({upsert:async()=>({error:{message:"Database unavailable"}})} as any);
    await expect(updateBrandingConfig({customLogoUrl:"/test.svg"})).rejects.toThrow("Database unavailable");
  });
  it("stores a stable private storage reference", async () => {
    const result = await uploadBrandingAsset(new File(["image"],"logo.png",{type:"image/png"}));
    expect(result).toMatch(/^storage:branding\/logo_\d+\.png$/);
    expect(result).not.toContain("token=");
  });
  it("reports upload failure rather than saving a local data URL", async () => {
    vi.mocked(supabase.storage.from).mockReturnValueOnce({upload:async()=>({error:{message:"Upload denied"}})} as any);
    await expect(uploadBrandingAsset(new File(["image"],"logo.png",{type:"image/png"}))).rejects.toThrow("Upload denied");
  });
});
