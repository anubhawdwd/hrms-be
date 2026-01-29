// src/modules/company/repository.ts

import { prisma } from "../../config/prisma.js";

export class CompanyRepository {
  async createCompany(name: string) {
    return prisma.company.create({
      data: {
        name,
      },
    });
  }

  async findByName(name: string) {
    return prisma.company.findUnique({
      where: { name },
    });
  }

  async findById(id: string) {
    return prisma.company.findUnique({
      where: { id },
    });
  }

  async updateCompany(
    id: string,
    data: {
      isActive?: boolean;
      logGeoFenceViolations?: boolean;
    }
  ) {
    return prisma.company.update({
      where: { id },
      data,
    });
  }
}
