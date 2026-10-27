import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type LedgerStageStatus = {
  amount_due?: number;
  amount_received?: number;
  outstanding?: number;
  paid?: boolean;
  paid_date?: string | null;
  entry_id?: string | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeTm(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  return digits.length === 6 ? digits : null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ledgerUrl = Deno.env.get("LEDGER_PAYMENT_STATUS_URL");
  const integrationSecret = Deno.env.get("LEDGER_CMS_INTEGRATION_SECRET");
  if (!supabaseUrl || !serviceRoleKey || !ledgerUrl || !integrationSecret) {
    return json({ error: "Ledger payment integration is not configured" }, 503);
  }

  const bearer = request.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer) return json({ error: "Sign in is required" }, 401);

  const cms = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await cms.auth.getUser(bearer);
  if (authError || !authData.user) return json({ error: "Sign in is required" }, 401);

  const { data: profile, error: profileError } = await cms
    .from("profiles")
    .select("role")
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (profileError) return json({ error: "Could not verify staff access" }, 500);
  if (!profile || !["admin", "viewer"].includes(profile.role)) {
    return json({ error: "Staff access is required" }, 403);
  }

  let input: { tm_digits?: unknown };
  try {
    input = await request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  if (!Array.isArray(input.tm_digits) || input.tm_digits.length < 1 || input.tm_digits.length > 50) {
    return json({ error: "Provide between 1 and 50 TM numbers" }, 400);
  }
  const tmNumbers = [...new Set(input.tm_digits.map(normalizeTm))];
  if (tmNumbers.includes(null)) return json({ error: "Each TM number must contain exactly six digits" }, 400);
  const normalizedNumbers = tmNumbers as string[];

  const ledgerResponse = await fetch(ledgerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-brandex-ledger-integration-secret": integrationSecret,
    },
    body: JSON.stringify({ tm_digits: normalizedNumbers }),
  });
  const ledgerBody = await ledgerResponse.json().catch(() => null) as
    | { payments?: Record<string, Record<string, LedgerStageStatus>>; error?: string }
    | null;
  if (!ledgerResponse.ok || !ledgerBody?.payments) {
    console.error("Ledger payment status request failed", { status: ledgerResponse.status });
    return json({ error: "Could not verify payments with Brandex Client Ledger" }, 502);
  }

  const { data: cases, error: caseError } = await cms
    .from("trademarks")
    .select("id,tm_cpr_number_norm,stage1_paid,stage1_paid_date,stage2_paid,stage2_paid_date,stage3_paid,stage3_paid_date,stage4_paid,stage4_paid_date")
    .in("tm_cpr_number_norm", normalizedNumbers);
  if (caseError) return json({ error: "Could not match Ledger payments to CMS cases" }, 500);

  let synced = 0;
  for (const caseRecord of cases ?? []) {
    const tm = caseRecord.tm_cpr_number_norm;
    if (!tm) continue;
    const payment = ledgerBody.payments[tm] ?? {};
    const patch: Record<string, boolean | string | null> = {};
    for (const stage of [1, 2, 3, 4] as const) {
      const status = payment[`S${stage}`] ?? {};
      const amountDue = Number(status.amount_due ?? 0);
      const amountReceived = Number(status.amount_received ?? 0);
      // A receipt against a zero-charge stage is not proof that the stage fee cleared.
      const paid = amountDue > 0 && amountReceived >= amountDue;
      const paidDate = paid ? status.paid_date ?? null : null;
      if (caseRecord[`stage${stage}_paid`] !== paid) patch[`stage${stage}_paid`] = paid;
      if (caseRecord[`stage${stage}_paid_date`] !== paidDate) patch[`stage${stage}_paid_date`] = paidDate;
    }
    if (Object.keys(patch).length) {
      const { error } = await cms.from("trademarks").update(patch).eq("id", caseRecord.id);
      if (error) {
        console.error("Ledger payment cache sync failed", { caseId: caseRecord.id, error: error.message });
        return json({ error: "Ledger status was read, but the CMS workflow cache could not be updated" }, 500);
      }
      synced += 1;
    }
  }

  return json({ payments: ledgerBody.payments, synced });
});
