// src/modules/organization/service.ts
import { OrganizationRepository } from "./repository.js";
import { prisma } from "../../config/prisma.js";
import type {
  CreateDepartmentDTO,
  CreateTeamDTO,
  CreateDesignationDTO,
  UpsertDesignationAttendancePolicyDTO,
} from "./types.js";

const repo = new OrganizationRepository();

export class OrganizationService {
  // =================== COMPANY SETTINGS ===================

  async getTeamsSetting(companyId: string) {
    return repo.getTeamsSetting(companyId);
  }

  async updateTeamsSetting(companyId: string, usesTeams: boolean) {
    return repo.updateTeamsSetting(companyId, Boolean(usesTeams));
  }

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
    radiusM: number,
    geoFencingEnabled: boolean = true
  ) {
    if (radiusM <= 0) throw new Error("Radius must be positive greater than 0");
    return repo.upsertOfficeLocation(
      companyId,
      latitude,
      longitude,
      radiusM,
      geoFencingEnabled
    );
  }

  async updateOfficeLocation(
    companyId: string,
    data: {
      latitude?: number;
      longitude?: number;
      radiusM?: number;
      geoFencingEnabled?: boolean;
    }
  ) {
    if (data.radiusM !== undefined && data.radiusM <= 0) {
      throw new Error("Radius must be positive greater than 0");
    }
    return repo.patchOfficeLocation(companyId, data);
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

  // =================== WORKING HOURS CONFIG ===================

  async getWorkingHoursConfig(companyId: string) {
    return repo.getWorkingHoursConfig(companyId);
  }

  async updateWorkingHoursConfig(
    companyId: string,
    dto: {
      workingMinutes?: number;
      lunchMinutes?: number;
      breakMinutes?: number;
      graceMinutes?: number;
      workWeekDays?: number;
      sandwichRuleEnabled?: boolean;
    }
  ) {
    if (dto.workingMinutes !== undefined) {
      if (
        typeof dto.workingMinutes !== "number" ||
        dto.workingMinutes < 60 ||
        dto.workingMinutes > 1440
      ) {
        throw new Error(
          "Working minutes must be an integer between 60 (1 hour) and 1440 (24 hours)"
        );
      }
    }

    if (dto.lunchMinutes !== undefined) {
      if (
        typeof dto.lunchMinutes !== "number" ||
        dto.lunchMinutes < 0 ||
        dto.lunchMinutes > 240
      ) {
        throw new Error(
          "Lunch duration must be an integer between 0 and 240 minutes (4 hours)"
        );
      }
    }

    if (dto.breakMinutes !== undefined) {
      if (
        typeof dto.breakMinutes !== "number" ||
        dto.breakMinutes < 0 ||
        dto.breakMinutes > 240
      ) {
        throw new Error(
          "Break duration must be an integer between 0 and 240 minutes (4 hours)"
        );
      }
    }

    if (dto.graceMinutes !== undefined) {
      if (
        typeof dto.graceMinutes !== "number" ||
        dto.graceMinutes < 0 ||
        dto.graceMinutes > 120
      ) {
        throw new Error(
          "Grace period must be an integer between 0 and 120 minutes (2 hours)"
        );
      }
    }

    if (dto.workWeekDays !== undefined) {
      if (![5, 6].includes(dto.workWeekDays)) {
        throw new Error("Working week must be either 5 days or 6 days");
      }
    }

    if (dto.sandwichRuleEnabled !== undefined) {
      if (typeof dto.sandwichRuleEnabled !== "boolean") {
        throw new Error("sandwichRuleEnabled must be a boolean");
      }
    }

    return repo.updateWorkingHoursConfig(companyId, {
      ...(dto.workingMinutes !== undefined && {
        workingMinutes: Math.round(dto.workingMinutes),
      }),
      ...(dto.lunchMinutes !== undefined && {
        lunchMinutes: Math.round(dto.lunchMinutes),
      }),
      ...(dto.breakMinutes !== undefined && {
        breakMinutes: Math.round(dto.breakMinutes),
      }),
      ...(dto.graceMinutes !== undefined && {
        graceMinutes: Math.round(dto.graceMinutes),
      }),
      ...(dto.workWeekDays !== undefined && {
        workWeekDays: dto.workWeekDays,
      }),
      ...(dto.sandwichRuleEnabled !== undefined && {
        sandwichRuleEnabled: dto.sandwichRuleEnabled,
      }),
    });
  }
}
