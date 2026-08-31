// src/utils/date.ts

export const TIMEZONE_IST = "Asia/Kolkata";

/**
 * Format a Date object to YYYY-MM-DD string in UTC
 */
export function formatDateUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Returns today's date as YYYY-MM-DD string in Asia/Kolkata (IST)
 */
export function getTodayDateStringIST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE_IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Returns today's date as YYYY-MM-DD midnight UTC Date based on Asia/Kolkata current calendar day.
 * Use this for all attendance date comparisons and storage.
 */
export function todayDateUTC(now: Date = new Date()): Date {
  const dateStr = getTodayDateStringIST(now);
  return parseDateUTC(dateStr);
}

/**
 * Parse a YYYY-MM-DD string into UTC midnight Date
 */
export function parseDateUTC(dateStr: string): Date {
  const parts = dateStr.split("-").map(Number);
  const year = parts[0] ?? 0;
  const month = (parts[1] ?? 1) - 1;
  const day = parts[2] ?? 1;
  return new Date(Date.UTC(year, month, day));
}

/**
 * Start of day in Asia/Kolkata (00:00:00.000 IST) converted to UTC Date timestamp
 * e.g. for "2026-08-27" -> 2026-08-26T18:30:00.000Z
 */
export function startOfDayIST(date: Date | string): Date {
  const dateStr = typeof date === "string" ? date : formatDateUTC(date);
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 0, 0, 0, 0) - (5 * 60 + 30) * 60 * 1000);
}

/**
 * End of day in Asia/Kolkata (23:59:59.999 IST) converted to UTC Date timestamp
 * e.g. for "2026-08-27" -> 2026-08-27T18:29:59.999Z
 */
export function endOfDayIST(date: Date | string): Date {
  const dateStr = typeof date === "string" ? date : formatDateUTC(date);
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 23, 59, 59, 999) - (5 * 60 + 30) * 60 * 1000);
}

/**
 * Convert numeric minutes into human-readable HH:mm:ss format
 * e.g. 480 -> "08:00:00", 520 -> "08:40:00", 550 -> "09:10:00", 90 -> "01:30:00"
 */
export function formatDurationHMS(minutes: number): string {
  if (!minutes || minutes <= 0) return "00:00:00";
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const secs = 0;
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Parse "HH:MM" string to total minutes since midnight
 */
export function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.split(":").map(Number);
  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  return hours * 60 + minutes;
}

/**
 * Calculate duration in minutes between two "HH:MM" strings
 */
export function timeDiffMinutes(startTime: string, endTime: string): number {
  const startMins = parseTimeToMinutes(startTime);
  const endMins = parseTimeToMinutes(endTime);
  if (endMins <= startMins) {
    throw new Error("End time must be after start time");
  }
  return endMins - startMins;
}

/**
 * Validate "HH:MM" format (00:00 – 23:59)
 */
export function isValidTimeString(timeStr: string): boolean {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(timeStr);
  return match !== null;
}

/**
 * Start of day in UTC for a given date
 */
export function startOfDayUTC(date: Date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

/**
 * End of day in UTC (23:59:59.999)
 */
export function endOfDayUTC(date: Date = new Date()): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );
}

/**
 * Check if two dates are the same calendar day (UTC)
 */
export function isSameDayUTC(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}
