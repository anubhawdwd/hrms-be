// src/modules/user/service.ts

import { UserRepository } from "./repository.js";
import type { CreateUserDTO, ListUsersDTO } from "./types.js";
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
}
