/**
 * Main Trademark Database CSV Bulk Import
 *
 * Dry-run first, then optional commit. No upsert/update in this version.
 *
 * PAYMENT SAFETY:
 *   createTrademark() defaults stage1_paid=true / stage1_paid_date=today.
 *   That is NOT safe for historical import — we cannot assert payment from a CSV.
 *   This module explicitly sets stage1_paid=false, stage1_paid_date=null.
 *   The schema supports this (DEFAULT false, nullable date). No migration needed.
 *
 * DUPLICATE KEY:
 *   Business duplicate key: (type, client_code, case_number).
 *   No DB unique constraint exists; detection is application-level against:
 *     A. Existing database records.
 *     B. Duplicate rows within the uploaded CSV itself.
 *
 * BLOCKED FIELDS:
 *   id, created_by, updated_by, created_at, updated_at, version,
 *   stage*_paid, stage*_paid_date, payment_reference,
 *   logo_path, legacy_image_url, journal_data,
 *   source_sheet_row, tm5, tm6, tm11, tm16, tm56,
 *   publication_date, opposition_deadline, demand_note_received, demand_note_date,
 *   journal_number, journal_date
 *   -- if present in CSV, they are silently ignored.
 */

import { supabase } from "./supabase";
import { parseCsv, parseFlexibleDate } from "./registryImport";
import { STAGES, STATUS_WORKFLOW, normalizeWorkflowValue } from "./api";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Fields that MUST be present and non-empty for a row to be valid. */
export const REQUIRED_IMPORT_FIELDS = [
  "type",
  "client_code",
  "case_number",
  "application_name",
  "city",
] as const;

/** Optional fields that will be imported if present. */
export const OPTIONAL_IMPORT_FIELDS = [
  "filing_date",
  "client_name",
  "tm_cpr_number",
  "nice_class",
  "case_type",
  "agent",
  "notes",
] as const;

/**
 * Fields that must NEVER be imported from CSV -- they are system-generated
 * or controlled by payment/workflow logic.
 */
export const BLOCKED_IMPORT_FIELDS = new Set([
  "id",
  "created_by",
  "updated_by",
  "created_at",
  "updated_at",
  "version",
  "stage1_paid",
  "stage1_paid_date",
  "stage2_paid",
  "stage2_paid_date",
  "stage3_paid",
  "stage3_paid_date",
  "stage4_paid",
  "stage4_paid_date",
  "payment_reference",
  "logo_path",
  "legacy_image_url",
  "legacy_image",
  "image",
  "journal_data",
  "source_sheet_row",
  "tm5",
  "tm6",
  "tm11",
  "tm16",
  "tm56",
  "publication_date",
  "opposition_deadline",
  "demand_note_received",
  "demand_note_date",
  "journal_number",
  "journal_date",
]);

/** Valid type values. Must match DB check constraint. */
const VALID_TYPES = ["X", "A", "N"] as const;

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface TmImportRow {
  /** 1-based source row number in the CSV. */
  sourceRow: number;
  type: string;
  clientCode: string;
  caseNumber: string;
  applicationName: string;
  city: string;
  filingDate: string | null;
  clientName: string | null;
  tmCprNumber: string | null;
  niceClass: string | null;
  caseType: string | null;
  agent: string | null;
  /** Notes preserve original case (free-form remarks). */
  notes: string | null;
  /** Validated canonical DB status value, defaults to "STAGE 1". */
  status: string;
  /** Validated canonical DB sub_status value, defaults to "Filing". */
  subStatus: string | null;
}

export type TmImportItemAction = "insert" | "skip_csv_dup" | "skip_db_dup";

export interface TmImportItem {
  action: TmImportItemAction;
  sourceRow: number;
  message: string;
  row: TmImportRow;
}

export interface TmImportDryRunResult {
  totalParsed: number;
  valid: number;
  invalid: number;
  csvDuplicates: number;
  dbDuplicates: number;
  wouldInsert: number;
  items: TmImportItem[];
  errors: string[];
}

