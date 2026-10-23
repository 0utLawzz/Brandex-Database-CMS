import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableKey = import.meta.env
  .VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabasePublishableKey &&
    !supabaseUrl.includes("YOUR_PROJECT_REF") &&
    !supabasePublishableKey.includes("YOUR_PUBLISHABLE_KEY"),
);

export const supabase = createClient(
  supabaseUrl || "https://invalid.supabase.co",
  supabasePublishableKey || "not-configured",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);

export const TRADEMARK_FILES_BUCKET = "trademark-files";
