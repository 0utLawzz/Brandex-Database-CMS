import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Supabase mock (same pattern as api.test.ts)
// ---------------------------------------------------------------------------
const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}));

vi.mock("./supabase", () => ({
  isSupabaseConfigured: true,
  TRADEMARK_FILES_BUCKET: "trademark-files",
  supabase: supabaseMock,
}));

// api.ts imports supabase too; we need the same mock to be in effect.
vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return actual;
});

import {
  parseTmImportCsv,
  dryRunTmImport,
  commitTmImport,
  REQUIRED_IMPORT_FIELDS,
  OPTIONAL_IMPORT_FIELDS,
  BLOCKED_IMPORT_FIELDS,
  tmDupKey,
  type TmImportRow,
} from "./trademarkImport";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQuery(response: unknown = { data: [], error: null, count: 0 }) {
  const q: Record<string, unknown> = {};
  const chain = () => q;
  q.select = vi.fn(chain);
  q.insert = vi.fn(chain);
  q.in = vi.fn(chain);
  q.eq = vi.fn(chain);
  q.order = vi.fn(chain);
  q.range = vi.fn(chain);
  q.then = (_res: (v: unknown) => unknown, _rej: (r: unknown) => unknown) =>
    Promise.resolve(response).then(_res, _rej);
  return q;
}

const CSV_HEADER = "type,client_code,case_number,application_name,city";
const CSV_ROW_VALID = "X,ACME,CASE-001,SUPER BRAND,Islamabad";

function csv(...rows: string[]): string {
  return [CSV_HEADER, ...rows].join("\n");
}

// ---------------------------------------------------------------------------
// parseTmImportCsv — unit tests (pure, no DB)
// ---------------------------------------------------------------------------

