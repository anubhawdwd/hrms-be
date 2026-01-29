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
}
