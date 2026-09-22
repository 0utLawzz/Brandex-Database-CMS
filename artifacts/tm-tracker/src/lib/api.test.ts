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
    const updateQueryMock = createQuery({ data: { id: "BX-2", version: 4 }, error: null });
    const deleteQueryMock = createQuery({ error: null });
    supabaseMock.from
      .mockReturnValueOnce(createQueryMock)
      .mockReturnValueOnce(updateQueryMock)
      .mockReturnValueOnce(deleteQueryMock);

    await createTrademark({ type: "X", clientCode: "C-7", caseNumber: "CASE-10", appName: "NEW", city: "Lahore", stage: "STAGE 1" });
    await updateTrademark("BX-2", { type: "X", clientCode: "C-7", caseNumber: "CASE-10", appName: "UPDATED", city: "Lahore", stage: "STAGE 2" }, 3);
    await deleteTrademark("BX-2");

    expect(createQueryMock.insert).toHaveBeenCalledWith(expect.objectContaining({ created_by: "user-1", updated_by: "user-1" }));
    expect(updateQueryMock.update).toHaveBeenCalledWith(expect.objectContaining({ application_name: "UPDATED" }));
    expect(updateQueryMock.eq).toHaveBeenCalledWith("version", 3);
    expect(deleteQueryMock.delete).toHaveBeenCalled();
    expect(deleteQueryMock.eq).toHaveBeenCalledWith("id", "BX-2");
  });

  it("raises a conflict when optimistic locking updates no row", async () => {
    const query = createQuery({ data: null, error: null });
    supabaseMock.from.mockReturnValue(query);

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

  it("enforces Stage 2 payment gate (stage2_paid = true required)", () => {
    // Stage 2 with unpaid status must be blocked
    expect(isStage2PaymentRequired("STAGE 2", false)).toBe(true);
    expect(isStage2PaymentRequired("STAGE 2", undefined)).toBe(true);
    expect(() => validateStage2PaymentGate("STAGE 2", false)).toThrow(StagePaymentRequiredError);
    expect(() => validateStage2PaymentGate("STAGE 2", false)).toThrow(
      "Stage 2 payment is required before proceeding.",
    );

    // Stage 2 with paid status must pass
    expect(isStage2PaymentRequired("STAGE 2", true)).toBe(false);
    expect(() => validateStage2PaymentGate("STAGE 2", true)).not.toThrow();

    // Non-Stage 2 (e.g. STAGE 1, STAGE 3) must pass without requiring stage2_paid
    expect(isStage2PaymentRequired("STAGE 1", false)).toBe(false);
    expect(() => validateStage2PaymentGate("STAGE 1", false)).not.toThrow();
  });

  it("enforces Stage 2 agent assignment: blocked when unpaid, allowed when paid", async () => {
    // Unpaid case: must throw StagePaymentRequiredError
    const unpaidQuery = createQuery({ data: { stage2_paid: false, status: "STAGE 2", sub_status: "Assigned" }, error: null });
    supabaseMock.from.mockReturnValue(unpaidQuery);
    await expect(assignStage2Agent("BX-1", "Counsel A", "Islamabad")).rejects.toBeInstanceOf(StagePaymentRequiredError);

    // Paid case: updates agent and city
    const paidSelectQuery = createQuery({ data: { stage2_paid: true, status: "STAGE 2", sub_status: "Assigned" }, error: null });
    const updateQuery = createQuery({ data: null, error: null });
    let callCount = 0;
    supabaseMock.from.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? paidSelectQuery : updateQuery;
    });

    await assignStage2Agent("BX-1", "Counsel B", "Karachi");
    expect(updateQuery.update).toHaveBeenCalledWith({ agent: "Counsel B", city: "Karachi" });
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
