import { describe, it, expect } from "vitest";
import { caseFlag, calendarMonth, journalDue } from "./case-timing";
describe("confirmed operational timing", () => {
  it("flags filing at day 15, counting holidays", () => {
    const c = {
      stage: "STAGE 1",
      subStage: "Filing",
      filingDate: "2026-10-01",
    };
    expect(caseFlag(c, "2026-10-15")).toBeNull();
    expect(caseFlag(c, "2026-10-16")?.tone).toBe("red");
  });
  it("flags examination reply after 7 days", () =>
    expect(
      caseFlag(
        { stage: "STAGE 1", subStage: "Examination", eventDate: "2026-10-01" },
        "2026-10-08",
      )?.tone,
    ).toBe("red"));
  it.each([
    [7, "green"],
    [8, "yellow"],
    [9, "yellow"],
    [10, "red"],
  ])("assignment day %s", (d, t) =>
    expect(
      caseFlag(
        { stage: "STAGE 2", subStage: "Assigned", eventDate: "2026-10-01" },
        `2026-10-${String(Number(d) + 1).padStart(2, "0")}`,
      )?.tone,
    ).toBe(t),
  );
  it("uses Accepted cutoff including year rollover", () => {
    expect(journalDue("2026-12-20")).toBe("2026-12-29");
    expect(journalDue("2026-12-21")).toBe("2027-01-29");
  });
  it("uses calendar months with end-of-month clamping", () => {
    expect(calendarMonth("2026-01-31", 1)).toBe("2026-02-28");
    expect(calendarMonth("2028-01-31", 1)).toBe("2028-02-29");
  });
  it("stops flags while stopped and restarts on restoration", () => {
    expect(
      caseFlag(
        { stage: "STOPPED", subStage: "", filingDate: "2020-01-01" },
        "2026-10-16",
      ),
    ).toBeNull();
    expect(
      caseFlag(
        {
          stage: "STAGE 1",
          subStage: "Filing",
          filingDate: "2020-01-01",
          reactivatedDate: "2026-10-15",
        },
        "2026-10-16",
      ),
    ).toBeNull();
  });
  it("suppresses Demand Note flags for objections", () =>
    expect(
      caseFlag(
        {
          stage: "STAGE 3",
          subStage: "Published",
          publicationDate: "2026-01-01",
          hasObjection: true,
        },
        "2026-10-16",
      ),
    ).toBeNull());
  it("does not flag hearings or held certificates", () => {
    expect(
      caseFlag(
        { stage: "STAGE 2", subStage: "Hearing", eventDate: "2020-01-01" },
        "2026-10-16",
      ),
    ).toBeNull();
    expect(
      caseFlag(
        {
          stage: "STAGE 4",
          subStage: "CER Received",
          feeSubmittedDate: "2026-01-01",
          certificateReceivedDate: "2026-02-01",
        },
        "2026-10-16",
      ),
    ).toBeNull();
  });
  it("flags certificate at one calendar month", () =>
    expect(
      caseFlag(
        {
          stage: "STAGE 3",
          subStage: "D-Note Submitted",
          feeSubmittedDate: "2026-09-16",
        },
        "2026-10-16",
      )?.tone,
    ).toBe("red"));
});
