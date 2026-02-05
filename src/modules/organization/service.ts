import { OrganizationRepository } from "./repository.js";
import type { 
  CreateDepartmentDTO, 
  CreateTeamDTO, 
  CreateDesignationDTO,  
  UpsertDesignationAttendancePolicyDTO 
} from "./types.js";

const repo = new OrganizationRepository();

export class OrganizationService {
  // ---------- Departments ----------
  async createDepartment(dto: CreateDepartmentDTO) {
    if (!dto.name.trim()) {
      throw new Error("Department name is required");
    }

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

  // ---------- Teams ----------

  async createTeam(dto: CreateTeamDTO) {
    if (!dto.name.trim()) {
      throw new Error("Team name is required");
    }

    return repo.createTeam(dto.name, dto.departmentId, dto.companyId);
  }

  async listTeams(departmentId: string, companyId: string) {
    return repo.getTeamsByDepartment(departmentId, companyId);
  }

  async updateTeam(
    companyId: string,
    teamId: string,
    data: {
      name?: string;
      departmentId?: string;
    }
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
  // ---------- Designations ----------

  async createDesignation(dto: CreateDesignationDTO) {
    if (!dto.name.trim()) {
      throw new Error("Designation name is required");
    }
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
    if (!name.trim()) {
      throw new Error("Designation name is required");
    }

    return repo.updateDesignation(
      designationId,
      companyId,
      name.trim()
    );
  }

  async deactivateDesignation(companyId: string, designationId: string) {
    return repo.deactivateDesignation(designationId, companyId);
  }
  // ---------- EmployeeProfile ----------

  // async createEmployeeProfile(dto: CreateEmployeeProfileDTO) {
  //   if (!dto.firstName.trim() || !dto.lastName.trim()) {
  //     throw new Error("First name and last name are required");
  //   }

  //   const joiningDate = new Date(dto.joiningDate);
  //   if (Number.isNaN(joiningDate.getTime())) {
  //     throw new Error("Invalid joining date");
  //   }

  //   const displayName =
  //     dto.displayName?.trim() ||
  //     [dto.firstName, dto.middleName, dto.lastName]
  //       .filter(Boolean)
  //       .join(" ");

  //   // 🔑 generate next employeeCode
  //   const lastEmployee = await repo.getLastEmployeeCode(dto.companyId);
  //   const nextEmployeeCode = (lastEmployee?.employeeCode ?? 0) + 1;

  //   return repo.createEmployeeProfile({
  //     userId: dto.userId,
  //     companyId: dto.companyId,
  //     teamId: dto.teamId,
  //     designationId: dto.designationId,

  //     employeeCode: nextEmployeeCode,

  //     firstName: dto.firstName.trim(),
  //     lastName: dto.lastName.trim(),
  //     displayName,

  //     ...(dto.middleName?.trim() && { middleName: dto.middleName.trim() }),
  //     ...(dto.managerId && { managerId: dto.managerId }),
  //     joiningDate,
  //   });
  // }

  // async listEmployees(companyId: string) {
  //   return repo.listEmployees(companyId);
  // }

  // async updateEmployee(
  //   employeeId: string,
  //   companyId: string,
  //   data: {
  //     designationId?: string;
  //     teamId?: string | null;
  //     firstName?: string;
  //     middleName?: string | null;
  //     lastName?: string;
  //     joiningDate?: string;
  //   }
  // ) {
  //   if (data.firstName && !data.firstName.trim()) {
  //     throw new Error("First name cannot be empty");
  //   }

  //   return repo.updateEmployee(employeeId, companyId, {
  //     ...(data.designationId && { designationId: data.designationId }),
  //     ...(data.teamId !== undefined && { teamId: data.teamId }),
  //     ...(data.firstName && { firstName: data.firstName.trim() }),
  //     ...(data.middleName !== undefined && { middleName: data.middleName }),
  //     ...(data.lastName && { lastName: data.lastName.trim() }),
  //     ...(data.joiningDate && { joiningDate: new Date(data.joiningDate) }),
  //   });
  // }

  // async deactivateEmployee(employeeId: string, companyId: string) {
  //   return repo.deactivateEmployee(employeeId, companyId);
  // }

  // ----setOffice Location----
  async setOfficeLocation(
    companyId: string,
    latitude: number,
    longitude: number,
    radiusM: number
  ) {
    if (radiusM <= 0) {
      throw new Error("Radius must be positive greater than 0");
    }

    return repo.upsertOfficeLocation(
      companyId,
      latitude,
      longitude,
      radiusM
    );
  }

  async getOfficeLocation(companyId: string) {
    return repo.getActiveOfficeLocation(companyId);
  }

  async upsertDesignationAttendancePolicy(
    dto: UpsertDesignationAttendancePolicyDTO,
    companyId: string
  ) {
    if (dto.autoPresent && dto.attendanceExempt) {
      throw new Error(
        "autoPresent and attendanceExempt cannot both be true"
      );
    }

    return repo.upsertDesignationAttendancePolicy(
      companyId,
      dto.designationId,
      dto.autoPresent,
      dto.attendanceExempt
    );
  }
  // --------Designation Attendance Policy-------------
  async listDesignationAttendancePolicies(companyId: string) {
    return repo.getDesignationAttendancePolicies(companyId);
  }

  async getDesignationAttendancePolicy(
    companyId: string,
    designationId: string
  ) {
    return repo.getDesignationAttendancePolicy(
      companyId,
      designationId
    );
  }

}
