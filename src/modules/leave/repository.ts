// src/modules/leave/repository.ts

import { prisma } from "../../config/prisma.js";
import {
  LeaveDurationType,
  LeaveRequestStatus,
  LeaveEncashmentStatus,
  GenderRestriction,
} from "../../generated/prisma/enums.js";

export class LeaveRepository {
  // =====================================================
  // LEAVE TYPE
  // =====================================================

  createLeaveType(params: {
    companyId: string;
    name: string;
    code: string;
    isPaid: boolean;
  }) {
    return prisma.leaveType.create({
      data: {
        companyId: params.companyId,
        name: params.name,
        code: params.code,
        isPaid: params.isPaid,
      },
    });
  }

  updateLeaveType(params: {
    leaveTypeId: string;
    name?: string;
    isPaid?: boolean;
    isActive?: boolean;
  }) {
    return prisma.leaveType.update({
      where: { id: params.leaveTypeId },
      data: {
        ...(params.name !== undefined && { name: params.name }),
        ...(params.isPaid !== undefined && { isPaid: params.isPaid }),
        ...(params.isActive !== undefined && { isActive: params.isActive }),
      },
    });
  }

  listLeaveTypes(companyId: string) {
    return prisma.leaveType.findMany({
      where: { companyId },
      orderBy: { createdAt: "asc" },
    });
  }

  // =====================================================
  // LEAVE POLICY (UPSERT)
  // =====================================================

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
    const {
      companyId,
      leaveTypeId,
      year,
      yearlyAllocation,
      allowCarryForward,
      maxCarryForward,
      allowEncashment,
      probationAllowed,
      genderRestriction,
      monthlyAccrual,
      sandwichRule,
    } = params;

    return prisma.leavePolicy.upsert({
      where: {
        leaveTypeId_year: {
          leaveTypeId,
          year,
        },
      },
      update: {
        yearlyAllocation,
        allowCarryForward,
        maxCarryForward: maxCarryForward ?? null,
        allowEncashment,
        probationAllowed,
        genderRestriction: genderRestriction ?? null,
        monthlyAccrual,
        sandwichRule,
      },
      create: {
        companyId,
        leaveTypeId,
        year,
        yearlyAllocation,
        allowCarryForward,
        maxCarryForward: maxCarryForward ?? null,
        allowEncashment,
        probationAllowed,
        genderRestriction: genderRestriction ?? null,
        monthlyAccrual,
        sandwichRule,
      },
    });
  }

  listLeavePolicies(companyId: string, year: number) {
    return prisma.leavePolicy.findMany({
      where: { companyId, year },
      include: {
        leaveType: {
          select: {
            name: true,
            code: true,
            isPaid: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }
  // --sandwich--
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

  // =====================================================
  // LEAVE REQUEST
  // =====================================================

  createLeaveRequest(params: {
    employeeId: string;
    leaveTypeId: string;
    fromDate: Date;
    toDate: Date;
    durationType: LeaveDurationType;
    durationValue: number;
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
        reason: params.reason ?? null,
      },
    });
  }

  updateLeaveRequestStatus(params: {
    requestId: string;
    status: LeaveRequestStatus;
    approvedById: string;
  }) {
    return prisma.leaveRequest.update({
      where: { id: params.requestId },
      data: {
        status: params.status,
        approvedById: params.approvedById,
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

  updateLeaveRequestStatusSimple(params: {
    requestId: string;
    status: LeaveRequestStatus;
  }) {
    return prisma.leaveRequest.update({
      where: { id: params.requestId },
      data: {
        status: params.status,
      },
    });
  }


  // =====================================================
  // LEAVE BALANCE
  // =====================================================

  getLeaveBalances(employeeId: string, year: number) {
    return prisma.leaveBalance.findMany({
      where: { employeeId, year },
      include: {
        leaveType: { select: { name: true, code: true } },
      },
    });
  }

  revertLeaveBalance(
    tx: any,
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

  updateLeaveRequestAfterHrCancel(
    tx: any,
    params: {
      requestId: string;
      reason: string | null;
    }
  ) {
    return tx.leaveRequest.update({
      where: { id: params.requestId },
      data: {
        status: LeaveRequestStatus.CANCELLED,
        reason: params.reason,
      },
    });
  }

  // =====================================================
  // LEAVE ENCASHMENT
  // =====================================================

  createLeaveEncashment(params: {
    employeeId: string;
    leaveTypeId: string;
    year: number;
    days: number;
  }) {
    return prisma.leaveEncashment.create({
      data: {
        employeeId: params.employeeId,
        leaveTypeId: params.leaveTypeId,
        year: params.year,
        days: params.days,
      },
    });
  }

  updateLeaveEncashmentStatus(params: {
    encashmentId: string;
    status: LeaveEncashmentStatus;
  }) {
    return prisma.leaveEncashment.update({
      where: { id: params.encashmentId },
      data: {
        status: params.status,
      },
    });
  }

  deductLeaveBalanceForEncashment(
    tx: any,
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

  // =====================================================
  // EMPLOYEE LEAVE OVERRIDE (HR)
  // =====================================================

  upsertEmployeeLeaveOverride(params: {
    employeeId: string;
    leaveTypeId: string;
    year: number;
    allowSandwich?: boolean | null;
    allowEncashment?: boolean | null;
    extraAllocation?: number | null;
    reason?: string | null;
  }) {
    return prisma.employeeLeaveOverride.upsert({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: params.employeeId,
          leaveTypeId: params.leaveTypeId,
          year: params.year,
        },
      },
      update: {
        allowSandwich: params.allowSandwich ?? null,
        allowEncashment: params.allowEncashment ?? null,
        extraAllocation: params.extraAllocation ?? null,
        reason: params.reason ?? null,
      },
      create: {
        employeeId: params.employeeId,
        leaveTypeId: params.leaveTypeId,
        year: params.year,
        allowSandwich: params.allowSandwich ?? null,
        allowEncashment: params.allowEncashment ?? null,
        extraAllocation: params.extraAllocation ?? null,
        reason: params.reason ?? null,
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

  // -------------Holiday Calendar-------------
  createHoliday(params: {
    companyId: string;
    name: string;
    date: Date;
  }) {
    return prisma.holiday.create({
      data: params,
    });
  }

  listHolidays(companyId: string) {
    return prisma.holiday.findMany({
      where: { companyId },
      orderBy: { date: "asc" },
    });
  }

  deleteHoliday(holidayId: string) {
    return prisma.holiday.delete({
      where: { id: holidayId },
    });
  }
  // --sandwich--
  getHolidaysForRange(params: {
    companyId: string;
    from: Date;
    to: Date;
  }) {
    return prisma.holiday.findMany({
      where: {
        companyId: params.companyId,
        date: {
          gte: params.from,
          lte: params.to,
        },
      },
    });
  }

  findOverlappingLeaveRequest(params: {
    employeeId: string;
    from: Date;
    to: Date;
  }) {
    return prisma.leaveRequest.findFirst({
      where: {
        employeeId: params.employeeId,
        status: {
          in: ["PENDING", "APPROVED"],
        },
        AND: [
          {
            fromDate: {
              lte: params.to,
            },
          },
          {
            toDate: {
              gte: params.from,
            },
          },
        ],
      },
    });
  }

}