describe("parseTmImportCsv", () => {
  it("exports constant field lists", () => {
    expect(REQUIRED_IMPORT_FIELDS).toContain("type");
    expect(REQUIRED_IMPORT_FIELDS).toContain("client_code");
    expect(REQUIRED_IMPORT_FIELDS).toContain("case_number");
    expect(REQUIRED_IMPORT_FIELDS).toContain("application_name");
    expect(REQUIRED_IMPORT_FIELDS).toContain("city");
    expect(OPTIONAL_IMPORT_FIELDS).toContain("filing_date");
    expect(OPTIONAL_IMPORT_FIELDS).toContain("notes");
    expect(OPTIONAL_IMPORT_FIELDS).toContain("tm_cpr_number");
    expect(BLOCKED_IMPORT_FIELDS.has("id")).toBe(true);
    expect(BLOCKED_IMPORT_FIELDS.has("stage1_paid")).toBe(true);
    expect(BLOCKED_IMPORT_FIELDS.has("stage2_paid")).toBe(true);
    expect(BLOCKED_IMPORT_FIELDS.has("payment_reference")).toBe(true);
    expect(BLOCKED_IMPORT_FIELDS.has("logo_path")).toBe(true);
    expect(BLOCKED_IMPORT_FIELDS.has("journal_data")).toBe(true);
  });

  it("returns error when CSV has no data rows", () => {
    const { rows, errors } = parseTmImportCsv("type,client_code");
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/no data rows/i);
  });

  it("parses a valid row with required fields only", () => {
    const { rows, errors } = parseTmImportCsv(csv(CSV_ROW_VALID));
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.type).toBe("X");
    expect(r.clientCode).toBe("ACME");
    expect(r.caseNumber).toBe("CASE-001");
    expect(r.applicationName).toBe("SUPER BRAND");
    expect(r.city).toBe("ISLAMABAD");
    expect(r.sourceRow).toBe(2);
  });

  it("normalizes type, clientCode, caseNumber, applicationName, city to UPPERCASE", () => {
    const { rows, errors } = parseTmImportCsv(
      csv("a,acme-corp,case-abc,my brand,karachi"),
    );
    expect(errors).toHaveLength(0);
    expect(rows[0].type).toBe("A");
    expect(rows[0].clientCode).toBe("ACME-CORP");
    expect(rows[0].caseNumber).toBe("CASE-ABC");
    expect(rows[0].applicationName).toBe("MY BRAND");
    expect(rows[0].city).toBe("KARACHI");
  });

  it("preserves notes in original case", () => {
    const { rows } = parseTmImportCsv(
      "type,client_code,case_number,application_name,city,notes\nX,ACME,CASE-001,MY BRAND,Islamabad,Keep This Case As-Is",
    );
    expect(rows[0].notes).toBe("Keep This Case As-Is");
  });

  it("rejects missing type", () => {
    const { rows, errors } = parseTmImportCsv(csv(",ACME,CASE-001,BRAND,Islamabad"));
    expect(rows).toHaveLength(0);
    expect(errors.some((e) => /type.*required/i.test(e))).toBe(true);
  });

  it("rejects invalid type value (not X/A/N)", () => {
    const { rows, errors } = parseTmImportCsv(csv("Z,ACME,CASE-001,BRAND,Islamabad"));
    expect(rows).toHaveLength(0);
    expect(errors.some((e) => /invalid type/i.test(e))).toBe(true);
  });

  it("rejects missing client_code", () => {
    const { rows, errors } = parseTmImportCsv(csv("X,,CASE-001,BRAND,Islamabad"));
    expect(rows).toHaveLength(0);
    expect(errors.some((e) => /client_code.*required/i.test(e))).toBe(true);
  });

  it("rejects missing case_number", () => {
    const { rows, errors } = parseTmImportCsv(csv("X,ACME,,BRAND,Islamabad"));
    expect(rows).toHaveLength(0);
    expect(errors.some((e) => /case_number.*required/i.test(e))).toBe(true);
  });

  it("rejects missing application_name", () => {
    const { rows, errors } = parseTmImportCsv(csv("X,ACME,CASE-001,,Islamabad"));
    expect(rows).toHaveLength(0);
    expect(errors.some((e) => /application_name.*required/i.test(e))).toBe(true);
  });

  it("rejects missing city", () => {
    const { rows, errors } = parseTmImportCsv(csv("X,ACME,CASE-001,BRAND,"));
    expect(rows).toHaveLength(0);
    expect(errors.some((e) => /city.*required/i.test(e))).toBe(true);
  });

  it("accumulates errors from multiple rows and continues parsing valid rows", () => {
    const { rows, errors } = parseTmImportCsv(
      csv(
        "X,ACME,CASE-001,BRAND,Islamabad",        // valid
        ",BAD,CASE-002,BRAND,Islamabad",           // missing type -> error
        "A,CORP,CASE-003,ANOTHER BRAND,Karachi",  // valid
      ),
    );
    expect(rows).toHaveLength(2);
    expect(errors).toHaveLength(1);
  });

  it("parses optional fields correctly", () => {
    const { rows, errors } = parseTmImportCsv(
      "type,client_code,case_number,application_name,city,filing_date,client_name,tm_cpr_number,nice_class,case_type,agent,notes\n" +
        "X,ACME,CASE-001,BRAND,Islamabad,2025-01-15,ACME CORP,12345,35,Trademark,LAWYER,some note",
    );
    expect(errors).toHaveLength(0);
    const r = rows[0];
    expect(r.filingDate).toBe("2025-01-15");
    expect(r.clientName).toBe("ACME CORP");
    expect(r.tmCprNumber).toBe("12345");
    expect(r.niceClass).toBe("35");
    expect(r.caseType).toBe("TRADEMARK");
    expect(r.agent).toBe("LAWYER");
    expect(r.notes).toBe("some note");
  });

  it("parses DD/MM/YYYY filing date format", () => {
    const { rows, errors } = parseTmImportCsv(
      "type,client_code,case_number,application_name,city,filing_date\n" +
        "X,ACME,CASE-001,BRAND,Islamabad,15/01/2025",
    );
    expect(errors).toHaveLength(0);
    expect(rows[0].filingDate).toBe("2025-01-15");
  });

  it("rejects invalid filing_date", () => {
    const { rows, errors } = parseTmImportCsv(
      "type,client_code,case_number,application_name,city,filing_date\n" +
        "X,ACME,CASE-001,BRAND,Islamabad,not-a-date",
    );
    expect(rows).toHaveLength(0);
    expect(errors.some((e) => /invalid filing_date/i.test(e))).toBe(true);
  });

  it("rejects invalid nice_class (out of range)", () => {
    const { rows, errors } = parseTmImportCsv(
      "type,client_code,case_number,application_name,city,nice_class\n" +
        "X,ACME,CASE-001,BRAND,Islamabad,99",
    );
    expect(rows).toHaveLength(0);
    expect(errors.some((e) => /invalid nice_class/i.test(e))).toBe(true);
  });

  it("rejects nice_class=0", () => {
    const { rows, errors } = parseTmImportCsv(
      "type,client_code,case_number,application_name,city,nice_class\n" +
        "X,ACME,CASE-001,BRAND,Islamabad,0",
    );
    expect(rows).toHaveLength(0);
    expect(errors.some((e) => /invalid nice_class/i.test(e))).toBe(true);
  });

  it("accepts nice_class 1-45", () => {
    for (const cls of [1, 20, 45]) {
      const { rows, errors } = parseTmImportCsv(
        `type,client_code,case_number,application_name,city,nice_class\nX,A,C-001,BRAND,Islamabad,${cls}`,
      );
      expect(errors).toHaveLength(0);
      expect(rows[0].niceClass).toBe(String(cls));
    }
  });

  it("WORKFLOW SAFETY: always initializes status to STAGE 1 and subStatus to Filing", () => {
    const { rows } = parseTmImportCsv(
      "type,client_code,case_number,application_name,city,status,sub_status\n" +
        "X,ACME,CASE-001,BRAND,Islamabad,STAGE 3,Published",
    );
    expect(rows[0].status).toBe("STAGE 1");
    expect(rows[0].subStatus).toBe("Filing");
  });
});

