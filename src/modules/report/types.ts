// src/modules/report/types.ts

export interface EmployeeReportFilterParams {
  departmentId?: string | undefined;
  teamId?: string | undefined;
  status?: "ACTIVE" | "INACTIVE" | "ALL" | undefined;
  search?: string | undefined;
}

export interface EmployeeReportRow {
  employeeCode: number | string;
  displayName: string;
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  personalEmail: string;
  phone: string;
  designation: string;
  department: string;
  team: string;
  primaryReportingManager: string;
  joiningDate: string;
  dateOfBirth: string;
  employmentStatus: string;
  employeeType: string;
  role: string;
  authProvider: string;
}

export interface EmployeeReportResponse {
  reportType: "EMPLOYEE";
  companyName: string;
  departmentLabel: string;
  teamLabel: string;
  statusLabel: string;
  generatedAt: string;
  totalEmployees: number;
  data: EmployeeReportRow[];
}

export interface LeaveReportFilterParams {
  year?: number | undefined;
  fromDate?: string | undefined;
  toDate?: string | undefined;
  departmentId?: string | undefined;
  teamId?: string | undefined;
  employeeId?: string | undefined;
  confirmPending?: boolean | undefined;
}

export interface DynamicLeaveTypeColumn {
  id: string;
  name: string;
  code: string;
  isPaid: boolean;
}

export interface LeaveReportEmployeeRow {
  employeeId: string;
  employeeCode: number | string;
  displayName: string;
  email: string;
  department: string;
  designation: string;
  team: string;
  leaveTypeMetrics: Record<
    string,
    {
      used: number;
      balance: number;
      booked?: number;
    }
  >;
  paidLeavesUsed: number;
  paidLeavesBalance: number;
  paidLeavesTotal: number;
  lwpTotal: number;
  absentDays: number;
}

export interface LeaveReportPendingWarning {
  warning: "PENDING_LEAVE_APPROVALS";
  hasPending: true;
  pendingCount: number;
  pendingTotalDays: number;
  message: string;
}

export interface LeaveReportSuccessResponse {
  reportType: "LEAVE";
  companyName: string;
  year: number;
  fromDate?: string | undefined;
  toDate?: string | undefined;
  periodLabel: string;
  dateRangeLabel: string;
  departmentLabel: string;
  teamLabel: string;
  generatedAt: string;
  totalEmployees: number;
  leaveTypes: DynamicLeaveTypeColumn[];
  hasPendingWarning: boolean;
  pendingCount: number;
  pendingTotalDays: number;
  reportNote?: string | undefined;
  data: LeaveReportEmployeeRow[];
}

export type LeaveReportResponse = LeaveReportPendingWarning | LeaveReportSuccessResponse;

// =================== ATTENDANCE REPORT TYPES ===================

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

export interface AttendanceReportFilterParams {
  year?: number | undefined;
  month?: string | undefined; // "YYYY-MM" or "1".."12"
  fromDate?: string | undefined; // "YYYY-MM-DD"
  toDate?: string | undefined; // "YYYY-MM-DD"
  departmentId?: string | undefined;
  teamId?: string | undefined;
  employeeId?: string | undefined;
  search?: string | undefined;
}

export interface AttendanceReportDayCell {
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

export interface AttendanceReportEmployeeRow {
  employeeId: string;
  employeeCode: number | string;
  displayName: string;
  email: string;
  department: string;
  designation: string;
  team: string;
  summary: {
    present: number;
    absent: number;
    partial: number;
    onLeave: number;
    pendingLeave: number;
    holiday: number;
    weekend: number;
    unrecorded: number;
    totalWorkingDays: number;
    totalPresentDays: number;
    attendancePercentage: number;
  };
  days: Record<string, AttendanceReportDayCell>;
}

export interface AttendanceReportHeaderDay {
  date: string; // "YYYY-MM-DD"
  dayOfWeek: string; // "Mon", "Tue", etc.
  dayNumber: number; // 1..31
  isWeekend: boolean;
  holidayName: string | null;
}

export interface AttendanceReportResponse {
  reportType: "ATTENDANCE";
  companyName: string;
  periodLabel: string;
  dateRangeLabel: string;
  startDate: string;
  endDate: string;
  departmentLabel: string;
  teamLabel: string;
  generatedAt: string;
  totalDays: number;
  daysHeader: AttendanceReportHeaderDay[];
  totalEmployees: number;
  companySummary: {
    totalEmployees: number;
    totalWorkingDays: number;
    avgAttendancePercentage: number;
  };
  dailySummary: Record<
    string,
    {
      present: number;
      absent: number;
      partial: number;
      onLeave: number;
      pendingLeave: number;
      holiday: number;
      weekend: number;
      unrecorded: number;
    }
  >;
  data: AttendanceReportEmployeeRow[];
}
