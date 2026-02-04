import { prisma } from "../../config/prisma.js";

export class AuthRepository {

  // ---------- USERS ----------

  findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  findUserById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
    });
  }

  // ---------- REFRESH TOKENS ----------

  createRefreshToken(params: {
    userId: string;
    token: string;
    expiresAt: Date;
  }) {
    return prisma.refreshToken.create({
      data: {
        userId: params.userId,
        token: params.token,
        expiresAt: params.expiresAt,
      },
    });
  }

  findRefreshToken(token: string) {
    return prisma.refreshToken.findUnique({
      where: { token },
      include: {
        user: true,
      },
    });
  }

  deleteRefreshToken(token: string) {
    return prisma.refreshToken.delete({
      where: { token },
    });
  }

  deleteAllRefreshTokensForUser(userId: string) {
    return prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }
}
