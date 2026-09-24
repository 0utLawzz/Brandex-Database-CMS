import React, { createContext, useContext, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BrandingConfig,
  DEFAULT_BRANDING,
  getBrandingConfig,
  updateBrandingConfig,
  uploadBrandingAsset,
  resetBrandingConfig,
  applyFavicon,
} from "@/lib/branding";

interface BrandingContextType {
  branding: BrandingConfig;
  isLoading: boolean;
  isCustom: boolean;
  updateBranding: (newConfig: Partial<BrandingConfig>) => Promise<BrandingConfig>;
  uploadAsset: (file: File, assetType?: "logo" | "mark" | "watermark") => Promise<string>;
  resetBranding: () => Promise<BrandingConfig>;
}

const BrandingContext = createContext<BrandingContextType>({
  branding: DEFAULT_BRANDING,
  isLoading: false,
  isCustom: false,
  updateBranding: async () => DEFAULT_BRANDING,
  uploadAsset: async () => "",
  resetBranding: async () => DEFAULT_BRANDING,
});

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  const { data: branding = DEFAULT_BRANDING, isLoading } = useQuery<BrandingConfig>({
    queryKey: ["branding-config"],
    queryFn: getBrandingConfig,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (branding.faviconUrl) {
      applyFavicon(branding.faviconUrl);
    }
  }, [branding.faviconUrl]);

  const updateMutation = useMutation({
    mutationFn: updateBrandingConfig,
    onSuccess: (updated) => {
      queryClient.setQueryData(["branding-config"], updated);
    },
  });

  const resetMutation = useMutation({
    mutationFn: resetBrandingConfig,
    onSuccess: (reset) => {
      queryClient.setQueryData(["branding-config"], reset);
    },
  });

  const isCustom = Boolean(
    branding.customLogoUrl || branding.customMarkUrl || branding.customWatermarkUrl
  );

  const value: BrandingContextType = {
    branding,
    isLoading,
    isCustom,
    updateBranding: updateMutation.mutateAsync,
    uploadAsset: uploadBrandingAsset,
    resetBranding: resetMutation.mutateAsync,
  };

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding(): BrandingContextType {
  const context = useContext(BrandingContext);
  if (!context) {
    return {
      branding: DEFAULT_BRANDING,
      isLoading: false,
      isCustom: false,
      updateBranding: async () => DEFAULT_BRANDING,
      uploadAsset: async () => "",
      resetBranding: async () => DEFAULT_BRANDING,
    };
  }
  return context;
}
