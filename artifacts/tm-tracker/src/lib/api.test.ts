import { beforeEach, describe, expect, it, vi } from "vitest";

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
    storage: {
      from: vi.fn(),
    },
  },
}));

vi.mock("./supabase", () => ({
  isSupabaseConfigured: true,
  TRADEMARK_FILES_BUCKET: "trademark-files",
  supabase: supabaseMock,
}));

import {
  ConflictError,
  createTrademark,
  deleteTrademark,
  getRecord,
  getWorkflowHistory,
  inputToRow,
  isStage2PaymentRequired,
  isValidStageTransition,
  validatePaymentGate,
  listStageDocuments,
  listTrademarkPage,
  listTrademarksForExport,
  mapRowToRecord,
  StagePaymentRequiredError,
  updateTrademark,
  uploadImage,
  uploadStageDocument,
  validateStage2PaymentGate,
  assignStage2Agent,
  formatWorkflowLabel,
  normalizeWorkflowValue,
  WORKFLOW_DISPLAY_LABELS,
  STAGE_DOCUMENT_WORKFLOW,
  updateTrademarkStatus,
  updateTrademarkAgent,
  listPublicationPipeline,
  getWorkflowReminders,
  listAuditLogs,
  getStats,
} from "./api";

function createQuery(response: unknown = { data: [], error: null, count: 0 }) {
  const query = {
    select: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn(() => query),
    or: vi.fn(() => query),
    gte: vi.fn(() => query),
    lte: vi.fn(() => query),
    eq: vi.fn(() => query),
    ilike: vi.fn(() => query),
    in: vi.fn(() => query),
    not: vi.fn(() => query),
    insert: vi.fn(() => query),
    update: vi.fn(() => query),
    delete: vi.fn(() => query),
    maybeSingle: vi.fn(() => Promise.resolve(response)),
    single: vi.fn(() => Promise.resolve(response)),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(response).then(resolve, reject),
  };
  return query;
}

const baseSupabaseRow = {
  id: "BX-1",
  filing_date: "2026-08-28",
  type: "X",
  client_code: "C-7",
  client_name: "Client",
  case_number: "CASE-9",
  application_name: "BRANDEX",
  tm_cpr_number: "12345",
  nice_class: "35",
  status: "STAGE 2",
  sub_status: "Assigned",
  case_type: "Trademark",
  agent: "Counsel",
  city: "Islamabad",
  notes: "Private detail",
  tm5: true,
  tm6: false,
  tm11: false,
  tm16: false,
  tm56: false,
  journal_number: "J-1",
  journal_date: "2026-08-01",
  journal_data: null,
  logo_path: "logos/bx-1.png",
  legacy_image_url: null,
  updated_at: "2026-08-28T10:00:00Z",
  version: 3,
};

beforeEach(() => {
  vi.clearAllMocks();
  supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  supabaseMock.storage.from.mockReturnValue({
    createSignedUrls: vi.fn().mockResolvedValue({ data: [] }),
    createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed.example/upload.png" } }),
  });
});

describe("Brandex data mapping", () => {
  it("maps the 24-column Sheet format without changing legal identifiers", () => {
    const record = mapRowToRecord({
      ID: "BX-1",
      DATE: "2026-08-28",
      TYPE: "X",
      "CLIENT CODE": "C-7",
      "CASE NUMBER": "CASE-9",
      "CLIENT NAME": "Client",
      "APPLICATION NAME": "BRANDEX",
      "TM/CPR NUMBER": "12345",
      CLASS: "35, 42",
      STATUS: "STAGE 2",
      "SUB STATUS": "Assigned",
      "CASE TYPE": "Trademark",
      AGENT: "Counsel",
      CITY: "Islamabad",
      NOTES: "Priority",
      TM5: "YES",
      TM6: "",
      TM11: "",
      TM16: "",
      TM56: "",
      "JOURNAL NUMBER": "J-1",
      "JOURNAL DATE": "2026-08-01",
      "LAST MODIFIED": "2026-08-28T10:00:00Z",
      IMAGE: "drive-file-id",
    });

    expect(record.id).toBe("BX-1");
    expect(record.caseNumber).toBe("CASE-9");
    expect(record.appClass).toBe("35, 42");
    expect(record.tm5).toBe("YES");
  });

  it("separates private storage paths from legacy external image URLs", () => {
    expect(inputToRow({ image: "pending/user/logo.png" })).toMatchObject({
      logo_path: "pending/user/logo.png",
      legacy_image_url: null,
    });
    expect(inputToRow({ image: "https://drive.google.com/logo" })).toMatchObject({
      logo_path: null,
      legacy_image_url: "https://drive.google.com/logo",
    });
    expect(inputToRow({ image: "" })).toMatchObject({
      logo_path: null,
      legacy_image_url: null,
    });
  });
});

