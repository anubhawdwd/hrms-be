// src/modules/superadmin/repository.ts
import { prisma } from "../../config/prisma.js";
import { AuthProvider, UserRole } from "../../generated/prisma/enums.js";

export class SuperAdminRepository {
  async create(email: string, passwordHash: string) {
    const user = await prisma.user.create({
      data: {
        email: email.trim().toLowerCase(),
        passwordHash,
        roles: {
          create: [{ role: UserRole.SUPER_ADMIN }],
        },
        authProvider: AuthProvider.LOCAL,
        companyId: null,
        isActive: true,
        mustChangePassword: true,
      },
      select: {
        id: true,
        email: true,
        roles: { select: { role: true } },
        companyId: true,
        isActive: true,
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const roles = user.roles.map((r) => r.role);
    return {
      ...user,
      roles,
      role: roles[0] ?? UserRole.SUPER_ADMIN,
    };
  }

  async list() {
    const users = await prisma.user.findMany({
      where: {
        roles: { some: { role: UserRole.SUPER_ADMIN } },
      },
      select: {
        id: true,
        email: true,
        roles: { select: { role: true } },
        companyId: true,
        isActive: true,
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return users.map((u) => {
      const roles = u.roles.map((r) => r.role);
      return {
        ...u,
        roles,
        role: roles[0] ?? UserRole.SUPER_ADMIN,
      };
    });
  }


  async findById(userId: string) {
    return prisma.user.findFirst({
      where: {
        id: userId,
      },
      include: {
        roles: { select: { role: true } },
      },
    });
  }

  async findByEmail(email: string) {
    return prisma.user.findFirst({
      where: {
        email: email.trim().toLowerCase(),
      },
      include: {
        roles: { select: { role: true } },
      },
    });
  }

  async countActive() {
    return prisma.user.count({
      where: {
        roles: { some: { role: UserRole.SUPER_ADMIN } },
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
