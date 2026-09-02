// src/modules/employee/repository.ts
import { prisma } from "../../config/prisma.js";

export interface UpdateEmployeeData {
  departmentId?: string | null;
  teamId?: string | null;
  designationId?: string;
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  displayName?: string;
  dateOfBirth?: Date | null;
  joiningDate?: Date;
  isProbation?: boolean;
}

export class EmployeeRepository {
  getLastEmployeeCode(companyId: string) {
    return prisma.employeeProfile.findFirst({
      where: { companyId },
      orderBy: { employeeCode: "desc" },
      select: { employeeCode: true },
    });
  }

  createEmployee(data: {
    userId: string;
    companyId: string;
    departmentId?: string;
    teamId?: string;
    designationId: string;
    managerId?: string;
    employeeCode: number;
    firstName: string;
    middleName?: string;
    lastName: string;
    displayName: string;
    dateOfBirth?: Date;
    joiningDate: Date;
    isProbation?: boolean;
  }) {
    return prisma.employeeProfile.create({
      data: {
        user: { connect: { id: data.userId } },
        company: { connect: { id: data.companyId } },
        ...(data.departmentId && {
          department: { connect: { id: data.departmentId } },
        }),
        ...(data.teamId && { team: { connect: { id: data.teamId } } }),
        designation: { connect: { id: data.designationId } },
        ...(data.managerId && {
          manager: { connect: { id: data.managerId } },
        }),
        employeeCode: data.employeeCode,
        firstName: data.firstName,
        ...(data.middleName !== undefined && {
          middleName: data.middleName,
        }),
        lastName: data.lastName,
        displayName: data.displayName,
        ...(data.dateOfBirth && { dateOfBirth: data.dateOfBirth }),
        joiningDate: data.joiningDate,
        ...(data.isProbation !== undefined && {
          isProbation: data.isProbation,
        }),
      },
    });
  }

  findById(employeeId: string, companyId: string) {
    return prisma.employeeProfile.findFirst({
      where: { id: employeeId, companyId },
      include: {
        user: { select: { email: true } },
        department: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
        designation: { select: { id: true, name: true } },
        manager: { select: { id: true, displayName: true } },
        subordinates: { select: { id: true, displayName: true } },
      },
    });
  }

  listEmployees(companyId: string, status?: string) {
    return prisma.employeeProfile.findMany({
      where: {
        companyId,
        ...(status === "ACTIVE" ? { isActive: true } : {}),
        ...(status === "INACTIVE" ? { isActive: false } : {}),
      },
      orderBy: { employeeCode: "asc" },
      include: {
        user: { select: { email: true } },
        department: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
        designation: { select: { id: true, name: true } },
        manager: { select: { id: true, displayName: true } },
      },
    });
  }

  updateEmployee(
    employeeId: string,
    companyId: string,
    data: UpdateEmployeeData
  ) {
    return prisma.employeeProfile.update({
      where: { id: employeeId },
      data,
      include: {
        user: { select: { email: true } },
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
        manager: { select: { id: true, displayName: true } },
      },
    });
  }



  changeManager(
    employeeId: string,
    companyId: string,
    managerId?: string
  ) {
    return prisma.employeeProfile.update({
      where: { id: employeeId },
      data: { managerId: managerId ?? null },
      include: {
        user: { select: { email: true } },
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
        manager: { select: { id: true, displayName: true } },
      },
    });
  }

  getLeavePoliciesForCompany(companyId: string, year: number) {
    return prisma.leavePolicy.findMany({
      where: {
        companyId,
        year,
        leaveType: {
          autoGrantOnOnboarding: true,
          isActive: true,
        },
      },
      include: { leaveType: true },
    });
  }

  createManyLeaveBalances(
    data: {
      employeeId: string;
      leaveTypeId: string;
      year: number;
      allocated: number;
      used: number;
      carriedForward: number;
      remaining: number;
    }[]
  ) {
    return prisma.leaveBalance.createMany({ data });
  }

  getLeaveBalance(employeeId: string, leaveTypeId: string, year: number) {
    return prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year },
      },
    });
  }

  incrementLeaveBalance(balanceId: string, amount: number) {
    return prisma.leaveBalance.update({
      where: { id: balanceId },
      data: {
        allocated: { increment: amount },
        remaining: { increment: amount },
      },
    });
  }

  async findByUserId(userId: string, companyId: string) {
    const employee = await prisma.employeeProfile.findFirst({
      where: { userId, companyId },
      include: {
        user: { select: { email: true } },
        department: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
        designation: { select: { id: true, name: true } },
        manager: {
          select: {
            id: true,
            displayName: true,
            employeeCode: true,
            designation: { select: { id: true, name: true } },
          },
        },
        subordinates: {
          where: { isActive: true },
          select: {
            id: true,
            displayName: true,
            employeeCode: true,
            designation: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!employee) return null;

    let peers: any[] = [];
    if (employee.managerId) {
      peers = await prisma.employeeProfile.findMany({
        where: {
          companyId,
          managerId: employee.managerId,
          id: { not: employee.id },
          isActive: true,
        },
        select: {
          id: true,
          displayName: true,
          employeeCode: true,
          designation: { select: { id: true, name: true } },
        },
      });
    }

    return {
      ...employee,
      peers,
    };
  }
}
