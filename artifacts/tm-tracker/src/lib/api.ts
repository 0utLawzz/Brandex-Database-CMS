/** Brandex browser data layer — Supabase is primary; Sheet mirroring is server-side. */

import { isSupabaseConfigured, supabase, TRADEMARK_FILES_BUCKET } from "./supabase";

export interface Trademark {
  ID: string;
  DATE: string;
  TYPE: string;
  "CLIENT CODE": string;
  "CASE NUMBER": string;
  "CLIENT NAME": string;
  "APPLICATION NAME": string;
  "TM/CPR NUMBER": string;
  CLASS: string;
  STATUS: string;
  "SUB STATUS": string;
  "CASE TYPE": string;
  AGENT: string;
  CITY: string;
  NOTES: string;
  TM5: string;
  TM6: string;
  TM11: string;
  TM16: string;
  TM56: string;
  "JOURNAL NUMBER": string;
  "JOURNAL DATE": string;
  "LAST MODIFIED": string;
  IMAGE: string;
  _tmMatches?: TmMatches;
  _journal?: JournalRecord | null;
}

export interface TrademarkRecord {
  id: string;
  date: string;
  type: string;
  prefix: string;
  clientCode: string;
  clientNo: string;
  caseNumber: string;
  folderNo: string;
  caseNo: string;
  clientName: string;
  appName: string;
  tmCprNo: string;
  tmNo: string;
  appClass: string;
  stage: string;
  subStage: string;
  caseType: string;
  agent: string;
  city: string;
  notes: string;
  updatedAt: string;
  createdAt?: string;
  version?: number;
  image: string;
  imagePath?: string;
  tm5: string;
  tm6: string;
  tm11: string;
  tm16: string;
  tm56: string;
  journalNumber: string;
  journalDate: string;
  tmMatches?: TmMatches;
  journal?: JournalRecord | null;
  // Publication workflow fields
  publicationDate?: string | null;
  oppositionDeadline?: string | null;
  demandNoteReceived?: boolean;
  demandNoteDate?: string | null;
  // Stage payment placeholder fields (manual — not auto-verified)
  stage1Paid?: boolean;
  stage1PaidDate?: string | null;
  stage2Paid?: boolean;
  stage2PaidDate?: string | null;
  stage3Paid?: boolean;
  stage3PaidDate?: string | null;
  stage4Paid?: boolean;
  stage4PaidDate?: string | null;
  paymentReference?: string | null;
}

export interface TmMatches {
  TM5: boolean;
  TM6: boolean;
  TM11: boolean;
  TM16: boolean;
  TM56: boolean;
  TM5_date?: string;
  TM6_date?: string;
  TM11_date?: string;
  TM16_date?: string;
  TM56_date?: string;
}

export interface JournalRecord {
  found: boolean;
  "Application No"?: string;
  "Journal No"?: string;
  "Journal Date"?: string;
  Title?: string;
  Class?: string;
  "Applicant Name and Address"?: string;
  "Agent Name and Address"?: string;
  "Date of Filing"?: string;
  [key: string]: string | boolean | undefined;
}

export interface AuditLogEntry {
  id: number;
  changedAt: string;
  changedBy: string;
  action: string;
  recordId: string;
  caseNo: string;
  record: string;
  field: string;
  oldValue: string;
  newValue: string;
  applicationNumber?: string;
  applicationName?: string;
  clientCode?: string;
  caseType?: string;
}

export interface TrademarkWorkflowEvent {
  id: number;
  trademarkId: string;
  eventType: string;
  fromStatus: string | null;
  fromSubStatus: string | null;
  toStatus: string;
  toSubStatus: string | null;
  eventAt: string;
  changedBy: string | null;
  changedByName: string;
}

export interface DashboardStatsFilters {
  agent?: string;
  appClass?: string;
}

export interface TrademarkStats {
  total: number;
  recentlyModified: number;
  byStage: Array<{ stage: string; count: number }>;
  byCity: Array<{ city: string; count: number }>;
  byNumericStage: Array<{ stage: string; count: number }>;
  byTmForm: Array<{ form: TmFormKey; count: number }>;
}

export type TmFormKey = "TM5" | "TM6" | "TM11" | "TM16" | "TM56";

export interface TrademarkListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  type?: string;
  clientCode?: string;
  stage?: string;
  subStage?: string;
  city?: string;
  caseType?: string;
  agent?: string;
  appClass?: string;
  tmForm?: TmFormKey;
  includeDetails?: boolean;
}

