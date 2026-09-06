// src/modules/user/repository.ts

import { prisma } from "../../config/prisma.js";
import { AuthProvider, UserRole } from "../../generated/prisma/enums.js";

export class UserRepository {
  async findByEmail(email: string, companyId: string) {
    return prisma.user.findFirst({
      where: {
        email,
        companyId,
      },
    });
  }

  async createUser(
    email: string,
    companyId: string,
    authProvider: AuthProvider,
    roles: UserRole[]
  ) {
    return prisma.user.create({
      data: {
        email,
        authProvider,
        company: {
          connect: { id: companyId },
        },
        roles: {
          create: roles.map((role) => ({ role })),
        },
      },
      include: {
        roles: { select: { role: true } },
      },
    });
  }

  async listUsers(companyId: string) {
    return prisma.user.findMany({
      where: { companyId },
      select: {
        id: true,
        email: true,
        companyId: true,
        authProvider: true,
        roles: {
          select: { role: true },
        },
        isActive: true,
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
        employee: {
          select: {
            id: true,
            employeeCode: true,
            displayName: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
            designation: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async updateUser(
    userId: string,
    companyId: string,
    data: {
      email?: string;
      authProvider?: AuthProvider;
    }
  ) {
    return prisma.user.updateMany({
      where: {
        id: userId,
        companyId,
        isActive: true,
      },
      data,
    });
  }

  async updateUserRoles(
    userId: string,
    companyId: string,
    targetRoles: UserRole[]
  ) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: userId, companyId, isActive: true },
        include: { roles: true },
      });
      if (!user) {
        throw new Error("User not found or inactive");
      }

      const currentRoles = user.roles.map((r) => r.role);
      const rolesToDelete = currentRoles.filter((r) => !targetRoles.includes(r));
      const rolesToAdd = targetRoles.filter((r) => !currentRoles.includes(r));

      if (rolesToDelete.length > 0) {
        await tx.userRoleAssignment.deleteMany({
          where: {
            userId,
            role: { in: rolesToDelete },
          },
        });
      }

      if (rolesToAdd.length > 0) {
        await tx.userRoleAssignment.createMany({
          data: rolesToAdd.map((role) => ({
            userId,
            role,
          })),
        });
      }

      return true;
    });
  }

  async findById(userId: string, companyId?: string | null) {
    return prisma.user.findFirst({
      where: {
        id: userId,
        ...(companyId ? { companyId } : {}),
      },
      include: {
        roles: { select: { role: true } },
      },
    });
  }

  async resetPassword(
    userId: string,
    companyId: string | null | undefined,
    passwordHash: string
  ) {
    return prisma.user.updateMany({
      where: {
        id: userId,
        ...(companyId ? { companyId } : {}),
        isActive: true,
      },
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

  async deactivateUser(userId: string, companyId: string) {
    return prisma.user.updateMany({
      where: {
        id: userId,
        companyId,
      },
      data: {
        isActive: false,
      },
    });
  }
}
