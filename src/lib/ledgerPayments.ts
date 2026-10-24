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

  try {
    // 1. Unified 1-Database Direct Query: Check client_ledger_entries joined with trademarks
    const { data: cases, error: tmError } = await supabase
      .from("trademarks")
      .select("id, tm_cpr_number_norm, stage1_paid, stage1_paid_date, stage2_paid, stage2_paid_date, stage3_paid, stage3_paid_date, stage4_paid, stage4_paid_date")
      .in("tm_cpr_number_norm", normalized);

    if (!tmError && cases && cases.length > 0) {
      const caseIds = cases.map((c) => c.id);
      const { data: entries, error: entriesError } = await supabase
        .from("client_ledger_entries")
        .select("*")
        .in("trademark_id", caseIds)
        .is("voided_at", null);

      if (!entriesError && entries !== null) {
        const result: LedgerPaymentsByTm = {};
        for (const tm of normalized) {
          result[tm] = {};
        }

        const entriesByCase = new Map<string, ClientLedgerEntry[]>();
        for (const entry of entries as ClientLedgerEntry[]) {
          const list = entriesByCase.get(entry.trademark_id) ?? [];
          list.push(entry);
          entriesByCase.set(entry.trademark_id, list);
        }

        for (const c of cases) {
          const tm = c.tm_cpr_number_norm;
          if (!tm) continue;
          const caseEntries = entriesByCase.get(c.id) ?? [];
          const stageMap: Partial<Record<"S1" | "S2" | "S3" | "S4", LedgerStagePayment>> = {};

          for (const s of ["S1", "S2", "S3", "S4"] as const) {
            const stageNum = s === "S1" ? 1 : s === "S2" ? 2 : s === "S3" ? 3 : 4;
            const sEntries = caseEntries.filter((e) => e.stage === s);
            const due = sEntries.reduce((sum, e) => sum + Number(e.amount_due || 0), 0);
            const rec = sEntries.reduce((sum, e) => sum + Number(e.amount_received || 0), 0);
            const lastRec = sEntries
              .filter((e) => e.entry_type === "receiving" && Number(e.amount_received || 0) > 0)
              .sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime())[0];

            const cachedPaid = Boolean(c[`stage${stageNum}_paid` as keyof typeof c]);
            const cachedDate = (c[`stage${stageNum}_paid_date` as keyof typeof c] as string) || null;

            const isPaid = (rec > 0 && (due === 0 || rec >= due)) || cachedPaid;

            stageMap[s] = {
              amount_due: due,
              amount_received: rec,
              outstanding: Math.max(0, due - rec),
              paid: isPaid,
              paid_date: lastRec?.entry_date ?? cachedDate,
              entry_id: lastRec?.id ?? null,
              receipt_no: lastRec?.receipt_no ?? null,
              payment_method: lastRec?.payment_method ?? null,
              bank_name: lastRec?.bank_name ?? null,
              cheque_no: lastRec?.cheque_no ?? null,
            };
          }
          result[tm] = stageMap;
        }
        return result;
      }
    }
  } catch {
    // If table not yet present or query fails, fall through to Edge Function
  }

  // 2. Fallback to Edge Function if external ledger bridge is active
  try {
    const { data, error } = await supabase.functions.invoke("ledger-payment-status", {
      body: { tm_digits: normalized },
    });
    if (!error && data?.payments) {
      return data.payments as LedgerPaymentsByTm;
    }
  } catch {
    // ignore
  }

  // 3. Fallback to cached columns in trademarks table
  const { data: cachedCases } = await supabase
    .from("trademarks")
    .select("tm_cpr_number_norm, stage1_paid, stage1_paid_date, stage2_paid, stage2_paid_date, stage3_paid, stage3_paid_date, stage4_paid, stage4_paid_date")
    .in("tm_cpr_number_norm", normalized);

  const fallback: LedgerPaymentsByTm = {};
  for (const c of cachedCases ?? []) {
    if (!c.tm_cpr_number_norm) continue;
    fallback[c.tm_cpr_number_norm] = {
      S1: { paid: Boolean(c.stage1_paid), paid_date: c.stage1_paid_date ?? null, amount_due: 0, amount_received: c.stage1_paid ? 1 : 0, outstanding: 0, entry_id: null },
      S2: { paid: Boolean(c.stage2_paid), paid_date: c.stage2_paid_date ?? null, amount_due: 0, amount_received: c.stage2_paid ? 1 : 0, outstanding: 0, entry_id: null },
      S3: { paid: Boolean(c.stage3_paid), paid_date: c.stage3_paid_date ?? null, amount_due: 0, amount_received: c.stage3_paid ? 1 : 0, outstanding: 0, entry_id: null },
      S4: { paid: Boolean(c.stage4_paid), paid_date: c.stage4_paid_date ?? null, amount_due: 0, amount_received: c.stage4_paid ? 1 : 0, outstanding: 0, entry_id: null },
    };
  }
  return fallback;
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
          paid: rec > 0 && (due === 0 || rec >= due),
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
    p_receipt_no: params.receiptNo || null,
    p_details: params.details || null,
    p_notes: params.notes || null,
  });

  if (!rpcError) {
    return rpcData;
  }

  // Fallback direct insert if RPC not present
  const receiptNo =
    params.receiptNo ||
    `BX-REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const { data, error } = await supabase
    .from("client_ledger_entries")
    .insert({
      trademark_id: params.trademarkId,
      stage: params.stage,
      entry_type: "receiving",
      entry_date: params.entryDate || new Date().toISOString().slice(0, 10),
      amount_due: 0,
      amount_received: params.amount,
      payment_method: params.paymentMethod || "cash",
      bank_name: params.bankName || null,
      cheque_no: params.chequeNo || null,
      receipt_no: receiptNo,
      details: params.details || null,
      notes: params.notes || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to record receipt: ${error.message}`);
  }
  return data;
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
