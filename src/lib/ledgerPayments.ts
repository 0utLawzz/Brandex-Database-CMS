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

export function isStageFullyPaid(amountDue: number, amountReceived: number): boolean {
  return amountDue > 0 && amountReceived >= amountDue;
}

export function normalizeTmDigits(value: string | null | undefined): string | null {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits.length === 6 ? digits : null;
}

/**
 * Read payment status from the separate Brandex Client Ledger through the
 * authenticated CMS Edge Function. CMS-local ledger rows and cached flags are
 * not financial sources of truth.
 */
export async function getLedgerStagePayments(tmNumbers: Array<string | null | undefined>): Promise<LedgerPaymentsByTm> {
  const normalized = [...new Set(tmNumbers.map(normalizeTmDigits).filter((value): value is string => value !== null))];
  if (normalized.length === 0) return {};

  const { data, error } = await supabase.functions.invoke("ledger-payment-status", {
    body: { tm_digits: normalized },
  });
  if (error) throw new Error("Unable to verify payments with Brandex Client Ledger: " + error.message);
  if (!data?.payments || typeof data.payments !== "object") {
    throw new Error("Brandex Client Ledger returned no verifiable payment status.");
  }

  const result: LedgerPaymentsByTm = {};
  for (const tm of normalized) {
    const source = data.payments[tm];
    if (!source || typeof source !== "object") {
      throw new Error("Brandex Client Ledger returned no status for TM " + tm + ".");
    }
    const stageMap: Partial<Record<"S1" | "S2" | "S3" | "S4", LedgerStagePayment>> = {};
    for (const stage of ["S1", "S2", "S3", "S4"] as const) {
      const row = source[stage];
      if (!row || typeof row !== "object") {
        throw new Error("Brandex Client Ledger returned no " + stage + " status for TM " + tm + ".");
      }
      const due = Number(row.amount_due ?? 0);
      const received = Number(row.amount_received ?? 0);
      const paid = isStageFullyPaid(due, received);
      stageMap[stage] = {
        amount_due: due,
        amount_received: received,
        outstanding: Math.max(0, due - received),
        paid,
        paid_date: paid ? (row.paid_date ?? null) : null,
        entry_id: row.entry_id ?? null,
        receipt_no: row.receipt_no ?? null,
        payment_method: row.payment_method ?? null,
        bank_name: row.bank_name ?? null,
        cheque_no: row.cheque_no ?? null,
      };
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
    const { data, error } = await supabase.from("trademarks").select("tm_cpr_number").eq("id", caseId).single();
    if (error) throw new Error("Unable to identify the case TM number: " + error.message);
    tm = normalizeTmDigits(data?.tm_cpr_number);
  }
  if (!tm) return {};
  const payments = await getLedgerStagePayments([tm]);
  return payments[tm] ?? {};
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
export async function recordClientReceipt(_params: RecordReceiptParams): Promise<never> {
  throw new Error("Client receipts must be recorded in the authoritative Brandex Client Ledger. CMS receipt posting is read-only until a secure write bridge is approved and deployed.");
}

/**
 * Financial adjustments and voids must be recorded in the authoritative Ledger.
 * The CMS deliberately has no local receipt-void fallback.
 */
export async function voidClientReceipt(_entryId: string, _reason: string): Promise<never> {
  throw new Error("Receipt voids and adjustments must be recorded in the authoritative Brandex Client Ledger.");
}
