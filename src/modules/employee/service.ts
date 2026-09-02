import { computeDailyAttendanceSessions } from "../attendance/calculations.js";
import { AttendanceEventType, AttendanceSource, AttendanceStatus, LeaveRequestStatus } from "../../generated/prisma/enums.js";
import { prisma } from "../../config/prisma.js";
// src/modules/employee/service.ts
import { EmployeeRepository } from "./repository.js";
import type {
  CreateEmployeeDTO,
  ChangeManagerDTO,
} from "./types.js";

const repo = new EmployeeRepository();

export class EmployeeService {
  async createEmployee(dto: CreateEmployeeDTO) {
    if (!dto.firstName.trim() || !dto.lastName.trim()) {
      throw new Error("First name and last name are required");
    }

    const joiningDate = new Date(dto.joiningDate);
    if (Number.isNaN(joiningDate.getTime())) {
      throw new Error("Invalid joining date");
    }

    const displayName =
      dto.displayName?.trim() ||
      [dto.firstName, dto.middleName, dto.lastName]
        .filter(Boolean)
        .join(" ");

    const dob =
      dto.dateOfBirth !== undefined
        ? new Date(dto.dateOfBirth.trim())
        : undefined;

    if (dob && Number.isNaN(dob.getTime())) {
      throw new Error("Invalid dateOfBirth");
    }

    if (dob && dob > new Date()) {
      throw new Error("dateOfBirth cannot be in the future");
    }

    const last = await repo.getLastEmployeeCode(dto.companyId);
    const nextEmployeeCode = (last?.employeeCode ?? 0) + 1;

    const employee = await repo.createEmployee({
      userId: dto.userId,
      companyId: dto.companyId,
      ...(dto.departmentId && { departmentId: dto.departmentId }),
      ...(dto.teamId && { teamId: dto.teamId }),
      designationId: dto.designationId,
      ...(dto.managerId && { managerId: dto.managerId }),
      employeeCode: nextEmployeeCode,
      firstName: dto.firstName.trim(),
      ...(dto.middleName !== undefined && {
        middleName: dto.middleName.trim(),
      }),
      lastName: dto.lastName.trim(),
      displayName,
      ...(dob && { dateOfBirth: dob }),
      joiningDate,
      ...(dto.isProbation !== undefined && {
        isProbation: dto.isProbation,
      }),
    });

    if (
      dto.initialLeaveGrant &&
      dto.initialLeaveGrant.leaveTypeId &&
      dto.initialLeaveGrant.allocated >= 0
    ) {
      await prisma.leaveBalance.create({
        data: {
          employeeId: employee.id,
          leaveTypeId: dto.initialLeaveGrant.leaveTypeId,
          year: joiningDate.getFullYear(),
          allocated: Number(dto.initialLeaveGrant.allocated),
          used: 0,
          carriedForward: 0,
          remaining: Number(dto.initialLeaveGrant.allocated),
        },
      });
    }

    return employee;
  }

  async getEmployeeById(employeeId: string, companyId: string) {
    const employee = await repo.findById(employeeId, companyId);
    if (!employee) throw new Error("Employee not found");
    return employee;
  }

  async listEmployees(companyId: string, status?: string) {
    return repo.listEmployees(companyId, status);
  }

  async updateMyProfile(
    userId: string,
    companyId: string,
    dto: {
      firstName?: string;
      middleName?: string;
      lastName?: string;
      displayName?: string;
      dateOfBirth?: string | null;
    }
  ) {
    const emp = await repo.findByUserId(userId, companyId);
    if (!emp) throw new Error("Employee not found");

    return repo.updateEmployee(emp.id, companyId, {
      ...(dto.firstName && { firstName: dto.firstName }),
      ...(dto.middleName !== undefined && { middleName: dto.middleName }),
      ...(dto.lastName && { lastName: dto.lastName }),
      ...(dto.displayName && { displayName: dto.displayName }),
      ...(dto.dateOfBirth !== undefined && {dateOfBirth: dto.dateOfBirth === null
        ? null
        : new Date(dto.dateOfBirth),
  }),
    });
  }

