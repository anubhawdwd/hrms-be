// src/modules/manager/types.ts
import type { LeaveRequestStatus, LeaveDurationType } from "../../generated/prisma/enums.js";

export interface ReporteeSummary {
  id: string;
  employeeCode: number | null;
  displayName: string;
  firstName: string;
  lastName: string;
  personalEmail: string | null;
  workEmail: string | null;
  department: { id: string; name: string } | null;
  designation: { id: string; name: string } | null;
  team: { id: string; name: string } | null;
  isPrimaryManager: boolean;
  isSecondaryManager: boolean;
  joiningDate: Date | null;
}

export interface ReporteeLeaveFilter {
  status?: LeaveRequestStatus;
  employeeId?: string;
  fromDate?: string;
  toDate?: string;
}

export interface ReporteeLeaveItem {
  id: string;
  employeeId: string;
  employee: {
    id: string;
    employeeCode: number | null;
    displayName: string;
    department: { name: string } | null;
    designation: { name: string } | null;
    team: { name: string } | null;
  };
  leaveType: {
    id: string;
    name: string;
    code: string;
    isPaid: boolean;
  };
  fromDate: Date;
  toDate: Date;
  durationType: LeaveDurationType;
  durationValue: number;
  status: LeaveRequestStatus;
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
  days: Array<{
    id: string;
    date: Date;
    status: LeaveRequestStatus;
    isSandwichDay: boolean;
    deductDays: number;
  }>;
}

export interface ReporteeAttendanceFilter {
  month: string; // YYYY-MM
  employeeId?: string;
}
