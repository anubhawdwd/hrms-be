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
  location?: GeoLocation;
}

export interface CheckOutDTO {
  userId: string;
  companyId: string;
  source: "WEB" | "PWA";
  location?: GeoLocation;
}

export interface HrUpsertAttendanceDayDTO {
  employeeId: string;
  companyId: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  status?: "PRESENT" | "ABSENT" | "PARTIAL" | "LEAVE";
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
  validFrom?: string;
  validTo?: string;
}

// =================== DASHBOARD TYPES ===================

export type DashboardAttendanceStatus =
  | "PRESENT"
  | "ABSENT"
  | "PARTIAL"
  | "ON_LEAVE"
  | "HALF_DAY_LEAVE"
  | "PENDING_LEAVE"
  | "HOLIDAY"
  | "WEEKEND"
  | "UNRECORDED";

export interface AttendanceDashboardCell {
  date: string; // "YYYY-MM-DD"
  status: DashboardAttendanceStatus;
  checkIn: string | null;
  checkOut: string | null;
  totalMinutes: number;
  leaveType: string | null;
  leaveDuration: "FULL_DAY" | "HALF_DAY" | "QUARTER_DAY" | "HOURLY" | null;
  holidayName: string | null;
  isAutoPresent: boolean;
  isExempt: boolean;
}

export interface AttendanceDashboardEmployeeRow {
  employeeId: string;
  employeeCode: number;
  displayName: string;
  firstName: string;
  lastName: string;
  departmentName: string | null;
  designationName: string | null;
  days: Record<string, AttendanceDashboardCell>;
  summary: {
    present: number;
    absent: number;
    partial: number;
    onLeave: number;
    pendingLeave: number;
    holiday: number;
    weekend: number;
    unrecorded: number;
  };
}

export interface AttendanceDashboardDailySummary {
  present: number;
  absent: number;
  partial: number;
  onLeave: number;
  pendingLeave: number;
  holiday: number;
  weekend: number;
  unrecorded: number;
}

export interface AttendanceDashboardResponse {
  month: string; // "YYYY-MM"
  startDate: string; // "YYYY-MM-01"
  endDate: string; // "YYYY-MM-31"
  totalDays: number;
  days: Array<{
    date: string; // "YYYY-MM-DD"
    dayOfWeek: string; // "Mon", "Tue", etc.
    dayNumber: number; // 1..31
    isWeekend: boolean;
    holidayName: string | null;
  }>;
  employees: AttendanceDashboardEmployeeRow[];
  dailySummary: Record<string, AttendanceDashboardDailySummary>;
  companySummary: {
    totalEmployees: number;
    totalWorkingDays: number;
  };
}
