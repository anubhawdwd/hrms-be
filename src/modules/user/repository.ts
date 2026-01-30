// src/modules/user/repository.ts

import { prisma } from "../../config/prisma.js";
import { AuthProvider } from "../../generated/prisma/enums.js";

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
    authProvider: AuthProvider
  ) {
    return prisma.user.create({
      data: {
        email,
        authProvider,
        company: {
          connect: { id: companyId },
        },
      },
    });
  }

  async listUsers(companyId: string) {
    return prisma.user.findMany({
      where: { companyId },
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
