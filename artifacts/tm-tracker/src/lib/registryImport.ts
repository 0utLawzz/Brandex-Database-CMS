/**
 * Admin CSV import for form_registry + journal_registry.
 * Dry-run first, then optional commit. Match key = digits-only TM number.
 */

import { supabase } from "./supabase";

export type FormType = "tm5" | "tm6" | "tm11" | "tm16" | "tm56";
export const FORM_TYPES: FormType[] = ["tm5", "tm6", "tm11", "tm16", "tm56"];

export interface FormRegistryRow {
  serialNumber: string;
  office: string;
  tmNumber: string;
  tmNumberNorm: string;
  niceClass: string;
  formType: FormType;
  status: string;
  formDate: string | null; // YYYY-MM-DD
  sourceRow: number;
  raw: Record<string, string>;
}

export interface JournalRegistryRow {
  journalNo: string;
  journalDate: string | null;
  applicationNo: string;
  applicationNoNorm: string;
  niceClass: string;
  applicant: string;
  agent: string;
  dateOfFiling: string | null;
  generatedDoc: string;
  sourceRow: number;
  raw: Record<string, string>;
}

export interface DryRunItem {
  kind: "form" | "journal";
  action: "insert" | "skip_duplicate" | "skip_invalid";
  message: string;
  row: FormRegistryRow | JournalRegistryRow;
}

export interface DryRunResult {
  kind: "form" | "journal";
  totalParsed: number;
  valid: number;
  invalid: number;
  wouldInsert: number;
  wouldSkipDuplicate: number;
  items: DryRunItem[];
  errors: string[];
}

export interface CommitResult {
  kind: "form" | "journal";
  inserted: number;
  skipped: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Digits only — used for TM matching across sheets and trademarks.tm_cpr_number */
export function normalizeTmNumber(value: string): string {
  return String(value ?? "").replace(/\D/g, "");
}

/** Accept YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, Excel serial-ish text */
export function parseFlexibleDate(value: string): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  // ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(raw + "T00:00:00Z");
    return Number.isNaN(d.getTime()) ? null : raw;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const d = new Date(iso + "T00:00:00Z");
    return Number.isNaN(d.getTime()) ? null : iso;
  }

  // Excel serial number (days since 1899-12-30)
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const serial = Math.floor(Number(raw));
    if (serial > 20000 && serial < 80000) {
      const epoch = Date.UTC(1899, 11, 30);
      const d = new Date(epoch + serial * 86400000);
      if (!Number.isNaN(d.getTime())) {
        return d.toISOString().slice(0, 10);
      }
    }
  }

  return null;
}

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[\s_\-]+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim();
}