describe("Brandex Supabase access patterns", () => {
  it("loads paginated list rows without fetching private detail fields", async () => {
    const query = createQuery({ data: [baseSupabaseRow], error: null, count: 1 });
    supabaseMock.from.mockReturnValue(query);

    const page = await listTrademarkPage({ search: " CASE,9 ", page: 2, pageSize: 50 });

    expect(supabaseMock.from).toHaveBeenCalledWith("trademarks");
    expect(query.select).toHaveBeenCalledWith(expect.not.stringContaining("notes"), { count: "exact" });
    expect(query.select).toHaveBeenCalledWith(expect.stringContaining("logo_path"), { count: "exact" });
    expect(query.order).toHaveBeenNthCalledWith(1, "type", { ascending: true });
    expect(query.order).toHaveBeenNthCalledWith(2, "client_code", { ascending: true });
    expect(query.order).toHaveBeenNthCalledWith(3, "case_number", { ascending: true });
    expect(query.range).toHaveBeenCalledWith(50, 99);
    expect(query.or).toHaveBeenCalledWith(expect.stringContaining("case_number.ilike.%CASE 9%"));
    expect(supabaseMock.storage.from).toHaveBeenCalledWith("trademark-files");
    expect(page.records[0]).toMatchObject({ id: "BX-1", caseNumber: "CASE-9", image: "" });
  });

  it("exports filtered records by reusing server-side filters with detail columns", async () => {
    const query = createQuery({ data: [baseSupabaseRow], error: null, count: 1 });
    supabaseMock.from.mockReturnValue(query);

    const records = await listTrademarksForExport({ city: "Islamabad", tmForm: "TM5" });

    expect(query.select).toHaveBeenCalledWith("*", { count: "exact" });
    expect(query.eq).toHaveBeenCalledWith("city", "Islamabad");
    expect(query.eq).toHaveBeenCalledWith("tm5", true);
    expect(records).toHaveLength(1);
  });

  it("signs private image paths only when a record is opened", async () => {
    const query = createQuery({ data: baseSupabaseRow, error: null });
    supabaseMock.from.mockReturnValue(query);
    supabaseMock.storage.from.mockReturnValue({
      createSignedUrls: vi.fn().mockResolvedValue({
        data: [{ signedUrl: "https://signed.example/logo.png" }],
      }),
    });

    const record = await getRecord("BX-1");

    expect(query.select).toHaveBeenCalledWith("*");
    expect(query.eq).toHaveBeenCalledWith("id", "BX-1");
    expect(query.maybeSingle).toHaveBeenCalled();
    expect(supabaseMock.storage.from).toHaveBeenCalledWith("trademark-files");
    expect(record?.image).toBe("https://signed.example/logo.png");
  });

  it("routes create, update, and delete through RLS-protected trademark mutations", async () => {
    const createQueryMock = createQuery({ data: { id: "BX-2", case_number: "CASE-10" }, error: null });
    const selectBeforeUpdateMock = createQuery({ data: { status: "STAGE 1", stage1_paid: true }, error: null });
    const updateQueryMock = createQuery({ data: { id: "BX-2", version: 4 }, error: null });
    const deleteQueryMock = createQuery({ error: null });
    supabaseMock.from
      .mockReturnValueOnce(createQueryMock)
      .mockReturnValueOnce(selectBeforeUpdateMock)
      .mockReturnValueOnce(updateQueryMock)
      .mockReturnValueOnce(deleteQueryMock);

    await createTrademark({ type: "X", clientCode: "C-7", caseNumber: "CASE-10", appName: "NEW", city: "Lahore", stage: "STAGE 1" });
    await updateTrademark("BX-2", { type: "X", clientCode: "C-7", caseNumber: "CASE-10", appName: "UPDATED", city: "Lahore", stage: "STAGE 1" }, 3);
    await deleteTrademark("BX-2");

    expect(createQueryMock.insert).toHaveBeenCalledWith(expect.objectContaining({ created_by: "user-1", updated_by: "user-1" }));
    expect(updateQueryMock.update).toHaveBeenCalledWith(expect.objectContaining({ application_name: "UPDATED" }));
    expect(updateQueryMock.eq).toHaveBeenCalledWith("version", 3);
    expect(deleteQueryMock.delete).toHaveBeenCalled();
    expect(deleteQueryMock.eq).toHaveBeenCalledWith("id", "BX-2");
  });

  it("raises a conflict when optimistic locking updates no row", async () => {
    const selectQuery = createQuery({ data: { status: "STAGE 1", stage1_paid: true }, error: null });
    const updateQuery = createQuery({ data: null, error: null });
    supabaseMock.from
      .mockReturnValueOnce(selectQuery)
      .mockReturnValueOnce(updateQuery);

    await expect(
      updateTrademark("BX-1", { type: "X", clientCode: "C-7", caseNumber: "CASE-9", appName: "BRANDEX", city: "Islamabad", stage: "STAGE 2" }, 3),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("uploads files into private user-scoped storage and returns a short-lived signed URL", async () => {
    const storage = {
      upload: vi.fn().mockResolvedValue({ error: null }),
      createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed.example/upload.png" } }),
    };
    supabaseMock.storage.from.mockReturnValue(storage);
    vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000000");

    const file = new File(["image"], "brand.png", { type: "image/png" });
    const result = await uploadImage(file);

    expect(supabaseMock.storage.from).toHaveBeenCalledWith("trademark-files");
    expect(storage.upload).toHaveBeenCalledWith(
      "pending/user-1/00000000-0000-4000-8000-000000000000.png",
      file,
      { contentType: "image/png", upsert: false },
    );
    expect(storage.createSignedUrl).toHaveBeenCalledWith(
      "pending/user-1/00000000-0000-4000-8000-000000000000.png",
      3600,
    );
    expect(result.url).toBe("https://signed.example/upload.png");
  });

  it("fetches workflow history mapped to TrademarkWorkflowEvent array", async () => {
    const query = createQuery({
      data: [{
        id: 1,
        trademark_id: "BX-1",
        event_type: "STATUS_CHANGE",
        from_status: "STAGE 1",
        from_sub_status: null,
        to_status: "STAGE 2",
        to_sub_status: "Accepted",
        event_at: "2026-09-10T12:00:00Z",
        changed_by: "user-1",
        profiles: { display_name: "User A" }
      }],
      error: null
    });
    supabaseMock.from.mockReturnValue(query);

    const history = await getWorkflowHistory("BX-1");
    expect(supabaseMock.from).toHaveBeenCalledWith("trademark_workflow_history");
    expect(query.eq).toHaveBeenCalledWith("trademark_id", "BX-1");
    expect(history).toHaveLength(1);
    expect(history[0].toSubStatus).toBe("Accepted");
    expect(history[0].changedByName).toBe("User A");
  });

  it("enforces Stage 2 payment gate (stage1_paid = true required)", () => {
    // Stage 2 with unpaid Stage 1 status must be blocked
    expect(isStage2PaymentRequired("STAGE 2", false)).toBe(true);
    expect(isStage2PaymentRequired("STAGE 2", undefined)).toBe(true);
    expect(() => validateStage2PaymentGate("STAGE 2", false)).toThrow(StagePaymentRequiredError);
    expect(() => validateStage2PaymentGate("STAGE 2", false)).toThrow(
      "Stage 2 cannot be started until Stage 1 payment is cleared.",
    );

    // Stage 2 with Stage 1 paid status must pass
    expect(isStage2PaymentRequired("STAGE 2", true)).toBe(false);
    expect(() => validateStage2PaymentGate("STAGE 2", true)).not.toThrow();

    // Non-Stage 2 (e.g. STAGE 1) must pass without requiring stage1_paid
    expect(isStage2PaymentRequired("STAGE 1", false)).toBe(false);
    expect(() => validateStage2PaymentGate("STAGE 1", false)).not.toThrow();
  });

  it("enforces Stage 2 agent assignment: blocked when unpaid, allowed when paid", async () => {
    // Unpaid case: must throw StagePaymentRequiredError
    const unpaidQuery = createQuery({ data: { stage1_paid: false, status: "STAGE 2", sub_status: "Assigned" }, error: null });
    supabaseMock.from.mockReturnValue(unpaidQuery);
    await expect(assignStage2Agent("BX-1", "Counsel A", "Islamabad")).rejects.toBeInstanceOf(StagePaymentRequiredError);

    // Paid case: updates agent and city
    const paidSelectQuery = createQuery({ data: { stage1_paid: true, status: "STAGE 2", sub_status: "Assigned" }, error: null });
    const updateQuery = createQuery({ data: null, error: null });
    let callCount = 0;
    supabaseMock.from.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? paidSelectQuery : updateQuery;
    });

    await assignStage2Agent("BX-1", "Counsel B", "Karachi");
    // Agent name and city are uppercased at the API boundary (Batch 2 normalisation rule)
    expect(updateQuery.update).toHaveBeenCalledWith({ agent: "COUNSEL B", city: "KARACHI" });
    expect(updateQuery.eq).toHaveBeenCalledWith("id", "BX-1");
  });
});

// =============================================================================
// Batch 9: Stage Document API tests
// =============================================================================

const baseStageDocRow = {
  id: "doc-uuid-1",
  trademark_id: "BX-1",
  stage: "STAGE 1",
  sub_stage: "Filing",
  title: "Application Form",
  storage_path: "BX-1/STAGE_1/doc-uuid-1.pdf",
  file_name: "application.pdf",
  mime_type: "application/pdf",
  size_bytes: 204800,
  uploaded_by: "user-1",
  created_at: "2026-09-22T01:00:00Z",
};

describe("Batch 9: Stage document API", () => {
  it("uploadStageDocument — maps stage, sub_stage, and title on the inserted row", async () => {
    const uploadStorage = {
      upload: vi.fn().mockResolvedValue({ error: null }),
      createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed.example/doc.pdf" } }),
      remove: vi.fn().mockResolvedValue({ error: null }),
    };
    supabaseMock.storage.from.mockReturnValue(uploadStorage);

    const insertQuery = createQuery({ data: baseStageDocRow, error: null });
    supabaseMock.from.mockReturnValue(insertQuery);
    vi.spyOn(crypto, "randomUUID").mockReturnValue("doc-uuid-1" as `${string}-${string}-${string}-${string}-${string}`);

    const file = new File([new Uint8Array(204800)], "application.pdf", { type: "application/pdf" });
    const result = await uploadStageDocument(file, {
      trademarkId: "BX-1",
      stage: "STAGE 1",
      subStage: "Filing",
      title: "Application Form",
    });

    // Verify storage path contains trademarkId and sanitised stage
    expect(uploadStorage.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^BX-1\/STAGE_1\//),
      file,
      { contentType: "application/pdf", upsert: false },
    );

    // Verify DB insert includes stage/sub_stage/title
    expect(insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        trademark_id: "BX-1",
        stage: "STAGE 1",
        sub_stage: "Filing",
        title: "Application Form",
        file_name: "application.pdf",
        mime_type: "application/pdf",
      }),
    );

    // Verify returned document maps correctly
    expect(result.stage).toBe("STAGE 1");
    expect(result.subStage).toBe("Filing");
    expect(result.title).toBe("Application Form");
    expect(result.trademarkId).toBe("BX-1");
    expect(result.signedUrl).toBe("https://signed.example/doc.pdf");
  });

  it("uploadStageDocument — removes orphan storage object when DB insert fails", async () => {
    const storagePath = "BX-1/STAGE_1/doc-uuid-1.pdf";
    const removeStorage = {
      upload: vi.fn().mockResolvedValue({ error: null }),
      createSignedUrl: vi.fn(),
      remove: vi.fn().mockResolvedValue({ error: null }),
    };
    supabaseMock.storage.from.mockReturnValue(removeStorage);

    const failQuery = createQuery({ data: null, error: { message: "insert failed" } });
    supabaseMock.from.mockReturnValue(failQuery);
    vi.spyOn(crypto, "randomUUID").mockReturnValue("doc-uuid-1" as `${string}-${string}-${string}-${string}-${string}`);

    const file = new File(["pdf"], "app.pdf", { type: "application/pdf" });
    await expect(
      uploadStageDocument(file, { trademarkId: "BX-1", stage: "STAGE 1" }),
    ).rejects.toThrow("insert failed");

    // Orphan cleanup must be attempted
    expect(removeStorage.remove).toHaveBeenCalledWith([expect.stringMatching(/^BX-1\/STAGE_1\//)],
    );

    void storagePath; // suppress unused-variable lint
  });

  it("uploadStageDocument — returns metadata without signedUrl when signing fails", async () => {
    const noUrlStorage = {
      upload: vi.fn().mockResolvedValue({ error: null }),
      createSignedUrl: vi.fn().mockResolvedValue({ data: null }),
      remove: vi.fn(),
    };
    supabaseMock.storage.from.mockReturnValue(noUrlStorage);

    const insertQuery = createQuery({ data: { ...baseStageDocRow, sub_stage: null, title: null }, error: null });
    supabaseMock.from.mockReturnValue(insertQuery);

    const file = new File(["pdf"], "doc.pdf", { type: "application/pdf" });
    const result = await uploadStageDocument(file, { trademarkId: "BX-1", stage: "STAGE 1" });

    // signedUrl absent — no public URL exposed
    expect(result.signedUrl).toBeUndefined();
    expect(result.stage).toBe("STAGE 1");
    expect(noUrlStorage.remove).not.toHaveBeenCalled();
  });

  it("listStageDocuments — returns all docs for trademark when no stage filter", async () => {
    const row2 = { ...baseStageDocRow, id: "doc-uuid-2", stage: "STAGE 2", storage_path: "BX-1/STAGE_2/doc-uuid-2.pdf" };
    const listQuery = createQuery({ data: [baseStageDocRow, row2], error: null });
    supabaseMock.from.mockReturnValue(listQuery);
    supabaseMock.storage.from.mockReturnValue({
      createSignedUrls: vi.fn().mockResolvedValue({
        data: [
          { signedUrl: "https://signed.example/stage1.pdf" },
          { signedUrl: "https://signed.example/stage2.pdf" },
        ],
      }),
    });

    const docs = await listStageDocuments("BX-1");

    expect(supabaseMock.from).toHaveBeenCalledWith("trademark_files");
    expect(listQuery.eq).toHaveBeenCalledWith("trademark_id", "BX-1");
    // No stage filter → eq("stage", ...) must NOT be called for stage
    const eqCalls = (listQuery.eq as ReturnType<typeof vi.fn>).mock.calls;
    expect(eqCalls.some((c: string[]) => c[0] === "stage")).toBe(false);
    expect(docs).toHaveLength(2);
    expect(docs[0].stage).toBe("STAGE 1");
    expect(docs[1].stage).toBe("STAGE 2");
  });

  it("listStageDocuments — applies stage filter when stage argument is provided", async () => {
    const listQuery = createQuery({ data: [baseStageDocRow], error: null });
    supabaseMock.from.mockReturnValue(listQuery);
    supabaseMock.storage.from.mockReturnValue({
      createSignedUrls: vi.fn().mockResolvedValue({ data: [{ signedUrl: "https://signed.example/stage1.pdf" }] }),
    });

    const docs = await listStageDocuments("BX-1", "STAGE 1");

    // Stage filter must be applied
    expect(listQuery.eq).toHaveBeenCalledWith("stage", "STAGE 1");
    expect(docs).toHaveLength(1);
    expect(docs[0].subStage).toBe("Filing");
    expect(docs[0].title).toBe("Application Form");
    expect(docs[0].signedUrl).toBe("https://signed.example/stage1.pdf");
  });
});

describe("Batch 10: Workflow Terminology Expansion", () => {
  it("formatWorkflowLabel — expands abbreviated sub-stage codes to full terminology", () => {
    expect(formatWorkflowLabel("D-Note Submitted")).toBe("Demand Note Submitted");
    expect(formatWorkflowLabel("D-Note Received")).toBe("Demand Note Received");
    expect(formatWorkflowLabel("OPPO: Filed")).toBe("Opposition: Filed");
    expect(formatWorkflowLabel("OPPO: Received")).toBe("Opposition: Received");
    expect(formatWorkflowLabel("OPPO: Withdrawn")).toBe("Opposition: Withdrawn");
  });

  it("formatWorkflowLabel — leaves unmapped or already expanded terminology unchanged", () => {
    expect(formatWorkflowLabel("Filing")).toBe("Filing");
    expect(formatWorkflowLabel("Assigned")).toBe("Assigned");
    expect(formatWorkflowLabel("Accepted")).toBe("Accepted");
    expect(formatWorkflowLabel("Hearing")).toBe("Hearing");
    expect(formatWorkflowLabel("Published")).toBe("Published");
    expect(formatWorkflowLabel("CER Dispatch")).toBe("CER Dispatch");
    expect(formatWorkflowLabel("CER Received")).toBe("CER Received");
    expect(formatWorkflowLabel("CER Acknowledge")).toBe("CER Acknowledge");
    expect(formatWorkflowLabel("Demand Note Submitted")).toBe("Demand Note Submitted");
  });

  it("formatWorkflowLabel — safely handles empty or null/undefined values", () => {
    expect(formatWorkflowLabel("")).toBe("");
    expect(formatWorkflowLabel(null)).toBe("");
    expect(formatWorkflowLabel(undefined)).toBe("");
  });

  it("normalizeWorkflowValue — maps full terminology back to canonical internal database values", () => {
    expect(normalizeWorkflowValue("Demand Note Submitted")).toBe("D-Note Submitted");
    expect(normalizeWorkflowValue("Demand Note Received")).toBe("D-Note Received");
    expect(normalizeWorkflowValue("Opposition: Filed")).toBe("OPPO: Filed");
    expect(normalizeWorkflowValue("Opposition: Received")).toBe("OPPO: Received");
    expect(normalizeWorkflowValue("Opposition: Withdrawn")).toBe("OPPO: Withdrawn");

    // Existing internal values remain unchanged
    expect(normalizeWorkflowValue("D-Note Submitted")).toBe("D-Note Submitted");
    expect(normalizeWorkflowValue("Assigned")).toBe("Assigned");
    expect(normalizeWorkflowValue(null)).toBe("");
  });

  it("inputToRow — normalizes expanded user-facing subStage to canonical database value", () => {
    const row = inputToRow({
      date: "2026-09-22",
      type: "X",
      clientCode: "C-1",
      caseNumber: "100",
      appName: "Test App",
      stage: "STAGE 3",
      subStage: "Demand Note Submitted",
      city: "Islamabad",
    });

    expect(row.sub_status).toBe("D-Note Submitted");
  });
});

describe("Batch 11: Stage Documents Workflow & Normalization", () => {
  it("STAGE_DOCUMENT_WORKFLOW — contains all 4 stages in sequential order", () => {
    expect(STAGE_DOCUMENT_WORKFLOW).toHaveLength(4);
    expect(STAGE_DOCUMENT_WORKFLOW[0].stage).toBe("STAGE 1");
    expect(STAGE_DOCUMENT_WORKFLOW[1].stage).toBe("STAGE 2");
    expect(STAGE_DOCUMENT_WORKFLOW[2].stage).toBe("STAGE 3");
    expect(STAGE_DOCUMENT_WORKFLOW[3].stage).toBe("STAGE 4");
  });

  it("STAGE_DOCUMENT_WORKFLOW — defines exact required sub-stages with full terminology", () => {
    // Stage 1
    expect(STAGE_DOCUMENT_WORKFLOW[0].subStages).toEqual([
      "Filing",
      "Acknowledgment",
      "Examination",
    ]);

    // Stage 2
    expect(STAGE_DOCUMENT_WORKFLOW[1].subStages).toEqual([
      "Assigned",
      "Accepted",
      "Hearing",
    ]);

    // Stage 3 (Demand Note, Opposition, Published)
    expect(STAGE_DOCUMENT_WORKFLOW[2].subStages).toEqual([
      "Demand Note Submitted",
      "Demand Note Received",
      "Opposition: Filed",
      "Opposition: Received",
      "Opposition: Withdrawn",
      "Published",
    ]);

    // Stage 4 (CER Dispatch, CER Received, CER Acknowledge)
    expect(STAGE_DOCUMENT_WORKFLOW[3].subStages).toEqual([
      "CER Dispatch",
      "CER Received",
      "CER Acknowledge",
    ]);
  });

  it("STAGE_DOCUMENT_WORKFLOW — avoids short forms (no D-Note or OPPO) and keeps CER unchanged", () => {
    const allSubStages = STAGE_DOCUMENT_WORKFLOW.flatMap((s) => s.subStages);
    for (const sub of allSubStages) {
      expect(sub).not.toMatch(/\bD-Note\b/);
      expect(sub).not.toMatch(/\bOPPO\b/);
    }

    const stage4Subs = STAGE_DOCUMENT_WORKFLOW[3].subStages;
    expect(stage4Subs).toEqual([
      "CER Dispatch",
      "CER Received",
      "CER Acknowledge",
    ]);
  });

  it("uploadStageDocument — normalizes full subStage when inserting DB row", async () => {
    const uploadStorage = {
      upload: vi.fn().mockResolvedValue({ error: null }),
      createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed.example/doc.pdf" } }),
      remove: vi.fn().mockResolvedValue({ error: null }),
    };
    supabaseMock.storage.from.mockReturnValue(uploadStorage);

    const insertQuery = createQuery({
      data: {
        id: "doc-uuid-1",
        trademark_id: "BX-1",
        stage: "STAGE 3",
        sub_stage: "D-Note Submitted",
        title: "D-Note Receipt",
        storage_path: "BX-1/STAGE_3/doc-uuid-1.pdf",
        file_name: "demand_note.pdf",
        mime_type: "application/pdf",
        size_bytes: 1024,
        uploaded_by: "user-1",
        created_at: "2026-09-22T00:00:00Z",
      },
      error: null,
    });
    supabaseMock.from.mockReturnValue(insertQuery);
    vi.spyOn(crypto, "randomUUID").mockReturnValue("doc-uuid-1" as `${string}-${string}-${string}-${string}-${string}`);

    const file = new File(["dummy pdf content"], "demand_note.pdf", { type: "application/pdf" });
    await uploadStageDocument(file, {
      trademarkId: "BX-1",
      stage: "STAGE 3",
      subStage: "Demand Note Submitted",
      title: "  D-Note Receipt  ",
    });

    expect(insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: "STAGE 3",
        sub_stage: "D-Note Submitted",
        title: "D-Note Receipt",
      }),
    );
  });
});

