// src/modules/company/types.ts
export interface CreateCompanyDTO {
  name: string;
  adminEmail?: string;
  adminPassword?: string;
}

export interface UpdateCompanyDTO {
  logGeoFenceViolations?: boolean;
  isActive?: boolean;
}
