// src/modules/leave/service.ts
import { LeaveRepository } from "./repository.js";
import {
  LeaveDurationType,
  LeaveRequestStatus,
  LeaveEncashmentStatus,
} from "../../generated/prisma/enums.js";
import { prisma } from "../../config/prisma.js";

const repo = new LeaveRepository();

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
    durationValue: number;
    reason?: string;
  }) {
    // Resolve employee from JWT user
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
    if (params.durationValue <= 0) {
      throw new Error("durationValue must be greater than 0");
    }
    if (
      params.durationType === LeaveDurationType.HOURLY &&
      from.toDateString() !== to.toDateString()
    ) {
      throw new Error("Hourly leave must be for a single day");
    }

    // Overlap check
    const overlapping = await repo.findOverlappingLeaveRequest({
      employeeId: employee.id,
      from,
      to,
    });
    if (overlapping) {
      throw new Error("You already have a leave request overlapping this date range");
    }

    const year = from.getFullYear();

    // Balance check
    const balance = await repo.getLeaveBalance(
      employee.id,
      params.leaveTypeId,
      year
    );
    if (!balance) throw new Error("Leave balance not found");

    // Policy + override
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

    // Sandwich calculation
    let sandwichEnabled = policy.sandwichRule;
    if (override?.allowSandwich === false) sandwichEnabled = false;

    // let effectiveDays = params.durationValue;
    let effectiveDays = this.toDays(params.durationType, params.durationValue);

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
      durationValue: params.durationValue,
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

  // =================== LEAVE  ===================
  /**
   * Convert duration to days based on type
   * Balance is always tracked in DAYS
   */
  private toDays(durationType: LeaveDurationType, durationValue: number): number {
    switch (durationType) {
      case LeaveDurationType.FULL_DAY:
        return durationValue;
      case LeaveDurationType.HALF_DAY:
        return durationValue * 0.5;
      case LeaveDurationType.QUARTER_DAY:
        return durationValue * 0.25;
      case LeaveDurationType.HOURLY:
        // 8-hour workday standard
        return durationValue / 8;
      default:
        return durationValue;
    }
  }
  // =================== LEAVE APPROVAL ===================

  async approveLeave(params: { requestId: string; userId: string; companyId: string }) {
    const request = await repo.findLeaveRequestById(params.requestId);
    if (!request) throw new Error("Leave request not found");
    if (request.status !== LeaveRequestStatus.PENDING) {
      throw new Error("Leave request already processed");
    }

    // Resolve approver's employee profile from user ID
    const approver = await repo.getEmployeeByUserId(params.userId);
    if (!approver) throw new Error("Approver employee profile not found");

    const year = request.fromDate.getFullYear();
    const deductDays = this.toDays(request.durationType, request.durationValue);

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
          approvedById: approver.id,  // ← Employee ID, not User ID
        },
      });
    });
  }

  async rejectLeave(params: { requestId: string; userId: string; companyId: string }) {
    const request = await repo.findLeaveRequestById(params.requestId);
    if (!request) throw new Error("Leave request not found");
    if (request.status !== LeaveRequestStatus.PENDING) {
      throw new Error("Leave request already processed");
    }

    // Resolve approver's employee profile from user ID
    const approver = await repo.getEmployeeByUserId(params.userId);
    if (!approver) throw new Error("Approver employee profile not found");

    return repo.updateLeaveRequestStatus({
      requestId: params.requestId,
      status: LeaveRequestStatus.REJECTED,
      approvedById: approver.id,  // ← Employee ID, not User ID
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
    const revertDays = this.toDays(request.durationType, request.durationValue);

    return prisma.$transaction(async (tx) => {
      await repo.revertLeaveBalance(tx, {
        employeeId: request.employeeId,
        leaveTypeId: request.leaveTypeId,
        year,
        // days: request.durationValue,
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
