import { formatTmNumber } from "./utils";
import { describe, expect, it } from "vitest";
import { formatDateLong, getRelativeAge, getFormDate } from "./utils";

describe("formatDateLong", () => {
  it("formats valid date strings to DD-MMM-YYYY", () => {
    expect(formatDateLong("2026-01-03")).toBe("03-Jan-2026");
    expect(formatDateLong("2026-08-19")).toBe("19-Aug-2026");
    expect(formatDateLong("2026-09-24")).toBe("24-Sep-2026");
  });

  it("handles ISO date strings", () => {
    expect(formatDateLong("2026-01-03T00:00:00Z")).toBe("03-Jan-2026");
  });

  it("handles Date objects", () => {
    const date = new Date("2026-01-03");
    expect(formatDateLong(date)).toBe("03-Jan-2026");
  });

  it("returns '—' for null/undefined", () => {
    expect(formatDateLong(null)).toBe("—");
    expect(formatDateLong(undefined)).toBe("—");
  });

  it("returns '—' for empty/invalid strings", () => {
    expect(formatDateLong("")).toBe("—");
    expect(formatDateLong("—")).toBe("—");
    expect(formatDateLong("null")).toBe("—");
    expect(formatDateLong("undefined")).toBe("—");
    expect(formatDateLong("invalid")).toBe("—");
  });
});

describe("getRelativeAge", () => {
  it("returns 'Today' for today's date", () => {
    const today = new Date();
    expect(getRelativeAge(today)).toBe("Today");
    expect(getRelativeAge(today.toISOString())).toBe("Today");
  });

  it("returns 'Date not available' for null/undefined", () => {
    expect(getRelativeAge(null)).toBe("Date not available");
    expect(getRelativeAge(undefined)).toBe("Date not available");
  });

  it("returns 'Date not available' for empty/invalid strings", () => {
    expect(getRelativeAge("")).toBe("Date not available");
    expect(getRelativeAge("—")).toBe("Date not available");
    expect(getRelativeAge("null")).toBe("Date not available");
    expect(getRelativeAge("undefined")).toBe("Date not available");
    expect(getRelativeAge("invalid")).toBe("Date not available");
  });

  it("returns 'Future date' for future dates", () => {
    const future = new Date();
    future.setDate(future.getDate() + 10);
    expect(getRelativeAge(future)).toBe("Future date");
  });

  it("calculates relative age for 3 days ago", () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const result = getRelativeAge(threeDaysAgo);
    expect(result).toBe("3 days ago");
  });

  it("calculates relative age for 1 day ago", () => {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const result = getRelativeAge(oneDayAgo);
    expect(result).toBe("1 day ago");
  });

  it("calculates relative age for 1 month ago", () => {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const result = getRelativeAge(oneMonthAgo);
    expect(result).toBe("1 month ago");
  });

  it("calculates relative age for 2 months ago", () => {
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const result = getRelativeAge(twoMonthsAgo);
    expect(result).toBe("2 months ago");
  });

  it("calculates relative age for 1 month and 20 days ago", () => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    date.setDate(date.getDate() - 20);
    const result = getRelativeAge(date);
    expect(result).toBe("1 month 20 days ago");
  });

  it("calculates relative age for 1 year ago", () => {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const result = getRelativeAge(oneYearAgo);
    expect(result).toBe("1 year ago");
  });

  it("calculates relative age for 2 years ago", () => {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const result = getRelativeAge(twoYearsAgo);
    expect(result).toBe("2 years ago");
  });

  it("calculates relative age for 1 year 2 months ago", () => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 1);
    date.setMonth(date.getMonth() - 2);
    const result = getRelativeAge(date);
    expect(result).toBe("1 year 2 months ago");
  });

  it("avoids awkward '0 months X days ago' format", () => {
    const date = new Date();
    date.setDate(date.getDate() - 15);
    const result = getRelativeAge(date);
    expect(result).toBe("15 days ago");
    expect(result).not.toContain("0 months");
  });

  it("avoids awkward 'X months 0 days ago' format", () => {
    const date = new Date();
    date.setMonth(date.getMonth() - 2);
    date.setDate(date.getDate()); // Keep same day for exact months
    const result = getRelativeAge(date);
    expect(result).toBe("2 months ago");
    expect(result).not.toContain("0 days");
  });
});

describe("getFormDate", () => {
  it("extracts form date from TmMatches object", () => {
    const tmMatches = {
      TM5: true,
      TM5_date: "2026-01-03",
      TM6: false,
      TM6_date: undefined,
    };
    expect(getFormDate(tmMatches, "TM5")).toBe("2026-01-03");
    expect(getFormDate(tmMatches, "TM6")).toBeUndefined();
  });

  it("returns undefined for undefined tmMatches", () => {
    expect(getFormDate(undefined, "TM5")).toBeUndefined();
  });

  it("returns undefined for missing form type", () => {
    const tmMatches = {
      TM5: true,
      TM5_date: "2026-01-03",
    };
    expect(getFormDate(tmMatches, "TM11")).toBeUndefined();
  });

  it("returns undefined for null form date", () => {
    const tmMatches = {
      TM5: true,
      TM5_date: null,
    };
    const result = getFormDate(tmMatches, "TM5");
    expect(result === undefined || result === null).toBe(true);
  });
});


describe("TM display formatting preserves identifiers",()=>{
  it("pads short numeric TM numbers for display only",()=>expect(formatTmNumber("123")).toBe("000123"));
  it("preserves alphanumeric and longer identifiers",()=>{
    expect(formatTmNumber("TM-48")).toBe("TM-48");
    expect(formatTmNumber("1234567")).toBe("1234567");
  });
});
