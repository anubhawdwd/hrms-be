// src/modules/superadmin/repository.ts
import { prisma } from "../../config/prisma.js";
import { AuthProvider, UserRole } from "../../generated/prisma/enums.js";

export class SuperAdminRepository {
  async create(email: string, passwordHash: string) {
    return prisma.user.create({
      data: {
        email: email.trim().toLowerCase(),
        passwordHash,
        role: UserRole.SUPER_ADMIN,
        authProvider: AuthProvider.LOCAL,
        companyId: null,
        isActive: true,
        mustChangePassword: true,
      },
      select: {
        id: true,
        email: true,
        role: true,
        companyId: true,
        isActive: true,
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async list() {
    return prisma.user.findMany({
      where: {
        role: UserRole.SUPER_ADMIN,
      },
      select: {
        id: true,
        email: true,
        role: true,
        companyId: true,
        isActive: true,
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }


  async findById(userId: string) {
    return prisma.user.findFirst({
      where: {
        id: userId,
      },
    });
  }

  async findByEmail(email: string) {
    return prisma.user.findFirst({
      where: {
        email: email.trim().toLowerCase(),
      },
    });
  }

  async countActive() {
    return prisma.user.count({
      where: {
        role: UserRole.SUPER_ADMIN,
        isActive: true,
        companyId: null,
      },
    });
  }

  async updatePassword(userId: string, passwordHash: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: true,
      },
    });
  }

  async deactivate(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
      },
    });
  }

  async deleteAllRefreshTokens(userId: string) {
    return prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }
}
