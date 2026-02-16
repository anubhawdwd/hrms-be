// src/modules/company/types.ts
export interface CreateCompanyDTO {
  name: string;
}

export interface UpdateCompanyDTO {
  logGeoFenceViolations?: boolean;
  isActive?: boolean;
}
