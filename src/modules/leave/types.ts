// src/modules/leave/types.ts

import {
  LeaveDurationType,
  LeaveRequestStatus,
  LeaveEncashmentStatus,
  GenderRestriction,
} from "../../generated/prisma/enums.js";

/* ======================================================
   LEAVE TYPE (Company-defined)
   ====================================================== */

export interface CreateLeaveTypeDTO {
  companyId: string;
  name: string;
  code: string;
  isPaid: boolean;
}

export interface UpdateLeaveTypeDTO {
  leaveTypeId: string;
  name?: string;
  isPaid?: boolean;
  isActive?: boolean;
}

/* ======================================================
   LEAVE POLICY (Current company policy)
   ====================================================== */

export interface UpsertLeavePolicyDTO {
  companyId: string;
  leaveTypeId: string;

  yearlyAllocation: number;

  allowCarryForward: boolean;
  maxCarryForward?: number | null;

  allowEncashment: boolean;
  probationAllowed: boolean;

  genderRestriction?: GenderRestriction | null;

  monthlyAccrual: boolean;
}

export interface ListLeavePoliciesDTO {
  companyId: string;
}

/* ======================================================
   LEAVE BALANCE (Read-only for now)
   ====================================================== */

export interface GetLeaveBalanceDTO {
  companyId: string;
  employeeId: string;
  year: number;
}

/* ======================================================
   LEAVE REQUEST (Employee workflow)
   ====================================================== */

export interface CreateLeaveRequestDTO {
  employeeId: string;
  leaveTypeId: string;

  fromDate: string; // ISO (YYYY-MM-DD)
  toDate: string; // ISO (YYYY-MM-DD)

  durationType: LeaveDurationType;
  durationValue: number; // computed by service

  // Required for HALF_DAY, QUARTER_DAY, HOURLY
  startTime?: string; // "HH:MM" e.g. "09:00"
  endTime?: string; // "HH:MM" e.g. "13:00"

  reason?: string;
}

export interface UpdateLeaveRequestStatusDTO {
  requestId: string;
  status: LeaveRequestStatus;
  approvedById: string;
}

/* ======================================================
   LEAVE ENCASHMENT
   ====================================================== */

export interface CreateLeaveEncashmentDTO {
  employeeId: string;
  leaveTypeId: string;
  year: number;
  days: number;
}

export interface UpdateLeaveEncashmentStatusDTO {
  encashmentId: string;
  status: LeaveEncashmentStatus;
}

/* ======================================================
   EMPLOYEE LEAVE OVERRIDE (HR)
   ====================================================== */

export interface UpsertEmployeeLeaveOverrideDTO {
  employeeId: string;
  leaveTypeId: string;
  year: number;

  allowEncashment?: boolean | null;
  extraAllocation?: number | null;

  reason?: string | null;
}

/* ======================================================
   EMPLOYEE ON LEAVE HIERARCHY
   ====================================================== */
export type LeaveTodayScope = "team" | "hierarchy" | "company";

export interface GetTodayLeavesDTO {
  userId: string;
  companyId: string;
  scope: LeaveTodayScope;
  date: Date;
}

/* ======================================================
   YEAR-END ROLLOVER DTOs (LEV-12)
   ====================================================== */

export interface RolloverPreviewItem {
  employeeId: string;
  employeeCode: number;
  employeeName: string;
  leaveTypeId: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  fromYearRemaining: number;
  policyAllocated: number;
  carryForwardDays: number;
  toYearUsed: number;
  toYearProjectedRemaining: number;
  status: "READY" | "ALREADY_ROLLED_OVER";
}

export interface RolloverPreviewResult {
  fromYear: number;
  toYear: number;
  totalEmployees: number;
  eligibleBalancesCount: number;
  totalCarriedForwardDays: number;
  alreadyRolledOver: boolean;
  alreadyRolledOverCount: number;
  items: RolloverPreviewItem[];
}

export interface RunRolloverParams {
  companyId: string;
  adminUserId: string;
  fromYear: number;
  toYear: number;
  forceOverwrite?: boolean | undefined;
  reason?: string | undefined;
}

export interface RunRolloverResult {
  success: boolean;
  fromYear: number;
  toYear: number;
  totalEmployees: number;
  processedCount: number;
  totalCarriedForwardDays: number;
  auditLogId?: string;
}

