export function isStageFullyPaid(amountDue, amountReceived) {
  return Number.isFinite(amountDue) && Number.isFinite(amountReceived) && amountDue > 0 && amountReceived >= amountDue;
}

export function normalizeTmDigits(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length === 6 ? digits : null;
}
