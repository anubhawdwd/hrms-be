// src/modules/employee/repository.ts

import { prisma } from "../../config/prisma.js";

export class EmployeeRepository {
  async getLastEmployeeCode(companyId: string) {
    return prisma.employeeProfile.findFirst({
      where: { companyId },
      orderBy: { employeeCode: "desc" },
      select: { employeeCode: true },
    });
  }

  async createEmployee(data: {
    userId: string;
    companyId: string;
    teamId: string;
    designationId: string;
    managerId?: string;

    employeeCode: number;

    firstName: string;
    middleName?: string;
    lastName: string;
    displayName: string;

    joiningDate: Date;
  }) {
    return prisma.employeeProfile.create({
      data: {
        user: { connect: { id: data.userId } },
        company: { connect: { id: data.companyId } },
        ...(data.teamId && {
          team: { connect: { id: data.teamId } },
        }),
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
        joiningDate: data.joiningDate,

      },
    });
  }

  async findById(employeeId: string, companyId: string) {
    return prisma.employeeProfile.findFirst({
      where: {
        id: employeeId,
        companyId,
      },
      include: {
        user: { select: { email: true } },
        team: { select: { name: true } },
        designation: { select: { name: true } },
        manager: {
          select: {
            id: true,
            displayName: true,
          },
        },
        subordinates: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });
  }

  async listEmployees(companyId: string) {
    return prisma.employeeProfile.findMany({
      where: { companyId },
      orderBy: { employeeCode: "asc" },
      include: {
        user: { select: { email: true } },
        team: { select: { name: true } },
        designation: { select: { name: true } },
        manager: {
          select: { id: true, displayName: true },
        },
      },
    });
  }

  async updateEmployee(
    employeeId: string,
    companyId: string,
    data: any
  ) {
    return prisma.employeeProfile.update({
      where: { id: employeeId },
      data,
    });
  }

  async changeManager(
    employeeId: string,
    companyId: string,
    managerId?: string
  ) {
    return prisma.employeeProfile.update({
      where: { id: employeeId },
      data: {
        managerId: managerId ?? null,
      },
    });
  }
}
