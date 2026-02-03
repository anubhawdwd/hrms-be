// src/modules/leave/service.ts

import { LeaveRepository } from "./repository.js";
import {
  LeaveDurationType,
  LeaveRequestStatus,
  LeaveEncashmentStatus,
  GenderRestriction,
} from "../../generated/prisma/enums.js";
import { prisma } from "../../config/prisma.js";

const repo = new LeaveRepository();

export class LeaveService {
  // =====================================================
  // LEAVE TYPE
  // =====================================================

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

  // =====================================================
  // LEAVE POLICY (HR / ADMIN)
  // =====================================================

  async upsertLeavePolicy(params: {
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
    if (params.year < 2000) {
      throw new Error("Invalid policy year");
    }

    if (params.yearlyAllocation < 0) {
      throw new Error("Yearly allocation cannot be negative");
    }

    if (
      params.allowCarryForward &&
      params.maxCarryForward !== null &&
      params.maxCarryForward !== undefined &&
      params.maxCarryForward < 0
    ) {
      throw new Error("maxCarryForward must be positive");
    }

    return repo.upsertLeavePolicy(params);
  }

  async listLeavePolicies(companyId: string, year: number) {
    return repo.listLeavePolicies(companyId, year);
  }

  // =====================================================
  // LEAVE REQUEST (EMPLOYEE)
  // =====================================================

  async applyLeave(params: {
    employeeId: string;
    leaveTypeId: string;
    fromDate: string;
    toDate: string;
    durationType: LeaveDurationType;
    durationValue: number;
    reason?: string;
  }) {
    const from = new Date(params.fromDate);
    const to = new Date(params.toDate);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new Error("Invalid date");
    }

    if (from > to) {
      throw new Error("fromDate cannot be after toDate");
    }
    // prevention CROSS-YEAR leave 
    if (from.getFullYear() !== to.getFullYear()) {
      throw new Error("Leave cannot span across multiple years");
    }
    if (params.durationValue <= 0) {
      throw new Error("durationValue must be greater than 0");
    }

    // HOURLY → same day only
    if (
      params.durationType === LeaveDurationType.HOURLY &&
      from.toDateString() !== to.toDateString()
    ) {
      throw new Error("Hourly leave must be for a single day");
    }

    //  OVERLAPPING LEAVE CHECK
    const overlapping = await repo.findOverlappingLeaveRequest({
      employeeId: params.employeeId,
      from,
      to,
    });

    if (overlapping) {
      throw new Error(
        "You already have a leave request overlapping this date range"
      );
    }


    // Fetch employee + policy
    const employee = await prisma.employeeProfile.findUnique({
      where: { id: params.employeeId },
      include: {
        company: true,
        leaveBalances: {
          where: {
            leaveTypeId: params.leaveTypeId,
            year: from.getFullYear(),
          },
        },
      },
    });

    if (!employee) {
      throw new Error("Employee not found");
    }

    // const balance = employee.leaveBalances[0];
    // if (!balance || balance.remaining < params.durationValue) {
    //   throw new Error("Insufficient leave balance");
    // }


    const balance = employee.leaveBalances[0];
    if (!balance) {
      throw new Error("Leave balance not found");
    }

    const year = from.getFullYear();

    /* ================================
       FETCH POLICY & OVERRIDE
    ================================ */

    const policy = await repo.getLeavePolicy({
      companyId: employee.companyId,
      leaveTypeId: params.leaveTypeId,
      year,
    });

    if (!policy) {
      throw new Error("Leave policy not configured");
    }

    const override = await repo.getEmployeeLeaveOverride({
      employeeId: params.employeeId,
      leaveTypeId: params.leaveTypeId,
      year,
    });

    /* ================================
       DETERMINE SANDWICH ENABLED
    ================================ */

    let sandwichEnabled = policy.sandwichRule;

    if (override?.allowSandwich === false) {
      sandwichEnabled = false;
    }

    /* ================================
       CALCULATE EFFECTIVE DAYS
    ================================ */

    let effectiveDays = params.durationValue;

    if (sandwichEnabled) {
      const holidays = await repo.getHolidaysForRange({
        companyId: employee.companyId,
        from,
        to,
      });

      const sandwichDays = this.countSandwichDays(
        from,
        to,
        holidays.map((h) => h.date)
      );

      effectiveDays += sandwichDays;
    }

    /* ================================
       FINAL BALANCE CHECK
    ================================ */

    if (balance.remaining < effectiveDays) {
      throw new Error(
        `Insufficient leave balance. Required: ${effectiveDays}`
      );
    }


    return repo.createLeaveRequest({
      employeeId: params.employeeId,
      leaveTypeId: params.leaveTypeId,
      fromDate: from,
      toDate: to,
      durationType: params.durationType,
      durationValue: params.durationValue,
      reason: params.reason ?? null,
    });
  }

  async listMyLeaveRequests(employeeId: string) {
    return repo.listLeaveRequestsForEmployee(employeeId);
  }

  async cancelLeaveRequest(requestId: string) {
    const request = await prisma.leaveRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new Error("Leave request not found");
    }