  async updateEmployeeAdmin(
    employeeId: string,
    companyId: string,
    dto: {
      departmentId?: string | null;
      teamId?: string | null;
      designationId?: string;
      joiningDate?: string;
      isProbation?: boolean;
      isActive?: boolean;
      firstName?: string;
      middleName?: string;
      lastName?: string;
      displayName?: string;
      dateOfBirth?: string | null;
    }
  ) {
    return repo.updateEmployee(employeeId, companyId, {
      ...(dto.departmentId !== undefined && { departmentId: dto.departmentId }),
      ...(dto.teamId !== undefined && { teamId: dto.teamId }),
      ...(dto.designationId && { designationId: dto.designationId }),
      ...(dto.joiningDate && { joiningDate: new Date(dto.joiningDate) }),
      ...(dto.isProbation !== undefined && { isProbation: dto.isProbation }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      ...(dto.firstName && { firstName: dto.firstName }),
      ...(dto.middleName !== undefined && { middleName: dto.middleName }),
      ...(dto.lastName && { lastName: dto.lastName }),
      ...(dto.displayName && { displayName: dto.displayName }),
      ...(dto.dateOfBirth !== undefined && {dateOfBirth:dto.dateOfBirth === null 
        ? null
        : new Date(dto.dateOfBirth),
      }),
    });
  }

  async deactivateEmployee(
    employeeId: string,
    companyId: string,
    dto?: { effectiveDate?: string; reason?: string }
  ) {
    return this.offboardEmployee(employeeId, companyId, dto);
  }

  async offboardEmployee(
    employeeId: string,
    companyId: string,
    dto?: { effectiveDate?: string; reason?: string }
  ) {
    const employee = await prisma.employeeProfile.findFirst({ where: { id: employeeId, companyId }, include: { user: true } });
    if (!employee) {
      throw new Error("Employee not found");
    }
    if (!employee.isActive) {
      throw new Error("Employee is already inactive");
    }

    const effectiveDateStr =
      dto?.effectiveDate?.trim() || new Date().toISOString().split("T")[0];

    // Atomically execute offboarding workflow
    await prisma.$transaction(async (tx) => {
      // 1. Deactivate Employee & User immediately (Decision 1)
      await tx.employeeProfile.update({
        where: { id: employeeId },
        data: { isActive: false },
      });

      await tx.user.update({
        where: { id: employee.userId },
        data: { isActive: false },
      });

      // Revoke all active sessions and refresh tokens
      await tx.refreshToken.deleteMany({
        where: { userId: employee.userId },
      });

      // 2. Attendance Handling: Close open attendance session at current timestamp (Decision 4)
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const attendanceDay = await tx.attendanceDay.findFirst({
        where: { employeeId, date: todayStart },
        include: { events: { orderBy: { timestamp: "asc" } } },
      });

      if (attendanceDay && attendanceDay.events.length > 0) {
        const lastEvent = attendanceDay.events[attendanceDay.events.length - 1];
        if (lastEvent && lastEvent.type === AttendanceEventType.CHECK_IN) {
          const checkOutEvent = await tx.attendanceEvent.create({
            data: {
              attendanceDayId: attendanceDay.id,
              type: AttendanceEventType.CHECK_OUT,
              source: AttendanceSource.WEB,
              timestamp: now,
            },
          });

          const updatedEvents = [...attendanceDay.events, checkOutEvent];
          const calcResult = computeDailyAttendanceSessions(updatedEvents, now);

          await tx.attendanceDay.update({
            where: { id: attendanceDay.id },
            data: {
              totalMinutes: calcResult.completedMinutes,
              status:
                calcResult.completedMinutes >= 480
                  ? AttendanceStatus.PRESENT
                  : AttendanceStatus.PARTIAL,
            },
          });
        }
      }

      // 3. Leave Handling: Auto-reject pending leave requests (Decision 3)
      const pendingLeaves = await tx.leaveRequest.findMany({
        where: {
          employeeId,
          status: LeaveRequestStatus.PENDING,
        },
      });

      for (const req of pendingLeaves) {
        await tx.leaveRequest.update({
          where: { id: req.id },
          data: {
            status: LeaveRequestStatus.REJECTED,
            reason: req.reason
              ? `${req.reason} (Rejected: Employee offboarded)`
              : "Employee offboarded",
          },
        });
      }

      // 4. Leave Handling: Auto-cancel future approved leave requests (Decision 2)
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);

      const futureApprovedLeaves = await tx.leaveRequest.findMany({
        where: {
          employeeId,
          status: LeaveRequestStatus.APPROVED,
          fromDate: { gt: todayEnd },
        },
      });

      for (const req of futureApprovedLeaves) {
        await tx.leaveRequest.update({
          where: { id: req.id },
          data: {
            status: LeaveRequestStatus.CANCELLED,
            reason: req.reason
              ? `${req.reason} (Cancelled: Offboarded on ${effectiveDateStr})`
              : `Offboarded on ${effectiveDateStr}`,
          },
        });
      }
    });

    return { message: "Employee offboarded successfully" };
  }

  async reactivateEmployee(employeeId: string, companyId: string) {
    const employee = await prisma.employeeProfile.findFirst({ where: { id: employeeId, companyId }, include: { user: true } });
    if (!employee) {
      throw new Error("Employee not found");
    }
    if (employee.isActive) {
      throw new Error("Employee is already active");
    }

    await prisma.$transaction(async (tx) => {
      await tx.employeeProfile.update({
        where: { id: employeeId },
        data: { isActive: true },
      });

      await tx.user.update({
        where: { id: employee.userId },
        data: { isActive: true },
      });
    });

    return { message: "Employee reactivated successfully" };
  }

  async changeManager(dto: ChangeManagerDTO) {
    return repo.changeManager(dto.employeeId, dto.companyId, dto.managerId);
  }

  async getEmployeeByUserId(userId: string, companyId: string) {
    const emp = await repo.findByUserId(userId, companyId);
    if (!emp) throw new Error("Employee not found");
    return emp;
  }

  private async bootstrapLeaveBalances(employee: {
    id: string;
    companyId: string;
    joiningDate?: Date | null;
    isProbation: boolean;
  }) {
    if (!employee.joiningDate) {
      return;
    }

    const year = employee.joiningDate.getFullYear();

    const policies = await repo.getLeavePoliciesForCompany(
      employee.companyId,
      year
    );

    const joiningMonth = employee.joiningDate.getMonth() + 1;
    const monthsRemaining = 12 - joiningMonth + 1;

    const balances = [];

    for (const policy of policies) {
      let totalEntitlement =
        (policy.yearlyAllocation / 12) * monthsRemaining;

      if (!policy.probationAllowed && employee.isProbation) {
        totalEntitlement = 0;
      }

      if (policy.monthlyAccrual) {
        totalEntitlement = policy.yearlyAllocation / 12;
      }

      balances.push({
        employeeId: employee.id,
        leaveTypeId: policy.leaveTypeId,
        year,
        allocated: totalEntitlement,
        used: 0,
        carriedForward: 0,
        remaining: totalEntitlement,
      });
    }

    if (balances.length > 0) {
      await repo.createManyLeaveBalances(balances);
    }
  }
}
