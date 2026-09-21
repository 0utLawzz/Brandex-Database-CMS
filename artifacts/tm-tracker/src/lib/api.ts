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
  // NEW: Publication workflow fields
  publicationDate?: string | null;
  oppositionDeadline?: string | null;
  demandNoteReceived?: boolean;
  demandNoteDate?: string | null;
}

export interface TmMatches {
  TM5: boolean;
  TM6: boolean;
  TM11: boolean;
  TM16: boolean;
  TM56: boolean;
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
}

export interface TmSearchResult {
  records: TrademarkRecord[];
  tmMatches: TmMatches;
  journal: JournalRecord | null;
}

export const STAGES = ["STAGE 1", "STAGE 2", "STAGE 3", "STAGE 4", "STOPPED"] as const;
export type StageType = typeof STAGES[number];

export const STATUS_WORKFLOW: Record<string, string[]> = {
  "STAGE 1": ["Acknowledgment", "Examination"],
  "STAGE 2": ["Assigned", "Accepted", "Hearing"],
  "STAGE 3": ["D-Note Submitted", "D-Note Received", "OPPO: Filed", "OPPO: Received", "OPPO: Withdrawn", "Published"],
  "STAGE 4": ["CER Dispatch", "CER Received", "CER Acknowledge"],
  "STOPPED": ["Case Stopped"],
};

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
  version?: number;
  // NEW fields from migration 1
  publication_date?: string | null;
  opposition_deadline?: string | null;
  demand_note_received?: boolean;
  demand_note_date?: string | null;
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
    // NEW publication fields
    publicationDate: row.publication_date ?? null,
    oppositionDeadline: row.opposition_deadline ?? null,
    demandNoteReceived: row.demand_note_received ?? false,
    demandNoteDate: row.demand_note_date ?? null,
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
    .select("tm_number_norm, form_type")
    .in("tm_number_norm", numbers);
  if (error) return records;

  const byNumber = new Map<string, Set<string>>();
  const rows = Array.isArray(data) ? data : [];
  for (const row of rows) {
    const key = String(row.tm_number_norm ?? "");
    if (!byNumber.has(key)) byNumber.set(key, new Set());
    byNumber.get(key)?.add(String(row.form_type ?? "").toUpperCase());
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
  "journal_number", "journal_date", "logo_path", "legacy_image_url", "updated_at", "version",
  // NEW
  "publication_date", "opposition_deadline", "demand_note_received", "demand_note_date",
].join(",");

