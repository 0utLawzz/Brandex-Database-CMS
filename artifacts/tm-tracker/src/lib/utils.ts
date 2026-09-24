import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, isValid, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a date string to the Brandex standard display format.
 * Output: DD-MMM-YY HH:MM AM/PM  e.g. "18-Aug-26 02:10 AM"
 *
 * Handles:
 *  - ISO strings: "2026-08-18T02:10:00"
 *  - Date-only:   "2026-08-18"
 *  - Google Sheets date strings
 *  - null / undefined / empty → returns "—"
 */
export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "";
  const s = String(d).trim();
  if (!s || s === "—" || s === "null" || s === "undefined") return "";
  try {
    let date: Date;
    if (d instanceof Date) {
      date = d;
    } else {
      date = parseISO(s);
      if (!isValid(date)) date = new Date(s);
    }
    if (!isValid(date)) return s;
    return format(date, "dd-MMM-yy");
  } catch {
    return s;
  }
}

/**
 * Format a date string for display in short form (DD-MMM-YY).
 * Output: DD-MMM-YY e.g. "18-Aug-26"
 */
export function formatDateShort(d: string | Date | null | undefined): string {
  return formatDate(d);
}

/**
 * Format a date string to DD-MMM-YYYY format (e.g., "03-Jan-2026").
 * Handles ISO strings, date-only strings, and Date objects.
 * Returns "—" for null/undefined/invalid dates.
 */
export function formatDateLong(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const s = String(d).trim();
  if (!s || s === "—" || s === "null" || s === "undefined") return "—";
  try {
    let date: Date;
    if (d instanceof Date) {
      date = d;
    } else {
      date = parseISO(s);
      if (!isValid(date)) date = new Date(s);
    }
    if (!isValid(date)) return "—";
    return format(date, "dd-MMM-yyyy");
  } catch {
    return "—";
  }
}

/**
 * Calculate relative age from a date string to today.
 * Returns compact relative age string (e.g., "3 days ago", "1 month ago", "1 year 2 months ago").
 * Handles today, future dates safely, and uses calendar-based calculation.
 */
export function getRelativeAge(d: string | Date | null | undefined): string {
  if (!d) return "Date not available";
  const s = String(d).trim();
  if (!s || s === "—" || s === "null" || s === "undefined") return "Date not available";
  try {
    let date: Date;
    if (d instanceof Date) {
      date = d;
    } else {
      date = parseISO(s);
      if (!isValid(date)) date = new Date(s);
    }
    if (!isValid(date)) return "Date not available";

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);

    // Check if today
    if (target.getTime() === today.getTime()) {
      return "Today";
    }

    // Future date - handle safely
    if (target > today) {
      return "Future date";
    }

    // Calculate difference in calendar months and days
    let years = today.getFullYear() - target.getFullYear();
    let months = today.getMonth() - target.getMonth();
    let days = today.getDate() - target.getDate();

    // Adjust for negative days
    if (days < 0) {
      months--;
      const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      days += prevMonth.getDate();
    }

    // Adjust for negative months
    if (months < 0) {
      years--;
      months += 12;
    }

    // Build compact relative age string
    const parts: string[] = [];
    if (years > 0) {
      parts.push(`${years} year${years > 1 ? "s" : ""}`);
    }
    if (months > 0) {
      parts.push(`${months} month${months > 1 ? "s" : ""}`);
    }
    if (days > 0 && years === 0) {
      parts.push(`${days} day${days > 1 ? "s" : ""}`);
    }

    if (parts.length === 0) {
      return "Today";
    }

    return parts.join(" ") + " ago";
  } catch {
    return "Date not available";
  }
}

/**
 * Helper to extract form date from TmMatches object.
 * Handles the dynamic date fields for each form type.
 */
export function getFormDate(tmMatches: Record<string, any> | undefined, form: string): string | undefined {
  if (!tmMatches) return undefined;
  const date = tmMatches[`${form}_date`] as string | undefined | null;
  return date || undefined;
}

/**
 * Normalize a TM number for comparison (strips whitespace, trailing .0, quotes)
 */
export function normalizeTmNo(val: string | null | undefined): string {
  return String(val ?? "")
    .trim()
    .replace(/\.0$/, "")
    .replace(/^["']|["']$/g, "");
}
