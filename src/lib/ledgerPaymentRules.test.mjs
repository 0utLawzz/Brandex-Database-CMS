import assert from "node:assert/strict";
import test from "node:test";
import { isStageFullyPaid, normalizeTmDigits } from "./ledgerPaymentRules.mjs";

test("a stage is paid only when a positive due charge is fully covered", () => {
  assert.equal(isStageFullyPaid(0, 500), false);
  assert.equal(isStageFullyPaid(10000, 5000), false);
  assert.equal(isStageFullyPaid(10000, 10000), true);
  assert.equal(isStageFullyPaid(10000, 15000), true);
  assert.equal(isStageFullyPaid(Number.NaN, 10000), false);
});

test("TM normalization preserves leading zeroes and requires exactly six digits", () => {
  assert.equal(normalizeTmDigits("TM 012-345"), "012345");
  assert.equal(normalizeTmDigits("12345"), null);
  assert.equal(normalizeTmDigits("1234567"), null);
  assert.equal(normalizeTmDigits(null), null);
});
