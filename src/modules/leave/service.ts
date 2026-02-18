// src/modules/leave/service.ts
import { LeaveRepository } from "./repository.js";
import {
  LeaveDurationType,
  LeaveRequestStatus,
  LeaveEncashmentStatus,
} from "../../generated/prisma/enums.js";
import { prisma } from "../../config/prisma.js";
import { isValidTimeString, timeDiffMinutes } from "../../utils/date.js";

const repo = new LeaveRepository();

/**
 * Standard work schedule (used for auto-computing time ranges)
 */
const WORK_START = "09:00";
const WORK_END = "18:00";
const WORK_HOURS = 8; // 8-hour workday for balance conversion

/**
 * Pre-defined time slots for half-day and quarter-day
 */
const HALF_DAY_SLOTS: Record<string, { start: string; end: string }> = {
  FIRST_HALF: { start: "09:00", end: "13:00" },
  SECOND_HALF: { start: "14:00", end: "18:00" },
};

const QUARTER_DAY_SLOTS: Record<string, { start: string; end: string }> = {
  Q1: { start: "09:00", end: "11:00" },
  Q2: { start: "11:00", end: "13:00" },
  Q3: { start: "14:00", end: "16:00" },
  Q4: { start: "16:00", end: "18:00" },
};

export class LeaveService {
  // =================== LEAVE TYPE ===================

  async createLeaveType(params: {
    companyId: string;
    name: string;
    code: string;
    isPaid: boolean;
  }) {
    if (!params.name.trim() || !params.code.trim()) {
      throw new Error("Leave name and code are required");
    }

    return repo.createLeaveType({
      companyId: params.companyId,
      name: params.name.trim(),
      code: params.code.trim().toUpperCase(),
      isPaid: params.isPaid,
    });
  }

  async updateLeaveType(params: {
    leaveTypeId: string;
    name?: string;
    isPaid?: boolean;
    isActive?: boolean;
  }) {
    if (!params.leaveTypeId) {
      throw new Error("leaveTypeId is required");
    }
    return repo.updateLeaveType(params);
  }

  async listLeaveTypes(companyId: string) {
    return repo.listLeaveTypes(companyId);
  }

  // =================== LEAVE POLICY ===================

  async upsertLeavePolicy(params: {
    companyId: string;
    leaveTypeId: string;
    year: number;
    yearlyAllocation: number;
    allowCarryForward: boolean;
    maxCarryForward?: number | null;
    allowEncashment: boolean;
    probationAllowed: boolean;
    genderRestriction?: any;
    monthlyAccrual: boolean;
    sandwichRule: boolean;
  }) {
    if (params.year < 2000) throw new Error("Invalid policy year");
    if (params.yearlyAllocation < 0)
      throw new Error("Yearly allocation cannot be negative");
    if (
      params.allowCarryForward &&
      params.maxCarryForward != null &&
      params.maxCarryForward < 0
    ) {
      throw new Error("maxCarryForward must be positive");
    }

    return repo.upsertLeavePolicy(params);
  }

  async listLeavePolicies(companyId: string, year: number) {
    return repo.listLeavePolicies(companyId, year);
  }

  // =================== LEAVE REQUEST ===================

  async applyLeave(params: {
    userId: string;
    companyId: string;
    leaveTypeId: string;
    fromDate: string;
    toDate: string;
    durationType: LeaveDurationType;
    slot?: string; // "FIRST_HALF", "SECOND_HALF", "Q1", "Q2", "Q3", "Q4"
    startTime?: string; // "HH:MM" — for HOURLY
    endTime?: string; // "HH:MM" — for HOURLY
    reason?: string;
  }) {
    const employee = await this.resolveEmployee(
      params.userId,
      params.companyId
    );

    const from = new Date(params.fromDate);
    const to = new Date(params.toDate);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new Error("Invalid date");
    }
    if (from > to) throw new Error("fromDate cannot be after toDate");
    if (from.getFullYear() !== to.getFullYear()) {
      throw new Error("Leave cannot span across multiple years");
    }

    // ─── Resolve startTime, endTime, durationValue based on durationType ───

    let durationValue: number;
    let startTime: string | null = null;
    let endTime: string | null = null;

