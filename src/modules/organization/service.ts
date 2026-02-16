// src/modules/organization/service.ts
import { OrganizationRepository } from "./repository.js";
import type {
  CreateDepartmentDTO,
  CreateTeamDTO,
  CreateDesignationDTO,
  UpsertDesignationAttendancePolicyDTO,
} from "./types.js";

const repo = new OrganizationRepository();

export class OrganizationService {
  // =================== DEPARTMENTS ===================

  async createDepartment(dto: CreateDepartmentDTO) {
    if (!dto.name.trim()) throw new Error("Department name is required");
    return repo.createDepartment(dto.name, dto.companyId);
  }

  async listDepartments(companyId: string) {
    return repo.getDepartments(companyId);
  }

  async updateDepartment(
    companyId: string,
    departmentId: string,
    name: string
  ) {
    if (!name.trim()) throw new Error("Name required");
    return repo.updateDepartment(departmentId, companyId, name.trim());
  }

  async deactivateDepartment(companyId: string, departmentId: string) {
    return repo.deactivateDepartment(departmentId, companyId);
  }

  // =================== TEAMS ===================

  async createTeam(dto: CreateTeamDTO) {
    if (!dto.name.trim()) throw new Error("Team name is required");
    return repo.createTeam(dto.name, dto.departmentId, dto.companyId);
  }

  async listTeams(departmentId: string, companyId: string) {
    return repo.getTeamsByDepartment(departmentId, companyId);
  }

  async updateTeam(
    companyId: string,
    teamId: string,
    data: { name?: string; departmentId?: string }
  ) {
    if (!data.name && !data.departmentId) {
      throw new Error("Nothing to update");
    }
    if (data.name && !data.name.trim()) {
      throw new Error("Team name cannot be empty");
    }

    return repo.updateTeam(teamId, companyId, {
      ...(data.name && { name: data.name.trim() }),
      ...(data.departmentId && { departmentId: data.departmentId }),
    });
  }

  async deactivateTeam(companyId: string, teamId: string) {
    return repo.deactivateTeam(teamId, companyId);
  }

  // =================== DESIGNATIONS ===================

  async createDesignation(dto: CreateDesignationDTO) {
    if (!dto.name.trim()) throw new Error("Designation name is required");
    return repo.createDesignation(dto.name, dto.companyId);
  }

  async listDesignations(companyId: string) {
    return repo.getDesignations(companyId);
  }

  async updateDesignation(
    companyId: string,
    designationId: string,
    name: string
  ) {
    if (!name.trim()) throw new Error("Designation name is required");
    return repo.updateDesignation(designationId, companyId, name.trim());
  }

  async deactivateDesignation(companyId: string, designationId: string) {
    return repo.deactivateDesignation(designationId, companyId);
  }

  // =================== OFFICE LOCATION ===================

  async setOfficeLocation(
    companyId: string,
    latitude: number,
    longitude: number,
    radiusM: number
  ) {
    if (radiusM <= 0) throw new Error("Radius must be positive greater than 0");
    return repo.upsertOfficeLocation(companyId, latitude, longitude, radiusM);
  }

  async getOfficeLocation(companyId: string) {
    return repo.getActiveOfficeLocation(companyId);
  }

  // =================== DESIGNATION ATTENDANCE POLICY ===================

  async upsertDesignationAttendancePolicy(
    dto: UpsertDesignationAttendancePolicyDTO,
    companyId: string
  ) {
    if (dto.autoPresent && dto.attendanceExempt) {
      throw new Error("autoPresent and attendanceExempt cannot both be true");
    }
    return repo.upsertDesignationAttendancePolicy(
      companyId,
      dto.designationId,
      dto.autoPresent,
      dto.attendanceExempt
    );
  }

  async listDesignationAttendancePolicies(companyId: string) {
    return repo.getDesignationAttendancePolicies(companyId);
  }

  async getDesignationAttendancePolicy(
    companyId: string,
    designationId: string
  ) {
    return repo.getDesignationAttendancePolicy(companyId, designationId);
  }
}
