export type AttendanceSource = "WEB" | "PWA";

export interface GeoLocation {
  latitude: number;
  longitude: number;
}

export interface CheckInDTO {
  employeeId: string;
  companyId: string;
  source: "WEB" | "PWA";
  location: GeoLocation;
}

export interface CheckOutDTO {
  employeeId: string;
  companyId: string;
  source: "WEB" | "PWA";
  location: GeoLocation;
}
export interface GetAttendanceDayQuery {
  employeeId: string;
  companyId: string;
  date: string; // ISO date (YYYY-MM-DD)
}

export interface GetAttendanceRangeQuery {
  employeeId: string;
  companyId: string;
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

export interface HrUpsertAttendanceDayDTO {
  employeeId: string;
  companyId: string;
  date: string; // YYYY-MM-DD
  status: "PRESENT" | "ABSENT" | "PARTIAL";
  totalMinutes?: number;
  reason: string; // mandatory
}

export interface HrAddAttendanceEventDTO {
  employeeId: string;
  companyId: string;
  date: string;
  type: "CHECK_IN" | "CHECK_OUT";
  timestamp: string; // ISO
  source: "WEB" | "PWA";
  reason: string;
}
