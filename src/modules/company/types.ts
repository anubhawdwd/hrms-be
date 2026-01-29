export interface CreateCompanyDTO {
  name: string;
}

export interface UpdateCompanyDTO {
  logGeoFenceViolations?: boolean;
  isActive?: boolean;
}