    if (request.status !== LeaveRequestStatus.PENDING) {
      throw new Error("Only pending leave can be cancelled");
    }

    return repo.updateLeaveRequestStatusSimple({
      requestId,
      status: LeaveRequestStatus.CANCELLED,
    });
  }

  // =====================================================
  // LEAVE APPROVAL (MANAGER / HR)
  // =====================================================

  async approveLeave(params: {
    requestId: string;
    approvedById: string;
  }) {
    const request = await prisma.leaveRequest.findUnique({
      where: { id: params.requestId },
    });

    if (!request) {
      throw new Error("Leave request not found");
    }

    if (request.status !== LeaveRequestStatus.PENDING) {
      throw new Error("Leave request already processed");
    }

    return repo.updateLeaveRequestStatus({
      requestId: params.requestId,
      status: LeaveRequestStatus.APPROVED,
      approvedById: params.approvedById,
    });
  }

  async rejectLeave(params: {
    requestId: string;
    approvedById: string;
  }) {
    return repo.updateLeaveRequestStatus({
      requestId: params.requestId,
      status: LeaveRequestStatus.REJECTED,
      approvedById: params.approvedById,
    });
  }

  async hrCancelApprovedLeave(params: {
    requestId: string;
    reason?: string | null;
  }) {
    const request = await prisma.leaveRequest.findUnique({
      where: { id: params.requestId },
    });

    if (!request) {
      throw new Error("Leave request not found");
    }

    if (request.status !== LeaveRequestStatus.APPROVED) {
      throw new Error("Only approved leave can be HR cancelled");
    }

    const year = request.fromDate.getFullYear();

    return prisma.$transaction(async (tx) => {
      await repo.revertLeaveBalance(tx, {
        employeeId: request.employeeId,
        leaveTypeId: request.leaveTypeId,
        year,
        days: request.durationValue,
      });

      return repo.updateLeaveRequestAfterHrCancel(tx, {
        requestId: params.requestId,
        reason: params.reason ?? null,
      });
    });
  }

  // =====================================================
  // LEAVE BALANCE
  // =====================================================

  async getMyLeaveBalances(employeeId: string, year: number) {
    return repo.getLeaveBalances(employeeId, year);
  }

  // =====================================================
  // LEAVE ENCASHMENT
  // =====================================================

  // async requestLeaveEncashment(params: {
  //   employeeId: string;
  //   leaveTypeId: string;
  //   year: number;
  //   days: number;
  // }) {
  //   if (params.days <= 0) {
  //     throw new Error("Encashment days must be greater than 0");
  //   }

  //   return repo.createLeaveEncashment(params);
  // }
  async requestLeaveEncashment(params: {
    employeeId: string;
    leaveTypeId: string;
    year: number;
    days: number;
  }) {
    if (params.days <= 0) {
      throw new Error("Encashment days must be greater than 0");
    }

    const balance = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: params.employeeId,
          leaveTypeId: params.leaveTypeId,
          year: params.year,
        },
      },
    });

    if (!balance) {
      throw new Error("Leave balance not found");
    }

    if (balance.remaining < params.days) {
      throw new Error("Insufficient leave balance for encashment");
    }

    return repo.createLeaveEncashment(params);
  }

  async updateLeaveEncashmentStatus(params: {
    encashmentId: string;
    status: LeaveEncashmentStatus;
  }) {
    return repo.updateLeaveEncashmentStatus(params);
  }

  async approveLeaveEncashment(encashmentId: string) {
    const encashment = await prisma.leaveEncashment.findUnique({
      where: { id: encashmentId },
    });

    if (!encashment) {
      throw new Error("Encashment not found");
    }

    if (encashment.status !== LeaveEncashmentStatus.REQUESTED) {
      throw new Error("Encashment already processed");
    }

    return prisma.$transaction(async (tx) => {
      await repo.deductLeaveBalanceForEncashment(tx, {
        employeeId: encashment.employeeId,
        leaveTypeId: encashment.leaveTypeId,
        year: encashment.year,
        days: encashment.days,
      });

      return repo.updateLeaveEncashmentStatus({
        encashmentId,
        status: LeaveEncashmentStatus.APPROVED,
      });
    });
  }

  async rejectLeaveEncashment(encashmentId: string) {
    return repo.updateLeaveEncashmentStatus({
      encashmentId,
      status: LeaveEncashmentStatus.REJECTED,
    });
  }


  // =====================================================
  // HR OVERRIDE
  // =====================================================

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

  // --------Holiday calendar-----------
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
  // ----Sandwich-----
  private countSandwichDays(
    from: Date,
    to: Date,
    holidays: Date[]
  ): number {
    let count = 0;

    const holidaySet = new Set(
      holidays.map((h) => h.toDateString())
    );

    const cursor = new Date(from);
    cursor.setDate(cursor.getDate() + 1);

    while (cursor < to) {
      const day = cursor.getDay(); // 0=Sun 6=Sat
      const isWeekend = day === 0 || day === 6;
      const isHoliday = holidaySet.has(cursor.toDateString());

      if (isWeekend || isHoliday) {
        count++;
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    return count;
  }

}