export interface TrademarkPage {
  records: TrademarkRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TrademarkInput {
  id?: string;
  date?: string;
  type?: string;
  prefix?: string;
  clientCode?: string;
  clientNo?: string;
  caseNumber?: string;
  caseNo?: string;
  folderNo?: string;
  clientName?: string;
  appName?: string;
  tmCprNo?: string;
  tmNo?: string;
  appClass?: string;
  stage?: string;
  subStage?: string;
  caseType?: string;
  agent?: string;
  city?: string;
  notes?: string;
  image?: string;
  stage1Paid?: boolean;
  stage1PaidDate?: string;
  stage2Paid?: boolean;
  stage2PaidDate?: string;
  stage3Paid?: boolean;
  stage3PaidDate?: string;
  stage4Paid?: boolean;
  stage4PaidDate?: string;
}

export interface TmSearchResult {
  records: TrademarkRecord[];
  tmMatches: TmMatches;
  journal: JournalRecord | null;
}

export const STAGES = ["STAGE 1", "STAGE 2", "STAGE 3", "STAGE 4", "STOPPED"] as const;
export type StageType = typeof STAGES[number];

export const STATUS_WORKFLOW: Record<string, string[]> = {
  "STAGE 1": ["Filing", "Examination", "Acknowledgment"],
  "STAGE 2": ["Assigned", "Accepted", "Hearing"],
  "STAGE 3": ["Published", "D-Note Received", "D-Note Submitted"],
  "STAGE 4": ["CER Acknowledge", "CER Received", "CER Dispatch"],
  "STOPPED": [],
};

/**
 * Canonical dictionary mapping abbreviated workflow / sub-stage codes
 * to complete user-facing terminology.
 */
export const WORKFLOW_DISPLAY_LABELS: Record<string, string> = {
  "D-Note Submitted": "Demand Note Submitted",
  "D-Note Received": "Demand Note Received",
  "OPPO: Filed": "Opposition: Filed",
  "OPPO: Received": "Opposition: Received",
  "OPPO: Withdrawn": "Opposition: Withdrawn",
};

/**
 * Reverse mapping to resolve complete terminology back to internal values.
 */
export const WORKFLOW_INTERNAL_VALUES: Record<string, string> = Object.entries(
  WORKFLOW_DISPLAY_LABELS,
).reduce((acc, [k, v]) => ({ ...acc, [v]: k }), {} as Record<string, string>);

/**
 * Returns the complete user-facing display label for a workflow status or sub-status.
 * If no mapping exists (or if already expanded), returns the value as-is.
 */
export function formatWorkflowLabel(label: string | null | undefined): string {
  if (!label) return "";
  return WORKFLOW_DISPLAY_LABELS[label] ?? label;
}

/**
 * Resolves a workflow label to its canonical internal database value.
 */
export function normalizeWorkflowValue(val: string | null | undefined): string {
  if (!val) return "";
  return WORKFLOW_INTERNAL_VALUES[val] ?? val;
}

export interface StageDocumentDefinition {
  stage: string;
  label: string;
  subStages: string[];
}

/**
 * Workflow stages and sub-stages for stage-wise document management.
 * Uses full user-facing terminology (Demand Note, Opposition, CER).
 */
export const STAGE_DOCUMENT_WORKFLOW: StageDocumentDefinition[] = [
  {
    stage: "STAGE 1",
    label: "Stage 1",
    subStages: ["Filing", "Examination", "Acknowledgment"],
  },
  {
    stage: "STAGE 2",
    label: "Stage 2",
    subStages: ["Assigned", "Accepted", "Hearing"],
  },
  {
    stage: "STAGE 3",
    label: "Stage 3",
    subStages: [
      "Demand Note Submitted",
      "Demand Note Received",
      "Opposition: Filed",
      "Opposition: Received",
      "Opposition: Withdrawn",
      "Published",
    ],
  },
  {
    stage: "STAGE 4",
    label: "Stage 4",
    subStages: [
      "CER Acknowledge",
      "CER Received",
      "CER Dispatch",
    ],
  },
];

export { getStaffRole } from "./registryImport";

export const CITIES = ["Islamabad", "Karachi", "Lahore", "Multan", "Rawalpindi", "Peshawar", "Quetta"] as const;
export const VALID_TYPES = ["X", "A", "N"] as const;
export const CASE_TYPES = ["Trademark", "Copyright", "Design", "Patent", "Renewal", "Opposition", "Other"] as const;
export const TM_FORMS: TmFormKey[] = ["TM5", "TM6", "TM11", "TM16", "TM56"];

export interface UploadImageResult {
  fileId: string;
  url: string;
  thumbnailUrl: string;
}

export function mapRowToRecord(row: Trademark): TrademarkRecord {
  return {
    id: String(row["ID"] ?? "").trim(),
    date: String(row["DATE"] ?? "").trim(),
    type: String(row["TYPE"] ?? "").trim(),
    prefix: String(row["TYPE"] ?? "").trim(),
    clientCode: String(row["CLIENT CODE"] ?? "").trim(),
    clientNo: String(row["CLIENT CODE"] ?? "").trim(),
    caseNumber: String(row["CASE NUMBER"] ?? "").trim(),
    folderNo: String(row["CASE NUMBER"] ?? "").trim(),
    caseNo: String(row["CASE NUMBER"] ?? "").trim(),
    clientName: String(row["CLIENT NAME"] ?? "").trim(),
    appName: String(row["APPLICATION NAME"] ?? "").trim(),
    tmCprNo: String(row["TM/CPR NUMBER"] ?? "").trim(),
    tmNo: String(row["TM/CPR NUMBER"] ?? "").trim(),
    appClass: String(row["CLASS"] ?? "").trim(),
    stage: String(row["STATUS"] ?? "").trim(),
    subStage: String(row["SUB STATUS"] ?? "").trim(),
    caseType: String(row["CASE TYPE"] ?? "").trim(),
    agent: String(row["AGENT"] ?? "").trim(),
    city: String(row["CITY"] ?? "").trim(),
    notes: String(row["NOTES"] ?? "").trim(),
    tm5: String(row["TM5"] ?? "").trim(),
    tm6: String(row["TM6"] ?? "").trim(),
    tm11: String(row["TM11"] ?? "").trim(),
    tm16: String(row["TM16"] ?? "").trim(),
    tm56: String(row["TM56"] ?? "").trim(),
    journalNumber: String(row["JOURNAL NUMBER"] ?? "").trim(),
    journalDate: String(row["JOURNAL DATE"] ?? "").trim(),
    updatedAt: String(row["LAST MODIFIED"] ?? "").trim(),
    image: String(row["IMAGE"] ?? "").trim(),
    tmMatches: row["_tmMatches"],
    journal: row["_journal"],
  };
}

type SupabaseTrademarkRow = {
  id: string;
  filing_date: string;
  type: string;
  client_code: string;
  client_name: string | null;
  case_number: string;
  application_name: string;
  tm_cpr_number: string | null;
  nice_class: string | null;
  status: string;
  sub_status: string | null;
  case_type: string | null;
  agent: string | null;
  city: string;
  notes?: string | null;
  tm5: boolean;
  tm6: boolean;
  tm11: boolean;
  tm16: boolean;
  tm56: boolean;
  journal_number: string | null;
  journal_date: string | null;
  journal_data?: JournalRecord | null;
  logo_path?: string | null;
  legacy_image_url?: string | null;
  updated_at: string;
  created_at?: string;
  version?: number;
  // Publication workflow fields
  publication_date?: string | null;
  opposition_deadline?: string | null;
  demand_note_received?: boolean;
  demand_note_date?: string | null;
  // Stage payment placeholder fields (migration 202609220003)
  stage1_paid?: boolean;
  stage1_paid_date?: string | null;
  stage2_paid?: boolean;
  stage2_paid_date?: string | null;
  stage3_paid?: boolean;
  stage3_paid_date?: string | null;
  stage4_paid?: boolean;
  stage4_paid_date?: string | null;
  payment_reference?: string | null;
};

function ensureConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");
  }
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function rowToRecord(row: SupabaseTrademarkRow, signedImage = ""): TrademarkRecord {
  const matches: TmMatches = {
    TM5: row.tm5,
    TM6: row.tm6,
    TM11: row.tm11,
    TM16: row.tm16,
    TM56: row.tm56,
    TM5_date: undefined,
    TM6_date: undefined,
    TM11_date: undefined,
    TM16_date: undefined,
    TM56_date: undefined,
  };
  return {
    id: row.id,
    date: row.filing_date,
    type: row.type,
    prefix: row.type,
    clientCode: row.client_code,
    clientNo: row.client_code,
    caseNumber: row.case_number,
    folderNo: row.case_number,
    caseNo: row.case_number,
    clientName: row.client_name ?? "",
    appName: row.application_name,
    tmCprNo: row.tm_cpr_number ?? "",
    tmNo: row.tm_cpr_number ?? "",
    appClass: row.nice_class ?? "",
    stage: row.status,
    subStage: row.sub_status ?? "",
    caseType: row.case_type ?? "",
    agent: row.agent ?? "",
    city: row.city,
    notes: row.notes ?? "",
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    version: row.version ?? 1,
    image: signedImage || row.legacy_image_url || "",
    imagePath: row.logo_path || row.legacy_image_url || "",
    tm5: row.tm5 ? "YES" : "",
    tm6: row.tm6 ? "YES" : "",
    tm11: row.tm11 ? "YES" : "",
    tm16: row.tm16 ? "YES" : "",
    tm56: row.tm56 ? "YES" : "",
    journalNumber: row.journal_number ?? "",
    journalDate: row.journal_date ?? "",
    tmMatches: matches,
    journal: row.journal_data,
    // Publication fields
    publicationDate: row.publication_date ?? null,
    oppositionDeadline: row.opposition_deadline ?? null,
    demandNoteReceived: row.demand_note_received ?? false,
    demandNoteDate: row.demand_note_date ?? null,
    // Stage payment placeholder fields (manual — not auto-verified)
    stage1Paid: row.stage1_paid ?? false,
    stage1PaidDate: row.stage1_paid_date ?? null,
    stage2Paid: row.stage2_paid ?? false,
    stage2PaidDate: row.stage2_paid_date ?? null,
    stage3Paid: row.stage3_paid ?? false,
    stage3PaidDate: row.stage3_paid_date ?? null,
    stage4Paid: row.stage4_paid ?? false,
    stage4PaidDate: row.stage4_paid_date ?? null,
    paymentReference: row.payment_reference ?? null,
  };
}

async function mapRows(rows: SupabaseTrademarkRow[], signImages = false): Promise<TrademarkRecord[]> {
  if (!signImages) return mergeRegistryMatches(rows.map((row) => rowToRecord(row)));
  const paths = rows.map((row) => row.logo_path).filter((path): path is string => Boolean(path));
  const signedByPath = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from(TRADEMARK_FILES_BUCKET).createSignedUrls(paths, 3600);
    data?.forEach((item, index) => {
      if (item.signedUrl) signedByPath.set(paths[index], item.signedUrl);
    });
  }
  return mergeRegistryMatches(rows.map((row) => rowToRecord(row, row.logo_path ? signedByPath.get(row.logo_path) ?? "" : "")));
}

async function mergeRegistryMatches(records: TrademarkRecord[]): Promise<TrademarkRecord[]> {
  const numbers = [...new Set(records.map((record) => record.tmCprNo.replace(/\D/g, "")).filter(Boolean))];
  if (!numbers.length) return records;

  const { data, error } = await supabase
    .from("form_registry")
    .select("tm_number_norm, form_type, form_date")
    .in("tm_number_norm", numbers);
  if (error) return records;

  const byNumber = new Map<string, Map<string, string>>();
  const rows = Array.isArray(data) ? data : [];
  for (const row of rows) {
    const key = String(row.tm_number_norm ?? "");
    const formType = String(row.form_type ?? "").toUpperCase();
    if (!byNumber.has(key)) byNumber.set(key, new Map());
    if (row.form_date) {
      byNumber.get(key)?.set(formType, String(row.form_date));
    }
  }

  return records.map((record) => {
    const found = byNumber.get(record.tmCprNo.replace(/\D/g, ""));
    if (!found?.size) return record;
    const tmMatches: TmMatches = {
      TM5: Boolean(record.tmMatches?.TM5 || found.has("TM5")),
      TM6: Boolean(record.tmMatches?.TM6 || found.has("TM6")),
      TM11: Boolean(record.tmMatches?.TM11 || found.has("TM11")),
      TM16: Boolean(record.tmMatches?.TM16 || found.has("TM16")),
      TM56: Boolean(record.tmMatches?.TM56 || found.has("TM56")),
      TM5_date: found.get("TM5"),
      TM6_date: found.get("TM6"),
      TM11_date: found.get("TM11"),
      TM16_date: found.get("TM16"),
      TM56_date: found.get("TM56"),
    };
    return {
      ...record,
      tmMatches,
      tm5: tmMatches.TM5 ? "YES" : record.tm5,
      tm6: tmMatches.TM6 ? "YES" : record.tm6,
      tm11: tmMatches.TM11 ? "YES" : record.tm11,
      tm16: tmMatches.TM16 ? "YES" : record.tm16,
      tm56: tmMatches.TM56 ? "YES" : record.tm56,
    };
  });
}

const TRADEMARK_LIST_COLUMNS = [
  "id", "filing_date", "type", "client_code", "client_name", "case_number",
  "application_name", "tm_cpr_number", "nice_class", "status", "sub_status",
  "case_type", "agent", "city", "tm5", "tm6", "tm11", "tm16", "tm56",
  "journal_number", "journal_date", "logo_path", "legacy_image_url", "created_at", "updated_at", "version",
  // Publication fields
  "publication_date", "opposition_deadline", "demand_note_received", "demand_note_date",
  // Stage payment placeholder fields (migration 202609220003)
  "stage1_paid", "stage1_paid_date",
  "stage2_paid", "stage2_paid_date",
  "stage3_paid", "stage3_paid_date",
  "stage4_paid", "stage4_paid_date",
  "payment_reference",
].join(",");

