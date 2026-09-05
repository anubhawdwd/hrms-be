import bcrypt from "bcrypt";
import { prisma } from "../../config/prisma.js";
import { UserRepository } from "./repository.js";
import type { CreateUserDTO, ListUsersDTO, UpdateUserDTO, UpdateUserEmailDTO } from "./types.js";
import { AuthProvider, UserRole } from "../../generated/prisma/enums.js";
import { generateTemporaryPassword } from "../../utils/password.js";

const repo = new UserRepository();

export class UserService {
  async createUser(dto: CreateUserDTO) {
    const email = dto.email?.trim().toLowerCase();

    const role = dto.role && Object.values(UserRole).includes(dto.role)
      ? dto.role
      : UserRole.EMPLOYEE;

    if (!email) {
      throw new Error("Email is required");
    }

    if (!Object.values(AuthProvider).includes(dto.authProvider)) {
      throw new Error("Invalid auth provider");
    }

    const existing = await repo.findByEmail(email, dto.companyId);
    if (existing) {
      throw new Error("User already exists in this company");
    }
    return repo.createUser(email, dto.companyId, dto.authProvider, role);
  }

  async listUsers(dto: ListUsersDTO) {
    return repo.listUsers(dto.companyId);
  }

  async updateUserEmail(dto: UpdateUserEmailDTO) {
    const newEmail = dto.email?.trim().toLowerCase();
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      throw new Error("Valid email is required");
    }

    const user = dto.companyId
      ? await repo.findById(dto.userId, dto.companyId)
      : await repo.findById(dto.userId);

    if (!user) {
      throw new Error("User not found or inactive");
    }
    if (!user.isActive) {
      throw new Error("Cannot update email for inactive user");
    }

    if (user.authProvider !== AuthProvider.LOCAL) {
      throw new Error("Email is managed by your SSO provider for this account");
    }

    if (user.email.toLowerCase() === newEmail) {
      return { message: "Email is already up to date" };
    }

    // Global uniqueness validation across all companies
    const existing = await prisma.user.findFirst({
      where: {
        email: newEmail,
        NOT: { id: dto.userId },
      },
    });
    if (existing) {
      const err: any = new Error(`A user with email '${newEmail}' already exists`);
      err.statusCode = 409;
      throw err;
    }

    // Update email
    await prisma.user.update({
      where: { id: dto.userId },
      data: { email: newEmail },
    });

    // Invalidate existing sessions
    await repo.deleteAllRefreshTokensByUser(dto.userId);

    // Persist audit record
    await prisma.auditLog.create({
      data: {
        action: "USER_EMAIL_UPDATE",
        actorId: dto.actorUserId ?? null,
        targetId: dto.userId,
        companyId: user.companyId ?? dto.companyId ?? null,
        details: {
          oldEmail: user.email,
          newEmail,
        },
      },
    });

    return { message: "User email updated successfully" };
  }

  async updateUser(dto: UpdateUserDTO) {
    if (!dto.email && !dto.authProvider && !dto.role) {
      throw new Error("Nothing to update");
    }

    if (
      dto.authProvider &&
      !Object.values(AuthProvider).includes(dto.authProvider)
    ) {
      throw new Error("Invalid auth provider");
    }

    if (
      dto.role &&
      !Object.values(UserRole).includes(dto.role)
    ) {
      throw new Error("Invalid role");
    }

    if (dto.email) {
      await this.updateUserEmail({
        userId: dto.userId,
        companyId: dto.companyId,
        email: dto.email,
        actorUserId: dto.actorUserId,
      });
    }

    if (dto.authProvider || dto.role) {
      const result = await repo.updateUser(
        dto.userId,
        dto.companyId,
        {
          ...(dto.authProvider && { authProvider: dto.authProvider }),
          ...(dto.role && { role: dto.role }),
        }
      );

      if (result.count === 0) {
        throw new Error("User not found or inactive");
      }
    }

    return { message: "User updated successfully" };
  }

  async resetPassword(dto: { userId: string; companyId?: string | null; manualPassword?: string }) {
    const user = dto.companyId
      ? await repo.findById(dto.userId, dto.companyId)
      : await repo.findById(dto.userId);
    if (!user) {
      throw new Error("User not found");
    }
    if (!user.isActive) {
      throw new Error("Cannot reset password for inactive user");
    }

    let temporaryPassword = dto.manualPassword?.trim();
    if (temporaryPassword) {
      if (temporaryPassword.length < 6) {
        throw new Error("Password must be at least 6 characters long");
      }
    } else {
      temporaryPassword = generateTemporaryPassword();
    }

    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    await repo.resetPassword(dto.userId, dto.companyId, passwordHash);
    await repo.deleteAllRefreshTokensByUser(dto.userId);

    // Return temporary password once to the requesting admin (do NOT log or persist in plaintext)
    return {
      message: "Password reset successfully",
      temporaryPassword,
    };
  }

  async deactivateUser(userId: string, companyId: string) {
    const result = await repo.deactivateUser(userId, companyId);

    if (result.count === 0) {
      throw new Error("User not found");
    }

    return { message: "User deactivated successfully" };
  }

}

