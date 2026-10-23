import { supabase } from "@/lib/supabase";

export type LedgerStagePayment = {
  amount_due: number;
  amount_received: number;
  outstanding: number;
  paid: boolean;
  paid_date: string | null;
  entry_id: string | null;
};

export type LedgerPaymentsByTm = Record<string, Partial<Record<"S1" | "S2" | "S3" | "S4", LedgerStagePayment>>>;

export function normalizeTmDigits(value: string | null | undefined): string | null {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits.length === 6 ? digits : null;
}

export async function getLedgerStagePayments(tmNumbers: Array<string | null | undefined>): Promise<LedgerPaymentsByTm> {
  const normalized = [...new Set(tmNumbers.map(normalizeTmDigits).filter((value): value is string => value !== null))];
  if (normalized.length === 0) return {};
  if (normalized.length > 50) throw new Error("Ledger payment status supports up to 50 cases per request.");

  const { data, error } = await supabase.functions.invoke("ledger-payment-status", {
    body: { tm_digits: normalized },
  });
  if (error) {
    throw new Error(`Could not verify payment with Brandex Client Ledger: ${error.message}`);
  }
  if (!data || typeof data.payments !== "object" || Array.isArray(data.payments)) {
    throw new Error("Brandex Client Ledger returned an invalid payment status response.");
  }
  return data.payments as LedgerPaymentsByTm;
}

export async function refreshLedgerPaymentsForCase(caseId: string, tmNumber?: string | null): Promise<Partial<Record<"S1" | "S2" | "S3" | "S4", LedgerStagePayment>>> {
  let tm = normalizeTmDigits(tmNumber);
  if (!tm) {
    const { data, error } = await supabase.from("trademarks").select("tm_cpr_number").eq("id", caseId).single();
    if (error) throw new Error(`Could not load the case TM number: ${error.message}`);
    tm = normalizeTmDigits(data?.tm_cpr_number);
  }
  if (!tm) throw new Error("Add the case's six-digit TM number before checking its Ledger payment.");
  const payments = await getLedgerStagePayments([tm]);
  return payments[tm] ?? {};
}
