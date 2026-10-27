import { supabase } from "@/lib/supabase";

export type LedgerStagePayment = {
  amount_due: number;
  amount_received: number;
  outstanding: number;
  paid: boolean;
  paid_date: string | null;
  entry_id: string | null;
  receipt_no?: string | null;
  payment_method?: string | null;
  bank_name?: string | null;
  cheque_no?: string | null;
};

export type ClientLedgerEntry = {
  id: string;
  trademark_id: string;
  entry_date: string;
  entry_type: "charge" | "receiving";
  stage: "S1" | "S2" | "S3" | "S4";
  amount_due: number;
  amount_received: number;
  payment_method: string | null;
  bank_name: string | null;
  cheque_no: string | null;
  receipt_no: string | null;
  details: string | null;
  notes: string | null;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
  created_by?: string | null;
};

export type LedgerPaymentsByTm = Record<string, Partial<Record<"S1" | "S2" | "S3" | "S4", LedgerStagePayment>>>;

export function normalizeTmDigits(value: string | null | undefined): string | null {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits.length === 6 ? digits : null;
}

/**
 * Fetch stage payment summaries. First attempts direct querying from the unified
 * client_ledger_entries table in the same database. If not yet migrated, falls back
 * to the Edge Function bridge.
 */
export async function getLedgerStagePayments(tmNumbers: Array<string | null | undefined>): Promise<LedgerPaymentsByTm> {
  const normalized = [...new Set(tmNumbers.map(normalizeTmDigits).filter((value): value is string => value !== null))];
  if (normalized.length === 0) return {};
  // Financial status must come only from ledger entries. Fail closed if unavailable.
  const { data: cases, error: casesError } = await supabase.from("trademarks").select("id, tm_cpr_number_norm").in("tm_cpr_number_norm", normalized);
  if (casesError) throw new Error(`Unable to verify ledger status: ${casesError.message}`);
  const result: LedgerPaymentsByTm = Object.fromEntries(normalized.map((tm) => [tm, {}]));
  if (!cases?.length) return result;
  const { data: entries, error: entriesError } = await supabase.from("client_ledger_entries").select("*").in("trademark_id", cases.map((c) => c.id)).is("voided_at", null);
  if (entriesError) throw new Error(`Unable to verify ledger entries: ${entriesError.message}`);
  const byCase = new Map<string, ClientLedgerEntry[]>();
  for (const entry of (entries ?? []) as ClientLedgerEntry[]) { const list = byCase.get(entry.trademark_id) ?? []; list.push(entry); byCase.set(entry.trademark_id, list); }
  for (const record of cases) {
    const tm = record.tm_cpr_number_norm; if (!tm) continue;
    const caseEntries = byCase.get(record.id) ?? [];
    const stageMap: Partial<Record<"S1" | "S2" | "S3" | "S4", LedgerStagePayment>> = {};
    for (const stage of ["S1", "S2", "S3", "S4"] as const) {
      const rows = caseEntries.filter((entry) => entry.stage === stage);
      const due = rows.reduce((sum, entry) => sum + Number(entry.amount_due || 0), 0);
      const received = rows.reduce((sum, entry) => sum + Number(entry.amount_received || 0), 0);
      const last = rows.filter((entry) => entry.entry_type === "receiving" && Number(entry.amount_received || 0) > 0).sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime())[0];
      const paid = due > 0 && received >= due;
      stageMap[stage] = { amount_due: due, amount_received: received, outstanding: Math.max(0, due - received), paid, paid_date: paid ? (last?.entry_date ?? null) : null, entry_id: last?.id ?? null, receipt_no: last?.receipt_no ?? null, payment_method: last?.payment_method ?? null, bank_name: last?.bank_name ?? null, cheque_no: last?.cheque_no ?? null };
    }
    result[tm] = stageMap;
  }
  return result;
}
export async function refreshLedgerPaymentsForCase(
  caseId: string,
  tmNumber?: string | null
): Promise<Partial<Record<"S1" | "S2" | "S3" | "S4", LedgerStagePayment>>> {
  let tm = normalizeTmDigits(tmNumber);
  if (!tm) {
    const { data } = await supabase.from("trademarks").select("tm_cpr_number").eq("id", caseId).single();
    tm = normalizeTmDigits(data?.tm_cpr_number);
  }
  if (!tm) {
    // If no 6-digit TM yet, query entries by trademark_id directly
    const { data: entries } = await supabase
      .from("client_ledger_entries")
      .select("*")
      .eq("trademark_id", caseId)
      .is("voided_at", null);

    if (entries) {
      const stageMap: Partial<Record<"S1" | "S2" | "S3" | "S4", LedgerStagePayment>> = {};
      for (const s of ["S1", "S2", "S3", "S4"] as const) {
        const sEntries = entries.filter((e) => e.stage === s);
        const due = sEntries.reduce((sum, e) => sum + Number(e.amount_due || 0), 0);
        const rec = sEntries.reduce((sum, e) => sum + Number(e.amount_received || 0), 0);
        const lastRec = sEntries
          .filter((e) => e.entry_type === "receiving" && Number(e.amount_received || 0) > 0)
          .sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime())[0];
        stageMap[s] = {
          amount_due: due,
          amount_received: rec,
          outstanding: Math.max(0, due - rec),
          paid: due > 0 && rec >= due,
          paid_date: lastRec?.entry_date ?? null,
          entry_id: lastRec?.id ?? null,
        };
      }
      return stageMap;
    }
    return {};
  }
  const payments = await getLedgerStagePayments([tm]);
  return payments[tm] ?? {};
}

