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

export type CreateLedgerClientInput = {
  clientCode: string;
  clientName: string;
  city?: string;
  email?: string;
  phone?: string;
  bankName?: string;
  bankAccount?: string;
  bankIban?: string;
  notes?: string;
  rates?: {
    S1?: number;
    S2?: number;
    S3?: number;
    S4?: number;
  };
};

export async function createLedgerClient(input: CreateLedgerClientInput): Promise<{ id: string }> {
  const code = input.clientCode.trim().toUpperCase();
  const name = input.clientName.trim();
  if (!code) throw new Error("Client code is required.");
  if (!name) throw new Error("Client name is required.");

  const { data: client, error } = await supabase
    .from("ledger_clients")
    .insert({
      client_code: code,
      client_name: name,
      city: input.city?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      bank_name: input.bankName?.trim() || null,
      bank_account: input.bankAccount?.trim() || null,
      bank_iban: input.bankIban?.trim() || null,
      notes: input.notes?.trim() || null,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create ledger client: ${error.message}`);

  if (input.rates && client?.id) {
    const rateRows: Array<{ client_id: string; stage: string; amount: number }> = [];
    for (const stage of ["S1", "S2", "S3", "S4"] as const) {
      const amt = Number(input.rates[stage] ?? 0);
      if (amt >= 0) {
        rateRows.push({ client_id: client.id, stage, amount: amt });
      }
    }
    if (rateRows.length > 0) {
      const { error: rateErr } = await supabase.from("ledger_client_stage_rates").insert(rateRows);
      if (rateErr) console.warn("Failed to save stage rates:", rateErr.message);
    }
  }

  return { id: client.id };
}

export type CreateLedgerCaseInput = {
  clientId: string;
  tmNo?: string;
  caseRef?: string;
  applicationName?: string;
  folderNo?: string;
  notes?: string;
  cmsTrademarkId?: string;
  linkReason?: string;
};

export async function createLedgerCase(input: CreateLedgerCaseInput): Promise<{ id: string }> {
  if (!input.clientId) throw new Error("Client ID is required.");
  const tmNo = input.tmNo?.trim() || null;
  const tmNorm = tmNo ? tmNo.replace(/\D/g, "") : null;

  const { data: newCase, error } = await supabase
    .from("ledger_cases")
    .insert({
      client_id: input.clientId,
      tm_no: tmNo,
      tm_no_normalized: tmNorm || null,
      case_ref: input.caseRef?.trim() || null,
      application_name: input.applicationName?.trim() || null,
      folder_no: input.folderNo?.trim() || null,
      notes: input.notes?.trim() || null,
      status: "open",
      reconciliation_status: "unmatched",
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create ledger case: ${error.message}`);

  if (input.cmsTrademarkId && input.linkReason && newCase?.id) {
    const { error: linkErr } = await supabase.rpc("link_ledger_case_to_trademark", {
      p_ledger_case_id: newCase.id,
      p_trademark_id: input.cmsTrademarkId,
      p_reason: input.linkReason.trim(),
    });
    if (linkErr) throw new Error(`Case created, but linking failed: ${linkErr.message}`);
  }

  return { id: newCase.id };
}

export type RecordLedgerChargeInput = {
  clientId: string;
  caseId?: string;
  stage?: "S1" | "S2" | "S3" | "S4";
  amount: number;
  entryDate?: string;
  details?: string;
  notes?: string;
};

export async function recordLedgerCharge(input: RecordLedgerChargeInput): Promise<{ id: string }> {
  if (!input.clientId) throw new Error("Client ID is required.");
  if (!input.amount || input.amount <= 0) throw new Error("Charge amount must be greater than zero.");

  const { data, error } = await supabase
    .from("ledger_entries")
    .insert({
      client_id: input.clientId,
      case_id: input.caseId || null,
      entry_type: "charge",
      stage: input.stage || null,
      amount_due: input.amount,
      amount_received: 0,
      entry_date: input.entryDate || new Date().toISOString().slice(0, 10),
      details: input.details?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to record charge: ${error.message}`);
  return { id: data.id };
}

export async function createLedgerSeries(input: {
  code: string;
  name: string;
  prefix?: string;
  sortOrder?: number;
}): Promise<{ id: string }> {
  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();
  if (!code) throw new Error("Series code is required.");
  if (!name) throw new Error("Series name is required.");

  const { data, error } = await supabase
    .from("ledger_series")
    .insert({
      code,
      name,
      prefix: input.prefix?.trim() || `${code}-`,
      sort_order: input.sortOrder ?? 50,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create series: ${error.message}`);
  return { id: data.id };
}

export type UpdateLedgerClientInput = {
  id: string;
  clientCode?: string;
  clientName?: string;
  seriesId?: string | null;
  city?: string;
  email?: string;
  phone?: string;
  headerBalance?: number;
  bankName?: string;
  bankAccount?: string;
  bankIban?: string;
  notes?: string;
  rates?: {
    S1?: number;
    S2?: number;
    S3?: number;
    S4?: number;
  };
};

export async function updateLedgerClient(input: UpdateLedgerClientInput): Promise<void> {
  if (!input.id) throw new Error("Client ID is required.");
  const payload: Record<string, any> = { updated_at: new Date().toISOString() };
  if (input.clientCode !== undefined) payload.client_code = input.clientCode.trim().toUpperCase();
  if (input.clientName !== undefined) payload.client_name = input.clientName.trim();
  if (input.seriesId !== undefined) payload.series_id = input.seriesId;
  if (input.city !== undefined) payload.city = input.city?.trim() || null;
  if (input.email !== undefined) payload.email = input.email?.trim() || null;
  if (input.phone !== undefined) payload.phone = input.phone?.trim() || null;
  if (input.headerBalance !== undefined) payload.header_balance = Number(input.headerBalance) || 0;
  if (input.bankName !== undefined) payload.bank_name = input.bankName?.trim() || null;
  if (input.bankAccount !== undefined) payload.bank_account = input.bankAccount?.trim() || null;
  if (input.bankIban !== undefined) payload.bank_iban = input.bankIban?.trim() || null;
  if (input.notes !== undefined) payload.notes = input.notes?.trim() || null;

  const { error } = await supabase.from("ledger_clients").update(payload).eq("id", input.id);
  if (error) throw new Error(`Failed to update client: ${error.message}`);

  if (input.rates) {
    for (const stage of ["S1", "S2", "S3", "S4"] as const) {
      const amt = Number(input.rates[stage] ?? 0);
      if (amt >= 0) {
        await supabase
          .from("ledger_client_stage_rates")
          .upsert({ client_id: input.id, stage, amount: amt }, { onConflict: "client_id,stage" });
      }
    }
  }
}

export type UpdateLedgerCaseInput = {
  id: string;
  tmNo?: string | null;
  folderNo?: string | null;
  applicationName?: string | null;
  caseRef?: string | null;
  notes?: string | null;
};

export async function updateLedgerCase(input: UpdateLedgerCaseInput): Promise<void> {
  if (!input.id) throw new Error("Case ID is required.");
  const payload: Record<string, any> = { updated_at: new Date().toISOString() };
  if (input.tmNo !== undefined) {
    const tm = input.tmNo?.trim() || null;
    payload.tm_no = tm;
    payload.tm_no_normalized = tm ? tm.replace(/\D/g, "") : null;
  }
  if (input.folderNo !== undefined) payload.folder_no = input.folderNo?.trim() || null;
  if (input.applicationName !== undefined) payload.application_name = input.applicationName?.trim() || null;
  if (input.caseRef !== undefined) payload.case_ref = input.caseRef?.trim() || null;
  if (input.notes !== undefined) payload.notes = input.notes?.trim() || null;

  const { error } = await supabase.from("ledger_cases").update(payload).eq("id", input.id);
  if (error) throw new Error(`Failed to update case: ${error.message}`);
}

export async function linkCaseToCmsTrademark(
  ledgerCaseId: string,
  cmsTrademarkId: string,
  reason: string
): Promise<void> {
  if (!ledgerCaseId) throw new Error("Ledger case ID is required.");
  if (!cmsTrademarkId) throw new Error("CMS trademark ID is required.");
  if (!reason || reason.trim().length < 3) throw new Error("An audit reason of at least 3 characters is required.");

  const { error } = await supabase.rpc("link_ledger_case_to_trademark", {
    p_ledger_case_id: ledgerCaseId,
    p_trademark_id: cmsTrademarkId,
    p_reason: reason.trim(),
  });
  if (error) throw new Error(`Could not link case to CMS trademark: ${error.message}`);
}

export type RecordLedgerReceivingInput = {
  clientId: string;
  caseId?: string | null;
  entryDate?: string;
  stage?: string | null;
  amount: number;
  paymentMethod?: string;
  details?: string | null;
  notes?: string | null;
  linkedEntryId?: string | null;
  requestId?: string;
};

export async function recordLedgerReceiving(input: RecordLedgerReceivingInput): Promise<{
  id: string;
  receipt_no: string;
  amount: number;
  stage: string | null;
  entry_date: string;
}> {
  if (!input.clientId) throw new Error("Client ID is required.");
  if (!input.amount || input.amount <= 0) throw new Error("Amount must be greater than zero.");

  const { data, error } = await supabase.rpc("record_ledger_receiving", {
    p_client_id: input.clientId,
    p_case_id: input.caseId || null,
    p_entry_date: input.entryDate || new Date().toISOString().slice(0, 10),
    p_stage: input.stage || null,
    p_amount: input.amount,
    p_payment_method: input.paymentMethod || "Cash",
    p_details: input.details?.trim() || null,
    p_notes: input.notes?.trim() || null,
    p_linked_entry_id: input.linkedEntryId || null,
    p_request_id: input.requestId || crypto.randomUUID(),
  });

  if (error) throw new Error(`Failed to record receiving: ${error.message}`);
  return data;
}

export type LookupTmResult = {
  normalizedTm: string | null;
  ledgerCase?: {
    id: string;
    tm_no: string | null;
    folder_no: string | null;
    application_name: string | null;
    client_id: string;
    client_code?: string;
    client_name?: string;
    cms_trademark_id?: string | null;
    reconciliation_status?: string;
  } | null;
  cmsTrademark?: {
    id: string;
    tm_number: string | null;
    tm_cpr_number_norm: string | null;
    trademark_name: string | null;
    client_code: string | null;
    client: string | null;
    stage_status: string | null;
    file_number: string | null;
    class_number: string | null;
  } | null;
};

export async function lookupCaseOrTrademarkByTm(tmInput: string): Promise<LookupTmResult> {
  const norm = normalizeTmDigits(tmInput) || tmInput.replace(/\D/g, "") || null;
  if (!norm) return { normalizedTm: null };

  const [caseRes, cmsRes] = await Promise.all([
    supabase
      .from("ledger_cases")
      .select("id, tm_no, folder_no, application_name, client_id, cms_trademark_id, reconciliation_status, ledger_clients(client_code, client_name)")
      .eq("tm_no_normalized", norm)
      .maybeSingle(),
    supabase
      .from("trademarks")
      .select("id, tm_number, tm_cpr_number_norm, trademark_name, client_code, client, stage_status, file_number, class_number")
      .eq("tm_cpr_number_norm", norm)
      .maybeSingle(),
  ]);

  const rawCase = caseRes.data as any;
  const clientObj = rawCase?.ledger_clients;
  const ledgerCase = rawCase
    ? {
        id: rawCase.id,
        tm_no: rawCase.tm_no,
        folder_no: rawCase.folder_no,
        application_name: rawCase.application_name,
        client_id: rawCase.client_id,
        client_code: clientObj?.client_code,
        client_name: clientObj?.client_name,
        cms_trademark_id: rawCase.cms_trademark_id,
        reconciliation_status: rawCase.reconciliation_status,
      }
    : null;

  return {
    normalizedTm: norm,
    ledgerCase,
    cmsTrademark: (cmsRes.data as any) || null,
  };
}

