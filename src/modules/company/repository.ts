// src/modules/company/repository.ts

import bcrypt from "bcrypt";
import { prisma } from "../../config/prisma.js";
import { AuthProvider, UserRole } from "../../generated/prisma/enums.js";

export class CompanyRepository {
  async createCompany(name: string, adminEmail?: string, adminPassword?: string) {
    if (!adminEmail) {
      const company = await prisma.company.create({
        data: {
          name,
        },
      });
      return {
        ...company,
        admins: [],
      };
    }

    let rawPassword = adminPassword?.trim();
    let mustChangePassword = false;

    if (rawPassword) {
      if (rawPassword.length < 6) {
        throw new Error("Password must be at least 6 characters long");
      }
    } else {
      const { generateTemporaryPassword } = await import("../../utils/password.js");
      rawPassword = generateTemporaryPassword();
      mustChangePassword = true;
    }

    const passwordHash = await bcrypt.hash(rawPassword, 12);

    return prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name,
        },
      });

      const adminUser = await tx.user.create({
        data: {
          email: adminEmail.trim().toLowerCase(),
          passwordHash,
          roles: {
            create: [{ role: UserRole.COMPANY_ADMIN }],
          },
          authProvider: AuthProvider.LOCAL,
          companyId: company.id,
          isActive: true,
          mustChangePassword,
        },
        select: {
          id: true,
          email: true,
          roles: { select: { role: true } },
          companyId: true,
          isActive: true,
          createdAt: true,
        },
      });

      const mappedAdmin = {
        ...adminUser,
        roles: adminUser.roles.map((r) => r.role),
        role: adminUser.roles[0]?.role ?? UserRole.COMPANY_ADMIN,
      };

      return {
        ...company,
        admins: [mappedAdmin],
        adminPassword: rawPassword,
        temporaryPassword: rawPassword,
      };
    });
  }


  async listCompanies() {
    const companies = await prisma.company.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        users: {
          where: { roles: { some: { role: UserRole.COMPANY_ADMIN } } },
          select: {
            id: true,
            email: true,
            roles: { select: { role: true } },
            companyId: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
    });

    return companies.map((c) => ({
      id: c.id,
      name: c.name,
      isActive: c.isActive,
      logGeoFenceViolations: c.logGeoFenceViolations,
      createdAt: c.createdAt,
      admins: c.users.map((u) => {
        const roles = u.roles.map((r) => r.role);
        return {
          ...u,
          roles,
          role: roles[0] ?? UserRole.COMPANY_ADMIN,
        };
      }),
    }));
  }

  async findByName(name: string) {
    return prisma.company.findUnique({
      where: { name },
    });
  }

  async findById(id: string) {
    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        users: {
          where: { roles: { some: { role: UserRole.COMPANY_ADMIN } } },
          select: {
            id: true,
            email: true,
            roles: { select: { role: true } },
            companyId: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
    });

    if (!company) return null;

    return {
      id: company.id,
      name: company.name,
      isActive: company.isActive,
      logGeoFenceViolations: company.logGeoFenceViolations,
      createdAt: company.createdAt,
      admins: company.users.map((u) => {
        const roles = u.roles.map((r) => r.role);
        return {
          ...u,
          roles,
          role: roles[0] ?? UserRole.COMPANY_ADMIN,
        };
      }),
    };
  }

  async updateCompany(
    id: string,
    data: {
      isActive?: boolean;
      logGeoFenceViolations?: boolean;
    }
  ) {
    return prisma.company.update({
      where: { id },
      data,
    });
  }

  async findCompanyUsers(companyId: string) {
    const users = await prisma.user.findMany({
      where: { companyId },
      select: {
        id: true,
        email: true,
        roles: { select: { role: true } },
        companyId: true,
        isActive: true,
        mustChangePassword: true,
        createdAt: true,
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            displayName: true,
            department: { select: { name: true } },
            designation: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return users.map((u) => {
      const roles = u.roles.map((r) => r.role);
      return {
        ...u,
        roles,
        role: roles[0] ?? UserRole.EMPLOYEE,
      };
    });
  }

  async findCompanyUser(companyId: string, userId: string) {
    return prisma.user.findFirst({
      where: {
        id: userId,
        companyId,
      },
    });
  }

  async updateCompanyUserPassword(userId: string, passwordHash: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: true,
      },
    });
  }

  async deleteAllRefreshTokensByUser(userId: string) {
    return prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }
}
