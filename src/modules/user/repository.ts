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
    role: UserRole
  ) {
    return prisma.user.create({
      data: {
        email,
        authProvider,
        role,
        company: {
          connect: { id: companyId },
        },
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
        role: true,
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
      role?: UserRole;
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

  async findById(userId: string, companyId?: string | null) {
    return prisma.user.findFirst({
      where: {
        id: userId,
        ...(companyId ? { companyId } : {}),
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