    switch (params.durationType) {
      case LeaveDurationType.FULL_DAY: {
        // Date range — compute number of calendar days (inclusive)
        const diffTime = to.getTime() - from.getTime();
        const diffDays =
          Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
        durationValue = diffDays;
        // No startTime/endTime for full day
        break;
      }

      case LeaveDurationType.HALF_DAY: {
        // Must be single day
        if (from.toDateString() !== to.toDateString()) {
          throw new Error("Half day leave must be for a single day");
        }
        if (!params.slot) {
          throw new Error(
            "Slot is required for half day (FIRST_HALF or SECOND_HALF)"
          );
        }
        const halfSlot = HALF_DAY_SLOTS[params.slot];
        if (!halfSlot) {
          throw new Error("Invalid half-day slot. Use FIRST_HALF or SECOND_HALF");
        }
        startTime = halfSlot.start;
        endTime = halfSlot.end;
        durationValue = 0.5; // 0.5 day
        break;
      }

      case LeaveDurationType.QUARTER_DAY: {
        // Must be single day
        if (from.toDateString() !== to.toDateString()) {
          throw new Error("Quarter day leave must be for a single day");
        }
        if (!params.slot) {
          throw new Error("Slot is required for quarter day (Q1, Q2, Q3, or Q4)");
        }
        const qSlot = QUARTER_DAY_SLOTS[params.slot];
        if (!qSlot) {
          throw new Error("Invalid quarter-day slot. Use Q1, Q2, Q3, or Q4");
        }
        startTime = qSlot.start;
        endTime = qSlot.end;
        durationValue = 0.25; // 0.25 day
        break;
      }

      case LeaveDurationType.HOURLY: {
        // Must be single day
        if (from.toDateString() !== to.toDateString()) {
          throw new Error("Hourly leave must be for a single day");
        }
        if (!params.startTime || !params.endTime) {
          throw new Error(
            "startTime and endTime are required for hourly leave"
          );
        }
        if (
          !isValidTimeString(params.startTime) ||
          !isValidTimeString(params.endTime)
        ) {
          throw new Error("Time must be in HH:MM format (e.g., 16:00)");
        }

        const diffMinutes = timeDiffMinutes(
          params.startTime,
          params.endTime
        );
        if (diffMinutes < 15) {
          throw new Error("Minimum hourly leave duration is 15 minutes");
        }

        startTime = params.startTime;
        endTime = params.endTime;
        // durationValue in fractional hours (for display), balance deduction uses toDays()
        durationValue = diffMinutes / 60;
        break;
      }

      default:
        throw new Error("Invalid duration type");
    }

    if (durationValue <= 0) {
      throw new Error("durationValue must be greater than 0");
    }

    // ─── Overlap check (time-aware for partial types) ───
    const overlapping = await repo.findOverlappingLeaveRequest({
      employeeId: employee.id,
      from,
      to,
      durationType: params.durationType,
      startTime,
      endTime,
    });
    if (overlapping) {
      throw new Error(
        "You already have a leave request overlapping this date/time range"
      );
    }

    const year = from.getFullYear();

    // ─── Balance check ───
    const balance = await repo.getLeaveBalance(
      employee.id,
      params.leaveTypeId,
      year
    );
    if (!balance) throw new Error("Leave balance not found");

    const policy = await repo.getLeavePolicy({
      companyId: params.companyId,
      leaveTypeId: params.leaveTypeId,
      year,
    });
    if (!policy) throw new Error("Leave policy not configured");

    const override = await repo.getEmployeeLeaveOverride({
      employeeId: employee.id,
      leaveTypeId: params.leaveTypeId,
      year,
    });

    // Calculate effective days for balance deduction
    let effectiveDays = this.toDays(params.durationType, durationValue);

    // Sandwich calculation (only for FULL_DAY spanning multiple days)
    if (
      params.durationType === LeaveDurationType.FULL_DAY &&
      durationValue > 1
    ) {
      let sandwichEnabled = policy.sandwichRule;
      if (override?.allowSandwich === false) sandwichEnabled = false;

      if (sandwichEnabled) {
        const holidays = await repo.getHolidaysForRange({
          companyId: params.companyId,
          from,
          to,
        });
        effectiveDays += this.countSandwichDays(
          from,
          to,
          holidays.map((h) => h.date)
        );
      }
    }

    if (balance.remaining < effectiveDays) {
      throw new Error(
        `Insufficient leave balance. Required: ${effectiveDays}, Available: ${balance.remaining} days`
      );
    }

