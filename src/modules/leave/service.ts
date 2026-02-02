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

    const balance = employee.leaveBalances[0];
    if (!balance || balance.remaining < params.durationValue) {
      throw new Error("Insufficient leave balance");
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

  // =====================================================
  // LEAVE BALANCE
  // =====================================================

  async getMyLeaveBalances(employeeId: string, year: number) {
    return repo.getLeaveBalances(employeeId, year);
  }

  // =====================================================
  // LEAVE ENCASHMENT
  // =====================================================

  async requestLeaveEncashment(params: {
    employeeId: string;
    leaveTypeId: string;
    year: number;
    days: number;
  }) {
    if (params.days <= 0) {
      throw new Error("Encashment days must be greater than 0");
    }

    return repo.createLeaveEncashment(params);
  }

  async updateLeaveEncashmentStatus(params: {
    encashmentId: string;
    status: LeaveEncashmentStatus;
  }) {
    return repo.updateLeaveEncashmentStatus(params);
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
}
