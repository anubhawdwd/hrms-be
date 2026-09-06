// src/modules/auth/repository.ts
import { prisma } from "../../config/prisma.js";

export class AuthRepository {
  findCompanyById(companyId?: string | null) {
    if (!companyId) return null;
    return prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, isActive: true, usesTeams: true },
    });
  }

  findActiveOfficeLocation(companyId?: string | null) {
    if (!companyId) return null;
    return prisma.officeLocation.findFirst({
      where: { companyId, isActive: true },
      select: { geoFencingEnabled: true },
    });
  }

  findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: { roles: { select: { role: true } } },
    });
  }

  findUserById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { select: { role: true } } },
    });
  }

  createRefreshToken(params: {
    userId: string;
    token: string;
    expiresAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }) {
    return prisma.refreshToken.create({
      data: {
        userId: params.userId,
        token: params.token,
        expiresAt: params.expiresAt,
        userAgent: params.userAgent ?? null,
        ipAddress: params.ipAddress ?? null,
      },
    });
  }

  findRefreshToken(token: string) {
    return prisma.refreshToken.findUnique({
      where: { token },
      include: {
        user: {
          include: { roles: { select: { role: true } } },
        },
      },
    });
  }

  deleteRefreshToken(token: string) {
    return prisma.refreshToken.delete({ where: { token } });
  }

  deleteAllRefreshTokensByUser(userId: string) {
    return prisma.refreshToken.deleteMany({ where: { userId } });
  }

  updatePassword(userId: string, passwordHash: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    });
  }

  clearMustChangePassword(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        mustChangePassword: false,
      },
    });
  }
}