export function inputToRow(input: TrademarkInput) {
  const image = input.image?.trim() || null;
  const externalImage = image?.startsWith("http") ?? false;
  return {
    filing_date: input.date,
    type: input.type ?? input.prefix,
    client_code: input.clientCode ?? input.clientNo,
    client_name: input.clientName ?? null,
    case_number: input.caseNumber ?? input.caseNo ?? input.folderNo,
    application_name: input.appName,
    tm_cpr_number: input.tmCprNo ?? input.tmNo ?? null,
    nice_class: input.appClass ?? null,
    status: input.stage,
    sub_status: input.subStage ?? null,
    case_type: input.caseType ?? null,
    agent: input.agent ?? null,
    city: input.city,
    notes: input.notes ?? null,
    logo_path: externalImage ? null : image,
    legacy_image_url: externalImage ? image : null,
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
  if (params?.subStage) query = query.ilike("sub_status", `%${safeSearchTerm(params.subStage)}%`);
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
  const first = records[0];
  return {
    records,
    tmMatches: first?.tmMatches ?? { TM5: false, TM6: false, TM11: false, TM16: false, TM56: false },
    journal: first?.journal ?? null,
  };
}

export async function createTrademark(input: TrademarkInput): Promise<{ id: string; caseNumber: string }> {
  ensureConfigured();
  const { data: authData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("trademarks")
    .insert({ ...inputToRow(input), created_by: authData.user?.id, updated_by: authData.user?.id })
    .select("id,case_number")
    .single();
  throwIfError(error);
  if (!data) throw new Error("Supabase did not return the created record.");
  return { id: data.id, caseNumber: data.case_number };
}

export class ConflictError extends Error {
  constructor(message = "Record was modified by another user. Reload and try again.") {
    super(message);
    this.name = "ConflictError";
  }
}

export async function updateTrademark(
  id: string,
  input: TrademarkInput,
  expectedVersion?: number,
): Promise<{ id: string; version: number }> {
  ensureConfigured();
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

export async function getStats(): Promise<TrademarkStats> {
  ensureConfigured();
  const exactCount = async (column?: string, value?: string | boolean, gte?: string) => {
    let query = supabase.from("trademarks").select("id", { count: "exact", head: true });
    if (column && gte) query = query.gte(column, gte);
    else if (column && value !== undefined) query = query.eq(column, value);
    const { count, error } = await query;
    throwIfError(error);
    return count ?? 0;
  };

  const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [total, recentlyModified, stageCounts, cityCounts, tmCounts] = await Promise.all([
    exactCount(),
    exactCount("updated_at", undefined, recentCutoff),
    Promise.all(STAGES.map(async (stage) => ({ stage, count: await exactCount("status", stage) }))),
    Promise.all(CITIES.map(async (city) => ({ city, count: await exactCount("city", city) }))),
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
  return (data ?? []).map((row) => ({
    id: row.id,
    changedAt: row.changed_at,
    changedBy: row.changed_by ?? "system",
    action: row.action,
    recordId: row.trademark_id ?? "",
    caseNo: row.new_record?.case_number ?? row.old_record?.case_number ?? "",
    record: row.new_record?.case_number ?? row.old_record?.case_number ?? row.trademark_id ?? "",
    field: "RECORD",
    oldValue: row.old_record ? JSON.stringify(row.old_record) : "",
    newValue: row.new_record ? JSON.stringify(row.new_record) : "",
  }));
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

/** A trademark that has been published in the journal — tracks opposition window */
export interface PublicationRecord {
  id: string;
  caseNumber: string;
  clientName: string;
  appName: string;
  tmCprNo: string;
  appClass: string;
  stage: string;
  subStage: string;
  agent: string;
  publicationDate: string;
  oppositionDeadline: string;
  daysRemaining: number; // negative = overdue
  demandNoteReceived: boolean;
  demandNoteDate: string | null;
  status: "pending" | "overdue" | "done"; // computed
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
      "id, case_number, client_name, application_name, tm_cpr_number, nice_class, " +
      "status, sub_status, agent, publication_date, opposition_deadline, " +
      "demand_note_received, demand_note_date"
    )
    .not("publication_date", "is", null) // only published cases
    .order("opposition_deadline", { ascending: true, nullsFirst: false });
  throwIfError(error);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (data ?? []).map((row: any) => {
    // Calculate days remaining until opposition deadline
    const deadline = row.opposition_deadline ? new Date(row.opposition_deadline) : null;
    const daysRemaining = deadline ? Math.floor((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : 0;

    // Compute status label
    let status: "pending" | "overdue" | "done" = "pending";
    if (row.demand_note_received) {
      status = "done";
    } else if (daysRemaining < 0) {
      status = "overdue"; // deadline passed, no demand note yet — action needed
    }

    return {
      id: row.id,
      caseNumber: row.case_number ?? "",
      clientName: row.client_name ?? "",
      appName: row.application_name ?? "",
      tmCprNo: row.tm_cpr_number ?? "",
      appClass: row.nice_class ?? "",
      stage: row.status ?? "",
      subStage: row.sub_status ?? "",
      agent: row.agent ?? "",
      publicationDate: row.publication_date ?? "",
      oppositionDeadline: row.opposition_deadline ?? "",
      daysRemaining,
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
      name: input.name,
      city: input.city ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      notes: input.notes ?? null,
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
  if (input.name !== undefined) patch.name = input.name;
  if (input.city !== undefined) patch.city = input.city;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.email !== undefined) patch.email = input.email;
  if (input.notes !== undefined) patch.notes = input.notes;
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
