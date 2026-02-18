// src/modules/leave/repository.ts
import { prisma } from "../../config/prisma.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import {
  LeaveDurationType,
  LeaveRequestStatus,
  LeaveEncashmentStatus,
  GenderRestriction,
} from "../../generated/prisma/enums.js";

type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export class LeaveRepository {
  // =================== LEAVE TYPE ===================

  createLeaveType(params: {
    companyId: string;
    name: string;
    code: string;
    isPaid: boolean;
  }) {
    return prisma.leaveType.create({ data: params });
  }

  updateLeaveType(params: {
    leaveTypeId: string;
    name?: string;
    isPaid?: boolean;
    isActive?: boolean;
  }) {
    const { leaveTypeId, ...data } = params;
    return prisma.leaveType.update({
      where: { id: leaveTypeId },
      data,
    });
  }

  listLeaveTypes(companyId: string) {
    return prisma.leaveType.findMany({
      where: { companyId },
      orderBy: { createdAt: "asc" },
    });
  }

  // =================== LEAVE POLICY ===================

  upsertLeavePolicy(params: {
    companyId: string;
    leaveTypeId: string;
    year: number;
    yearlyAllocation: number;
    allowCarryForward: boolean;
    maxCarryForward?: number | null;
    allowEncashment: boolean;
    probationAllowed: boolean;
    genderRestriction?: GenderRestriction | null;
    monthlyAccrual: boolean;
    sandwichRule: boolean;
  }) {
    const { companyId, leaveTypeId, year, ...rest } = params;

    return prisma.leavePolicy.upsert({
      where: { leaveTypeId_year: { leaveTypeId, year } },
      update: {
        ...rest,
        maxCarryForward: rest.maxCarryForward ?? null,
        genderRestriction: rest.genderRestriction ?? null,
      },
      create: {
        companyId,
        leaveTypeId,
        year,
        ...rest,
        maxCarryForward: rest.maxCarryForward ?? null,
        genderRestriction: rest.genderRestriction ?? null,
      },
    });
  }

  listLeavePolicies(companyId: string, year: number) {
    return prisma.leavePolicy.findMany({
      where: { companyId, year },
      include: {
        leaveType: { select: { name: true, code: true, isPaid: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  getLeavePolicy(params: {
    companyId: string;
    leaveTypeId: string;
    year: number;
  }) {
    return prisma.leavePolicy.findUnique({
      where: {
        leaveTypeId_year: {
          leaveTypeId: params.leaveTypeId,
          year: params.year,
        },
      },
    });
  }

  // =================== LEAVE REQUEST ===================

  createLeaveRequest(params: {
    employeeId: string;
    leaveTypeId: string;
    fromDate: Date;
    toDate: Date;
    durationType: LeaveDurationType;
    durationValue: number;
    startTime?: string | null;
    endTime?: string | null;
    reason?: string | null;
  }) {
    return prisma.leaveRequest.create({
      data: {
        employeeId: params.employeeId,
        leaveTypeId: params.leaveTypeId,
        fromDate: params.fromDate,
        toDate: params.toDate,
        durationType: params.durationType,
        durationValue: params.durationValue,
        startTime: params.startTime ?? null,
        endTime: params.endTime ?? null,
        reason: params.reason ?? null,
      },
    });
  }

  findLeaveRequestById(requestId: string) {
    return prisma.leaveRequest.findUnique({
      where: { id: requestId },
    });
  }

  updateLeaveRequestStatus(params: {
    requestId: string;
    status: LeaveRequestStatus;
    approvedById?: string;
  }) {
    return prisma.leaveRequest.update({
      where: { id: params.requestId },
      data: {
        status: params.status,
        ...(params.approvedById && { approvedById: params.approvedById }),
      },
    });
  }

  listLeaveRequestsForEmployee(employeeId: string) {
    return prisma.leaveRequest.findMany({
      where: { employeeId },
      include: {
        leaveType: { select: { name: true, code: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Find overlapping leave requests with time-aware overlap for partial-day types.
   */
  async findOverlappingLeaveRequest(params: {
    employeeId: string;
    from: Date;
    to: Date;
    durationType: LeaveDurationType;
    startTime?: string | null;
    endTime?: string | null;
  }) {
    const existing = await prisma.leaveRequest.findMany({
      where: {
        employeeId: params.employeeId,
        status: { in: ["PENDING", "APPROVED"] },
        fromDate: { lte: params.to },
        toDate: { gte: params.from },
      },
    });

    if (existing.length === 0) return null;

    const isPartialDay = (dt: LeaveDurationType) =>
      dt === LeaveDurationType.HALF_DAY ||
      dt === LeaveDurationType.QUARTER_DAY ||
      dt === LeaveDurationType.HOURLY;

    // If the new request is FULL_DAY, any date overlap is a conflict
    if (params.durationType === LeaveDurationType.FULL_DAY) {
      return existing[0];
    }

    // New request is partial-day — check each existing
    for (const req of existing) {
      // If existing is FULL_DAY covering the same date, it blocks entirely
      if (req.durationType === LeaveDurationType.FULL_DAY) {
        return req;
      }

      // Both are partial-day — check time overlap
      if (
        isPartialDay(req.durationType) &&
        req.startTime &&
        req.endTime &&
        params.startTime &&
        params.endTime
      ) {
        // Overlap: newStart < existingEnd AND newEnd > existingStart
        if (
          params.startTime < req.endTime &&
          params.endTime > req.startTime
        ) {
          return req;
        }
      }
    }

    return null;
  }

  /**
   * Find approved FULL_DAY leave for a date (blocks entire day attendance)
   */
  findApprovedFullDayLeaveForDate(employeeId: string, date: Date) {
    return prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        status: "APPROVED",
        durationType: "FULL_DAY",
        fromDate: { lte: date },
        toDate: { gte: date },
      },
    });
  }

  /**
   * Find all approved partial-day leaves (HALF_DAY, QUARTER_DAY, HOURLY) for a date
   */
  findApprovedPartialLeavesForDate(employeeId: string, date: Date) {
    return prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: "APPROVED",
        durationType: { in: ["HALF_DAY", "QUARTER_DAY", "HOURLY"] },
        fromDate: { lte: date },
        toDate: { gte: date },
      },
      select: {
        id: true,
        durationType: true,
        startTime: true,
        endTime: true,
        durationValue: true,
        leaveType: { select: { name: true, code: true } },
      },
    });
  }

  // =================== LEAVE BALANCE ===================

  getLeaveBalances(employeeId: string, year: number) {
    return prisma.leaveBalance.findMany({
      where: { employeeId, year },
      include: {
        leaveType: { select: { name: true, code: true } },
      },
    });
  }

  getLeaveBalance(employeeId: string, leaveTypeId: string, year: number) {
    return prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year },
      },
    });
  }

  deductLeaveBalance(
    tx: TxClient,
    params: {
      employeeId: string;
      leaveTypeId: string;
      year: number;
      days: number;
    }
  ) {
    return tx.leaveBalance.update({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: params.employeeId,
          leaveTypeId: params.leaveTypeId,
          year: params.year,
        },
      },
      data: {
        used: { increment: params.days },
        remaining: { decrement: params.days },
      },
    });
  }

  revertLeaveBalance(
    tx: TxClient,
    params: {
      employeeId: string;
      leaveTypeId: string;
      year: number;
      days: number;
    }
  ) {
    return tx.leaveBalance.update({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: params.employeeId,
          leaveTypeId: params.leaveTypeId,
          year: params.year,
        },
      },
      data: {
        used: { decrement: params.days },
        remaining: { increment: params.days },
      },
    });
  }

  // =================== LEAVE ENCASHMENT ===================

  createLeaveEncashment(params: {
    employeeId: string;
    leaveTypeId: string;
    year: number;
    days: number;
  }) {
    return prisma.leaveEncashment.create({ data: params });
  }

  findLeaveEncashmentById(encashmentId: string) {
    return prisma.leaveEncashment.findUnique({
      where: { id: encashmentId },
    });
  }

  updateLeaveEncashmentStatus(
    tx: TxClient,
    encashmentId: string,
    status: LeaveEncashmentStatus
  ) {
    return tx.leaveEncashment.update({
      where: { id: encashmentId },
      data: { status },
    });
  }

  // =================== HR -> EMPLOYEE LEAVE OVERRIDE ===================

  upsertEmployeeLeaveOverride(params: {
    employeeId: string;
    leaveTypeId: string;
    year: number;
    allowSandwich?: boolean | null;
    allowEncashment?: boolean | null;
    extraAllocation?: number | null;
    reason?: string | null;
  }) {
    const { employeeId, leaveTypeId, year, ...rest } = params;

    return prisma.employeeLeaveOverride.upsert({
      where: {
        employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year },
      },
      update: {
        allowSandwich: rest.allowSandwich ?? null,
        allowEncashment: rest.allowEncashment ?? null,
        extraAllocation: rest.extraAllocation ?? null,
        reason: rest.reason ?? null,
      },
      create: {
        employeeId,
        leaveTypeId,
        year,
        allowSandwich: rest.allowSandwich ?? null,
        allowEncashment: rest.allowEncashment ?? null,
        extraAllocation: rest.extraAllocation ?? null,
        reason: rest.reason ?? null,
      },
    });
  }

  getEmployeeLeaveOverride(params: {
    employeeId: string;
    leaveTypeId: string;
    year: number;
  }) {
    return prisma.employeeLeaveOverride.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: params.employeeId,
          leaveTypeId: params.leaveTypeId,
          year: params.year,
        },
      },
    });
  }

  // =================== PendingLeaveRequests ===================
  listPendingLeaveRequests(companyId: string) {
    return prisma.leaveRequest.findMany({
      where: {
        status: "PENDING",
        employee: { companyId },
      },
      include: {
        leaveType: { select: { name: true, code: true } },
        employee: {
          select: {
            id: true,
            displayName: true,
            designation: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  // =================== HOLIDAYS ===================

  createHoliday(params: { companyId: string; name: string; date: Date }) {
    return prisma.holiday.create({ data: params });
  }

  listHolidays(companyId: string) {
    return prisma.holiday.findMany({
      where: { companyId },
      orderBy: { date: "asc" },
    });
  }

  deleteHoliday(holidayId: string) {
    return prisma.holiday.delete({ where: { id: holidayId } });
  }

  getHolidaysForRange(params: { companyId: string; from: Date; to: Date }) {
    return prisma.holiday.findMany({
      where: {
        companyId: params.companyId,
        date: { gte: params.from, lte: params.to },
      },
    });
  }

  // =================== TODAY LEAVES ===================

  findApprovedLeavesForEmployees(params: {
    employeeIds: string[];
    date: Date;
  }) {
    return prisma.leaveRequest.findMany({
      where: {
        employeeId: { in: params.employeeIds },
        status: LeaveRequestStatus.APPROVED,
        fromDate: { lte: params.date },
        toDate: { gte: params.date },
      },
      include: {
        employee: {
          select: {
            id: true,
            displayName: true,
            team: { select: { name: true } },
            designation: { select: { name: true } },
          },
        },
        leaveType: { select: { name: true } },
      },
    });
  }

  getEmployeeByUserId(userId: string) {
    return prisma.employeeProfile.findFirst({
      where: { userId },
    });
  }

  getTeamEmployeeIds(teamId: string) {
    return prisma.employeeProfile.findMany({
      where: { teamId, isActive: true },
      select: { id: true },
    });
  }

  getHierarchyEmployeeIds(managerId: string) {
    return prisma.employeeProfile.findMany({
      where: { managerId, isActive: true },
      select: { id: true },
    });
  }

  getCompanyEmployeeIds(companyId: string) {
    return prisma.employeeProfile.findMany({
      where: { companyId, isActive: true },
      select: { id: true },
    });
  }
}
