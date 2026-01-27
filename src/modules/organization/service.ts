import { OrganizationRepository } from "./repository.js";
import type { CreateDepartmentDTO, CreateTeamDTO, CreateDesignationDTO, CreateEmployeeProfileDTO } from "./types.js";

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

   // ---------- EmployeeProfile ----------
   
async createEmployeeProfile(dto: CreateEmployeeProfileDTO) {
  if (!dto.firstName.trim() || !dto.lastName.trim()) {
    throw new Error("First name and last name are required");
  }

  const joiningDate = new Date(dto.joiningDate);
  if (Number.isNaN(joiningDate.getTime())) {
    throw new Error("Invalid joining date");
  }

  const displayName =
    dto.displayName?.trim() ||
    [dto.firstName, dto.middleName, dto.lastName]
      .filter(Boolean)
      .join(" ");

  // 🔑 generate next employeeCode
  const lastEmployee = await repo.getLastEmployeeCode(dto.companyId);
  const nextEmployeeCode = (lastEmployee?.employeeCode ?? 0) + 1;

  return repo.createEmployeeProfile({
    userId: dto.userId,
    companyId: dto.companyId,
    teamId: dto.teamId,
    designationId: dto.designationId,

    employeeCode: nextEmployeeCode,

    firstName: dto.firstName.trim(),
    lastName: dto.lastName.trim(),
    displayName,

    ...(dto.middleName?.trim() && { middleName: dto.middleName.trim() }),
    ...(dto.managerId && { managerId: dto.managerId }),
    joiningDate,
  });
}


  async listEmployees(companyId: string) {
    return repo.listEmployees(companyId);
  }
}
