// src/modules/user/service.ts

import { UserRepository } from "./repository.js";
import type { CreateUserDTO, ListUsersDTO, UpdateUserDTO } from "./types.js";
import { AuthProvider } from "../../generated/prisma/enums.js";

const repo = new UserRepository();

export class UserService {
  async createUser(dto: CreateUserDTO) {
    const email = dto.email?.trim().toLowerCase();

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

    return repo.createUser(email, dto.companyId, dto.authProvider);
  }

  async listUsers(dto: ListUsersDTO) {
    return repo.listUsers(dto.companyId);
  }

  async updateUser(dto: UpdateUserDTO) {
    if (!dto.email && !dto.authProvider) {
      throw new Error("Nothing to update");
    }

    if (
      dto.authProvider &&
      !Object.values(AuthProvider).includes(dto.authProvider)
    ) {
      throw new Error("Invalid auth provider");
    }

    const result = await repo.updateUser(
      dto.userId,
      dto.companyId,
      {
        ...(dto.email && { email: dto.email.trim().toLowerCase() }),
        ...(dto.authProvider && { authProvider: dto.authProvider }),
      }
    );

    if (result.count === 0) {
      throw new Error("User not found or inactive");
    }

    return { message: "User updated successfully" };
  }

  async deactivateUser(userId: string, companyId: string) {
    const result = await repo.deactivateUser(userId, companyId);

    if (result.count === 0) {
      throw new Error("User not found");
    }

    return { message: "User deactivated successfully" };
  }

}

