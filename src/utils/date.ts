// src/utils/date.ts

/**
 * Returns today's date as YYYY-MM-DD midnight UTC
 * Use this for all attendance date comparisons
 */
export function todayDateUTC(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  );
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
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
}

/**
 * End of day in UTC
 */
export function endOfDayUTC(date: Date = new Date()): Date {
  return new Date(
    Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
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