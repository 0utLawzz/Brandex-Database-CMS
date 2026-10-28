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

function summarizeStage(entries: ClientLedgerEntry[], stage: "S1" | "S2" | "S3" | "S4"): LedgerStagePayment {
  const rows = entries.filter((entry) => entry.stage === stage && !entry.voided_at);
  const due = rows.reduce((sum, entry) => sum + Number(entry.amount_due || 0), 0);
  const received = rows.reduce((sum, entry) => sum + Number(entry.amount_received || 0), 0);
  const lastReceipt = rows
    .filter((entry) => entry.entry_type === "receiving" && Number(entry.amount_received || 0) > 0)
    .sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime())[0];

  return {
    amount_due: due,
    amount_received: received,
    outstanding: Math.max(0, due - received),
    paid: due > 0 && received >= due,
    paid_date: due > 0 && received >= due ? lastReceipt?.entry_date ?? null : null,
    entry_id: lastReceipt?.id ?? null,
    receipt_no: lastReceipt?.receipt_no ?? null,
    payment_method: lastReceipt?.payment_method ?? null,
    bank_name: lastReceipt?.bank_name ?? null,
    cheque_no: lastReceipt?.cheque_no ?? null,
  };
}

/** Read payment truth from this CMS Supabase project's ledger view only. */
export async function getLedgerStagePayments(tmNumbers: Array<string | null | undefined>): Promise<LedgerPaymentsByTm> {
  const normalized = [...new Set(tmNumbers.map(normalizeTmDigits).filter((value): value is string => value !== null))];
  if (normalized.length === 0) return {};

  const { data: cases, error: caseError } = await supabase
    .from("trademarks")
    .select("id, tm_cpr_number_norm")
    .in("tm_cpr_number_norm", normalized);
  if (caseError) throw new Error(`Could not read CMS cases: ${caseError.message}`);

  const result: LedgerPaymentsByTm = {};
  if (!cases?.length) return result;

  // A CMS trademark is not a Ledger case merely because it has a TM number.
  // Only an explicit, audited approved link authorizes payment status/receipt actions.
  const { data: linkedCases, error: linkError } = await supabase
    .from("ledger_cases")
    .select("cms_trademark_id")
    .in("cms_trademark_id", cases.map((row) => row.id))
    .eq("reconciliation_status", "approved_link");
  if (linkError) throw new Error(`Could not verify Ledger case links: ${linkError.message}`);

  const linkedTrademarkIds = [...new Set((linkedCases ?? [])
    .map((row) => row.cms_trademark_id)
    .filter((id): id is string => Boolean(id)))];
  if (linkedTrademarkIds.length === 0) return result;

  const { data: entries, error: entryError } = await supabase
    .from("client_ledger_entries")
    .select("*")
    .in("trademark_id", linkedTrademarkIds)
    .is("voided_at", null);
  if (entryError) throw new Error(`Could not read ledger entries: ${entryError.message}`);

  for (const row of cases) {
    const tm = row.tm_cpr_number_norm;
    if (!tm || !linkedTrademarkIds.includes(row.id)) continue;
    const caseEntries = (entries ?? []).filter((entry) => entry.trademark_id === row.id) as ClientLedgerEntry[];
    result[tm] = {
      S1: summarizeStage(caseEntries, "S1"),
      S2: summarizeStage(caseEntries, "S2"),
      S3: summarizeStage(caseEntries, "S3"),
      S4: summarizeStage(caseEntries, "S4"),
    };
  }
  return result;
}

export async function refreshLedgerPaymentsForCase(
  caseId: string,
  tmNumber?: string | null
): Promise<Partial<Record<"S1" | "S2" | "S3" | "S4", LedgerStagePayment>>> {
  const tm = normalizeTmDigits(tmNumber);
  if (tm) {
    const payments = await getLedgerStagePayments([tm]);
    return payments[tm] ?? {};
  }

  const { data: linkedCase, error: linkError } = await supabase
    .from("ledger_cases")
    .select("id")
    .eq("cms_trademark_id", caseId)
    .eq("reconciliation_status", "approved_link")
    .maybeSingle();
  if (linkError) throw new Error(`Could not verify Ledger case link: ${linkError.message}`);
  if (!linkedCase) return {};

  const { data: entries, error } = await supabase
    .from("client_ledger_entries")
    .select("*")
    .eq("trademark_id", caseId)
    .is("voided_at", null);
  if (error) throw new Error(`Could not read ledger entries: ${error.message}`);
  const rows = (entries ?? []) as ClientLedgerEntry[];
  return {
    S1: summarizeStage(rows, "S1"),
    S2: summarizeStage(rows, "S2"),
    S3: summarizeStage(rows, "S3"),
    S4: summarizeStage(rows, "S4"),
  };
}

/** Fetch all entries linked to one CMS trademark from the consolidated database. */
export async function getClientLedgerEntries(trademarkId: string): Promise<ClientLedgerEntry[]> {
  const { data, error } = await supabase
    .from("client_ledger_entries")
    .select("*")
    .eq("trademark_id", trademarkId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not read ledger entries: ${error.message}`);
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
  requestId?: string;
  details?: string;
  notes?: string;
};

/** The database generates receipt numbers and enforces authorization/idempotency. */
export async function recordClientReceipt(params: RecordReceiptParams) {
  const { data, error } = await supabase.rpc("record_client_receipt", {
    p_trademark_id: params.trademarkId,
    p_stage: params.stage,
    p_amount: params.amount,
    p_entry_date: params.entryDate || new Date().toISOString().slice(0, 10),
    p_payment_method: params.paymentMethod || "cash",
    p_bank_name: params.paymentMethod === "cash" ? "Cash" : params.bankName || null,
    p_cheque_no: params.chequeNo || null,
    p_receipt_no: params.receiptNo || null,
    p_details: params.details || null,
    p_notes: params.notes || null,
    p_request_id: params.requestId || null,
  });
  if (error) throw new Error(`Failed to record receipt: ${error.message}`);
  return data;
}

/** Soft-void a receipt through the database's audited admin-only RPC. */
export async function voidClientReceipt(entryId: string, reason: string) {
  const { data, error } = await supabase.rpc("void_client_receipt", {
    p_entry_id: entryId,
    p_reason: reason,
  });
  if (error) throw new Error(`Failed to void receipt: ${error.message}`);
  return data;
}
