import { beforeEach, describe, expect, it, vi } from "vitest";

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {
    from: vi.fn(),
    rpc: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}));

vi.mock("./supabase", () => ({ supabase: supabaseMock }));

import {
  getLedgerStagePayments,
  normalizeTmDigits,
  recordClientReceipt,
  createLedgerClient,
  recordLedgerCharge,
  refreshLedgerPaymentsForCase,
} from "./ledgerPayments";

describe("Unified Brandex Client Ledger", () => {
  beforeEach(() => vi.resetAllMocks());

  it("normalizes formatted six-digit TM numbers and preserves leading zeroes", () => {
    expect(normalizeTmDigits("TM 012-345")).toBe("012345");
    expect(normalizeTmDigits("12345")).toBeNull();
    expect(normalizeTmDigits("1234567")).toBeNull();
  });

  it("records a client receipt via database RPC", async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: { id: "rec-1", receipt_no: "BX-REC-2026-1001", amount: 15000 },
      error: null,
    });

    const result = await recordClientReceipt({
      trademarkId: "tm-1",
      stage: "S1",
      amount: 15000,
      paymentMethod: "bank_transfer",
      bankName: "United Bank Limited (UBL)",
    });

    expect(result).toEqual({ id: "rec-1", receipt_no: "BX-REC-2026-1001", amount: 15000 });
    expect(supabaseMock.rpc).toHaveBeenCalledWith("record_client_receipt", expect.objectContaining({
      p_trademark_id: "tm-1",
      p_stage: "S1",
      p_amount: 15000,
    }));
  });

  it("creates a client and agreed stage rates", async () => {
    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: "client-1" }, error: null }),
      }),
    });
    const ratesInsertMock = vi.fn().mockResolvedValue({ error: null });

    supabaseMock.from.mockImplementation((table: string) => {
      if (table === "ledger_clients") return { insert: insertMock };
      if (table === "ledger_client_stage_rates") return { insert: ratesInsertMock };
      throw new Error(`Unexpected table: ${table}`);
    });

    const res = await createLedgerClient({
      clientCode: "NXA-001",
      clientName: "Nexus Corp",
      city: "Karachi",
      rates: { S1: 10000, S2: 15000, S3: 20000, S4: 25000 },
    });

    expect(res).toEqual({ id: "client-1" });
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      client_code: "NXA-001",
      client_name: "Nexus Corp",
      city: "Karachi",
    }));
    expect(ratesInsertMock).toHaveBeenCalledWith(expect.arrayContaining([
      { client_id: "client-1", stage: "S1", amount: 10000 },
      { client_id: "client-1", stage: "S2", amount: 15000 },
      { client_id: "client-1", stage: "S3", amount: 20000 },
      { client_id: "client-1", stage: "S4", amount: 25000 },
    ]));
  });

  it("records a client stage charge", async () => {
    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: "entry-1" }, error: null }),
      }),
    });
    supabaseMock.from.mockReturnValue({ insert: insertMock });

    const res = await recordLedgerCharge({
      clientId: "client-1",
      caseId: "case-1",
      stage: "S1",
      amount: 10000,
      details: "Stage 1 agreed filing fee",
    });

    expect(res).toEqual({ id: "entry-1" });
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      client_id: "client-1",
      case_id: "case-1",
      entry_type: "charge",
      stage: "S1",
      amount_due: 10000,
    }));
  });

  it("creates a new ledger series", async () => {
    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: "series-b" }, error: null }),
      }),
    });
    supabaseMock.from.mockReturnValue({ insert: insertMock });

    const { createLedgerSeries } = await import("./ledgerPayments");
    const res = await createLedgerSeries({
      code: "B",
      name: "B-Series",
      prefix: "B-",
    });

    expect(res).toEqual({ id: "series-b" });
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      code: "B",
      name: "B-Series",
      prefix: "B-",
    }));
  });

  it("records a receiving via record_ledger_receiving RPC", async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: {
        id: "rec-1",
        receipt_no: "REC-2026-1002",
        amount: 25000,
        stage: "S1",
        entry_date: "2026-10-28",
      },
      error: null,
    });

    const { recordLedgerReceiving } = await import("./ledgerPayments");
    const res = await recordLedgerReceiving({
      clientId: "client-1",
      amount: 25000,
      stage: "S1",
      paymentMethod: "UBL - Brandex Pk",
      details: "Stage 1 payment via UBL",
    });

    expect(res.receipt_no).toBe("REC-2026-1002");
    expect(supabaseMock.rpc).toHaveBeenCalledWith("record_ledger_receiving", expect.objectContaining({
      p_client_id: "client-1",
      p_amount: 25000,
      p_stage: "S1",
      p_payment_method: "UBL - Brandex Pk",
    }));
  });

  it("links a ledger case to a CMS trademark via link_ledger_case_to_trademark RPC", async () => {
    supabaseMock.rpc.mockResolvedValue({ data: null, error: null });

    const { linkCaseToCmsTrademark } = await import("./ledgerPayments");
    await linkCaseToCmsTrademark("case-uuid-1", "cms-tm-id-1", "Admin verified against physical file");

    expect(supabaseMock.rpc).toHaveBeenCalledWith("link_ledger_case_to_trademark", {
      p_ledger_case_id: "case-uuid-1",
      p_trademark_id: "cms-tm-id-1",
      p_reason: "Admin verified against physical file",
    });
  });

  it("refreshLedgerPaymentsForCase returns a defined empty object when unlinked (never undefined)", async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === "trademarks") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      };
    });

    const resWithTm = await refreshLedgerPaymentsForCase("case-1", "963963");
    expect(resWithTm).toBeDefined();
    expect(resWithTm).toEqual({});

    const resWithoutTm = await refreshLedgerPaymentsForCase("case-1", null);
    expect(resWithoutTm).toBeDefined();
    expect(resWithoutTm).toEqual({});
  });
});