describe("Batch 12: RecordView Workflow Consolidation", () => {
  it("updateTrademarkStatus — blocks transition to STAGE 2 when stage2_paid is false", async () => {
    const selectQuery = createQuery({
      data: { stage2_paid: false, status: "STAGE 1" },
      error: null,
    });
    supabaseMock.from.mockReturnValue(selectQuery);

    await expect(
      updateTrademarkStatus("BX-1", "STAGE 2", "Assigned"),
    ).rejects.toBeInstanceOf(StagePaymentRequiredError);
  });

  it("updateTrademarkStatus — allows transition to STAGE 2 when stage1_paid is true", async () => {
    const selectQuery = createQuery({
      data: { stage1_paid: true, status: "STAGE 1" },
      error: null,
    });
    const updateQuery = createQuery({ data: null, error: null });
    let callCount = 0;
    supabaseMock.from.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? selectQuery : updateQuery;
    });

    await updateTrademarkStatus("BX-1", "STAGE 2", "Assigned");
    expect(updateQuery.update).toHaveBeenCalledWith({
      status: "STAGE 2",
      sub_status: "Assigned",
    });
    expect(updateQuery.eq).toHaveBeenCalledWith("id", "BX-1");
  });

  it("updateTrademarkStatus — normalizes user-facing subStage when updating status", async () => {
    const selectQuery = createQuery({
      data: { status: "STAGE 1", stage1_paid: true, stage2_paid: true },
      error: null,
    });
    const updateQuery = createQuery({ data: null, error: null });
    let callCount = 0;
    supabaseMock.from.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? selectQuery : updateQuery;
    });

    await updateTrademarkStatus("BX-1", "STAGE 3", "Demand Note Submitted");
    expect(updateQuery.update).toHaveBeenCalledWith({
      status: "STAGE 3",
      sub_status: "D-Note Submitted",
    });
  });

  it("updateTrademarkAgent — allows assignment of agent and city", async () => {
    const updateQuery = createQuery({ data: null, error: null });
    supabaseMock.from.mockReturnValue(updateQuery);

    await updateTrademarkAgent("BX-1", "Counsel A", "Islamabad");
    // Agent name and city are uppercased at the API boundary (Batch 2 normalisation rule)
    expect(updateQuery.update).toHaveBeenCalledWith({
      agent: "COUNSEL A",
      city: "ISLAMABAD",
    });
    expect(updateQuery.eq).toHaveBeenCalledWith("id", "BX-1");
  });
});