/** Minimal RFC4180-ish CSV parse (handles quoted fields and newlines inside quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;
  // strip BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  // last cell
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function headerMap(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, idx) => {
    map[normalizeHeader(h)] = idx;
  });
  return map;
}

function cell(row: string[], map: Record<string, number>, ...aliases: string[]): string {
  for (const a of aliases) {
    const idx = map[normalizeHeader(a)];
    if (idx !== undefined && row[idx] !== undefined) return String(row[idx]).trim();
  }
  return "";
}

function normalizeFormType(raw: string): FormType | null {
  const t = raw.trim().toLowerCase().replace(/[\s_\-]/g, "");
  if (t === "tm5" || t === "5") return "tm5";
  if (t === "tm6" || t === "6") return "tm6";
  if (t === "tm11" || t === "11") return "tm11";
  if (t === "tm16" || t === "16") return "tm16";
  if (t === "tm56" || t === "56") return "tm56";
  return null;
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

export function parseFormCsv(text: string): { rows: FormRegistryRow[]; errors: string[] } {
  const grid = parseCsv(text);
  const errors: string[] = [];
  if (grid.length < 2) {
    return { rows: [], errors: ["CSV has no data rows."] };
  }
  const map = headerMap(grid[0]);
  const rows: FormRegistryRow[] = [];

  for (let r = 1; r < grid.length; r++) {
    const line = grid[r];
    const sourceRow = r + 1;
    const serialNumber = cell(line, map, "serial number", "serial", "s no", "sno", "sr");
    const office = cell(line, map, "office", "ipo office", "branch");
    const tmNumber = cell(line, map, "tm number", "tm no", "tm/cpr number", "tm cpr number", "application no", "application number");
    const niceClass = cell(line, map, "class", "nice class", "app class");
    const typeRaw = cell(
      line,
      map,
      "type",
      "type (tm5/tm6/tm11/tm16/tm56)",
      "type tm5tm6tm11tm16tm56",
      "form type",
      "form",
      "tm type",
    );
    const status = cell(line, map, "status", "form status");
    // User: only date from column G — prefer explicit "date" header; fallback index 6 (0-based)
    let dateRaw = cell(line, map, "date", "form date", "filing date");
    if (!dateRaw && line.length > 6) dateRaw = String(line[6] ?? "").trim();

    const formType = normalizeFormType(typeRaw);
    const tmNumberNorm = normalizeTmNumber(tmNumber);
    const formDate = parseFlexibleDate(dateRaw);

    const raw: Record<string, string> = {};
    grid[0].forEach((h, i) => {
      raw[h] = line[i] ?? "";
    });

    if (!tmNumberNorm) {
      errors.push(`Row ${sourceRow}: missing TM number`);
      continue;
    }
    if (!formType) {
      errors.push(
        `Row ${sourceRow}: ${typeRaw ? `invalid type "${typeRaw}"` : "type is blank"} (use tm5, tm6, tm11, tm16, or tm56)`,
      );
      continue;
    }

    rows.push({
      serialNumber,
      office,
      tmNumber,
      tmNumberNorm,
      niceClass,
      formType,
      status,
      formDate,
      sourceRow,
      raw,
    });
  }
  return { rows, errors };
}

export function parseJournalCsv(text: string): { rows: JournalRegistryRow[]; errors: string[] } {
  const grid = parseCsv(text);
  const errors: string[] = [];
  if (grid.length < 2) {
    return { rows: [], errors: ["CSV has no data rows."] };
  }
  const map = headerMap(grid[0]);
  const rows: JournalRegistryRow[] = [];

  for (let r = 1; r < grid.length; r++) {
    const line = grid[r];
    const sourceRow = r + 1;
    // Preferred: Journal No (A), Journal Date (B), Application No (TM), Class (F),
    // Applicant (G), Agent (H), Date of Filing (I), Generated Doc (M)
    const journalNo = cell(line, map, "journal no", "journal number", "journal");
    const journalDateRaw = cell(line, map, "journal date");
    const applicationNo = cell(
      line,
      map,
      "application no",
      "application number",
      "tm number",
      "tm no",
      "tm/cpr number",
      "application",
    );
    const niceClass = cell(line, map, "class", "nice class");
    const applicant = cell(line, map, "applicant", "applicant name and address", "applicant name", "applicant name address");
    const agent = cell(line, map, "agent", "agent name and address", "agent name", "agent name address");
    const filingRaw = cell(line, map, "date of filing", "filing date", "date of filing");
    const generatedDoc = cell(line, map, "generated doc", "generated document", "doc", "document");

    // Column-index fallbacks matching user sheet layout when headers differ
    const col = (i: number) => (line[i] !== undefined ? String(line[i]).trim() : "");

    const jNo = journalNo || col(0);
    const jDate = journalDateRaw || col(1);
    const appNo = applicationNo || col(2) || col(3);
    const cls = niceClass || col(5);
    const app = applicant || col(6);
    const ag = agent || col(7);
    const filing = filingRaw || col(8);
    const doc = generatedDoc || col(12);

    const applicationNoNorm = normalizeTmNumber(appNo);
    const journalDate = parseFlexibleDate(jDate);
    const dateOfFiling = parseFlexibleDate(filing);

    const raw: Record<string, string> = {};
    grid[0].forEach((h, i) => {
      raw[h] = line[i] ?? "";
    });

    if (!applicationNoNorm) {
      errors.push(`Row ${sourceRow}: missing Application No / TM number`);
      continue;
    }

    rows.push({
      journalNo: jNo,
      journalDate,
      applicationNo: appNo,
      applicationNoNorm,
      niceClass: cls,
      applicant: app,
      agent: ag,
      dateOfFiling,
      generatedDoc: doc,
      sourceRow,
      raw,
    });
  }
  return { rows, errors };
}

// ---------------------------------------------------------------------------
// Role gate
// ---------------------------------------------------------------------------

export async function getStaffRole(): Promise<"viewer" | "editor" | "admin" | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error || !data) return null;
  return data.role === "admin" ? "admin" : "viewer";
}

// ---------------------------------------------------------------------------
// Dry-run
// ---------------------------------------------------------------------------

export async function dryRunFormImport(csvText: string): Promise<DryRunResult> {
  const { rows, errors } = parseFormCsv(csvText);
  const items: DryRunItem[] = [];

  if (!rows.length) {
    return {
      kind: "form",
      totalParsed: 0,
      valid: 0,
      invalid: errors.length,
      wouldInsert: 0,
      wouldSkipDuplicate: 0,
      items: [],
      errors,
    };
  }

  // Existing keys in DB for dedupe preview
  const norms = [...new Set(rows.map((r) => r.tmNumberNorm))];
  const existing = new Set<string>();
  // chunk queries
  for (let i = 0; i < norms.length; i += 200) {
    const chunk = norms.slice(i, i + 200);
    const { data, error } = await supabase
      .from("form_registry")
      .select("tm_number_norm, form_type, form_date, serial_number")
      .in("tm_number_norm", chunk);
    if (error) {
      // Table may not exist yet — treat as empty for dry-run
      if (!/does not exist|relation/i.test(error.message)) {
        errors.push(`Lookup failed: ${error.message}`);
      }
      break;
    }
    (data ?? []).forEach((row) => {
      const key = `${row.tm_number_norm}|${row.form_type}|${row.form_date ?? ""}|${row.serial_number ?? ""}`;
      existing.add(key);
    });
  }

  let wouldInsert = 0;
  let wouldSkipDuplicate = 0;

  for (const row of rows) {
    const key = `${row.tmNumberNorm}|${row.formType}|${row.formDate ?? ""}|${row.serialNumber ?? ""}`;
    if (existing.has(key)) {
      wouldSkipDuplicate += 1;
      items.push({
        kind: "form",
        action: "skip_duplicate",
        message: `Duplicate ${row.formType.toUpperCase()} for TM ${row.tmNumber}`,
        row,
      });
    } else {
      wouldInsert += 1;
      items.push({
        kind: "form",
        action: "insert",
        message: `Insert ${row.formType.toUpperCase()} · TM ${row.tmNumber} · ${row.formDate ?? "no date"}`,
        row,
      });
      existing.add(key); // prevent within-file dups counting twice
    }
  }

  return {
    kind: "form",
    totalParsed: rows.length + errors.length,
    valid: rows.length,
    invalid: errors.length,
    wouldInsert,
    wouldSkipDuplicate,
    items,
    errors,
  };
}

export async function dryRunJournalImport(csvText: string): Promise<DryRunResult> {
  const { rows, errors } = parseJournalCsv(csvText);
  const items: DryRunItem[] = [];

  if (!rows.length) {
    return {
      kind: "journal",
      totalParsed: 0,
      valid: 0,
      invalid: errors.length,
      wouldInsert: 0,
      wouldSkipDuplicate: 0,
      items: [],
      errors,
    };
  }

  const norms = [...new Set(rows.map((r) => r.applicationNoNorm))];
  const existing = new Set<string>();
  for (let i = 0; i < norms.length; i += 200) {
    const chunk = norms.slice(i, i + 200);
    const { data, error } = await supabase
      .from("journal_registry")
      .select("application_no_norm, journal_no, journal_date")
      .in("application_no_norm", chunk);
    if (error) {
      if (!/does not exist|relation/i.test(error.message)) {
        errors.push(`Lookup failed: ${error.message}`);
      }
      break;
    }
    (data ?? []).forEach((row) => {
      const key = `${row.application_no_norm}|${row.journal_no ?? ""}|${row.journal_date ?? ""}`;
      existing.add(key);
    });
  }

  let wouldInsert = 0;
  let wouldSkipDuplicate = 0;

  for (const row of rows) {
    const key = `${row.applicationNoNorm}|${row.journalNo}|${row.journalDate ?? ""}`;
    if (existing.has(key)) {
      wouldSkipDuplicate += 1;
      items.push({
        kind: "journal",
        action: "skip_duplicate",
        message: `Duplicate journal ${row.journalNo || "—"} for TM ${row.applicationNo}`,
        row,
      });
    } else {
      wouldInsert += 1;
      items.push({
        kind: "journal",
        action: "insert",
        message: `Insert journal ${row.journalNo || "—"} · TM ${row.applicationNo} · ${row.journalDate ?? "no date"}`,
        row,
      });
      existing.add(key);
    }
  }

  return {
    kind: "journal",
    totalParsed: rows.length + errors.length,
    valid: rows.length,
    invalid: errors.length,
    wouldInsert,
    wouldSkipDuplicate,
    items,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Commit (after dry-run confirmation)
// ---------------------------------------------------------------------------

export async function commitFormImport(rows: FormRegistryRow[]): Promise<CommitResult> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;
  const payload = rows.map((r) => ({
    serial_number: r.serialNumber || "",
    office: r.office || null,
    tm_number: r.tmNumber,
    tm_number_norm: r.tmNumberNorm,
    nice_class: r.niceClass || null,
    form_type: r.formType,
    status: r.status || null,
    form_date: r.formDate,
    source_row: r.sourceRow,
    imported_by: userId,
    raw: r.raw,
  }));

  let inserted = 0;
  const errors: string[] = [];
  for (let i = 0; i < payload.length; i += 100) {
    const chunk = payload.slice(i, i + 100);
    const { data, error } = await supabase
      .from("form_registry")
      .upsert(chunk, {
        onConflict: "tm_number_norm,form_type,form_date,serial_number",
        ignoreDuplicates: true,
      })
      .select("id");
    if (error) {
      errors.push(error.message);
    } else {
      inserted += data?.length ?? 0;
    }
  }
  return { kind: "form", inserted, skipped: rows.length - inserted, errors };
}

export async function commitJournalImport(rows: JournalRegistryRow[]): Promise<CommitResult> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;
  const payload = rows.map((r) => ({
    journal_no: r.journalNo || "",
    journal_date: r.journalDate,
    application_no: r.applicationNo,
    application_no_norm: r.applicationNoNorm,
    nice_class: r.niceClass || null,
    applicant: r.applicant || null,
    agent: r.agent || null,
    date_of_filing: r.dateOfFiling,
    generated_doc: r.generatedDoc || null,
    source_row: r.sourceRow,
    imported_by: userId,
    raw: r.raw,
  }));

  let inserted = 0;
  const errors: string[] = [];
  for (let i = 0; i < payload.length; i += 100) {
    const chunk = payload.slice(i, i + 100);
    const { data, error } = await supabase
      .from("journal_registry")
      .upsert(chunk, {
        onConflict: "application_no_norm,journal_no,journal_date",
        ignoreDuplicates: true,
      })
      .select("id");
    if (error) {
      errors.push(error.message);
    } else {
      inserted += data?.length ?? 0;
    }
  }
  return { kind: "journal", inserted, skipped: rows.length - inserted, errors };
}