// ---------------------------------------------------------------------------
// tmDupKey — unit test
// ---------------------------------------------------------------------------

describe("tmDupKey", () => {
  it("uses exactly (type, client_code, case_number) as duplicate key", () => {
    expect(tmDupKey("X", "ACME", "CASE-001")).toBe("X|ACME|CASE-001");
  });

  it("is case-insensitive", () => {
    expect(tmDupKey("x", "acme", "case-001")).toBe(
      tmDupKey("X", "ACME", "CASE-001"),
    );
  });

  it("distinguishes different composite keys", () => {
    expect(tmDupKey("X", "ACME", "CASE-001")).not.toBe(
      tmDupKey("A", "ACME", "CASE-001"),
    );
    expect(tmDupKey("X", "ACME", "CASE-001")).not.toBe(
      tmDupKey("X", "OTHER", "CASE-001"),
    );
    expect(tmDupKey("X", "ACME", "CASE-001")).not.toBe(
      tmDupKey("X", "ACME", "CASE-002"),
    );
  });
});

// ---------------------------------------------------------------------------
// dryRunTmImport — integration-level (supabase mocked)
// ---------------------------------------------------------------------------

describe("dryRunTmImport", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns zero counts and parse error for empty CSV", async () => {
    const result = await dryRunTmImport("type,client_code");
    expect(result.valid).toBe(0);
    expect(result.invalid).toBe(1);
    expect(result.wouldInsert).toBe(0);
    expect(result.errors).toHaveLength(1);
  });

  it("DRY RUN SAFETY: makes NO database inserts or mutations", async () => {
    supabaseMock.from.mockReturnValue(makeQuery({ data: [], error: null }));
    const result = await dryRunTmImport(csv(CSV_ROW_VALID));
    expect(result.wouldInsert).toBe(1);
    // Confirm supabase.from was called only for SELECT, never insert/update/delete/upsert
    const q = supabaseMock.from.mock.results[0].value;
    expect((q.insert as ReturnType<typeof vi.fn>).mock?.calls?.length ?? 0).toBe(0);
  });

  it("detects within-CSV duplicate rows with exact duplicate key", async () => {
    supabaseMock.from.mockReturnValue(makeQuery({ data: [], error: null }));
    const result = await dryRunTmImport(
      csv(
        CSV_ROW_VALID,
        CSV_ROW_VALID, // exact duplicate
      ),
    );
    expect(result.valid).toBe(2);
    expect(result.csvDuplicates).toBe(1);
    expect(result.wouldInsert).toBe(1);
    const skips = result.items.filter((i) => i.action === "skip_csv_dup");
    expect(skips).toHaveLength(1);
    expect(skips[0].message).toMatch(/duplicate within csv/i);
  });

  it("DUPLICATE KEY SAFETY: detects within-CSV duplicates when TM/CPR numbers differ", async () => {
    supabaseMock.from.mockReturnValue(makeQuery({ data: [], error: null }));
    const csvContent =
      "type,client_code,case_number,application_name,city,tm_cpr_number\n" +
      "X,ACME,CASE-001,BRAND ONE,Islamabad,11111\n" +
      "X,ACME,CASE-001,BRAND TWO,Islamabad,99999";
    const result = await dryRunTmImport(csvContent);
    expect(result.valid).toBe(2);
    expect(result.csvDuplicates).toBe(1);
    expect(result.wouldInsert).toBe(1);
    const skips = result.items.filter((i) => i.action === "skip_csv_dup");
    expect(skips).toHaveLength(1);
  });

  it("DUPLICATE KEY SAFETY: detects within-CSV duplicates when one TM/CPR number is blank", async () => {
    supabaseMock.from.mockReturnValue(makeQuery({ data: [], error: null }));
    const csvContent =
      "type,client_code,case_number,application_name,city,tm_cpr_number\n" +
      "X,ACME,CASE-001,BRAND ONE,Islamabad,\n" +
      "X,ACME,CASE-001,BRAND TWO,Islamabad,54321";
    const result = await dryRunTmImport(csvContent);
    expect(result.valid).toBe(2);
    expect(result.csvDuplicates).toBe(1);
    expect(result.wouldInsert).toBe(1);
  });

  it("detects DB duplicate rows based on (type, client_code, case_number)", async () => {
    supabaseMock.from.mockReturnValue(
      makeQuery({
        data: [{ type: "X", client_code: "ACME", case_number: "CASE-001" }],
        error: null,
      }),
    );
    const result = await dryRunTmImport(csv(CSV_ROW_VALID));
    expect(result.dbDuplicates).toBe(1);
    expect(result.wouldInsert).toBe(0);
    const skip = result.items.find((i) => i.action === "skip_db_dup");
    expect(skip).toBeDefined();
    expect(skip!.message).toMatch(/already in database/i);
  });

  it("DUPLICATE KEY SAFETY: detects DB duplicate even when CSV has different or blank TM/CPR number", async () => {
    supabaseMock.from.mockReturnValue(
      makeQuery({
        data: [{ type: "X", client_code: "ACME", case_number: "CASE-001" }],
        error: null,
      }),
    );
    const csvContent =
      "type,client_code,case_number,application_name,city,tm_cpr_number\n" +
      "X,ACME,CASE-001,BRAND ONE,Islamabad,DIFFERENT-TM-999";
    const result = await dryRunTmImport(csvContent);
    expect(result.dbDuplicates).toBe(1);
    expect(result.wouldInsert).toBe(0);
  });

  it("correctly separates valid, invalid, and would-insert rows", async () => {
    supabaseMock.from.mockReturnValue(makeQuery({ data: [], error: null }));
    const result = await dryRunTmImport(
      csv(
        CSV_ROW_VALID,                             // valid -> insert
        "X,ACME,CASE-002,BRAND B,Karachi",        // valid -> insert
        ",BAD,CASE-003,BRAND,Islamabad",           // invalid (missing type)
      ),
    );
    expect(result.valid).toBe(2);
    expect(result.invalid).toBe(1);
    expect(result.wouldInsert).toBe(2);
    expect(result.errors).toHaveLength(1);
  });

  it("handles DB lookup error gracefully", async () => {
    supabaseMock.from.mockReturnValue(
      makeQuery({ data: null, error: { message: "connection refused" } }),
    );
    const result = await dryRunTmImport(csv(CSV_ROW_VALID));
    expect(result.errors.some((e) => /db lookup failed/i.test(e))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// commitTmImport — integration-level (supabase mocked)
// ---------------------------------------------------------------------------

describe("commitTmImport", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
    });
  });

  it("returns zero counts for empty rows array", async () => {
    const result = await commitTmImport([]);
    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("inserts only valid rows in batches of 100", async () => {
    const insertQuery = makeQuery({ data: [{ id: "new-1" }], error: null });
    supabaseMock.from.mockReturnValue(insertQuery);

    const rows: TmImportRow[] = [
      {
        sourceRow: 2,
        type: "X",
        clientCode: "ACME",
        caseNumber: "CASE-001",
        applicationName: "SUPER BRAND",
        city: "ISLAMABAD",
        filingDate: "2025-01-01",
        clientName: null,
        tmCprNumber: null,
        niceClass: null,
        caseType: null,
        agent: null,
        notes: null,
        status: "STAGE 1",
        subStatus: "Filing",
      },
    ];

    const result = await commitTmImport(rows);
    expect(result.inserted).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it("PAYMENT SAFETY: insert payload sets stage1_paid=false and stage1_paid_date=null", async () => {
    let capturedPayload: unknown[] = [];
    const insertQuery = {
      insert: vi.fn((data: unknown[]) => {
        capturedPayload = data;
        return insertQuery;
      }),
      select: vi.fn(() => Promise.resolve({ data: [{ id: "new-1" }], error: null })),
    };
    supabaseMock.from.mockReturnValue(insertQuery);

    const rows: TmImportRow[] = [
      {
        sourceRow: 2,
        type: "X",
        clientCode: "ACME",
        caseNumber: "CASE-001",
        applicationName: "SUPER BRAND",
        city: "ISLAMABAD",
        filingDate: null,
        clientName: null,
        tmCprNumber: null,
        niceClass: null,
        caseType: null,
        agent: null,
        notes: null,
        status: "STAGE 1",
        subStatus: "Filing",
      },
    ];

    await commitTmImport(rows);

    expect(capturedPayload).toHaveLength(1);
    const row = capturedPayload[0] as Record<string, unknown>;
    // Payment safety assertions
    expect(row.stage1_paid).toBe(false);
    expect(row.stage1_paid_date).toBeNull();
  });

  it("WORKFLOW SAFETY: insert payload explicitly sets status=STAGE 1 and sub_status=Filing", async () => {
    let capturedPayload: unknown[] = [];
    const insertQuery = {
      insert: vi.fn((data: unknown[]) => {
        capturedPayload = data;
        return insertQuery;
      }),
      select: vi.fn(() => Promise.resolve({ data: [{ id: "new-1" }], error: null })),
    };
    supabaseMock.from.mockReturnValue(insertQuery);

    const rows: TmImportRow[] = [
      {
        sourceRow: 2,
        type: "X",
        clientCode: "ACME",
        caseNumber: "CASE-001",
        applicationName: "SUPER BRAND",
        city: "ISLAMABAD",
        filingDate: null,
        clientName: null,
        tmCprNumber: null,
        niceClass: null,
        caseType: null,
        agent: null,
        notes: null,
        status: "STAGE 1",
        subStatus: "Filing",
      },
    ];

    await commitTmImport(rows);

    expect(capturedPayload).toHaveLength(1);
    const row = capturedPayload[0] as Record<string, unknown>;
    expect(row.status).toBe("STAGE 1");
    expect(row.sub_status).toBe("Filing");
  });

  it("BLOCKED FIELDS: insert payload must NOT contain system/blocked fields", async () => {
    let capturedPayload: unknown[] = [];
    const insertQuery = {
      insert: vi.fn((data: unknown[]) => {
        capturedPayload = data;
        return insertQuery;
      }),
      select: vi.fn(() => Promise.resolve({ data: [{ id: "new-1" }], error: null })),
    };
    supabaseMock.from.mockReturnValue(insertQuery);

    const rows: TmImportRow[] = [
      {
        sourceRow: 2,
        type: "X",
        clientCode: "ACME",
        caseNumber: "CASE-001",
        applicationName: "MY BRAND",
        city: "ISLAMABAD",
        filingDate: null,
        clientName: null,
        tmCprNumber: null,
        niceClass: null,
        caseType: null,
        agent: null,
        notes: null,
        status: "STAGE 1",
        subStatus: "Filing",
      },
    ];

    await commitTmImport(rows);

    const row = capturedPayload[0] as Record<string, unknown>;
    // These must NEVER appear in insert payload
    expect(row).not.toHaveProperty("id");
    expect(row).not.toHaveProperty("version");
    expect(row).not.toHaveProperty("stage2_paid");
    expect(row).not.toHaveProperty("stage2_paid_date");
    expect(row).not.toHaveProperty("stage3_paid");
    expect(row).not.toHaveProperty("stage4_paid");
    expect(row).not.toHaveProperty("payment_reference");
    expect(row).not.toHaveProperty("logo_path");
    expect(row).not.toHaveProperty("legacy_image_url");
    expect(row).not.toHaveProperty("journal_data");
    expect(row).not.toHaveProperty("tm5");
    expect(row).not.toHaveProperty("tm6");
    expect(row).not.toHaveProperty("tm11");
    expect(row).not.toHaveProperty("tm16");
    expect(row).not.toHaveProperty("tm56");
    expect(row).not.toHaveProperty("publication_date");
    expect(row).not.toHaveProperty("source_sheet_row");
  });

  it("reports error when batch insert fails, without silent partial failure", async () => {
    const insertQuery = {
      insert: vi.fn(() => insertQuery),
      select: vi.fn(() =>
        Promise.resolve({ data: null, error: { message: "permission denied" } }),
      ),
    };
    supabaseMock.from.mockReturnValue(insertQuery);

    const rows: TmImportRow[] = [
      {
        sourceRow: 2,
        type: "A",
        clientCode: "CORP",
        caseNumber: "CASE-999",
        applicationName: "FAIL BRAND",
        city: "KARACHI",
        filingDate: null,
        clientName: null,
        tmCprNumber: null,
        niceClass: null,
        caseType: null,
        agent: null,
        notes: null,
        status: "STAGE 1",
        subStatus: "Filing",
      },
    ];

    const result = await commitTmImport(rows);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/batch.*failed/i);
    expect(result.inserted).toBe(0);
  });
});
