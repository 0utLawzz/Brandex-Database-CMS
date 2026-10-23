import { describe, expect, it } from "vitest";
import { parseFormCsv } from "./registryImport";

describe("form registry CSV import", () => {
  it("accepts the descriptive type header used by the office sheet", () => {
    const result = parseFormCsv(
      [
        "serial,office,TM number,class,type (tm5/tm6/tm11/tm16/tm56),status,date (col G)",
        "1,Karachi,222222,2,tm5,Submitted,11/09/2026",
        "2,Karachi,222224,13,tm16,Submitted,13/09/2026",
      ].join("\n"),
    );

    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((row) => row.formType)).toEqual(["tm5", "tm16"]);
    expect(result.rows[0].formDate).toBe("2026-09-11");
  });

  it("reports a blank form type without rejecting the other valid rows", () => {
    const result = parseFormCsv(
      [
        "serial,office,TM number,class,type (tm5/tm6/tm11/tm16/tm56),status,date (col G)",
        "1,Karachi,222222,2,tm5,Submitted,11/09/2026",
        "2,Karachi,222223,2,,Submitted,12/09/2026",
      ].join("\n"),
    );

    expect(result.rows).toHaveLength(1);
    expect(result.errors).toEqual([
      "Row 3: type is blank (use tm5, tm6, tm11, tm16, or tm56)",
    ]);
  });
});
