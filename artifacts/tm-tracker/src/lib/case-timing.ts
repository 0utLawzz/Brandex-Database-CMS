/** Owner-confirmed internal targets. Calendar dates, not statutory deadlines. */
export type TimingCase = {
  stage: string;
  subStage: string;
  filingDate?: string | null;
  eventDate?: string | null;
  acceptedDate?: string | null;
  publicationDate?: string | null;
  feeSubmittedDate?: string | null;
  certificateReceivedDate?: string | null;
  reactivatedDate?: string | null;
  hasObjection?: boolean;
};
export type CaseFlag = {
  tone: "green" | "yellow" | "red";
  reason: string;
  dueDate: string | null;
  elapsedDays: number;
};
const DAY = 86_400_000;
function date(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const n = Date.parse(value + "T00:00:00Z");
  return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === value
    ? n
    : null;
}
export function calendarMonth(value: string, months: number) {
  const n = date(value);
  if (n === null) throw new Error("Invalid calendar date");
  const d = new Date(n),
    day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}
export function journalDue(accepted: string) {
  const n = date(accepted);
  if (n === null) throw new Error("Invalid Accepted date");
  const d = new Date(n);
  if (d.getUTCDate() > 20) {
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  d.setUTCDate(29);
  return d.toISOString().slice(0, 10);
}
export function caseFlag(record: TimingCase, today: string): CaseFlag | null {
  const now = date(today);
  if (now === null) throw new Error("Invalid current date");
  if (record.stage === "STOPPED") return null;
  const result = (
    start: string | null | undefined,
    days: number,
    reason: string,
  ): CaseFlag | null => {
    const base = date(start);
    if (base === null) return null;
    const elapsedDays = Math.floor((now - base) / DAY),
      dueDate = new Date(base + days * DAY).toISOString().slice(0, 10);
    return {
      tone: elapsedDays >= days ? "red" : "green",
      reason,
      dueDate,
      elapsedDays,
    };
  };
  const baseline = record.reactivatedDate || record.eventDate;
  if (record.stage === "STAGE 1" && record.subStage === "Filing") {
    const f = result(
      record.reactivatedDate || record.filingDate,
      15,
      "Filing follow-up",
    );
    return f?.tone === "red" ? f : null;
  }
  if (record.stage === "STAGE 1" && record.subStage === "Examination") {
    const f = result(baseline, 7, "Acknowledgement pending after reply");
    return f?.tone === "red" ? f : null;
  }
  if (record.stage === "STAGE 2" && record.subStage === "Assigned") {
    const flag = result(baseline, 10, "Assignment outcome pending");
    if (flag && flag.elapsedDays >= 8 && flag.elapsedDays < 10)
      flag.tone = "yellow";
    return flag;
  }
  if (
    record.stage === "STAGE 2" &&
    record.subStage === "Accepted" &&
    record.acceptedDate
  ) {
    // Reactivated journal eligibility requires a separate owner decision.
    if (record.reactivatedDate) return null;
    const dueDate = journalDue(record.acceptedDate);
    return {
      tone: today >= dueDate ? "red" : "green",
      dueDate,
      elapsedDays: Math.floor((now - date(record.acceptedDate)!) / DAY),
      reason: "Expected journal publication",
    };
  }
  if (
    record.stage === "STAGE 3" &&
    record.subStage === "Published" &&
    !record.hasObjection
  ) {
    const start = record.reactivatedDate || record.publicationDate;
    if (date(start) === null) return null;
    const dueDate = calendarMonth(start!, 2);
    return {
      tone: today >= dueDate ? "red" : "green",
      dueDate,
      elapsedDays: Math.floor((now - date(start)!) / DAY),
      reason: "Demand Note pending",
    };
  }
  if (record.feeSubmittedDate && !record.certificateReceivedDate) {
    const start = record.reactivatedDate || record.feeSubmittedDate;
    const dueDate = calendarMonth(start, 1);
    return {
      tone: today >= dueDate ? "red" : "green",
      dueDate,
      elapsedDays: Math.floor((now - date(start)!) / DAY),
      reason: "Certificate receipt pending",
    };
  }
  return null;
}
export function pakistanToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
