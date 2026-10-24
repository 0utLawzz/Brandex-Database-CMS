import { beforeEach, describe, expect, it, vi } from "vitest";

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {
    from: vi.fn(),
    rpc: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}));

vi.mock("./supabase", () => ({ supabase: supabaseMock }));

import { getLedgerStagePayments, normalizeTmDigits, recordClientReceipt } from "./ledgerPayments";

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
});
