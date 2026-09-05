// src/modules/company/service.ts

import { CompanyRepository } from "./repository.js";
import type { CreateCompanyDTO, UpdateCompanyDTO } from "./types.js";

const repo = new CompanyRepository();

export class CompanyService {
  async createCompany(dto: CreateCompanyDTO) {
    const name = dto.name?.trim();

    if (!name) {
      throw new Error("Company name is required");
    }

    const existing = await repo.findByName(name);
    if (existing) {
      throw new Error("Company with this name already exists");
    }

    return repo.createCompany(name, dto.adminEmail, dto.adminPassword);
  }

  async listCompanies() {
    return repo.listCompanies();
  }

  async getCompany(companyId: string) {
    const company = await repo.findById(companyId);

    if (!company) {
      throw new Error("Company not found");
    }

    return company;
  }

  async updateCompany(companyId: string, dto: UpdateCompanyDTO) {
    const company = await repo.findById(companyId);

    if (!company) {
      throw new Error("Company not found");
    }

    return repo.updateCompany(companyId, dto);
  }

  async getCompanyUsers(companyId: string) {
    const company = await repo.findById(companyId);
    if (!company) {
      throw new Error("Company not found");
    }

    return repo.findCompanyUsers(companyId);
  }

  async resetCompanyUserPassword(companyId: string, userId: string, manualPassword?: string) {
    const company = await repo.findById(companyId);
    if (!company) {
      throw new Error("Company not found");
    }

    const user = await repo.findCompanyUser(companyId, userId);
    if (!user) {
      throw new Error("User not found in specified company");
    }

    if (!user.isActive) {
      throw new Error("Cannot reset password for inactive user");
    }

    let temporaryPassword = manualPassword?.trim();
    if (temporaryPassword) {
      if (temporaryPassword.length < 6) {
        throw new Error("Password must be at least 6 characters long");
      }
    } else {
      const { generateTemporaryPassword } = await import("../../utils/password.js");
      temporaryPassword = generateTemporaryPassword();
    }

    const bcrypt = await import("bcrypt");
    const passwordHash = await bcrypt.default.hash(temporaryPassword, 12);

    await repo.updateCompanyUserPassword(userId, passwordHash);
    await repo.deleteAllRefreshTokensByUser(userId);

    return {
      message: "Password reset successfully",
      temporaryPassword,
    };
  }
}
