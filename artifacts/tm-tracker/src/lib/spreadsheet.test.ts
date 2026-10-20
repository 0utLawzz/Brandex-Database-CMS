import { expect, it } from "vitest";
import { csvCell } from "./spreadsheet";

it("keeps externally supplied spreadsheet formulas inert in CSV", () => {
  for (const value of ["=1+1", "+HYPERLINK(\"https://example.invalid\")", "-1+2", "@SUM(1)", "  =1+1", "\t=1+1"]) {
    expect(csvCell(value)).toBe(`"'${value.replace(/"/g, '""')}"`);
  }
  expect(csvCell('Normal "brand"')).toBe('"Normal ""brand"""');
});