/**
 * Normalizes ordinary business string values to UPPERCASE.
 * Preserves null/undefined/empty appropriately.
 */
export function normalizeBusinessUpper(val: string | null | undefined): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  return s ? s.toUpperCase() : null;
}

export function normalizeBusinessUpperRequired(val: string | null | undefined, fallback = ""): string {
  if (!val) return fallback;
  return String(val).trim().toUpperCase();
}

/**
 * Stage document section visibility rule:
 * Show if:
 * A. The stage is the current stage
 * OR
 * B. That stage already contains existing documents (docCount > 0) - preserves historical documents
 * Earlier stages without documents are hidden to reduce clutter
 */
export function isStageDocumentSectionVisible(
  sectionStage: string,
  currentStage?: string,
  docCount = 0
): boolean {
  // Always show if it has documents (historical preservation)
  if (docCount > 0) return true;
  
  // Always show current stage
  if (sectionStage.toUpperCase() === currentStage?.toUpperCase()) return true;
  
  // Hide empty future or earlier stages
  return false;
}

export function inputToRow(input: TrademarkInput) {
  const image = input.image?.trim() || null;
  const externalImage = image?.startsWith("http") ?? false;
  return {
    filing_date: input.date,
    type: normalizeBusinessUpperRequired(input.type ?? input.prefix),
    client_code: normalizeBusinessUpperRequired(input.clientCode ?? input.clientNo),
    client_name: normalizeBusinessUpper(input.clientName),
    case_number: normalizeBusinessUpperRequired(input.caseNumber ?? input.caseNo ?? input.folderNo),
    application_name: normalizeBusinessUpperRequired(input.appName),
    tm_cpr_number: normalizeBusinessUpper(input.tmCprNo ?? input.tmNo),
    nice_class: normalizeBusinessUpper(input.appClass),
    status: input.stage ? input.stage.trim().toUpperCase() : "STAGE 1",
    sub_status: input.subStage ? normalizeWorkflowValue(input.subStage) : null,
    case_type: normalizeBusinessUpper(input.caseType),
    agent: normalizeBusinessUpper(input.agent),
    city: normalizeBusinessUpperRequired(input.city, "ISLAMABAD"),
    notes: input.notes ?? null, // PRESERVE ORIGINAL CASE for free-form remarks
    logo_path: externalImage ? null : image, // PRESERVE EXACT PATH
    legacy_image_url: externalImage ? image : null, // PRESERVE EXACT URL
  };
}

const TM_FORM_COLUMNS: Record<TmFormKey, "tm5" | "tm6" | "tm11" | "tm16" | "tm56"> = {
  TM5: "tm5", TM6: "tm6", TM11: "tm11", TM16: "tm16", TM56: "tm56",
};

function safeSearchTerm(value: string) {
  return value.trim().replace(/[(),]/g, " ").replace(/\s+/g, " ");
}

