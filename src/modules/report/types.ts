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
      booked: number;
      balance: number;
    }
  >;
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
