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

    return repo.createCompany(name);
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
}
