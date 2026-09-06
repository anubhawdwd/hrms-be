// src/modules/superadmin/service.ts
import bcrypt from "bcrypt";
import { SuperAdminRepository } from "./repository.js";
import type { CreateSuperAdminDTO } from "./types.js";
import { generateTemporaryPassword } from "../../utils/password.js";
import { UserRole } from "../../generated/prisma/enums.js";

const repo = new SuperAdminRepository();

export class SuperAdminService {
  async createSuperAdmin(dto: CreateSuperAdminDTO) {
    const email = dto.email?.trim().toLowerCase();
    if (!email) {
      throw new Error("Email is required");
    }

    const existing = await repo.findByEmail(email);
    if (existing) {
      throw new Error("User with this email already exists");
    }

    let temporaryPassword = dto.password?.trim();
    if (temporaryPassword) {
      if (temporaryPassword.length < 6) {
        throw new Error("Password must be at least 6 characters long");
      }
    } else {
      temporaryPassword = generateTemporaryPassword();
    }

    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const user = await repo.create(email, passwordHash);

    return {
      user,
      temporaryPassword,
    };
  }

  async listSuperAdmins() {
    return repo.list();
  }

  async resetSuperAdminPassword(userId: string, manualPassword?: string) {
    const user = await repo.findById(userId);

    if (!user) {
      throw new Error("SuperAdmin not found");
    }

    if (!user.roles.some((r) => r.role === UserRole.SUPER_ADMIN) || user.companyId !== null) {
      throw new Error("Target user is not a SuperAdmin");
    }

    if (!user.isActive) {
      throw new Error("Cannot reset password for inactive SuperAdmin");
    }

    let temporaryPassword = manualPassword?.trim();
    if (temporaryPassword) {
      if (temporaryPassword.length < 6) {
        throw new Error("Password must be at least 6 characters long");
      }
    } else {
      temporaryPassword = generateTemporaryPassword();
    }

    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    await repo.updatePassword(userId, passwordHash);
    await repo.deleteAllRefreshTokens(userId);

    return {
      message: "SuperAdmin password reset successfully",
      temporaryPassword,
    };
  }

  async deactivateSuperAdmin(userId: string) {
    const user = await repo.findById(userId);
    if (!user) {
      throw new Error("SuperAdmin not found");
    }

    if (!user.roles.some((r) => r.role === UserRole.SUPER_ADMIN) || user.companyId !== null) {
      throw new Error("Target user is not a SuperAdmin");
    }

    if (!user.isActive) {
      throw new Error("SuperAdmin account is already inactive");
    }

    const activeCount = await repo.countActive();
    if (activeCount <= 1) {
      throw new Error("Cannot deactivate the last active SuperAdmin account");
    }

    await repo.deactivate(userId);
    await repo.deleteAllRefreshTokens(userId);

    return {
      message: "SuperAdmin account deactivated successfully",
    };
  }
}