describe("Batch 13: Publication Workflow Integration", () => {
  it("listPublicationPipeline — queries journal-matched records and maps clientCode, type, journalNumber, and formats subStage", async () => {
    const publicationRows = [
      {
        id: "BX-100",
        case_number: "CASE-100",
        client_code: "CC-99",
        type: "X",
        client_name: "Apex Corp",
        application_name: "APEX FLOW",
        tm_cpr_number: "554433",
        nice_class: "09",
        journal_number: "J-890",
        status: "STAGE 3",
        sub_status: "D-Note Submitted",
        agent: "Lead Counsel",
        publication_date: "2026-08-01",
        opposition_deadline: "2026-10-01",
        demand_note_received: false,
        demand_note_date: null,
      },
      {
        id: "BX-101",
        case_number: "CASE-101",
        client_code: "CC-101",
        type: "Y",
        client_name: "Beacon Ltd",
        application_name: "BEACON PRO",
        tm_cpr_number: "998877",
        nice_class: "42",
        journal_number: "J-891",
        status: "STAGE 3",
        sub_status: "OPPO: Filed",
        agent: "Senior Partner",
        publication_date: "2026-08-05",
        opposition_deadline: "2026-08-20",
        demand_note_received: true,
        demand_note_date: "2026-08-25",
      },
    ];

    const selectQuery = createQuery({
      data: publicationRows,
      error: null,
    });
    supabaseMock.from.mockReturnValue(selectQuery);

    const records = await listPublicationPipeline();

    expect(selectQuery.not).toHaveBeenCalledWith("publication_date", "is", null);
    expect(records).toHaveLength(2);

    // Record 1: D-Note Submitted -> Demand Note Submitted
    expect(records[0]).toMatchObject({
      id: "BX-100",
      caseNumber: "CASE-100",
      clientCode: "CC-99",
      type: "X",
      journalNumber: "J-890",
      stage: "STAGE 3",
      subStage: "Demand Note Submitted",
      status: expect.stringMatching(/pending|overdue/),
    });

    // Record 2: OPPO: Filed -> Opposition: Filed, demandNoteReceived true -> status: done
    expect(records[1]).toMatchObject({
      id: "BX-101",
      caseNumber: "CASE-101",
      clientCode: "CC-101",
      type: "Y",
      journalNumber: "J-891",
      stage: "STAGE 3",
      subStage: "Opposition: Filed",
      demandNoteReceived: true,
      status: "done",
    });
  });

  describe("getWorkflowReminders", () => {
    it("returns exactly 4 reminders (numbers 1 to 4)", () => {
      const reminders = getWorkflowReminders("STAGE 1");
      expect(reminders).toHaveLength(4);
      expect(reminders.map((r) => r.number)).toEqual([1, 2, 3, 4]);
      // Verify no reminder 5+ ever exists
      expect(reminders.some((r) => r.number > 4)).toBe(false);
    });

    it("activates reminder 1 for STAGE 1", () => {
      const reminders = getWorkflowReminders("STAGE 1", "Filing");
      expect(reminders[0].active).toBe(true);
      expect(reminders[1].active).toBe(false);
      expect(reminders[2].active).toBe(false);
      expect(reminders[3].active).toBe(false);
      expect(reminders[0].description).toContain("Application has been filed");
    });

    it("activates reminder 2 for STAGE 2", () => {
      const reminders = getWorkflowReminders("STAGE 2", "Assigned");
      expect(reminders[0].active).toBe(false);
      expect(reminders[1].active).toBe(true);
      expect(reminders[2].active).toBe(false);
      expect(reminders[3].active).toBe(false);
      expect(reminders[1].description).toContain("assigned to agent");
    });

    it("activates reminder 3 for STAGE 3", () => {
      const reminders = getWorkflowReminders("STAGE 3", "Published");
      expect(reminders[0].active).toBe(false);
      expect(reminders[1].active).toBe(false);
      expect(reminders[2].active).toBe(true);
      expect(reminders[3].active).toBe(false);
      expect(reminders[2].description).toContain("Published in Trade Marks Journal");
    });

    it("activates reminder 4 for STAGE 4", () => {
      const reminders = getWorkflowReminders("STAGE 4", "CER Dispatch");
      expect(reminders[0].active).toBe(false);
      expect(reminders[1].active).toBe(false);
      expect(reminders[2].active).toBe(false);
      expect(reminders[3].active).toBe(true);
      expect(reminders[3].description).toContain("Certificate dispatched");
    });

    it("handles empty or unknown stage safely", () => {
      const reminders = getWorkflowReminders(undefined, undefined);
      expect(reminders).toHaveLength(4);
      expect(reminders[0].active).toBe(true);
    });
  });

  describe("listAuditLogs", () => {
    it("extracts applicationNumber, applicationName, clientCode, caseType from JSON records", async () => {
      const rawAuditRows = [
        {
          id: "log-1",
          changed_at: "2026-09-22T08:00:00Z",
          changed_by: "user-uuid-1",
          action: "UPDATE",
          trademark_id: "tm-uuid-123",
          old_record: {
            case_number: "CASE-10",
            application_name: "Old Brand",
            tm_cpr_number: "600100",
            client_code: "CC-01",
            type: "TM",
          },
          new_record: {
            case_number: "CASE-10",
            application_name: "New Brand",
            tm_cpr_number: "600100",
            client_code: "CC-01",
            type: "TM",
          },
        },
      ];

      const selectQuery = createQuery({
        data: rawAuditRows,
        error: null,
      });
      supabaseMock.from.mockReturnValue(selectQuery);

      const logs = await listAuditLogs(10, 0);

      expect(supabaseMock.from).toHaveBeenCalledWith("audit_logs");
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        id: "log-1",
        recordId: "tm-uuid-123",
        caseNo: "CASE-10",
        record: "CASE-10",
        applicationNumber: "600100",
        applicationName: "New Brand",
        clientCode: "CC-01",
        caseType: "TM",
      });
    });
  });

  describe("Batch 15: Security, Workflow Validation & Reliability", () => {
    it("validates stage and sub-stage values on updateTrademark", async () => {
      await expect(
        updateTrademark("BX-1", { stage: "INVALID_STAGE" as any })
      ).rejects.toThrow('Invalid stage "INVALID_STAGE"');

      await expect(
        updateTrademark("BX-1", { stage: "STAGE 1", subStage: "NonExistentSubStage" })
      ).rejects.toThrow('Invalid sub-stage "NonExistentSubStage" for STAGE 1');
    });

    it("requires non-empty agent name on assignStage2Agent", async () => {
      await expect(assignStage2Agent("BX-1", "   ")).rejects.toThrow("Agent name is required.");
    });

    it("trims agent and city whitespace on assignStage2Agent", async () => {
      const selectQuery = createQuery({ data: { stage1_paid: true, status: "STAGE 2", sub_status: "Assigned" }, error: null });
      const updateQuery = createQuery({ data: null, error: null });
      supabaseMock.from
        .mockReturnValueOnce(selectQuery)
        .mockReturnValueOnce(updateQuery);

      await assignStage2Agent("BX-1", "  Agent Smith  ", "  Karachi  ");
      // Whitespace is trimmed AND value is uppercased at the API boundary (Batch 2 normalisation rule)
      expect(updateQuery.update).toHaveBeenCalledWith({
        agent: "AGENT SMITH",
        city: "KARACHI",
      });
    });
  });

  describe("Batch 1 (v2.0.1): Core Workflow + New Record Creation Corrections", () => {
    it("A. New record defaults (STAGE 1, Filing, stage1_paid = true, filing_date)", async () => {
      supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
      const insertQuery = createQuery({ data: { id: "new-tm-1", case_number: "TM-001" }, error: null });
      supabaseMock.from.mockReturnValue(insertQuery);

      const result = await createTrademark({
        date: "2026-09-22",
        type: "X",
        clientCode: "C-01",
        caseNumber: "TM-001",
        appName: "Test Brand",
        city: "Islamabad",
      });

      expect(result).toEqual({ id: "new-tm-1", caseNumber: "TM-001" });
      expect(insertQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "STAGE 1",
          sub_status: "Filing",
          stage1_paid: true,
          stage1_paid_date: "2026-09-22",
        })
      );
    });

    it("B. Forward workflow progression rules", () => {
      // Valid forward transitions
      expect(isValidStageTransition("STAGE 1", "STAGE 2")).toBe(true);
      expect(isValidStageTransition("STAGE 2", "STAGE 3")).toBe(true);
      expect(isValidStageTransition("STAGE 3", "STAGE 4")).toBe(true);
      expect(isValidStageTransition("STAGE 1", "STAGE 4")).toBe(true);
      expect(isValidStageTransition("STAGE 1", "STAGE 1")).toBe(true);
      expect(isValidStageTransition("STAGE 2", "STOPPED")).toBe(true);

      // Backward transitions (must fail)
      expect(isValidStageTransition("STAGE 2", "STAGE 1")).toBe(false);
      expect(isValidStageTransition("STAGE 3", "STAGE 2")).toBe(false);
      expect(isValidStageTransition("STAGE 3", "STAGE 1")).toBe(false);
      expect(isValidStageTransition("STAGE 4", "STAGE 3")).toBe(false);
      expect(isValidStageTransition("STAGE 4", "STAGE 2")).toBe(false);
      expect(isValidStageTransition("STAGE 4", "STAGE 1")).toBe(false);

      // Cannot exit STOPPED
      expect(isValidStageTransition("STOPPED", "STAGE 1")).toBe(false);
      expect(isValidStageTransition("STOPPED", "STAGE 2")).toBe(false);
    });

    it("C. Payment gate validation logic", () => {
      // Stage 2 requires stage1_paid
      expect(() => validatePaymentGate("STAGE 2", { stage1_paid: false })).toThrow(StagePaymentRequiredError);
      expect(() => validatePaymentGate("STAGE 2", { stage1_paid: true })).not.toThrow();

      // Stage 3 requires stage1_paid AND stage2_paid
      expect(() => validatePaymentGate("STAGE 3", { stage1_paid: true, stage2_paid: false })).toThrow(StagePaymentRequiredError);
      expect(() => validatePaymentGate("STAGE 3", { stage1_paid: true, stage2_paid: true })).not.toThrow();

      // Stage 4 requires stage1_paid AND stage2_paid AND stage3_paid
      expect(() => validatePaymentGate("STAGE 4", { stage1_paid: true, stage2_paid: true, stage3_paid: false })).toThrow(StagePaymentRequiredError);
      expect(() => validatePaymentGate("STAGE 4", { stage1_paid: true, stage2_paid: true, stage3_paid: true })).not.toThrow();
    });

    it("D. Backward status update rejection at API level", async () => {
      const selectQuery = createQuery({
        data: { status: "STAGE 3", stage1_paid: true, stage2_paid: true, stage3_paid: true },
        error: null,
      });
      supabaseMock.from.mockReturnValue(selectQuery);

      await expect(updateTrademarkStatus("BX-1", "STAGE 2", "Assigned")).rejects.toThrow(
        "Backward workflow transitions are not allowed (cannot move from STAGE 3 to STAGE 2)."
      );
    });
  });

  describe("Dashboard getStats() API", () => {
    it("A. Executes exact count queries for total, recent, stages, cities, and TM forms", async () => {
      const mockQuery = createQuery({ count: 42, data: null, error: null });
      supabaseMock.from.mockReturnValue(mockQuery);

      const stats = await getStats();

      expect(supabaseMock.from).toHaveBeenCalledWith("trademarks");
      expect(mockQuery.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
      expect(stats.total).toBe(42);
      expect(stats.recentlyModified).toBe(42);
      expect(Array.isArray(stats.byStage)).toBe(true);
      expect(Array.isArray(stats.byCity)).toBe(true);
      expect(Array.isArray(stats.byNumericStage)).toBe(true);
      expect(Array.isArray(stats.byTmForm)).toBe(true);
      expect(stats.byTmForm).toHaveLength(5);
    });

    it("B. Applies agent filter when provided in DashboardStatsFilters", async () => {
      const mockQuery = createQuery({ count: 15, data: null, error: null });
      supabaseMock.from.mockReturnValue(mockQuery);

      const stats = await getStats({ agent: "Legal Associates" });

      expect(mockQuery.eq).toHaveBeenCalledWith("agent", "Legal Associates");
      expect(stats.total).toBe(15);
    });

    it("C. Applies nice_class filter when appClass is provided in DashboardStatsFilters", async () => {
      const mockQuery = createQuery({ count: 8, data: null, error: null });
      supabaseMock.from.mockReturnValue(mockQuery);

      const stats = await getStats({ appClass: "35" });

      expect(mockQuery.eq).toHaveBeenCalledWith("nice_class", "35");
      expect(stats.total).toBe(8);
    });
  });
});



