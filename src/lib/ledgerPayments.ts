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
  client_id: string;
  case_id: string | null;
  entry_date: string;
  entry_type: "charge" | "receiving";
  stage: "S1" | "S2" | "S3" | "S4" | null;
  amount_due: number | null;
  amount_received: number | null;
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

type ApprovedLedgerCase = {
  id: string;
  client_id: string;
  cms_trademark_id: string;
};

export type LedgerPaymentsByTm = Record<string, Partial<Record<"S1" | "S2" | "S3" | "S4", LedgerStagePayment>>>;

const STAGE_KEYS = ["S1", "S2", "S3", "S4"] as const;
type StageKey = typeof STAGE_KEYS[number];

export function normalizeTmDigits(value: string | null | undefined): string | null {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits.length === 6 ? digits : null;
}

function summarizeStage(entries: ClientLedgerEntry[], stage: StageKey): LedgerStagePayment {
  const rows = entries.filter((entry) => entry.stage === stage && !entry.voided_at);
  const due = rows
    .filter((entry) => entry.entry_type === "charge")
    .reduce((sum, entry) => sum + Number(entry.amount_due || 0), 0);
  const received = rows
    .filter((entry) => entry.entry_type === "receiving")
    .reduce((sum, entry) => sum + Number(entry.amount_received || 0), 0);
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

/**
 * Resolve a CMS trademark to exactly one audited, approved Ledger case.
 * TM-number similarity alone is never sufficient to authorize a payment link.
 */
async function getApprovedLedgerCase(trademarkId: string): Promise<ApprovedLedgerCase | null> {
  const { data, error } = await supabase
    .from("ledger_cases")
    .select("id, client_id, cms_trademark_id")
    .eq("cms_trademark_id", trademarkId)
    .eq("reconciliation_status", "approved_link");

  if (error) throw new Error(`Could not verify Ledger case link: ${error.message}`);
  if (!data || data.length !== 1 || !data[0].cms_trademark_id) return null;
  return data[0] as ApprovedLedgerCase;
}

/** Read payment truth from the consolidated CMS Supabase Ledger tables. */
export async function getLedgerStagePayments(tmNumbers: Array<string | null | undefined>): Promise<LedgerPaymentsByTm> {
  const normalized = [...new Set(tmNumbers.map(normalizeTmDigits).filter((value): value is string => value !== null))];
  if (normalized.length === 0) return {};

  const { data: trademarks, error: trademarkError } = await supabase
    .from("trademarks")
    .select("id, tm_cpr_number_norm")
    .in("tm_cpr_number_norm", normalized);
  if (trademarkError) throw new Error(`Could not read CMS cases: ${trademarkError.message}`);

  const result: LedgerPaymentsByTm = {};
  if (!trademarks?.length) return result;

  // Ambiguous duplicate TM numbers must fail closed rather than combine unrelated cases.
  const trademarkIdsByTm = new Map<string, string[]>();
  for (const trademark of trademarks) {
    const tm = trademark.tm_cpr_number_norm;
    if (!tm) continue;
    const ids = trademarkIdsByTm.get(tm) ?? [];
    ids.push(trademark.id);
    trademarkIdsByTm.set(tm, ids);
  }

  const cmsIds = [...new Set(trademarks.map((row) => row.id))];
  const { data: links, error: linkError } = await supabase
    .from("ledger_cases")
    .select("id, client_id, cms_trademark_id")
    .in("cms_trademark_id", cmsIds)
    .eq("reconciliation_status", "approved_link");
  if (linkError) throw new Error(`Could not verify Ledger case links: ${linkError.message}`);

  const linksByCmsId = new Map<string, ApprovedLedgerCase[]>();
  for (const link of (links ?? []) as ApprovedLedgerCase[]) {
    const id = link.cms_trademark_id;
    const rows = linksByCmsId.get(id) ?? [];
    rows.push(link);
    linksByCmsId.set(id, rows);
  }

  const approvedLinks = (links ?? []) as ApprovedLedgerCase[];
  if (!approvedLinks.length) return result;

  const { data: entries, error: entryError } = await supabase
    .from("ledger_entries")
    .select("*")
    .in("case_id", approvedLinks.map((link) => link.id))
    .is("voided_at", null);
  if (entryError) throw new Error(`Could not read consolidated Ledger entries: ${entryError.message}`);

  for (const [tm, trademarkIds] of trademarkIdsByTm) {
    if (trademarkIds.length !== 1) continue;
    const cmsId = trademarkIds[0];
    const linkedCases = linksByCmsId.get(cmsId) ?? [];
    if (linkedCases.length !== 1) continue;
    const linkedCase = linkedCases[0];
    const caseEntries = ((entries ?? []) as ClientLedgerEntry[]).filter((entry) => entry.case_id === linkedCase.id);
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
): Promise<Partial<Record<StageKey, LedgerStagePayment>>> {
  const tm = normalizeTmDigits(tmNumber);
  if (tm) {
    const payments = await getLedgerStagePayments([tm]);
    return payments[tm] ?? {};
  }

  const linkedCase = await getApprovedLedgerCase(caseId);
  if (!linkedCase) return {};

  const { data: entries, error } = await supabase
    .from("ledger_entries")
    .select("*")
    .eq("case_id", linkedCase.id)
    .is("voided_at", null);
  if (error) throw new Error(`Could not read consolidated Ledger entries: ${error.message}`);
  const rows = (entries ?? []) as ClientLedgerEntry[];
  return {
    S1: summarizeStage(rows, "S1"),
    S2: summarizeStage(rows, "S2"),
    S3: summarizeStage(rows, "S3"),
    S4: summarizeStage(rows, "S4"),
  };
}

/** Fetch entries for a CMS trademark only when one approved Ledger link exists. */
export async function getClientLedgerEntries(trademarkId: string): Promise<ClientLedgerEntry[]> {
  const linkedCase = await getApprovedLedgerCase(trademarkId);
  if (!linkedCase) return [];

  const { data, error } = await supabase
    .from("ledger_entries")
    .select("*")
    .eq("case_id", linkedCase.id)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not read consolidated Ledger entries: ${error.message}`);
  return (data as ClientLedgerEntry[]) ?? [];
}

export type RecordReceiptParams = {
  trademarkId: string;
  stage: StageKey;
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

/** The database generates receipt numbers and enforces approved-link authorization/idempotency. */
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