/**
 * Fetch all client ledger entries (charges, receipts) for a specific trademark.
 */
export async function getClientLedgerEntries(trademarkId: string): Promise<ClientLedgerEntry[]> {
  const { data, error } = await supabase
    .from("client_ledger_entries")
    .select("*")
    .eq("trademark_id", trademarkId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    // Return empty list if table not created yet
    return [];
  }
  return (data as ClientLedgerEntry[]) ?? [];
}

export type RecordReceiptParams = {
  trademarkId: string;
  stage: "S1" | "S2" | "S3" | "S4";
  amount: number;
  entryDate?: string;
  paymentMethod?: "cash" | "bank_transfer" | "cheque" | "online" | "other";
  bankName?: string;
  chequeNo?: string;
  receiptNo?: string;
  details?: string;
  notes?: string;
};

/**
 * Record a client receipt directly in the unified database.
 * Calls the secure RPC function or inserts directly, updating the workflow cache in real-time.
 */
export async function recordClientReceipt(params: RecordReceiptParams) {
  // Try RPC first
  const { data: rpcData, error: rpcError } = await supabase.rpc("record_client_receipt", {
    p_trademark_id: params.trademarkId,
    p_stage: params.stage,
    p_amount: params.amount,
    p_entry_date: params.entryDate || new Date().toISOString().slice(0, 10),
    p_payment_method: params.paymentMethod || "cash",
    p_bank_name: params.bankName || null,
    p_cheque_no: params.chequeNo || null,
    p_receipt_no: null,
    p_details: params.details || null,
    p_notes: params.notes || null,
  });

  if (!rpcError) {
    return rpcData;
  }

  if (rpcError) throw new Error(`Receipt was not recorded by the authoritative ledger: ${rpcError.message}`);
  return rpcData;
}

/**
 * Soft-void an existing client receipt with an audit reason.
 */
export async function voidClientReceipt(entryId: string, reason: string) {
  const { data: rpcData, error: rpcError } = await supabase.rpc("void_client_receipt", {
    p_entry_id: entryId,
    p_reason: reason,
  });

  if (!rpcError) {
    return rpcData;
  }

  const { data, error } = await supabase
    .from("client_ledger_entries")
    .update({
      voided_at: new Date().toISOString(),
      void_reason: reason.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", entryId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to void receipt: ${error.message}`);
  }
  return data;
}
