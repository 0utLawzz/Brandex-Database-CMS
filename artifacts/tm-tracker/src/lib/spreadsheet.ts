/** Quoting a CSV cell alone does not stop spreadsheet formula evaluation. */
export function spreadsheetLiteral(value: string): string {
  return /^[\s\u0000-\u001f]*[=+\-@]/.test(value) || /^[\t\r\n]/.test(value)
    ? `'${value}`
    : value;
}

export function csvCell(value: string): string {
  return `"${spreadsheetLiteral(String(value ?? "")).replace(/"/g, '""')}"`;
}
