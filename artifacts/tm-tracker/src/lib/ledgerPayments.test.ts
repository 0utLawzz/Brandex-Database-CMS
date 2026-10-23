import { beforeEach, describe, expect, it, vi } from "vitest";

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: { functions: { invoke: vi.fn() } },
}));

vi.mock("./supabase", () => ({ supabase: supabaseMock }));

import { getLedgerStagePayments, normalizeTmDigits } from "./ledgerPayments";

describe("Brandex Client Ledger payment bridge", () => {
  beforeEach(() => vi.resetAllMocks());

  it("normalizes formatted six-digit TM numbers and preserves leading zeroes", () => {
    expect(normalizeTmDigits("TM 012-345")).toBe("012345");
    expect(normalizeTmDigits("12345")).toBeNull();
    expect(normalizeTmDigits("1234567")).toBeNull();
  });

  it("requests a deduplicated batch and returns the Ledger stage summaries", async () => {
    const payments = { "012345": { S1: { paid: true, amount_due: 5000, amount_received: 5000, outstanding: 0, paid_date: "2026-10-23", entry_id: "receipt-1" } } };
    supabaseMock.functions.invoke.mockResolvedValue({ data: { payments }, error: null });

    await expect(getLedgerStagePayments(["TM 012-345", "012345", "12345"])).resolves.toEqual(payments);
    expect(supabaseMock.functions.invoke).toHaveBeenCalledWith("ledger-payment-status", {
      body: { tm_digits: ["012345"] },
    });
  });

  it("fails closed when the Ledger bridge is unavailable", async () => {
    supabaseMock.functions.invoke.mockResolvedValue({ data: null, error: { message: "function unavailable" } });

    await expect(getLedgerStagePayments(["123456"])).rejects.toThrow("Could not verify payment with Brandex Client Ledger");
  });
});