export async function listTrademarkPage(params: TrademarkListParams = {}): Promise<TrademarkPage> {
  ensureConfigured();
  const pageSize = Math.min(500, Math.max(1, params.pageSize ?? 50));
  const page = Math.max(1, params.page ?? 1);
  const start = (page - 1) * pageSize;
  let query = supabase
    .from("trademarks")
    .select(params.includeDetails ? "*" : TRADEMARK_LIST_COLUMNS, { count: "exact" })
    .order("filing_date", { ascending: false })
    .order("updated_at", { ascending: false })
    .order("type", { ascending: true })
    .order("client_code", { ascending: true })
    .order("case_number", { ascending: true })
    .range(start, start + pageSize - 1);

  const search = params.search ? safeSearchTerm(params.search) : "";
  if (search) {
    const pattern = `%${search}%`;
    query = query.or([
      `client_name.ilike.${pattern}`,
      `client_code.ilike.${pattern}`,
      `case_number.ilike.${pattern}`,
      `application_name.ilike.${pattern}`,
      `tm_cpr_number.ilike.${pattern}`,
      `nice_class.ilike.${pattern}`,
      `agent.ilike.${pattern}`,
      `city.ilike.${pattern}`,
    ].join(","));
  }
  if (params.dateFrom) query = query.gte("filing_date", params.dateFrom);
  if (params.dateTo) query = query.lte("filing_date", params.dateTo);
  if (params.type) query = query.eq("type", params.type);
  if (params.clientCode) query = query.ilike("client_code", `%${safeSearchTerm(params.clientCode)}%`);
  if (params?.stage) query = query.eq("status", params.stage);
  if (params?.subStage) {
    const term = safeSearchTerm(params.subStage);
    let altTerm: string | null = null;
    if (/demand\s*note/i.test(term)) altTerm = "D-Note";
    else if (/d-note/i.test(term)) altTerm = "Demand Note";
    else if (/opposition/i.test(term)) altTerm = "OPPO";
    else if (/oppo/i.test(term)) altTerm = "Opposition";

    if (altTerm) {
      query = query.or(`sub_status.ilike.%${term}%,sub_status.ilike.%${altTerm}%`);
    } else {
      query = query.ilike("sub_status", `%${term}%`);
    }
  }
  if (params?.city) query = query.eq("city", params.city);
  if (params?.caseType) query = query.eq("case_type", params.caseType);
  if (params?.agent) query = query.eq("agent", params.agent);
  if (params?.appClass) query = query.eq("nice_class", params.appClass);
  if (params.tmForm) query = query.eq(TM_FORM_COLUMNS[params.tmForm], true);

  const { data, error, count } = await query;
  throwIfError(error);
  return {
    records: await mapRows((data ?? []) as unknown as SupabaseTrademarkRow[], true),
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function listTrademarks(params: Omit<TrademarkListParams, "page" | "pageSize"> = {}): Promise<TrademarkRecord[]> {
  const first = await listTrademarkPage({ ...params, page: 1, pageSize: 500 });
  const records = [...first.records];
  for (let page = 2; records.length < first.total; page += 1) {
    const next = await listTrademarkPage({ ...params, page, pageSize: 500 });
    records.push(...next.records);
  }
  return records;
}

export async function listTrademarksForExport(params: Omit<TrademarkListParams, "page" | "pageSize" | "includeDetails"> = {}) {
  return listTrademarks({ ...params, includeDetails: true });
}

export async function getRecord(id: string): Promise<TrademarkRecord | null> {
  ensureConfigured();
  const { data, error } = await supabase.from("trademarks").select("*").eq("id", id).maybeSingle();
  throwIfError(error);
  if (!data) return null;
  return (await mapRows([data as SupabaseTrademarkRow], true))[0];
}

export async function getTrademark(id: string): Promise<TrademarkRecord | null> {
  return getRecord(id);
}

export async function searchTm(tmNo: string): Promise<TmSearchResult> {
  ensureConfigured();
  const { data, error } = await supabase
    .from("trademarks")
    .select("*")
    .ilike("tm_cpr_number", tmNo.trim())
    .order("updated_at", { ascending: false });
  throwIfError(error);
  const records = await mapRows((data ?? []) as SupabaseTrademarkRow[]);
  const recordsWithDates = await mergeRegistryMatches(records);
  const first = recordsWithDates[0];
  return {
    records: recordsWithDates,
    tmMatches: first?.tmMatches ?? { TM5: false, TM6: false, TM11: false, TM16: false, TM56: false },
    journal: first?.journal ?? null,
  };
}

export class ConflictError extends Error {
  constructor(message = "Record was modified by another user. Reload and try again.") {
    super(message);
    this.name = "ConflictError";
  }
}

export class StagePaymentRequiredError extends Error {
  constructor(message = "Previous stage payment is required before proceeding.") {
    super(message);
    this.name = "StagePaymentRequiredError";
  }
}

/**
 * Validates stage forward-only workflow transition.
 * Stage 1 -> Stage 2 -> Stage 3 -> Stage 4.
 * STOPPED can be entered from any stage, but cannot be exited.
 * Backward transitions (e.g. Stage 2 -> Stage 1, Stage 4 -> Stage 3) are rejected.
 */
export function isValidStageTransition(fromStage: string, toStage: string): boolean {
  if (!STAGES.includes(fromStage as StageType) || !STAGES.includes(toStage as StageType)) return false;
  if (fromStage === toStage) return true;
  if (toStage === "STOPPED") return true;
  if (fromStage === "STOPPED") return false;

  const stageOrder: Record<string, number> = {
    "STAGE 1": 1,
    "STAGE 2": 2,
    "STAGE 3": 3,
    "STAGE 4": 4,
  };

  const fromIndex = stageOrder[fromStage];
  const toIndex = stageOrder[toStage];

  if (fromIndex !== undefined && toIndex !== undefined) {
    return toIndex === fromIndex + 1;
  }

  return false;
}

/** Sub-stage transitions are deliberately explicit: Stage 2 outcomes are alternatives. */
export const SUB_STAGE_TRANSITIONS: Record<string, Record<string, string[]>> = {
  "STAGE 1": { Filing: ["Examination", "Acknowledgment"], Examination: ["Acknowledgment"], Acknowledgment: [] },
  "STAGE 2": { Assigned: ["Accepted", "Hearing"], Accepted: [], Hearing: [] },
  "STAGE 3": { Published: ["D-Note Received"], "D-Note Received": ["D-Note Submitted"], "D-Note Submitted": [] },
  "STAGE 4": { "CER Acknowledge": ["CER Received"], "CER Received": ["CER Dispatch"], "CER Dispatch": [] },
};
const COMPLETED_SUB_STAGES: Record<string, string[]> = {
  "STAGE 1": ["Acknowledgment"], "STAGE 2": ["Accepted", "Hearing"],
  "STAGE 3": ["D-Note Submitted"], "STAGE 4": ["CER Dispatch"],
};
export function workflowTransitionError(fromStage: string, fromSub: string | null | undefined,
  toStage: string, toSub: string | null | undefined): string | null {
  if (!isValidStageTransition(fromStage, toStage)) return `Backward workflow transitions are not allowed (cannot move from ${fromStage} to ${toStage}). Stages cannot be skipped.`;
  if (toStage === "STOPPED") return toSub ? "STOPPED has no sub-stage." : null;
  const current = normalizeWorkflowValue(fromSub || "");
  const target = normalizeWorkflowValue(toSub || "");
  // Keep legacy records editable without pretending their old workflow is valid.
  if (fromStage === toStage && current === target) return null;
  if (!STATUS_WORKFLOW[toStage]?.includes(target)) return `Invalid sub-stage "${toSub || ""}" for ${toStage}.`;
  if (fromStage !== toStage) {
    if (!COMPLETED_SUB_STAGES[fromStage]?.includes(current)) return `Complete ${fromStage} before moving to ${toStage}.`;
    if (target !== STATUS_WORKFLOW[toStage][0]) return `Enter ${toStage} at ${STATUS_WORKFLOW[toStage][0]}.`;
  } else if (!SUB_STAGE_TRANSITIONS[fromStage]?.[current]?.includes(target)) {
    return `Cannot move from ${current || "an unspecified sub-stage"} to ${target}.`;
  }
  return null;
}
export function availableWorkflowSubStages(fromStage: string, fromSub: string, targetStage: string): string[] {
  const candidates = STATUS_WORKFLOW[targetStage] || [];
  return candidates.filter(sub => !workflowTransitionError(fromStage, fromSub, targetStage, sub));
}

/**
 * Validates payment gates for moving into a target stage.
 * To enter STAGE 2: stage1_paid must be true.
 * To enter STAGE 3: stage2_paid must be true.
 * To enter STAGE 4: stage3_paid must be true.
 */
export function validatePaymentGate(
  targetStage: string,
  record: { stage1_paid?: boolean; stage2_paid?: boolean; stage3_paid?: boolean }
): void {
  if (targetStage === "STAGE 2") {
    if (!record.stage1_paid) {
      throw new StagePaymentRequiredError("Stage 2 cannot be started until Stage 1 payment is cleared.");
    }
  } else if (targetStage === "STAGE 3") {
    if (!record.stage1_paid) {
      throw new StagePaymentRequiredError("Stage 3 cannot be started until Stage 1 payment is cleared.");
    }
    if (!record.stage2_paid) {
      throw new StagePaymentRequiredError("Stage 3 cannot be started until Stage 2 payment is cleared.");
    }
  } else if (targetStage === "STAGE 4") {
    if (!record.stage1_paid) {
      throw new StagePaymentRequiredError("Stage 4 cannot be started until Stage 1 payment is cleared.");
    }
    if (!record.stage2_paid) {
      throw new StagePaymentRequiredError("Stage 4 cannot be started until Stage 2 payment is cleared.");
    }
    if (!record.stage3_paid) {
      throw new StagePaymentRequiredError("Stage 4 cannot be started until Stage 3 payment is cleared.");
    }
  }
}

export function isStage2PaymentRequired(stage?: string, stage1Paid?: boolean): boolean {
  return stage === "STAGE 2" && !stage1Paid;
}

export function validateStage2PaymentGate(stage?: string, stage1Paid?: boolean): void {
  validatePaymentGate(stage || "", { stage1_paid: stage1Paid });
}

export async function createTrademark(input: TrademarkInput): Promise<{ id: string; caseNumber: string }> {
  ensureConfigured();

  const targetStage = input.stage || "STAGE 1";
  const targetSubStage = input.subStage || "Filing";

  // Validate workflow values if stage is supplied
  if (!STAGES.includes(targetStage as any)) {
    throw new Error(`Invalid stage "${targetStage}". Permitted stages: ${STAGES.join(", ")}`);
  }
  if (targetStage in STATUS_WORKFLOW) {
    const validSubStages = STATUS_WORKFLOW[targetStage] || [];
    const normalizedSub = normalizeWorkflowValue(targetSubStage);
    const isValid = validSubStages.some(
      (s) => s === targetSubStage || normalizeWorkflowValue(s) === normalizedSub,
    );
    if (!isValid) {
      throw new Error(`Invalid sub-stage "${targetSubStage}" for ${targetStage}.`);
    }
  }

  if (targetStage !== "STAGE 1" || targetSubStage !== "Filing") {
    throw new Error("New cases must start at Stage 1 / Filing. Historical imports use the import workflow.");
  }
  if (input.agent?.trim()) throw new Error("Assign the agent when the case reaches Stage 2 / Assigned.");
  const filingDate = input.date || new Date().toISOString().split("T")[0];

  // Prepare initial row data with Batch 1 defaults
  const rowPayload: Record<string, any> = {
    ...inputToRow({ ...input, stage: targetStage, subStage: targetSubStage }),
    stage1_paid: input.stage1Paid ?? true,
    stage1_paid_date: input.stage1PaidDate ?? filingDate,
  };

  if (input.stage2Paid !== undefined) rowPayload.stage2_paid = input.stage2Paid;
  if (input.stage3Paid !== undefined) rowPayload.stage3_paid = input.stage3Paid;
  if (input.stage4Paid !== undefined) rowPayload.stage4_paid = input.stage4Paid;

  // Validate payment gate for target stage
  validatePaymentGate(targetStage, {
    stage1_paid: rowPayload.stage1_paid,
    stage2_paid: rowPayload.stage2_paid,
    stage3_paid: rowPayload.stage3_paid,
  });

  const { data: authData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("trademarks")
    .insert({ ...rowPayload, created_by: authData.user?.id, updated_by: authData.user?.id })
    .select("id,case_number")
    .single();
  throwIfError(error);
  if (!data) throw new Error("Supabase did not return the created record.");
  return { id: data.id, caseNumber: data.case_number };
}

/**
 * Assigns an agent to a Stage 2 Assigned trademark.
 * Agent assignment is part of Stage 2 workflow and does NOT require Stage 2 payment.
 * Reuses existing agent string field and agents master profiles.
 */
export async function assignStage2Agent(
  id: string,
  agentName: string,
  city?: string,
): Promise<void> {
  ensureConfigured();
  if (!agentName || !agentName.trim()) {
    throw new Error("Agent name is required.");
  }
  const { data: current, error: readError } = await supabase.from("trademarks")
    .select("status,sub_status,version").eq("id", id).single();
  throwIfError(readError);
  if (!current) throw new Error("Record not found.");
  if (current.status !== "STAGE 2" || current.sub_status !== "Assigned") {
    throw new Error("Agents can only be assigned in Stage 2 / Assigned.");
  }
  const patch: Record<string, string> = {
    agent: agentName.trim().toUpperCase(),
  };
  if (city && city.trim()) {
    patch.city = city.trim().toUpperCase();
  }
  const { error } = await supabase
    .from("trademarks")
    .update(patch)
    .eq("id", id);
  throwIfError(error);
}

/**
 * Updates a trademark's stage and sub-stage directly.
 * Enforces strict forward-only workflow and payment gates.
 * Normalizes user-facing subStage values to database values.
 * Requires STOPPED reason when entering STOPPED state.
 */
export async function updateTrademarkStatus(
  id: string,
  stage: string,
  subStage?: string | null,
  stoppedReason?: string,
): Promise<void> {
  ensureConfigured();

  // Validate stage
  if (!STAGES.includes(stage as any)) {
    throw new Error(`Invalid stage "${stage}". Permitted stages: ${STAGES.join(", ")}`);
  }

  // Validate subStage if supplied
  if (subStage && stage in STATUS_WORKFLOW) {
    const validSubStages = STATUS_WORKFLOW[stage] || [];
    const normalizedSub = normalizeWorkflowValue(subStage);
    const isValid = validSubStages.some(
      (s) => s === subStage || normalizeWorkflowValue(s) === normalizedSub,
    );
    if (!isValid) {
      throw new Error(`Invalid sub-stage "${subStage}" for ${stage}.`);
    }
  }

  // STOPPED requires reason
  if (stage === "STOPPED" && !stoppedReason?.trim()) {
    throw new Error("STOPPED requires a reason. Please provide a reason for stopping this case.");
  }

  const { data: current, error: fetchErr } = await supabase
    .from("trademarks")
    .select("status, sub_status, version, stage1_paid, stage2_paid, stage3_paid, stage4_paid, notes")
    .eq("id", id)
    .single();
  throwIfError(fetchErr);

  if (!current) throw new Error("Record not found.");
  const transitionError = workflowTransitionError(current.status, current.sub_status, stage, subStage);
  if (transitionError) throw new Error(transitionError);
  if (current.status !== stage) validatePaymentGate(stage, current);

  const canonicalSubStage = subStage ? normalizeWorkflowValue(subStage) : null;
  const updateData: Record<string, any> = {
    status: stage,
    sub_status: canonicalSubStage,
  };

  // If entering STOPPED, append reason to notes
  if (stage === "STOPPED" && stoppedReason?.trim()) {
    const existingNotes = current?.notes || "";
    const timestamp = new Date().toISOString();
    updateData.notes = existingNotes 
      ? `${existingNotes}\n\nSTOPPED: ${stoppedReason} (${timestamp})`
      : `STOPPED: ${stoppedReason} (${timestamp})`;
  }

  const { error } = await supabase
    .from("trademarks")
    .update(updateData)
    .eq("id", id);
  throwIfError(error);
}

/**
 * Updates a trademark's assigned agent and city.
 * Agent assignment does NOT require payment gate - it's part of Stage 2 workflow.
 */
export async function updateTrademarkAgent(
  id: string,
  agentName: string,
  city?: string,
): Promise<void> {
  return assignStage2Agent(id, agentName, city);
}

export async function updateTrademark(
  id: string,
  input: TrademarkInput,
  expectedVersion?: number,
): Promise<{ id: string; version: number }> {
  ensureConfigured();

  if (input.stage && !STAGES.includes(input.stage as StageType)) throw new Error(`Invalid stage "${input.stage}".`);
  if (input.stage && input.subStage && input.stage !== "STOPPED" && !STATUS_WORKFLOW[input.stage]?.includes(normalizeWorkflowValue(input.subStage))) {
    throw new Error(`Invalid sub-stage "${input.subStage}" for ${input.stage}.`);
  }
  const { data: current, error: fetchErr } = await supabase.from("trademarks")
    .select("status,sub_status,agent,notes,version,stage1_paid,stage2_paid,stage3_paid").eq("id", id).single();
  throwIfError(fetchErr);
  if (!current) throw new Error("Record not found.");
  const targetStage = input.stage ?? current.status;
  const targetSub = input.subStage ?? current.sub_status;
  if (targetStage === "STOPPED" && current.status !== "STOPPED") {
    throw new Error("Use Update Status to stop a case with a mandatory reason.");
  }
  const transitionError = workflowTransitionError(current.status, current.sub_status, targetStage, targetSub);
  if (transitionError) throw new Error(transitionError);
  if (targetStage !== current.status) validatePaymentGate(targetStage, current);
  if (input.agent !== undefined && input.agent.trim().toUpperCase() !== (current.agent || "").toUpperCase()
      && (current.status !== "STAGE 2" || current.sub_status !== "Assigned")) {
    throw new Error("Agents can only be assigned in Stage 2 / Assigned.");
  }

  let query = supabase.from("trademarks").update(inputToRow(input)).eq("id", id);
  if (expectedVersion !== undefined) {
    query = query.eq("version", expectedVersion);
  }
  const { data, error } = await query.select("id,version").maybeSingle();
  throwIfError(error);
  if (!data) {
    if (expectedVersion !== undefined) {
      throw new ConflictError();
    }
    throw new Error("Supabase did not return the updated record.");
  }
  return { id: data.id, version: data.version ?? expectedVersion ?? 1 };
}

export async function deleteTrademark(id: string): Promise<void> {
  ensureConfigured();
  const { error } = await supabase.from("trademarks").delete().eq("id", id);
  throwIfError(error);
}

/**
 * Persist a single stage payment tick + date + optional reference.
 * Manual / placeholder only — payment is NOT auto-verified.
 * Does not touch the trademark version or trigger ConflictError.
 */
export async function updateStagePayment(
  id: string,
  stage: 1 | 2 | 3 | 4,
  paid: boolean,
  paidDate?: string | null,
  reference?: string | null,
): Promise<void> {
  ensureConfigured();
  const patch: Record<string, boolean | string | null> = {
    [`stage${stage}_paid`]: paid,
    [`stage${stage}_paid_date`]: paid ? (paidDate ?? null) : null,
  };
  if (reference !== undefined) {
    patch["payment_reference"] = reference ?? null;
  }
  const { error } = await supabase.from("trademarks").update(patch).eq("id", id);
  throwIfError(error);
}

export async function getStats(filters?: DashboardStatsFilters): Promise<TrademarkStats> {
  ensureConfigured();
  const exactCount = async (column?: string, value?: string | boolean, gte?: string) => {
    let query = supabase.from("trademarks").select("id", { count: "exact", head: true });
    if (column && gte) query = query.gte(column, gte);
    else if (column && value !== undefined) query = query.eq(column, value);

    if (filters?.agent) query = query.eq("agent", filters.agent);
    if (filters?.appClass) query = query.eq("nice_class", filters.appClass);

    const { count, error } = await query;
    throwIfError(error);
    return count ?? 0;
  };

  // Get all actual cities from database (not just predefined CITIES array)
  const getCitiesFromDb = async (): Promise<Array<{ city: string; count: number }>> => {
    let query = supabase.from("trademarks").select("city");
    if (filters?.agent) query = query.eq("agent", filters.agent);
    if (filters?.appClass) query = query.eq("nice_class", filters.appClass);
    
    const { data, error } = await query;
    throwIfError(error);
    
    // Count occurrences of each city from actual data
    const cityCounts = new Map<string, number>();
    (data ?? []).forEach((row) => {
      const city = row.city || "UNSPECIFIED";
      cityCounts.set(city, (cityCounts.get(city) || 0) + 1);
    });
    
    // Convert to array and sort by count descending
    return Array.from(cityCounts.entries())
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count);
  };

  const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [total, recentlyModified, stageCounts, cityCounts, tmCounts] = await Promise.all([
    exactCount(),
    exactCount("updated_at", undefined, recentCutoff),
    Promise.all(STAGES.map(async (stage) => ({ stage, count: await exactCount("status", stage) }))),
    getCitiesFromDb(),
    Promise.all(TM_FORMS.map(async (form) => ({ form, count: await exactCount(TM_FORM_COLUMNS[form], true) }))),
  ]);

  return {
    total,
    recentlyModified,
    byStage: stageCounts.filter(({ count }) => count > 0),
    byCity: cityCounts.filter(({ count }) => count > 0),
    byNumericStage: stageCounts.filter(({ stage }) => /^STAGE \d+$/.test(stage)),
    byTmForm: tmCounts,
  };
}

export async function listAuditLogs(limit = 100, offset = 0): Promise<AuditLogEntry[]> {
  ensureConfigured();
  const { data, error } = await supabase.from("audit_logs").select("*")
    .order("changed_at", { ascending: false }).range(offset, offset + limit - 1);
  throwIfError(error);
  return (data ?? []).map((row) => {
    const nr = row.new_record as Record<string, unknown> | null;
    const or = row.old_record as Record<string, unknown> | null;
    return {
      id: row.id,
      changedAt: row.changed_at,
      changedBy: row.changed_by ?? "system",
      action: row.action,
      recordId: row.trademark_id ?? "",
      caseNo: String(nr?.case_number ?? or?.case_number ?? ""),
      record: String(nr?.case_number ?? or?.case_number ?? row.trademark_id ?? ""),
      field: "RECORD",
      oldValue: or ? JSON.stringify(or) : "",
      newValue: nr ? JSON.stringify(nr) : "",
      applicationNumber: String(nr?.tm_cpr_number ?? or?.tm_cpr_number ?? "") || undefined,
      applicationName: String(nr?.application_name ?? or?.application_name ?? "") || undefined,
      clientCode: String(nr?.client_code ?? or?.client_code ?? "") || undefined,
      caseType: String(nr?.type ?? or?.type ?? "") || undefined,
    };
  });
}

export async function getWorkflowHistory(trademarkId: string): Promise<TrademarkWorkflowEvent[]> {
  ensureConfigured();
  const { data, error } = await supabase
    .from("trademark_workflow_history")
    .select("*, profiles!changed_by(display_name)")
    .eq("trademark_id", trademarkId)
    .order("event_at", { ascending: false });

  throwIfError(error);

  return (data ?? []).map((row: any) => ({
    id: row.id,
    trademarkId: row.trademark_id,
    eventType: row.event_type,
    fromStatus: row.from_status,
    fromSubStatus: row.from_sub_status,
    toStatus: row.to_status,
    toSubStatus: row.to_sub_status,
    eventAt: row.event_at,
    changedBy: row.changed_by,
    changedByName: row.profiles?.display_name || "Unknown User",
  }));
}

export async function listAgents(): Promise<string[]> {
  ensureConfigured();
  const { data, error } = await supabase.from("trademarks").select("agent").not("agent", "is", null).order("agent");
  throwIfError(error);
  return Array.from(new Set((data ?? []).map((row) => row.agent).filter((agent): agent is string => Boolean(agent))));
}

export interface ClientRef {
  code: string;
  name: string;
}

export async function listClients(): Promise<ClientRef[]> {
  ensureConfigured();
  const { data, error } = await supabase.from("clients").select("code,name").order("code");
  throwIfError(error);
  return data ?? [];
}

export async function uploadImage(
  file: File,
  onProgress?: (progressPercent: number) => void
): Promise<UploadImageResult> {
  ensureConfigured();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error("Please sign in before uploading files.");
  if (file.size > 10 * 1024 * 1024) throw new Error("File must be 10 MB or smaller.");
  const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `pending/${authData.user.id}/${crypto.randomUUID()}.${extension}`;
  onProgress?.(20);
  const { error } = await supabase.storage.from(TRADEMARK_FILES_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  throwIfError(error);
  onProgress?.(80);
  const { data } = await supabase.storage.from(TRADEMARK_FILES_BUCKET).createSignedUrl(path, 3600);
  onProgress?.(100);
  return { fileId: path, url: data?.signedUrl ?? "", thumbnailUrl: data?.signedUrl ?? "" };
}

// =============================================================================
// NEW: AGENT INTERFACES
// =============================================================================

/** One agent in the agents master table */
export interface Agent {
  id: string;
  name: string;
  city: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Agent with computed fee summary stats (from agent_summary view) */
export interface AgentWithStats extends Agent {
  casesWithFees: number; // how many trademark cases have fee entries
  totalBilled: number; // total amount charged
  totalPaid: number; // total amount received
  balanceDue: number; // totalBilled - totalPaid
  unpaidEntries: number; // count of unpaid fee rows
}

/** Input when creating or updating an agent */
export interface AgentInput {
  name: string;
  city?: string;
  phone?: string;
  email?: string;
  notes?: string;
  isActive?: boolean;
}

/** One fee entry linked to a trademark case + agent */
export interface AgentFee {
  id: string;
  trademarkId: string;
  agentId: string;
  agentName?: string; // joined from agents table for display
  caseNumber?: string; // joined from trademarks for display
  appName?: string; // joined from trademarks for display
  description: string;
  amountBilled: number;
  amountPaid: number;
  balanceDue: number; // computed: amountBilled - amountPaid
  feeDate: string;
  paid: boolean;
  paidDate: string | null;
  notes: string | null;
  createdAt: string;
}

/** Input when adding or updating a fee entry */
export interface AgentFeeInput {
  trademarkId: string;
  agentId: string;
  description: string;
  amountBilled: number;
  amountPaid?: number;
  feeDate?: string;
  paid?: boolean;
  paidDate?: string | null;
  notes?: string;
}

// =============================================================================
// NEW: PUBLICATION PIPELINE INTERFACE
// =============================================================================

/** A trademark that has been matched to journal data — tracks opposition window & demand note workflow */
export interface PublicationRecord {
  id: string;
  caseNumber: string;
  clientCode: string;
  type: string;
  clientName: string;
  appName: string;
  tmCprNo: string;
  appClass: string;
  journalNumber: string;
  stage: string;
  /** Full user-facing sub-stage label (e.g. "Demand Note Submitted", not "D-Note Submitted") */
  subStage: string;
  agent: string;
  publicationDate: string;
  oppositionDeadline: string;
  daysRemaining: number; // negative = overdue
  demandNoteReceived: boolean;
  demandNoteDate: string | null;
  status: "pending" | "overdue" | "done"; // computed
  date: string; // Filing date
}

// =============================================================================
// NEW: MATCH ENGINE FUNCTIONS
// Calls Supabase RPC functions created in migration 1
// =============================================================================

/** Matches journal_registry rows → trademarks by TM number
 * Updates: journal_number, journal_date, publication_date, journal_data
 * Returns how many trademarks were updated
 */
export async function runJournalMatch(): Promise<{ matched: number; message: string; ranAt: string }> {
  ensureConfigured();
  const { data, error } = await supabase.rpc("run_journal_match");
  throwIfError(error);
  const result = data as { matched_trademarks: number; message: string; ran_at: string; status: string };
  return {
    matched: result.matched_trademarks ?? 0,
    message: result.message ?? "Journal match completed",
    ranAt: result.ran_at ?? new Date().toISOString(),
  };
}

/** Matches form_registry rows → trademarks by TM number
 * Sets tm5/tm6/tm11/tm16/tm56 booleans on matching trademarks
 * Returns count per form type
 */
export async function runFormMatch(): Promise<{ total: number; tm5: number; tm6: number; tm11: number; tm16: number; tm56: number; message: string }> {
  ensureConfigured();
  const { data, error } = await supabase.rpc("run_form_match");
  throwIfError(error);
  const result = data as { total: number; tm5: number; tm6: number; tm11: number; tm16: number; tm56: number; message: string };
  return {
    total: result.total ?? 0,
    tm5: result.tm5 ?? 0,
    tm6: result.tm6 ?? 0,
    tm11: result.tm11 ?? 0,
    tm16: result.tm16 ?? 0,
    tm56: result.tm56 ?? 0,
    message: result.message ?? "Form match completed",
  };
}

// =============================================================================
// NEW: PUBLICATION PIPELINE FUNCTIONS
// Tracks publication → opposition window → demand note workflow
// =============================================================================

/** Returns all trademarks that have been published in the journal
 * with computed daysRemaining and status
 */
export async function listPublicationPipeline(): Promise<PublicationRecord[]> {
  ensureConfigured();
  const { data, error } = await supabase
    .from("trademarks")
    .select(
      "id, case_number, client_code, type, client_name, application_name, tm_cpr_number, nice_class, " +
      "journal_number, status, sub_status, agent, publication_date, opposition_deadline, " +
      "demand_note_received, demand_note_date, filing_date"
    )
    .not("publication_date", "is", null) // only journal-matched cases
    .order("opposition_deadline", { ascending: true, nullsFirst: false });
  throwIfError(error);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (data ?? []).map((row: any) => {
    // Calculate days remaining until opposition deadline
    const deadline = row.opposition_deadline ? new Date(row.opposition_deadline) : null;
    const daysRemaining = deadline ? Math.floor((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : 0;

    // Compute pipeline status label
    let status: "pending" | "overdue" | "done" = "pending";
    if (row.demand_note_received) {
      status = "done";
    } else if (daysRemaining < 0) {
      status = "overdue"; // deadline passed, no demand note yet — action needed
    }

    return {
      id: row.id,
      caseNumber: row.case_number ?? "",
      clientCode: row.client_code ?? "",
      type: row.type ?? "",
      clientName: row.client_name ?? "",
      appName: row.application_name ?? "",
      tmCprNo: row.tm_cpr_number ?? "",
      appClass: row.nice_class ?? "",
      journalNumber: row.journal_number ?? "",
      stage: row.status ?? "",
      // Sub-stage is stored internally (e.g. "D-Note Submitted"); expose full user-facing label
      subStage: formatWorkflowLabel(row.sub_status) ?? "",
      agent: row.agent ?? "",
      publicationDate: row.publication_date ?? "",
      oppositionDeadline: row.opposition_deadline ?? "",
      daysRemaining,
      date: row.filing_date ?? "",
      demandNoteReceived: row.demand_note_received ?? false,
      demandNoteDate: row.demand_note_date ?? null,
      status,
    };
  });
}

/** Marks a case's demand note as received with a date
 * Called when firm physically receives the demand note from IPO
 */
export async function markDemandNoteReceived(trademarkId: string, date: string): Promise<void> {
  ensureConfigured();
  const { error } = await supabase
    .from("trademarks")
    .update({
      demand_note_received: true,
      demand_note_date: date,
    })
    .eq("id", trademarkId);
  throwIfError(error);
}

/** Clears the demand note received flag (undo/correction) */
export async function clearDemandNoteReceived(trademarkId: string): Promise<void> {
  ensureConfigured();
  const { error } = await supabase
    .from("trademarks")
    .update({
      demand_note_received: false,
      demand_note_date: null,
    })
    .eq("id", trademarkId);
  throwIfError(error);
}

// =============================================================================
// NEW: AGENT MANAGEMENT FUNCTIONS
// Note: existing listAgents() returns string[] from trademarks — that stays.
// These new functions work with the agents master table.
// =============================================================================

/** Returns all agents from agents table with fee summary stats (from agent_summary view) */
export async function listAgentProfiles(): Promise<AgentWithStats[]> {
  ensureConfigured();
  const { data, error } = await supabase
    .from("agent_summary")
    .select("*")
    .order("name");
  throwIfError(error);
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    city: row.city ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    notes: null,
    isActive: row.is_active ?? true,
    createdAt: "",
    updatedAt: "",
    casesWithFees: Number(row.cases_with_fees ?? 0),
    totalBilled: Number(row.total_billed ?? 0),
    totalPaid: Number(row.total_paid ?? 0),
    balanceDue: Number(row.balance_due ?? 0),
    unpaidEntries: Number(row.unpaid_entries ?? 0),
  }));
}

/** Creates a new agent in the agents table */
export async function createAgentProfile(input: AgentInput): Promise<Agent> {
  ensureConfigured();
  const { data, error } = await supabase
    .from("agents")
    .insert({
      name: input.name.trim().toUpperCase(),
      city: input.city ? input.city.trim().toUpperCase() : null,
      phone: input.phone ?? null,
      email: input.email ?? null, // PRESERVE ORIGINAL CASE
      notes: input.notes ?? null, // PRESERVE ORIGINAL CASE
      is_active: input.isActive ?? true,
    })
    .select("*")
    .single();
  throwIfError(error);
  return {
    id: data.id,
    name: data.name,
    city: data.city,
    phone: data.phone,
    email: data.email,
    notes: data.notes,
    isActive: data.is_active,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/** Updates an existing agent */
export async function updateAgentProfile(id: string, input: Partial<AgentInput>): Promise<void> {
  ensureConfigured();
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim().toUpperCase();
  if (input.city !== undefined) patch.city = input.city ? input.city.trim().toUpperCase() : null;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.email !== undefined) patch.email = input.email; // PRESERVE ORIGINAL CASE
  if (input.notes !== undefined) patch.notes = input.notes; // PRESERVE ORIGINAL CASE
  if (input.isActive !== undefined) patch.is_active = input.isActive;
  const { error } = await supabase.from("agents").update(patch).eq("id", id);
  throwIfError(error);
}

// =============================================================================
// NEW: AGENT FEE FUNCTIONS
// Per-case fee entries linked to agents
// =============================================================================

/** Fetch all fee entries for a specific trademark case (for RecordView fees tab) */
export async function listFeesForTrademark(trademarkId: string): Promise<AgentFee[]> {
  ensureConfigured();
  const { data, error } = await supabase
    .from("agent_fees")
    .select("*, agents(name)")
    .eq("trademark_id", trademarkId)
    .order("fee_date", { ascending: false });
  throwIfError(error);
  return (data ?? []).map(mapFeeRow);
}

/** Fetch all fee entries for a specific agent (for AgentsPage detail view) */
export async function listFeesForAgent(agentId: string): Promise<AgentFee[]> {
  ensureConfigured();
  const { data, error } = await supabase
    .from("agent_fees")
    .select("*, trademarks(case_number, application_name)")
    .eq("agent_id", agentId)
    .order("fee_date", { ascending: false });
  throwIfError(error);
  return (data ?? []).map(mapFeeRow);
}

/** Add a new fee entry */
export async function addAgentFee(input: AgentFeeInput): Promise<AgentFee> {
  ensureConfigured();
  const { data: authData } = await supabase.auth.getUser();
  const amountBilled = input.amountBilled ?? 0;
  const amountPaid = input.amountPaid ?? 0;
  const isPaid = input.paid ?? (amountPaid >= amountBilled && amountBilled > 0);
  const { data, error } = await supabase
    .from("agent_fees")
    .insert({
      trademark_id: input.trademarkId,
      agent_id: input.agentId,
      description: input.description,
      amount_billed: amountBilled,
      amount_paid: amountPaid,
      fee_date: input.feeDate ?? new Date().toISOString().slice(0, 10),
      paid: isPaid,
      paid_date: input.paidDate ?? (isPaid ? new Date().toISOString().slice(0, 10) : null),
      notes: input.notes ?? null,
      created_by: authData.user?.id,
    })
    .select("*, agents(name), trademarks(case_number, application_name)")
    .single();
  throwIfError(error);
  return mapFeeRow(data);
}

/** Update a fee entry (e.g. mark as paid, update amount) */
export async function updateAgentFee(id: string, input: Partial<AgentFeeInput>): Promise<void> {
  ensureConfigured();
  const patch: Record<string, unknown> = {};
  if (input.description !== undefined) patch.description = input.description;
  if (input.amountBilled !== undefined) patch.amount_billed = input.amountBilled;
  if (input.amountPaid !== undefined) patch.amount_paid = input.amountPaid;
  if (input.feeDate !== undefined) patch.fee_date = input.feeDate;
  if (input.paid !== undefined) patch.paid = input.paid;
  if (input.paidDate !== undefined) patch.paid_date = input.paidDate;
  if (input.notes !== undefined) patch.notes = input.notes;
  const { error } = await supabase.from("agent_fees").update(patch).eq("id", id);
  throwIfError(error);
}

/** Delete a fee entry */
export async function deleteAgentFee(id: string): Promise<void> {
  ensureConfigured();
  const { error } = await supabase.from("agent_fees").delete().eq("id", id);
  throwIfError(error);
}

// =============================================================================
// AGENT CASE COUNTS
// Counts Stage 2 sub-stage cases assigned to an agent by their text name.
// No FK required — matches trademarks.agent exact string.
// =============================================================================

export interface AgentCaseCounts {
  /** Stage 2 + sub_status = 'Assigned' */
  assignedCases: number;
  /** Stage 2 + sub_status = 'Accepted' */
  acceptedCases: number;
  /** All cases (any stage) where trademarks.agent = name */
  totalAssignedCases: number;
}

/** Returns trademark case counts for an agent matched by their exact name string.
 * Only fired on demand (modal open), not in the table list.
 */
export async function getAgentCaseCounts(agentName: string): Promise<AgentCaseCounts> {
  ensureConfigured();
  const [assignedResult, acceptedResult, totalResult] = await Promise.all([
    supabase
      .from("trademarks")
      .select("id", { count: "exact", head: true })
      .eq("agent", agentName)
      .eq("status", "STAGE 2")
      .ilike("sub_status", "Assigned"),
    supabase
      .from("trademarks")
      .select("id", { count: "exact", head: true })
      .eq("agent", agentName)
      .eq("status", "STAGE 2")
      .ilike("sub_status", "Accepted"),
    supabase
      .from("trademarks")
      .select("id", { count: "exact", head: true })
      .eq("agent", agentName),
  ]);
  throwIfError(assignedResult.error);
  throwIfError(acceptedResult.error);
  throwIfError(totalResult.error);
  return {
    assignedCases: assignedResult.count ?? 0,
    acceptedCases: acceptedResult.count ?? 0,
    totalAssignedCases: totalResult.count ?? 0,
  };
}

// =============================================================================
// BATCH 9: STAGE DOCUMENT API
// Upload and list documents attached to a specific trademark stage/sub-stage.
// Uses the existing trademark-files private bucket and trademark_files table.
// No new bucket, no new table, no public URLs.
// =============================================================================

/** Represents a document file attached to a trademark stage */
export interface StageDocument {
  id: string;
  trademarkId: string;
  stage: string | null;
  subStage: string | null;
  title: string | null;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string | null;
  createdAt: string;
  /** Signed URL valid for 1 hour. Absent if signing failed. */
  signedUrl?: string;
}

/** Input parameters for uploadStageDocument */
export interface UploadStageDocumentInput {
  trademarkId: string;
  stage: string;
  subStage?: string;
  title?: string;
  uploadedBy?: string; // auth user id — resolved from session when omitted
}

const STAGE_DOC_ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

/**
 * Upload a document into the existing `trademark-files` private bucket under a
 * deterministic, record-scoped path: `{trademarkId}/{stage}/{uuid}.{ext}`
 *
 * Inserts a corresponding row into `public.trademark_files` with:
 * trademark_id, stage, sub_stage, title, storage_path, file_name,
 * mime_type, size_bytes, uploaded_by.
 *
 * Error safety:
 *  - If the storage upload succeeds but the DB insert fails, the orphan storage
 *    object is removed before the original error is re-thrown.
 *  - If the DB insert succeeds but URL signing fails, the document metadata is
 *    returned without a signedUrl (no storage object is made public).
 */
export async function uploadStageDocument(
  file: File,
  input: UploadStageDocumentInput,
): Promise<StageDocument> {
  ensureConfigured();

  // Validate size
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("File must be 10 MB or smaller.");
  }

  // Validate MIME type
  if (!STAGE_DOC_ALLOWED_MIME.has(file.type)) {
    throw new Error(
      `File type "${file.type}" is not allowed. Permitted types: PDF, Word, Excel, plain text, PNG, JPEG, GIF, WebP.`,
    );
  }

  // Validate stage restriction - can only upload to current stage
  const { data: trademark } = await supabase
    .from("trademarks")
    .select("status")
    .eq("id", input.trademarkId)
    .single();
  
  if (!trademark) {
    throw new Error("Trademark record not found.");
  }

  const currentStage = trademark.status;
  const requestedStage = input.stage.toUpperCase();

  // STOPPED is terminal - no document uploads allowed
  if (currentStage === "STOPPED") {
    throw new Error("Document uploads are not allowed for STOPPED cases.");
  }

  // Validate that requested stage matches current stage
  if (requestedStage !== currentStage.toUpperCase()) {
    throw new Error(
      `You can only upload documents for the current workflow stage (${currentStage}). Cannot upload to ${input.stage}.`
    );
  }

  // Resolve uploader id
  const { data: authData } = await supabase.auth.getUser();
  const uploadedBy = input.uploadedBy ?? authData.user?.id ?? null;
  if (!uploadedBy) throw new Error("Please sign in before uploading documents.");

  const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
  const uuid = crypto.randomUUID();
  // Sanitise stage for use in storage path (replace spaces/slashes)
  const stageSlug = input.stage.replace(/[^a-zA-Z0-9-]/g, "_");
  const storagePath = `${input.trademarkId}/${stageSlug}/${uuid}.${extension}`;

  // 1. Upload to private bucket
  const { error: uploadError } = await supabase.storage
    .from(TRADEMARK_FILES_BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (uploadError) throw new Error(uploadError.message);

  // 2. Insert DB row — clean up storage on failure
  const { data: dbRow, error: insertError } = await supabase
    .from("trademark_files")
    .insert({
      trademark_id: input.trademarkId,
      stage: input.stage,
      sub_stage: input.subStage ? normalizeWorkflowValue(input.subStage) : null,
      title: input.title?.trim() || null,
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: uploadedBy,
    })
    .select("*")
    .single();

  if (insertError) {
    // Best-effort cleanup of orphan storage object
    await supabase.storage.from(TRADEMARK_FILES_BUCKET).remove([storagePath]);
    throw new Error(insertError.message);
  }

  // 3. Sign URL (non-fatal if it fails)
  let signedUrl: string | undefined;
  const { data: signData } = await supabase.storage
    .from(TRADEMARK_FILES_BUCKET)
    .createSignedUrl(storagePath, 3600);
  if (signData?.signedUrl) signedUrl = signData.signedUrl;

  return mapStageDocRow(dbRow, signedUrl);
}

/**
 * List trademark_files rows for a trademark.
 * Pass `stage` to filter to a specific stage.
 * Returns document metadata + signed URLs (private storage, 1-hour expiry).
 * No public URLs are exposed.
 */
export async function listStageDocuments(
  trademarkId: string,
  stage?: string,
): Promise<StageDocument[]> {
  ensureConfigured();

  let query = supabase
    .from("trademark_files")
    .select("*")
    .eq("trademark_id", trademarkId)
    .order("created_at", { ascending: false });

  if (stage) {
    query = query.eq("stage", stage);
  }

  const { data, error } = await query;
  throwIfError(error);

  const rows = (data ?? []) as StageDocumentRow[];

  // Batch-sign all storage paths
  const paths = rows.map((r) => r.storage_path);
  const signedByPath = new Map<string, string>();
  if (paths.length) {
    const { data: signData } = await supabase.storage
      .from(TRADEMARK_FILES_BUCKET)
      .createSignedUrls(paths, 3600);
    signData?.forEach((item, index) => {
      if (item.signedUrl) signedByPath.set(paths[index], item.signedUrl);
    });
  }

  return rows.map((row) =>
    mapStageDocRow(row, signedByPath.get(row.storage_path)),
  );
}

/** Raw DB row shape for trademark_files (Batch 9 columns included) */
type StageDocumentRow = {
  id: string;
  trademark_id: string;
  stage: string | null;
  sub_stage: string | null;
  title: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string | null;
  created_at: string;
};

function mapStageDocRow(row: StageDocumentRow, signedUrl?: string): StageDocument {
  return {
    id: row.id,
    trademarkId: row.trademark_id,
    stage: row.stage ?? null,
    subStage: row.sub_stage ?? null,
    title: row.title ?? null,
    storagePath: row.storage_path,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    uploadedBy: row.uploaded_by ?? null,
    createdAt: row.created_at,
    ...(signedUrl !== undefined ? { signedUrl } : {}),
  };
}

// Internal helper: maps a raw Supabase agent_fee row to AgentFee interface
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFeeRow(row: any): AgentFee {
  const billed = Number(row.amount_billed ?? 0);
  const paid = Number(row.amount_paid ?? 0);
  return {
    id: row.id,
    trademarkId: row.trademark_id,
    agentId: row.agent_id,
    agentName: row.agents?.name ?? undefined,
    caseNumber: row.trademarks?.case_number ?? undefined,
    appName: row.trademarks?.application_name ?? undefined,
    description: row.description ?? "",
    amountBilled: billed,
    amountPaid: paid,
    balanceDue: billed - paid,
    feeDate: row.fee_date ?? "",
    paid: row.paid ?? false,
    paidDate: row.paid_date ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at ?? "",
  };
}

// =============================================================================
// BATCH 14: WORKFLOW REMINDERS
// Returns exactly 4 informational reminder items based on current workflow state.
// These are informational/contextual only — no automatic legal actions.
// Hard cap: never returns more than 4 reminders.
// =============================================================================

export interface WorkflowReminder {
  /** Reminder 1–4 */
  number: 1 | 2 | 3 | 4;
  /** Short title */
  title: string;
  /** Descriptive context for the reminder */
  description: string;
  /** Whether this reminder is active/relevant for the current workflow state */
  active: boolean;
}

/**
 * Returns exactly 4 workflow reminder definitions adapted to the current
 * stage/sub-stage context. Reminders are informational/contextual only.
 *
 * Rules:
 *  - Exactly Reminder 1–4. Never Reminder 5+.
 *  - Does not invent statutory deadlines.
 *  - Does not invent legal meanings or automatic actions.
 *  - Does not mutate any data.
 */
export function getWorkflowReminders(
  stage?: string,
  subStage?: string,
  context?: {
    filingDate?: string;
    publicationDate?: string;
    oppositionDeadline?: string;
  },
): WorkflowReminder[] {
  const s = stage || "";
  const sub = subStage || "";

  // Default 4 reminders with stage-adaptive descriptions
  const reminders: WorkflowReminder[] = [
    {
      number: 1,
      title: "Filing & Documentation",
      description: getReminder1(s, sub, context),
      active: s === "STAGE 1" || s === "",
    },
    {
      number: 2,
      title: "Agent & Assignment",
      description: getReminder2(s, sub),
      active: s === "STAGE 2",
    },
    {
      number: 3,
      title: "Publication & Opposition",
      description: getReminder3(s, sub, context),
      active: s === "STAGE 3",
    },
    {
      number: 4,
      title: "Registration & Certificate",
      description: getReminder4(s, sub),
      active: s === "STAGE 4",
    },
  ];

  // Hard cap: exactly 4
  return reminders.slice(0, 4);
}

function getReminder1(stage: string, sub: string, ctx?: { filingDate?: string }): string {
  if (stage === "STAGE 1") {
    if (sub === "Filing") return "Application has been filed. Await acknowledgment from IPO.";
    if (sub === "Acknowledgment") return "Acknowledgment received. Await examination report.";
    if (sub === "Examination") return "Under examination. Monitor for official queries or objections.";
    return "Stage 1 in progress. Ensure all filing documents are complete.";
  }
  if (ctx?.filingDate) return `Filed on ${ctx.filingDate}. Filing documentation archived.`;
  return "Ensure all original filing documents are collected and archived.";
}

function getReminder2(stage: string, sub: string): string {
  if (stage === "STAGE 2") {
    if (sub === "Assigned") return "Case assigned to agent. Await acceptance confirmation. Stage 2 payment required.";
    if (sub === "Accepted") return "Agent has accepted. Case is under agent handling. Monitor hearing dates.";
    if (sub === "Hearing") return "Hearing scheduled or in progress. Coordinate with assigned agent.";
    return "Stage 2 in progress. Verify agent assignment and payment status.";
  }
  return "Agent assignment and hearing management — refer to assigned agent details.";
}

function getReminder3(stage: string, sub: string, ctx?: { publicationDate?: string; oppositionDeadline?: string }): string {
  if (stage === "STAGE 3") {
    const normalized = normalizeWorkflowValue(sub);
    if (normalized === "D-Note Submitted") return "Demand note submitted to IPO. Await demand note receipt.";
    if (normalized === "D-Note Received") return "Demand note received. Process payment and proceed.";
    if (normalized === "OPPO: Filed") return "Opposition filed against this mark. Prepare response.";
    if (normalized === "OPPO: Received") return "Opposition received. Review and coordinate legal response.";
    if (normalized === "OPPO: Withdrawn") return "Opposition withdrawn. Case may proceed to publication.";
    if (sub === "Published") {
      if (ctx?.oppositionDeadline) return `Published. Opposition deadline: ${ctx.oppositionDeadline}. Monitor for third-party oppositions.`;
      return "Published in Trade Marks Journal. Monitor opposition window.";
    }
    return "Stage 3 in progress. Track publication and opposition status.";
  }
  return "Publication and opposition tracking — review publication pipeline if applicable.";
}

function getReminder4(stage: string, sub: string): string {
  if (stage === "STAGE 4") {
    if (sub === "CER Dispatch") return "Certificate dispatched from IPO. Await physical receipt.";
    if (sub === "CER Received") return "Certificate received. Verify details and deliver to client.";
    if (sub === "CER Acknowledge") return "Certificate acknowledged. Case registration complete.";
    return "Stage 4 in progress. Track certificate dispatch and receipt.";
  }
  return "Registration certificate tracking — case may not yet be at this stage.";
}
