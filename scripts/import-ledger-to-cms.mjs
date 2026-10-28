import { createClient } from "@supabase/supabase-js";

const SOURCE_REF = "addiipgeoqdgrjbgytta";
const TARGET_REF = "jzcrfbyypbbbittzbyyx";
const APPLY = process.argv.includes("--apply");

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function assertProject(url, expectedRef, label) {
  const host = new URL(url).hostname;
  if (!host.startsWith(`${expectedRef}.`)) {
    throw new Error(`${label} URL does not point to the expected Supabase project.`);
  }
}

function digits(value) {
  return String(value ?? "").replace(/\D/g, "") || null;
}

function normalizeName(value) {
  return String(value ?? "").normalize("NFKC").toLocaleUpperCase().replace(/[^A-Z0-9]/g, "");
}

async function fetchAll(client, table) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from(table).select("*").range(offset, offset + 999);
    if (error) throw new Error(`Read ${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) return rows;
  }
}

async function upsertAll(client, table, rows) {
  for (let offset = 0; offset < rows.length; offset += 500) {
    const { error } = await client.from(table).upsert(rows.slice(offset, offset + 500), { onConflict: "id" });
    if (error) throw new Error(`Write ${table}: ${error.message}`);
  }
}

const sourceUrl = required("LEDGER_SOURCE_SUPABASE_URL");
const sourceKey = required("LEDGER_SOURCE_SERVICE_ROLE_KEY");
const targetUrl = required("CMS_TARGET_SUPABASE_URL");
const targetKey = required("CMS_TARGET_SERVICE_ROLE_KEY");
assertProject(sourceUrl, SOURCE_REF, "Source");
assertProject(targetUrl, TARGET_REF, "Target");

if (APPLY) {
  const approval = required("LEDGER_IMPORT_APPROVAL");
  if (approval !== "approved-after-backup-and-reconciliation") {
    throw new Error("Set LEDGER_IMPORT_APPROVAL only after the owner approves the production import and a backup is confirmed.");
  }
}

const source = createClient(sourceUrl, sourceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const target = createClient(targetUrl, targetKey, { auth: { persistSession: false, autoRefreshToken: false } });

const [series, clients, rates, cases, entries, cmsCases] = await Promise.all([
  fetchAll(source, "series"),
  fetchAll(source, "clients"),
  fetchAll(source, "client_stage_rates"),
  fetchAll(source, "cases"),
  fetchAll(source, "ledger_entries"),
  fetchAll(target, "trademarks"),
]);

const cmsByTm = new Map();
for (const cmsCase of cmsCases) {
  const tm = cmsCase.tm_cpr_number_norm ?? digits(cmsCase.tm_cpr_number);
  if (!tm) continue;
  const list = cmsByTm.get(tm) ?? [];
  list.push(cmsCase);
  cmsByTm.set(tm, list);
}

const existingCaseState = new Map();
for (let offset = 0; offset < cases.length; offset += 500) {
  const ids = cases.slice(offset, offset + 500).map((row) => row.id);
  if (!ids.length) continue;
  const { data, error } = await target.from("ledger_cases").select("id,cms_trademark_id,reconciliation_status").in("id", ids);
  if (error && !/does not exist|schema cache/i.test(error.message)) throw new Error(`Read target ledger_cases: ${error.message}`);
  for (const row of data ?? []) existingCaseState.set(row.id, row);
}

const mappedCases = cases.map((row) => {
  const tm = row.tm_no_normalized ?? digits(row.tm_no);
  const candidates = tm ? cmsByTm.get(tm) ?? [] : [];
  const prior = existingCaseState.get(row.id);
  let status = "unmatched";
  if (candidates.length > 1) {
    status = "ownership_conflict";
  } else if (candidates.length === 1) {
    const cmsCase = candidates[0];
    const sameClient = String(cmsCase.client_code ?? "") === String(row.client_code ?? "");
    const sameApplication = normalizeName(cmsCase.application_name) === normalizeName(row.application_name);
    status = sameClient && sameApplication ? "pending_review" : "ownership_conflict";
  }
  return {
    id: row.id,
    client_id: row.client_id,
    tm_no: row.tm_no,
    tm_no_normalized: tm,
    folder_no: row.folder_no,
    case_ref: row.case_ref,
    application_name: row.application_name,
    status: row.status,
    notes: row.notes,
    cms_trademark_id: prior?.cms_trademark_id ?? null,
    reconciliation_status: prior?.cms_trademark_id ? prior.reconciliation_status : status,
    source_created_by: row.created_by ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
});

const mappedClients = clients.map((row) => ({ ...row }));
const mappedEntries = entries.map((row) => ({
  id: row.id,
  client_id: row.client_id,
  case_id: row.case_id,
  entry_date: row.entry_date,
  entry_type: row.entry_type,
  stage: row.stage,
  details: row.details,
  amount_due: row.amount_due,
  amount_received: row.amount_received,
  running_balance: row.running_balance,
  payment_method: row.payment_method,
  bank_name: null,
  cheque_no: null,
  receipt_no: row.receipt_no,
  notes: row.notes,
  voided_at: row.voided_at,
  void_reason: row.void_reason,
  linked_entry_id: row.linked_entry_id,
  created_by: null,
  source_created_by: row.created_by ?? null,
  created_at: row.created_at,
  updated_at: row.created_at,
}));

const counts = {
  series: series.length,
  clients: clients.length,
  stageRates: rates.length,
  cases: cases.length,
  entries: entries.length,
  activeCharges: entries.filter((r) => r.entry_type === "charge" && !r.voided_at).length,
  activeReceipts: entries.filter((r) => r.entry_type === "receiving" && !r.voided_at).length,
  voidedEntries: entries.filter((r) => r.voided_at).length,
  activeChargeAmount: entries.filter((r) => r.entry_type === "charge" && !r.voided_at).reduce((n, r) => n + Number(r.amount_due ?? 0), 0),
  activeReceiptAmount: entries.filter((r) => r.entry_type === "receiving" && !r.voided_at).reduce((n, r) => n + Number(r.amount_received ?? 0), 0),
  voidedChargeAmount: entries.filter((r) => r.entry_type === "charge" && r.voided_at).reduce((n, r) => n + Number(r.amount_due ?? 0), 0),
  voidedReceiptAmount: entries.filter((r) => r.entry_type === "receiving" && r.voided_at).reduce((n, r) => n + Number(r.amount_received ?? 0), 0),
  caseReconciliation: mappedCases.reduce((out, row) => {
    out[row.reconciliation_status] = (out[row.reconciliation_status] ?? 0) + 1;
    return out;
  }, {}),
};

if (!APPLY) {
  console.log(JSON.stringify({ mode: "dry-run", sourceRef: SOURCE_REF, targetRef: TARGET_REF, counts }, null, 2));
  console.log("No rows were written. Review all ownership conflicts and get explicit owner approval before using --apply.");
  process.exit(0);
}

await upsertAll(target, "ledger_series", series);
await upsertAll(target, "ledger_clients", mappedClients);
await upsertAll(target, "ledger_client_stage_rates", rates);
await upsertAll(target, "ledger_cases", mappedCases);
await upsertAll(target, "ledger_entries", mappedEntries);

console.log(JSON.stringify({ mode: "applied", sourceRef: SOURCE_REF, targetRef: TARGET_REF, counts }, null, 2));
