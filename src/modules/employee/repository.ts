// src/modules/employee/repository.ts
import { prisma } from "../../config/prisma.js";
import { AuthProvider, Gender, UserRole } from "../../generated/prisma/enums.js";

export interface UpdateEmployeeData {
  departmentId?: string | null | undefined;
  teamId?: string | null | undefined;
  designationId?: string | undefined;
  firstName?: string | undefined;
  middleName?: string | null | undefined;
  lastName?: string | undefined;
  displayName?: string | undefined;
  personalEmail?: string | null | undefined;
  phone?: string | null | undefined;
  gender?: Gender | null | undefined;
  dateOfBirth?: Date | null | undefined;
  joiningDate?: Date | undefined;
  isProbation?: boolean | undefined;
  isActive?: boolean | undefined;
  managerId?: string | null | undefined;
  secondaryManagerId?: string | null | undefined;
}

export interface OnboardEmployeeData {
  user: {
    email: string;
    personalEmail?: string | null | undefined;
    passwordHash?: string | null | undefined;
    mustChangePassword: boolean;
    authProvider: AuthProvider;
    role?: UserRole;
    roles?: UserRole[];
  };
  profile: {
    employeeCode: number;
    firstName: string;
    middleName?: string | null | undefined;
    lastName: string;
    displayName: string;
    personalEmail?: string | null | undefined;
    phone?: string | null | undefined;
    gender?: Gender | null | undefined;
    dateOfBirth?: Date | null | undefined;
    joiningDate: Date;
    isProbation: boolean;
    departmentId?: string | null | undefined;
    teamId?: string | null | undefined;
    designationId: string;
    managerId?: string | null | undefined;
    secondaryManagerId?: string | null | undefined;
  };
  initialLeaveGrant?: {
    leaveTypeId: string;
    allocated: number;
  } | null | undefined;
}

export function mapEmployeeWithUserRoles<T extends { user?: { roles?: { role: UserRole }[] } | null }>(emp: T) {
  if (!emp || !emp.user) return emp;
  const roles = emp.user.roles ? emp.user.roles.map((r) => r.role) : [];
  return {
    ...emp,
    user: {
      ...emp.user,
      roles,
      role: roles[0] ?? UserRole.EMPLOYEE,
    },
  };
}

export class EmployeeRepository {
  getLastEmployeeCode(companyId: string) {
    return prisma.employeeProfile.findFirst({
      where: { companyId },
      orderBy: { employeeCode: "desc" },
      select: { employeeCode: true },
    });
  }

