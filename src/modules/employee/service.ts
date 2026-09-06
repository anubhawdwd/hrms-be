// src/modules/employee/service.ts
import bcrypt from "bcrypt";
import { computeDailyAttendanceSessions } from "../attendance/calculations.js";
import {
  AuthProvider,
  AttendanceEventType,
  AttendanceSource,
  AttendanceStatus,
  Gender,
  LeaveRequestStatus,
  UserRole,
} from "../../generated/prisma/enums.js";
import { prisma } from "../../config/prisma.js";
import { EmployeeRepository } from "./repository.js";
import type {
  CreateEmployeeDTO,
  OnboardEmployeeDTO,
  UpdateEmployeeDTO,
  ChangeManagerDTO,
} from "./types.js";
import { generateTemporaryPassword } from "../../utils/password.js";

const repo = new EmployeeRepository();

export class EmployeeService {
  async onboardEmployee(companyId: string, dto: OnboardEmployeeDTO) {
    // 1. Validate email
    const email = dto.email?.trim().toLowerCase();
    if (!email) {
      const err: any = new Error("Email is required");
      err.statusCode = 400;
      throw err;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      const err: any = new Error("Invalid email format");
      err.statusCode = 400;
      throw err;
    }

    const existingUser = await prisma.user.findFirst({
      where: { email },
    });
    if (existingUser) {
      const err: any = new Error("A user with this email already exists");
      err.statusCode = 409;
      throw err;
    }

    // 2. Validate names
    if (!dto.firstName?.trim() || !dto.lastName?.trim()) {
      const err: any = new Error("First name and last name are required");
      err.statusCode = 400;
      throw err;
    }

    // 3. Validate joining date
    const joiningDate = new Date(dto.joiningDate);
    if (Number.isNaN(joiningDate.getTime())) {
      const err: any = new Error("Invalid joining date");
      err.statusCode = 400;
      throw err;
    }

    // 4. Validate DOB
    const dob =
      dto.dateOfBirth && dto.dateOfBirth.trim()
        ? new Date(dto.dateOfBirth.trim())
        : undefined;

    if (dob) {
      if (Number.isNaN(dob.getTime())) {
        const err: any = new Error("Invalid dateOfBirth");
        err.statusCode = 400;
        throw err;
      }
      if (dob > new Date()) {
        const err: any = new Error("dateOfBirth cannot be in the future");
        err.statusCode = 400;
        throw err;
      }
    }

    // 5. Validate Designation & Organization
    if (!dto.designationId) {
      const err: any = new Error("Designation is required");
      err.statusCode = 400;
      throw err;
    }
    const designation = await prisma.designation.findFirst({
      where: { id: dto.designationId, companyId },
    });
    if (!designation) {
      const err: any = new Error("Designation not found in this company");
      err.statusCode = 400;
      throw err;
    }

    if (dto.departmentId) {
      const department = await prisma.department.findFirst({
        where: { id: dto.departmentId, companyId },
      });
      if (!department) {
        const err: any = new Error("Department not found in this company");
        err.statusCode = 400;
        throw err;
      }
    }

    if (dto.teamId) {
      const team = await prisma.team.findFirst({
        where: { id: dto.teamId, department: { companyId } },
      });
      if (!team) {
        const err: any = new Error("Team not found in this company");
        err.statusCode = 400;
        throw err;
      }
    }

    // 6. Strict Tenant Isolation for Managers (Amendment 1)
    if (dto.managerId) {
      const manager = await prisma.employeeProfile.findFirst({
        where: { id: dto.managerId, companyId },
      });
      if (!manager) {
        const err: any = new Error("Reporting manager not found or belongs to a different company");
        err.statusCode = 400;
        throw err;
      }
    }

    if (dto.secondaryManagerId) {
      if (dto.managerId && dto.secondaryManagerId === dto.managerId) {
        const err: any = new Error("Secondary reporting manager cannot be the same as primary manager");
        err.statusCode = 400;
        throw err;
      }
      const secManager = await prisma.employeeProfile.findFirst({
        where: { id: dto.secondaryManagerId, companyId },
      });
      if (!secManager) {
        const err: any = new Error("Secondary reporting manager not found or belongs to a different company");
        err.statusCode = 400;
        throw err;
      }
    }

    // 7. Employee Code Validation & Pre-Check
    let employeeCode: number;
    if (
      dto.employeeCode !== undefined &&
      dto.employeeCode !== null &&
      String(dto.employeeCode).trim() !== ""
    ) {
      const parsedCode = Number(dto.employeeCode);
      if (!Number.isInteger(parsedCode) || parsedCode <= 0) {
        const err: any = new Error("Employee code must be a positive integer");
        err.statusCode = 400;
        throw err;
      }
      const existingCode = await prisma.employeeProfile.findFirst({
        where: { companyId, employeeCode: parsedCode },
      });
      if (existingCode) {
        const err: any = new Error(
          `Employee code ${parsedCode} is already in use for this company`
        );
        err.statusCode = 409;
        throw err;
      }
      employeeCode = parsedCode;
    } else {
      const last = await repo.getLastEmployeeCode(companyId);
      employeeCode = (last?.employeeCode ?? 0) + 1;
    }

    // 8. Auth Credentials & Security (Amendment 3)
    const authProvider =
      dto.authProvider && Object.values(AuthProvider).includes(dto.authProvider)
        ? dto.authProvider
        : AuthProvider.LOCAL;

    let roles: UserRole[];
    if (dto.roles && Array.isArray(dto.roles) && dto.roles.length > 0) {
      for (const r of dto.roles) {
        if (!Object.values(UserRole).includes(r)) {
          const err: any = new Error(`Invalid role: ${r}`);
          err.statusCode = 400;
          throw err;
        }
      }
      roles = Array.from(new Set(dto.roles));
    } else if (dto.role && Object.values(UserRole).includes(dto.role)) {
      roles = [dto.role];
    } else {
      roles = [UserRole.EMPLOYEE];
    }

    let passwordHash: string | null = null;
    let mustChangePassword = false;
    let temporaryPassword: string | undefined = undefined;

    if (authProvider === AuthProvider.LOCAL) {
      if (dto.password?.trim()) {
        if (dto.password.trim().length < 6) {
          const err: any = new Error("Password must be at least 6 characters long");
          err.statusCode = 400;
          throw err;
        }
        temporaryPassword = dto.password.trim();
      } else {
        temporaryPassword = generateTemporaryPassword();
      }
      passwordHash = await bcrypt.hash(temporaryPassword, 12);
      mustChangePassword = true; // Explicitly set true for LOCAL onboarding per spec
    }

    const displayName =
      dto.displayName?.trim() ||
      [dto.firstName, dto.middleName, dto.lastName].filter(Boolean).join(" ");

    // 9. Execute Atomic Transaction
    const result = await repo.onboardEmployee(companyId, {
      user: {
        email,
        personalEmail: dto.personalEmail?.trim() || null,
        passwordHash,
        mustChangePassword,
        authProvider,
        roles,
        role: roles[0] ?? UserRole.EMPLOYEE,
      },
      profile: {
        employeeCode,
        firstName: dto.firstName.trim(),
        middleName: dto.middleName?.trim() || null,
        lastName: dto.lastName.trim(),
        displayName,
        personalEmail: dto.personalEmail?.trim() || null,
        phone: dto.phone?.trim() || null,
        gender: dto.gender || null,
        dateOfBirth: dob || null,
        joiningDate,
        isProbation: dto.isProbation ?? true,
        departmentId: dto.departmentId || null,
        teamId: dto.teamId || null,
        designationId: dto.designationId,
        managerId: dto.managerId || null,
        secondaryManagerId: dto.secondaryManagerId || null,
      },
      initialLeaveGrant: dto.initialLeaveGrant,
    });

    return {
      ...result,
      temporaryPassword,
    };
  }

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
      ...(dto.secondaryManagerId && { secondaryManagerId: dto.secondaryManagerId }),
      employeeCode: nextEmployeeCode,
      firstName: dto.firstName.trim(),
      ...(dto.middleName !== undefined && {
        middleName: dto.middleName.trim(),
      }),
      lastName: dto.lastName.trim(),
      displayName,
      ...(dto.phone !== undefined && { phone: dto.phone.trim() }),
      ...(dto.gender !== undefined && { gender: dto.gender }),
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
      personalEmail?: string | null;
      phone?: string | null;
      gender?: Gender | null;
    }
  ) {
    const emp = await repo.findByUserId(userId, companyId);
    if (!emp) throw new Error("Employee not found");

    const dob =
      dto.dateOfBirth !== undefined
        ? dto.dateOfBirth === null
          ? null
          : new Date(dto.dateOfBirth)
        : undefined;

    if (dob && dob > new Date()) {
      throw new Error("Date of birth cannot be in the future");
    }

    return repo.updateEmployee(emp.id, companyId, {
      ...(dto.firstName && { firstName: dto.firstName.trim() }),
      ...(dto.middleName !== undefined && {
        middleName: dto.middleName ? dto.middleName.trim() : null,
      }),
      ...(dto.lastName && { lastName: dto.lastName.trim() }),
      ...(dto.displayName && { displayName: dto.displayName.trim() }),
      ...(dto.personalEmail !== undefined && {
        personalEmail: dto.personalEmail ? dto.personalEmail.trim() : null,
      }),
      ...(dto.phone !== undefined && {
        phone: dto.phone ? dto.phone.trim() : null,
      }),
      ...(dto.gender !== undefined && { gender: dto.gender }),
      ...(dob !== undefined && { dateOfBirth: dob }),
    });
  }

  async updateEmployeeAdmin(
    employeeId: string,
    companyId: string,
    dto: UpdateEmployeeDTO
  ) {
    const existing = await repo.findById(employeeId, companyId);
    if (!existing) {
      throw new Error("Employee not found");
    }

    // Manager tenant isolation validation (Amendment 1)
    if (dto.managerId !== undefined && dto.managerId !== null) {
      if (dto.managerId === employeeId) {
        throw new Error("An employee cannot be their own manager");
      }
      const mgr = await prisma.employeeProfile.findFirst({
        where: { id: dto.managerId, companyId },
      });
      if (!mgr) {
        throw new Error("Reporting manager not found or belongs to a different company");
      }
    }

    if (dto.secondaryManagerId !== undefined && dto.secondaryManagerId !== null) {
      if (dto.secondaryManagerId === employeeId) {
        throw new Error("An employee cannot be their own secondary manager");
      }
      const effectivePrimaryManager =
        dto.managerId !== undefined ? dto.managerId : existing.managerId;
      if (effectivePrimaryManager && dto.secondaryManagerId === effectivePrimaryManager) {
        throw new Error("Secondary reporting manager cannot be the same as primary manager");
      }
      const secMgr = await prisma.employeeProfile.findFirst({
        where: { id: dto.secondaryManagerId, companyId },
      });
      if (!secMgr) {
        throw new Error("Secondary reporting manager not found or belongs to a different company");
      }
    }

    const dob =
      dto.dateOfBirth !== undefined
        ? dto.dateOfBirth === null
          ? null
          : new Date(dto.dateOfBirth)
        : undefined;

    if (dob && dob > new Date()) {
      throw new Error("dateOfBirth cannot be in the future");
    }

    return repo.updateEmployee(employeeId, companyId, {
      ...(dto.departmentId !== undefined && { departmentId: dto.departmentId }),
      ...(dto.teamId !== undefined && { teamId: dto.teamId }),
      ...(dto.designationId && { designationId: dto.designationId }),
      ...(dto.joiningDate && { joiningDate: new Date(dto.joiningDate) }),
      ...(dto.isProbation !== undefined && { isProbation: dto.isProbation }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      ...(dto.firstName && { firstName: dto.firstName.trim() }),
      ...(dto.middleName !== undefined && {
        middleName: dto.middleName ? dto.middleName.trim() : null,
      }),
      ...(dto.lastName && { lastName: dto.lastName.trim() }),
      ...(dto.displayName && { displayName: dto.displayName.trim() }),
      ...(dto.personalEmail !== undefined && {
        personalEmail: dto.personalEmail ? dto.personalEmail.trim() : null,
      }),
      ...(dto.phone !== undefined && {
        phone: dto.phone ? dto.phone.trim() : null,
      }),
      ...(dto.gender !== undefined && { gender: dto.gender }),
      ...(dto.managerId !== undefined && { managerId: dto.managerId }),
      ...(dto.secondaryManagerId !== undefined && {
        secondaryManagerId: dto.secondaryManagerId,
      }),
      ...(dob !== undefined && { dateOfBirth: dob }),
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
    const employee = await prisma.employeeProfile.findFirst({
      where: { id: employeeId, companyId },
      include: { user: true },
    });
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
          status: { in: [LeaveRequestStatus.PENDING, LeaveRequestStatus.PENDING_MANAGER, LeaveRequestStatus.PENDING_HR] },
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
    const employee = await prisma.employeeProfile.findFirst({
      where: { id: employeeId, companyId },
      include: { user: true },
    });
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
    if (dto.managerId && dto.managerId === dto.employeeId) {
      throw new Error("An employee cannot be their own manager");
    }
    if (dto.managerId) {
      const mgr = await prisma.employeeProfile.findFirst({
        where: { id: dto.managerId, companyId: dto.companyId },
      });
      if (!mgr) {
        throw new Error("Reporting manager not found or belongs to a different company");
      }
    }
    return repo.changeManager(dto.employeeId, dto.companyId, dto.managerId);
  }

  async getEmployeeByUserId(userId: string, companyId: string) {
    const emp = await repo.findByUserId(userId, companyId);
    if (!emp) throw new Error("Employee not found");
    return emp;
  }
}