export interface TmImportCommitResult {
  inserted: number;
  skipped: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "_")
    .replace(/[^\w]/g, "")
    .trim();
}

function buildHeaderMap(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, idx) => {
    map[normalizeHeader(h)] = idx;
  });
  return map;
}

function getCell(row: string[], map: Record<string, number>, ...aliases: string[]): string {
  for (const a of aliases) {
    const key = normalizeHeader(a);
    const idx = map[key];
    if (idx !== undefined && row[idx] !== undefined) return String(row[idx]).trim();
  }
  return "";
}

function upperOrNull(val: string): string | null {
  const s = val.trim();
  return s ? s.toUpperCase() : null;
}

function upperRequired(val: string, fallback = ""): string {
  const s = val.trim();
  return s ? s.toUpperCase() : fallback;
}

/** Composite business duplicate key. */
export function tmDupKey(type: string, clientCode: string, caseNumber: string): string {
  return `${type.toUpperCase()}|${clientCode.toUpperCase()}|${caseNumber.toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// Parse + validate
// ---------------------------------------------------------------------------

export function parseTmImportCsv(text: string): {
  rows: TmImportRow[];
  errors: string[];
} {
  const grid = parseCsv(text);
  const errors: string[] = [];

  if (grid.length < 2) {
    return { rows: [], errors: ["CSV has no data rows."] };
  }

  const map = buildHeaderMap(grid[0]);
  const rows: TmImportRow[] = [];

  for (let r = 1; r < grid.length; r++) {
    const line = grid[r];
    const sourceRow = r + 1;
    const rowErrors: string[] = [];

    // --- Required fields ---
    const typeRaw = getCell(line, map, "type", "prefix");
    const clientCodeRaw = getCell(line, map, "client_code", "client code", "clientcode", "code");
    const caseNumberRaw = getCell(
      line,
      map,
      "case_number",
      "case number",
      "casenumber",
      "case no",
      "caseno",
    );
    const applicationNameRaw = getCell(
      line,
      map,
      "application_name",
      "application name",
      "applicationname",
      "app name",
      "appname",
      "trademark",
      "mark",
    );
    const cityRaw = getCell(line, map, "city");

    // Validate type
    const typeNorm = upperRequired(typeRaw);
    if (!typeNorm) {
      rowErrors.push(`Row ${sourceRow}: 'type' is required`);
    } else if (!VALID_TYPES.includes(typeNorm as "X" | "A" | "N")) {
      rowErrors.push(
        `Row ${sourceRow}: invalid type "${typeNorm}" -- must be one of: ${VALID_TYPES.join(", ")}`,
      );
    }

    if (!clientCodeRaw.trim()) {
      rowErrors.push(`Row ${sourceRow}: 'client_code' is required`);
    }
    if (!caseNumberRaw.trim()) {
      rowErrors.push(`Row ${sourceRow}: 'case_number' is required`);
    }
    if (!applicationNameRaw.trim()) {
      rowErrors.push(`Row ${sourceRow}: 'application_name' is required`);
    }
    if (!cityRaw.trim()) {
      rowErrors.push(`Row ${sourceRow}: 'city' is required`);
    }

    if (rowErrors.length) {
      errors.push(...rowErrors);
      continue;
    }

    // --- Optional fields ---
    const filingDateRaw = getCell(
      line,
      map,
      "filing_date",
      "filing date",
      "date",
      "filingdate",
    );
    const filingDate = parseFlexibleDate(filingDateRaw);
    if (filingDateRaw.trim() && !filingDate) {
      errors.push(
        `Row ${sourceRow}: invalid filing_date "${filingDateRaw}" -- use YYYY-MM-DD or DD/MM/YYYY`,
      );
      continue;
    }

    const clientNameRaw = getCell(line, map, "client_name", "client name", "clientname");
    const tmCprNumberRaw = getCell(
      line,
      map,
      "tm_cpr_number",
      "tm cpr number",
      "tmcprnumber",
      "tm number",
      "tm no",
      "tmnumber",
      "cpr number",
    );
    const niceClassRaw = getCell(
      line,
      map,
      "nice_class",
      "nice class",
      "niceclass",
      "class",
      "app class",
    );
    const caseTypeRaw = getCell(line, map, "case_type", "case type", "casetype");
    const agentRaw = getCell(line, map, "agent");
    const notesRaw = getCell(line, map, "notes", "note", "remarks");

    // Validate nice_class if provided
    const niceClassNorm = upperOrNull(niceClassRaw);
    if (niceClassNorm) {
      const classNum = Number(niceClassNorm);
      if (Number.isNaN(classNum) || classNum < 1 || classNum > 45) {
        errors.push(
          `Row ${sourceRow}: invalid nice_class "${niceClassNorm}" -- must be 1-45`,
        );
        continue;
      }
    }

    // WORKFLOW SAFETY:
    // Historical bulk imports must ALWAYS start at the canonical initial state:
    // STAGE 1 / Filing. Arbitrary status/sub_status columns in CSV are intentionally
    // not imported so that forward workflow rules, payment gates, and workflow history
    // are not bypassed or fabricated.
    const statusNorm = "STAGE 1";
    const subStatusNorm = "Filing";

    rows.push({
      sourceRow,
      type: upperRequired(typeRaw),
      clientCode: upperRequired(clientCodeRaw),
      caseNumber: upperRequired(caseNumberRaw),
      applicationName: upperRequired(applicationNameRaw),
      city: upperRequired(cityRaw),
      filingDate,
      clientName: upperOrNull(clientNameRaw),
      tmCprNumber: upperOrNull(tmCprNumberRaw),
      niceClass: niceClassNorm,
      caseType: upperOrNull(caseTypeRaw),
      agent: upperOrNull(agentRaw),
      // Notes preserve original case (free-form remarks field)
      notes: notesRaw.trim() || null,
      status: statusNorm,
      subStatus: subStatusNorm,
    });
  }

  return { rows, errors };
}

// ---------------------------------------------------------------------------
// Dry-run
// ---------------------------------------------------------------------------

export async function dryRunTmImport(csvText: string): Promise<TmImportDryRunResult> {
  const { rows, errors } = parseTmImportCsv(csvText);

  if (!rows.length) {
    return {
      totalParsed: errors.length,
      valid: 0,
      invalid: errors.length,
      csvDuplicates: 0,
      dbDuplicates: 0,
      wouldInsert: 0,
      items: [],
      errors,
    };
  }

  // --- Within-CSV duplicate detection (first occurrence wins) ---
  const firstSeen = new Map<string, number>(); // key -> sourceRow of first occurrence
  for (const row of rows) {
    const key = tmDupKey(row.type, row.clientCode, row.caseNumber);
    if (!firstSeen.has(key)) firstSeen.set(key, row.sourceRow);
  }

  // --- Database duplicate detection ---
  const dbExisting = new Set<string>();
  const allClientCodes = [...new Set(rows.map((r) => r.clientCode))];

  for (let i = 0; i < allClientCodes.length; i += 200) {
    const chunk = allClientCodes.slice(i, i + 200);
    const { data, error } = await supabase
      .from("trademarks")
      .select("type, client_code, case_number")
      .in("client_code", chunk);
    if (error) {
      errors.push(`DB lookup failed: ${error.message}`);
      break;
    }
    (data ?? []).forEach(
      (row: { type: string; client_code: string; case_number: string }) => {
        dbExisting.add(tmDupKey(row.type, row.client_code, row.case_number));
      },
    );
  }

  // --- Classify each row ---
  const items: TmImportItem[] = [];
  let csvDuplicates = 0;
  let dbDuplicates = 0;
  let wouldInsert = 0;

  for (const row of rows) {
    const key = tmDupKey(row.type, row.clientCode, row.caseNumber);

    // CSV duplicate: not the first occurrence of this key
    if (firstSeen.get(key) !== row.sourceRow) {
      csvDuplicates += 1;
      items.push({
        action: "skip_csv_dup",
        sourceRow: row.sourceRow,
        message: `Duplicate within CSV (first at row ${firstSeen.get(key)}): ${row.type} / ${row.clientCode} / ${row.caseNumber}`,
        row,
      });
      continue;
    }

    // DB duplicate
    if (dbExisting.has(key)) {
      dbDuplicates += 1;
      items.push({
        action: "skip_db_dup",
        sourceRow: row.sourceRow,
        message: `Already in database: ${row.type} / ${row.clientCode} / ${row.caseNumber}`,
        row,
      });
      continue;
    }

    wouldInsert += 1;
    items.push({
      action: "insert",
      sourceRow: row.sourceRow,
      message: `Insert: ${row.type} / ${row.clientCode} / ${row.caseNumber} -- ${row.applicationName}`,
      row,
    });
  }

  return {
    totalParsed: rows.length + errors.length,
    valid: rows.length,
    invalid: errors.length,
    csvDuplicates,
    dbDuplicates,
    wouldInsert,
    items,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Commit (after dry-run confirmation)
// ---------------------------------------------------------------------------

/**
 * Inserts validated, non-duplicate rows into the trademarks table.
 *
 * PAYMENT SAFETY:
 *   stage1_paid is explicitly set to FALSE.
 *   stage1_paid_date is explicitly set to NULL.
 *   This is the only honest representation for historical bulk import --
 *   we cannot assert payment verification from a CSV file.
 *
 * WORKFLOW SAFETY:
 *   Records default to status='STAGE 1', sub_status='Filing'.
 *   No fake workflow transitions or invented payment records.
 *   The INSERT trigger (migration 202609220006) writes one RECORD_CREATED
 *   event to trademark_workflow_history -- that is the correct initial history.
 */
export async function commitTmImport(rows: TmImportRow[]): Promise<TmImportCommitResult> {
  if (!rows.length) {
    return { inserted: 0, skipped: 0, errors: [] };
  }

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id ?? null;

  const payload = rows.map((r) => ({
    // Required
    type: r.type,
    client_code: r.clientCode,
    case_number: r.caseNumber,
    application_name: r.applicationName,
    city: r.city,
    // Optional
    ...(r.filingDate ? { filing_date: r.filingDate } : {}),
    client_name: r.clientName,
    tm_cpr_number: r.tmCprNumber,
    nice_class: r.niceClass,
    case_type: r.caseType,
    agent: r.agent,
    notes: r.notes,
    status: r.status,
    sub_status: r.subStatus,
    // PAYMENT SAFETY: historical import cannot assert verified payment.
    // Do NOT default to true. Do NOT invent a payment date.
    stage1_paid: false,
    stage1_paid_date: null,
    // Ownership
    created_by: userId,
    updated_by: userId,
    // ALL system/blocked fields are absent from this payload:
    //   id, version, stage2-4_paid fields, payment_reference,
    //   logo_path, legacy_image_url, journal_data, tm5-56,
    //   publication fields, source_sheet_row, etc.
  }));

  let inserted = 0;
  const errors: string[] = [];

  for (let i = 0; i < payload.length; i += 100) {
    const chunk = payload.slice(i, i + 100);
    const { data, error } = await supabase
      .from("trademarks")
      .insert(chunk)
      .select("id");
    if (error) {
      errors.push(`Batch ${Math.floor(i / 100) + 1} failed: ${error.message}`);
    } else {
      inserted += data?.length ?? 0;
    }
  }

  return {
    inserted,
    skipped: rows.length - inserted,
    errors,
  };
}
