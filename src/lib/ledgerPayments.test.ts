import { beforeEach, describe, expect, it, vi } from "vitest";

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {
    from: vi.fn(),
    rpc: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}));

vi.mock("@/lib/supabase", () => ({ supabase: supabaseMock }));

import { getLedgerStagePayments, isStageFullyPaid, normalizeTmDigits, recordClientReceipt } from "./ledgerPayments";

describe("Unified Brandex Client Ledger", () => {
  beforeEach(() => vi.resetAllMocks());

  it("does not mark an uncharged or partially paid stage as paid", () => {
    expect(isStageFullyPaid(0, 500)).toBe(false);
    expect(isStageFullyPaid(10000, 5000)).toBe(false);
    expect(isStageFullyPaid(10000, 10000)).toBe(true);
  });

  it("normalizes formatted six-digit TM numbers and preserves leading zeroes", () => {
    expect(normalizeTmDigits("TM 012-345")).toBe("012345");
    expect(normalizeTmDigits("12345")).toBeNull();
    expect(normalizeTmDigits("1234567")).toBeNull();
  });

  it("reads payment status only from the authoritative external Ledger bridge", async () => {
    supabaseMock.functions.invoke.mockResolvedValue({
      data: { payments: {
        "123456": {
          S1: { amount_due: 10000, amount_received: 5000, paid: true, paid_date: "2026-10-01" },
          S2: { amount_due: 0, amount_received: 500, paid: true, paid_date: "2026-10-02" },
          S3: { amount_due: 2500, amount_received: 2500, paid: true, paid_date: "2026-10-03" },
          S4: { amount_due: 0, amount_received: 0, paid: false, paid_date: null },
        },
      } },
      error: null,
    });

    const result = await getLedgerStagePayments(["TM 123-456"]);

    expect(supabaseMock.functions.invoke).toHaveBeenCalledWith("ledger-payment-status", { body: { tm_digits: ["123456"] } });
    expect(result["123456"].S1?.paid).toBe(false);
    expect(result["123456"].S2?.paid).toBe(false);
    expect(result["123456"].S3?.paid).toBe(true);
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it("fails closed when the external Ledger bridge is unavailable", async () => {
    supabaseMock.functions.invoke.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    await expect(getLedgerStagePayments(["123456"])).rejects.toThrow("Unable to verify payments with Brandex Client Ledger");
  });

  it("does not write client receipts into the CMS database", async () => {
    await expect(recordClientReceipt({ trademarkId: "tm-1", stage: "S1", amount: 15000, paymentMethod: "bank_transfer" }))
      .rejects.toThrow("must be recorded in the authoritative Brandex Client Ledger");
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });
});
