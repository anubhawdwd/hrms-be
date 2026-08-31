// hrms-be/src/modules/attendance/calculations.ts

export interface AttendanceEventLike {
  type: "CHECK_IN" | "CHECK_OUT";
  timestamp: Date | string;
}

export interface AttendanceSession {
  checkIn: Date;
  checkOut: Date | null;
  durationMinutes: number;
  isOngoing: boolean;
}

export interface DailyAttendanceCalculationResult {
  sessions: AttendanceSession[];
  completedMinutes: number;
  liveMinutes: number;
  totalLiveMinutes: number;
  isCheckedIn: boolean;
  activeCheckInTime: Date | null;
  firstCheckIn: Date | null;
  lastCheckOut: Date | null;
}

/**
 * Computes the canonical daily attendance presence, paired sessions, and live state
 * from an ordered sequence of CHECK_IN / CHECK_OUT events.
 *
 * Rules:
 * 1. Events are sorted chronologically.
 * 2. Each valid CHECK_IN is paired with its subsequent CHECK_OUT into a Completed Session.
 * 3. Daily Presence = Sum of all completed sessions + (if currently open: now - activeCheckIn).
 * 4. If the final event is CHECK_IN:
 *    - isCheckedIn = true
 *    - activeCheckInTime = final CHECK_IN timestamp
 *    - lastCheckOut = null (shift currently "In progress")
 * 5. If the final event is CHECK_OUT:
 *    - isCheckedIn = false
 *    - activeCheckInTime = null
 *    - lastCheckOut = final CHECK_OUT timestamp
 * 6. Defensively handles malformed consecutive duplicate punches (IN->IN or OUT->OUT) without throwing.
 */
export function computeDailyAttendanceSessions(
  events: AttendanceEventLike[] | undefined | null,
  now: Date = new Date()
): DailyAttendanceCalculationResult {
  if (!events || events.length === 0) {
    return {
      sessions: [],
      completedMinutes: 0,
      liveMinutes: 0,
      totalLiveMinutes: 0,
      isCheckedIn: false,
      activeCheckInTime: null,
      firstCheckIn: null,
      lastCheckOut: null,
    };
  }

  // 1. Sort events chronologically
  const sorted = [...events]
    .map((e) => ({
      type: e.type,
      timestamp: e.timestamp instanceof Date ? e.timestamp : new Date(e.timestamp),
    }))
    .filter((e) => !Number.isNaN(e.timestamp.getTime()))
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  if (sorted.length === 0) {
    return {
      sessions: [],
      completedMinutes: 0,
      liveMinutes: 0,
      totalLiveMinutes: 0,
      isCheckedIn: false,
      activeCheckInTime: null,
      firstCheckIn: null,
      lastCheckOut: null,
    };
  }

  const sessions: AttendanceSession[] = [];
  let completedMinutes = 0;
  let openCheckIn: Date | null = null;
  let firstCheckIn: Date | null = null;
  let finalCheckOut: Date | null = null;

  for (const evt of sorted) {
    if (evt.type === "CHECK_IN") {
      if (!firstCheckIn) {
        firstCheckIn = evt.timestamp;
      }
      // If there was already an open check-in without check-out, we retain the latest or first
      // Defensively treat new CHECK_IN as active open check-in
      openCheckIn = evt.timestamp;
    } else if (evt.type === "CHECK_OUT") {
      if (openCheckIn) {
        // Completed session pair
        const duration = Math.max(
          Math.ceil((evt.timestamp.getTime() - openCheckIn.getTime()) / 60000),
          0
        );
        sessions.push({
          checkIn: openCheckIn,
          checkOut: evt.timestamp,
          durationMinutes: duration,
          isOngoing: false,
        });
        completedMinutes += duration;
        finalCheckOut = evt.timestamp;
        openCheckIn = null;
      }
      // If OUT without open IN, ignore for duration calculation (defensive guard)
    }
  }

  const isCheckedIn = openCheckIn !== null;
  let liveMinutes = 0;

  if (isCheckedIn && openCheckIn) {
    const liveDuration = Math.max(
      Math.floor((now.getTime() - openCheckIn.getTime()) / 60000),
      0
    );
    liveMinutes = liveDuration;
    sessions.push({
      checkIn: openCheckIn,
      checkOut: null,
      durationMinutes: liveMinutes,
      isOngoing: true,
    });
  }

  return {
    sessions,
    completedMinutes,
    liveMinutes,
    totalLiveMinutes: completedMinutes + liveMinutes,
    isCheckedIn,
    activeCheckInTime: isCheckedIn ? openCheckIn : null,
    firstCheckIn,
    lastCheckOut: isCheckedIn ? null : finalCheckOut,
  };
}
