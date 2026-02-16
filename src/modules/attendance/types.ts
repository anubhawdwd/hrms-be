// src/modules/attendance/types.ts
export type AttendanceSource = "WEB" | "PWA";

export interface GeoLocation {
  latitude: number;
  longitude: number;
}

export interface CheckInDTO {
  userId: string;
  companyId: string;
  source: "WEB" | "PWA";
  location: GeoLocation;
}

export interface CheckOutDTO {
  userId: string;
  companyId: string;
  source: "WEB" | "PWA";
  location: GeoLocation;
}

export interface HrUpsertAttendanceDayDTO {
  employeeId: string;
  companyId: string;
  date: string;
  status: "PRESENT" | "ABSENT" | "PARTIAL" | "LEAVE";
  totalMinutes?: number;
  reason: string;
}

export interface HrAddAttendanceEventDTO {
  employeeId: string;
  companyId: string;
  date: string;
  type: "CHECK_IN" | "CHECK_OUT";
  timestamp: string;
  source: "WEB" | "PWA";
  reason: string;
}

export interface UpsertEmployeeAttendanceOverrideDTO {
  employeeId: string;
  autoPresent: boolean;
  attendanceExempt: boolean;
  reason?: string;
  validFrom: string;
  validTo?: string;
}