    return repo.createLeaveRequest({
      employeeId: employee.id,
      leaveTypeId: params.leaveTypeId,
      fromDate: from,
      toDate: to,
      durationType: params.durationType,
      durationValue,
      startTime,
      endTime,
      reason: params.reason ?? null,
    });
  }

  async listMyLeaveRequests(userId: string, companyId: string) {
    const employee = await this.resolveEmployee(userId, companyId);
    return repo.listLeaveRequestsForEmployee(employee.id);
  }

  async cancelLeaveRequest(
    requestId: string,
    userId: string,
    companyId: string
  ) {
    const employee = await this.resolveEmployee(userId, companyId);
    const request = await repo.findLeaveRequestById(requestId);

    if (!request) throw new Error("Leave request not found");
    if (request.employeeId !== employee.id) {
      throw new Error("You can only cancel your own leave requests");
    }
    if (request.status !== LeaveRequestStatus.PENDING) {
      throw new Error("Only pending leave can be cancelled");
    }

    return repo.updateLeaveRequestStatus({
      requestId,
      status: LeaveRequestStatus.CANCELLED,
    });
  }

  // =================== DURATION → DAYS CONVERSION ===================
  /**
   * Convert duration to days for balance deduction.
   * Balance is always tracked in DAYS.
   *
   * FULL_DAY    → durationValue (already in days)
   * HALF_DAY    → 0.5 (durationValue is already 0.5)
   * QUARTER_DAY → 0.25 (durationValue is already 0.25)
   * HOURLY      → durationValue / 8 (8-hour workday)
   */
  private toDays(
    durationType: LeaveDurationType,
    durationValue: number
  ): number {
    switch (durationType) {
      case LeaveDurationType.FULL_DAY:
        return durationValue;
      case LeaveDurationType.HALF_DAY:
        return durationValue; // already 0.5
      case LeaveDurationType.QUARTER_DAY:
        return durationValue; // already 0.25
      case LeaveDurationType.HOURLY:
        return durationValue / WORK_HOURS;
      default:
        return durationValue;
    }
  }

  // =================== LEAVE APPROVAL ===================

  async approveLeave(params: {
    requestId: string;
    userId: string;
    companyId: string;
  }) {
    const request = await repo.findLeaveRequestById(params.requestId);
    if (!request) throw new Error("Leave request not found");
    if (request.status !== LeaveRequestStatus.PENDING) {
      throw new Error("Leave request already processed");
    }

    const approver = await repo.getEmployeeByUserId(params.userId);
    if (!approver) throw new Error("Approver employee profile not found");

    const year = request.fromDate.getFullYear();
    const deductDays = this.toDays(
      request.durationType,
      request.durationValue
    );

    return prisma.$transaction(async (tx) => {
      await repo.deductLeaveBalance(tx, {
        employeeId: request.employeeId,
        leaveTypeId: request.leaveTypeId,
        year,
        days: deductDays,
      });

      return tx.leaveRequest.update({
        where: { id: params.requestId },
        data: {
          status: LeaveRequestStatus.APPROVED,
          approvedById: approver.id,
        },
      });
    });
  }

  async rejectLeave(params: {
    requestId: string;
    userId: string;
    companyId: string;
  }) {
    const request = await repo.findLeaveRequestById(params.requestId);
    if (!request) throw new Error("Leave request not found");
    if (request.status !== LeaveRequestStatus.PENDING) {
      throw new Error("Leave request already processed");
    }

    const approver = await repo.getEmployeeByUserId(params.userId);
    if (!approver) throw new Error("Approver employee profile not found");

    return repo.updateLeaveRequestStatus({
      requestId: params.requestId,
      status: LeaveRequestStatus.REJECTED,
      approvedById: approver.id,
    });
  }

  async hrCancelApprovedLeave(params: {
    requestId: string;
    reason?: string | null;
  }) {
    const request = await repo.findLeaveRequestById(params.requestId);
    if (!request) throw new Error("Leave request not found");
    if (request.status !== LeaveRequestStatus.APPROVED) {
      throw new Error("Only approved leave can be HR cancelled");
    }

    const year = request.fromDate.getFullYear();
    const revertDays = this.toDays(
      request.durationType,
      request.durationValue
    );

    return prisma.$transaction(async (tx) => {
      await repo.revertLeaveBalance(tx, {
        employeeId: request.employeeId,
        leaveTypeId: request.leaveTypeId,
        year,
        days: revertDays,
      });

      return tx.leaveRequest.update({
        where: { id: params.requestId },
        data: {
          status: LeaveRequestStatus.CANCELLED,
          reason: params.reason ?? null,
        },
      });
    });
  }

  // =================== LEAVE BALANCE ===================

  async getMyLeaveBalances(userId: string, companyId: string, year: number) {
    const employee = await this.resolveEmployee(userId, companyId);
    return repo.getLeaveBalances(employee.id, year);
  }

  // =================== LEAVE ENCASHMENT ===================

  async requestLeaveEncashment(params: {
    userId: string;
    companyId: string;
    leaveTypeId: string;
    year: number;
    days: number;
  }) {
    if (params.days <= 0) {
      throw new Error("Encashment days must be greater than 0");
    }

    const employee = await this.resolveEmployee(
      params.userId,
      params.companyId
    );

    const balance = await repo.getLeaveBalance(
      employee.id,
      params.leaveTypeId,
      params.year
    );
    if (!balance) throw new Error("Leave balance not found");
    if (balance.remaining < params.days) {
      throw new Error("Insufficient leave balance for encashment");
    }

    return repo.createLeaveEncashment({
      employeeId: employee.id,
      leaveTypeId: params.leaveTypeId,
      year: params.year,
      days: params.days,
    });
  }

  async approveLeaveEncashment(encashmentId: string) {
    const encashment = await repo.findLeaveEncashmentById(encashmentId);
    if (!encashment) throw new Error("Encashment not found");
    if (encashment.status !== LeaveEncashmentStatus.REQUESTED) {
      throw new Error("Encashment already processed");
    }

    return prisma.$transaction(async (tx) => {
      await repo.deductLeaveBalance(tx, {
        employeeId: encashment.employeeId,
        leaveTypeId: encashment.leaveTypeId,
        year: encashment.year,
        days: encashment.days,
      });

      return repo.updateLeaveEncashmentStatus(
        tx,
        encashmentId,
        LeaveEncashmentStatus.APPROVED
      );
    });
  }

  async rejectLeaveEncashment(encashmentId: string) {
    const encashment = await repo.findLeaveEncashmentById(encashmentId);
    if (!encashment) throw new Error("Encashment not found");
    if (encashment.status !== LeaveEncashmentStatus.REQUESTED) {
      throw new Error("Encashment already processed");
    }

    return prisma.$transaction(async (tx) => {
      return repo.updateLeaveEncashmentStatus(
        tx,
        encashmentId,
        LeaveEncashmentStatus.REJECTED
      );
    });
  }

  // =================== HR OVERRIDE ===================

  async upsertEmployeeLeaveOverride(params: {
    employeeId: string;
    leaveTypeId: string;
    year: number;
    allowSandwich?: boolean | null;
    allowEncashment?: boolean | null;
    extraAllocation?: number | null;
    reason?: string | null;
  }) {
    return repo.upsertEmployeeLeaveOverride(params);
  }

  // =================== PendingLeaveRequest ===================
  async listPendingLeaveRequests(companyId: string) {
    return repo.listPendingLeaveRequests(companyId);
  }

  // =================== HOLIDAYS ===================

  async createHoliday(params: {
    companyId: string;
    name: string;
    date: Date;
  }) {
    return repo.createHoliday(params);
  }

  async listHolidays(companyId: string) {
    return repo.listHolidays(companyId);
  }

  async deleteHoliday(holidayId: string) {
    return repo.deleteHoliday(holidayId);
  }

  // =================== TODAY LEAVES ===================

  async getTodayLeaves(params: {
    userId: string;
    companyId: string;
    scope: "team" | "hierarchy" | "company";
    date: Date;
  }) {
    const employee = await repo.getEmployeeByUserId(params.userId);
    if (!employee) throw new Error("Employee not found");

    let employeeIds: string[] = [];

    switch (params.scope) {
      case "team":
        if (!employee.teamId) {
          return { date: params.date, scope: "team", employees: [] };
        }
        employeeIds = (
          await repo.getTeamEmployeeIds(employee.teamId)
        ).map((e) => e.id);
        break;
      case "hierarchy":
        employeeIds = (
          await repo.getHierarchyEmployeeIds(employee.id)
        ).map((e) => e.id);
        break;
      case "company":
        employeeIds = (
          await repo.getCompanyEmployeeIds(params.companyId)
        ).map((e) => e.id);
        break;
    }

    const leaves = await repo.findApprovedLeavesForEmployees({
      employeeIds,
      date: params.date,
    });

    return {
      date: params.date.toISOString().slice(0, 10),
      scope: params.scope,
      employees: leaves.map((l) => ({
        employeeId: l.employee.id,
        displayName: l.employee.displayName,
        designation: l.employee.designation.name,
        team: l.employee.team?.name ?? null,
        leaveType: l.leaveType.name,
        durationType: l.durationType,
        startTime: (l as any).startTime ?? null,
        endTime: (l as any).endTime ?? null,
      })),
    };
  }

  // =================== HELPERS ===================

  private async resolveEmployee(userId: string, companyId: string) {
    const employee = await repo.getEmployeeByUserId(userId);
    if (!employee) throw new Error("Employee profile not found");
    if (employee.companyId !== companyId) {
      throw new Error("Employee does not belong to this company");
    }
    return employee;
  }

  private countSandwichDays(
    from: Date,
    to: Date,
    holidays: Date[]
  ): number {
    let count = 0;
    const holidaySet = new Set(holidays.map((h) => h.toDateString()));
    const cursor = new Date(from);
    cursor.setDate(cursor.getDate() + 1);

    while (cursor < to) {
      const day = cursor.getDay();
      const isWeekend = day === 0 || day === 6;
      const isHoliday = holidaySet.has(cursor.toDateString());
      if (isWeekend || isHoliday) count++;
      cursor.setDate(cursor.getDate() + 1);
    }

    return count;
  }
}