  async createEmployee(data: {
    userId: string;
    companyId: string;
    departmentId?: string;
    teamId?: string;
    designationId: string;
    managerId?: string;
    secondaryManagerId?: string;
    employeeCode: number;
    firstName: string;
    middleName?: string;
    lastName: string;
    displayName: string;
    phone?: string;
    gender?: Gender;
    dateOfBirth?: Date;
    joiningDate: Date;
    isProbation?: boolean;
  }) {
    const created = await prisma.employeeProfile.create({
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
        ...(data.secondaryManagerId && {
          secondaryManager: { connect: { id: data.secondaryManagerId } },
        }),
        employeeCode: data.employeeCode,
        firstName: data.firstName,
        ...(data.middleName !== undefined && {
          middleName: data.middleName,
        }),
        lastName: data.lastName,
        displayName: data.displayName,
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.gender !== undefined && { gender: data.gender }),
        ...(data.dateOfBirth && { dateOfBirth: data.dateOfBirth }),
        joiningDate: data.joiningDate,
        ...(data.isProbation !== undefined && {
          isProbation: data.isProbation,
        }),
      },
      include: {
        user: { select: { id: true, email: true, personalEmail: true, roles: { select: { role: true } }, isActive: true } },
        department: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
        designation: { select: { id: true, name: true } },
        manager: { select: { id: true, displayName: true, employeeCode: true } },
        secondaryManager: { select: { id: true, displayName: true, employeeCode: true } },
      },
    });
    return mapEmployeeWithUserRoles(created);
  }

  async onboardEmployee(companyId: string, data: OnboardEmployeeData) {
    return prisma.$transaction(async (tx) => {
      let roles: UserRole[] = [UserRole.EMPLOYEE];
      if (data.user.roles && data.user.roles.length > 0) {
        roles = data.user.roles;
      } else if (data.user.role) {
        roles = [data.user.role];
      }

      // 1. Create User
      const user = await tx.user.create({
        data: {
          email: data.user.email,
          personalEmail: data.user.personalEmail ?? null,
          passwordHash: data.user.passwordHash ?? null,
          mustChangePassword: data.user.mustChangePassword,
          authProvider: data.user.authProvider,
          roles: {
            create: roles.map((role) => ({ role })),
          },
          companyId,
        },
        include: {
          roles: { select: { role: true } },
        },
      });

      // 2. Create Employee Profile
      const employee = await tx.employeeProfile.create({
        data: {
          userId: user.id,
          companyId,
          employeeCode: data.profile.employeeCode,
          firstName: data.profile.firstName,
          middleName: data.profile.middleName ?? null,
          lastName: data.profile.lastName,
          displayName: data.profile.displayName,
          phone: data.profile.phone ?? null,
          gender: data.profile.gender ?? null,
          dateOfBirth: data.profile.dateOfBirth ?? null,
          joiningDate: data.profile.joiningDate,
          isProbation: data.profile.isProbation,
          designationId: data.profile.designationId,
          departmentId: data.profile.departmentId ?? null,
          teamId: data.profile.teamId ?? null,
          managerId: data.profile.managerId ?? null,
          secondaryManagerId: data.profile.secondaryManagerId ?? null,
        },
        include: {
          user: { select: { id: true, email: true, personalEmail: true, roles: { select: { role: true } }, isActive: true } },
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
          secondaryManager: {
            select: {
              id: true,
              displayName: true,
              employeeCode: true,
              designation: { select: { id: true, name: true } },
            },
          },
        },
      });

      // 3. Create initial leave grant if requested
      if (
        data.initialLeaveGrant &&
        data.initialLeaveGrant.leaveTypeId &&
        data.initialLeaveGrant.allocated >= 0
      ) {
        await tx.leaveBalance.create({
          data: {
            employeeId: employee.id,
            leaveTypeId: data.initialLeaveGrant.leaveTypeId,
            year: data.profile.joiningDate.getFullYear(),
            allocated: Number(data.initialLeaveGrant.allocated),
            used: 0,
            carriedForward: 0,
            remaining: Number(data.initialLeaveGrant.allocated),
          },
        });
      }

      const userRoles = user.roles.map((r) => r.role);
      return {
        ...employee,
        user: {
          id: user.id,
          email: user.email,
          personalEmail: user.personalEmail,
          roles: userRoles,
          role: userRoles[0] ?? UserRole.EMPLOYEE,
          isActive: user.isActive,
          mustChangePassword: user.mustChangePassword,
          authProvider: user.authProvider,
        },
      };
    });
  }

  async findById(employeeId: string, companyId: string) {
    const emp = await prisma.employeeProfile.findFirst({
      where: { id: employeeId, companyId },
      include: {
        user: { select: { id: true, email: true, personalEmail: true, roles: { select: { role: true } }, isActive: true } },
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
        secondaryManager: {
          select: {
            id: true,
            displayName: true,
            employeeCode: true,
            designation: { select: { id: true, name: true } },
          },
        },
        subordinates: { select: { id: true, displayName: true, employeeCode: true } },
        secondarySubordinates: { select: { id: true, displayName: true, employeeCode: true } },
      },
    });
    return emp ? mapEmployeeWithUserRoles(emp) : null;
  }

  async listEmployees(companyId: string, status?: string) {
    const employees = await prisma.employeeProfile.findMany({
      where: {
        companyId,
        ...(status === "ACTIVE" ? { isActive: true } : {}),
        ...(status === "INACTIVE" ? { isActive: false } : {}),
      },
      orderBy: { employeeCode: "asc" },
      include: {
        user: { select: { id: true, email: true, personalEmail: true, roles: { select: { role: true } }, isActive: true } },
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
        secondaryManager: {
          select: {
            id: true,
            displayName: true,
            employeeCode: true,
            designation: { select: { id: true, name: true } },
          },
        },
      },
    });
    return employees.map((emp) => mapEmployeeWithUserRoles(emp));
  }

  async updateEmployee(
    employeeId: string,
    companyId: string,
    data: UpdateEmployeeData
  ) {
    const { personalEmail, ...profileData } = data;

    // If personalEmail is provided, update associated user
    if (personalEmail !== undefined) {
      const emp = await prisma.employeeProfile.findUnique({
        where: { id: employeeId },
        select: { userId: true },
      });
      if (emp?.userId) {
        await prisma.user.update({
          where: { id: emp.userId },
          data: { personalEmail: personalEmail ?? null },
        });
      }
    }

    const updatePayload: Record<string, any> = {};
    if (profileData.departmentId !== undefined) updatePayload.departmentId = profileData.departmentId;
    if (profileData.teamId !== undefined) updatePayload.teamId = profileData.teamId;
    if (profileData.designationId !== undefined) updatePayload.designationId = profileData.designationId;
    if (profileData.firstName !== undefined) updatePayload.firstName = profileData.firstName;
    if (profileData.middleName !== undefined) updatePayload.middleName = profileData.middleName;
    if (profileData.lastName !== undefined) updatePayload.lastName = profileData.lastName;
    if (profileData.displayName !== undefined) updatePayload.displayName = profileData.displayName;
    if (profileData.phone !== undefined) updatePayload.phone = profileData.phone;
    if (profileData.gender !== undefined) updatePayload.gender = profileData.gender;
    if (profileData.dateOfBirth !== undefined) updatePayload.dateOfBirth = profileData.dateOfBirth;
    if (profileData.joiningDate !== undefined) updatePayload.joiningDate = profileData.joiningDate;
    if (profileData.isProbation !== undefined) updatePayload.isProbation = profileData.isProbation;
    if (profileData.isActive !== undefined) updatePayload.isActive = profileData.isActive;
    if (profileData.managerId !== undefined) updatePayload.managerId = profileData.managerId;
    if (profileData.secondaryManagerId !== undefined) updatePayload.secondaryManagerId = profileData.secondaryManagerId;

    const updated = await prisma.employeeProfile.update({
      where: { id: employeeId },
      data: updatePayload,
      include: {
        user: { select: { id: true, email: true, personalEmail: true, roles: { select: { role: true } }, isActive: true } },
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
        manager: {
          select: {
            id: true,
            displayName: true,
            employeeCode: true,
            designation: { select: { id: true, name: true } },
          },
        },
        secondaryManager: {
          select: {
            id: true,
            displayName: true,
            employeeCode: true,
            designation: { select: { id: true, name: true } },
          },
        },
      },
    });
    return mapEmployeeWithUserRoles(updated);
  }

  async changeManager(
    employeeId: string,
    companyId: string,
    managerId?: string | null
  ) {
    const updated = await prisma.employeeProfile.update({
      where: { id: employeeId },
      data: { managerId: managerId ?? null },
      include: {
        user: { select: { id: true, email: true, personalEmail: true, roles: { select: { role: true } }, isActive: true } },
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
        manager: {
          select: {
            id: true,
            displayName: true,
            employeeCode: true,
            designation: { select: { id: true, name: true } },
          },
        },
        secondaryManager: {
          select: {
            id: true,
            displayName: true,
            employeeCode: true,
            designation: { select: { id: true, name: true } },
          },
        },
      },
    });
    return mapEmployeeWithUserRoles(updated);
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
        user: { select: { id: true, email: true, personalEmail: true, roles: { select: { role: true } }, isActive: true } },
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
        secondaryManager: {
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
        secondarySubordinates: {
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
      ...mapEmployeeWithUserRoles(employee),
      peers,
    };
  }
}
