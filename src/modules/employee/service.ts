// src/modules/employee/service.ts
import { EmployeeRepository } from "./repository.js";
import type {
  CreateEmployeeDTO,
  ChangeManagerDTO,
} from "./types.js";

const repo = new EmployeeRepository();

export class EmployeeService {
  async createEmployee(dto: CreateEmployeeDTO) {
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

    const dob =
      dto.dateOfBirth !== undefined
        ? new Date(dto.dateOfBirth.trim())
        : undefined;

    if (dob && Number.isNaN(dob.getTime())) {
      throw new Error("Invalid dateOfBirth");
    }

    if (dob && dob > new Date()) {
      throw new Error("dateOfBirth cannot be in the future");
    }

    const last = await repo.getLastEmployeeCode(dto.companyId);
    const nextEmployeeCode = (last?.employeeCode ?? 0) + 1;

    const employee = await repo.createEmployee({
      userId: dto.userId,
      companyId: dto.companyId,
      teamId: dto.teamId,
      designationId: dto.designationId,
      ...(dto.managerId && { managerId: dto.managerId }),
      employeeCode: nextEmployeeCode,
      firstName: dto.firstName.trim(),
      ...(dto.middleName !== undefined && {
        middleName: dto.middleName.trim(),
      }),
      lastName: dto.lastName.trim(),
      displayName,
      ...(dob && { dateOfBirth: dob }),
      joiningDate,
      ...(dto.isProbation !== undefined && {
        isProbation: dto.isProbation,
      }),
    });

    await this.bootstrapLeaveBalances(employee);

    return employee;
  }

  async getEmployeeById(employeeId: string, companyId: string) {
    const employee = await repo.findById(employeeId, companyId);
    if (!employee) throw new Error("Employee not found");
    return employee;
  }

  async listEmployees(companyId: string) {
    return repo.listEmployees(companyId);
  }

  async updateMyProfile(
    userId: string,
    companyId: string,
    dto: {
      firstName?: string;
      middleName?: string;
      lastName?: string;
      displayName?: string;
      dateOfBirth?: string | null;
    }
  ) {
    const emp = await repo.findByUserId(userId, companyId);
    if (!emp) throw new Error("Employee not found");

    return repo.updateEmployee(emp.id, companyId, {
      ...(dto.firstName && { firstName: dto.firstName }),
      ...(dto.middleName !== undefined && { middleName: dto.middleName }),
      ...(dto.lastName && { lastName: dto.lastName }),
      ...(dto.displayName && { displayName: dto.displayName }),
      ...(dto.dateOfBirth !== undefined && {dateOfBirth: dto.dateOfBirth === null
        ? null
        : new Date(dto.dateOfBirth),
  }),
    });
  }

  async updateEmployeeAdmin(
    employeeId: string,
    companyId: string,
    dto: {
      teamId?: string;
      designationId?: string;
      joiningDate?: string;
      isProbation?: boolean;
      firstName?: string;
      middleName?: string;
      lastName?: string;
      displayName?: string;
      dateOfBirth?: string | null;
    }
  ) {
    return repo.updateEmployee(employeeId, companyId, {
      ...(dto.teamId && { teamId: dto.teamId }),
      ...(dto.designationId && { designationId: dto.designationId }),
      ...(dto.joiningDate && { joiningDate: new Date(dto.joiningDate) }),
      ...(dto.isProbation !== undefined && { isProbation: dto.isProbation }),
      ...(dto.firstName && { firstName: dto.firstName }),
      ...(dto.middleName !== undefined && { middleName: dto.middleName }),
      ...(dto.lastName && { lastName: dto.lastName }),
      ...(dto.displayName && { displayName: dto.displayName }),
      ...(dto.dateOfBirth !== undefined && {dateOfBirth:dto.dateOfBirth === null 
        ? null
        : new Date(dto.dateOfBirth),
      }),
    });
  }

  async deactivateEmployee(employeeId: string, companyId: string) {
    return repo.deactivateEmployee(employeeId, companyId);
  }

  async changeManager(dto: ChangeManagerDTO) {
    return repo.changeManager(dto.employeeId, dto.companyId, dto.managerId);
  }

  async getEmployeeByUserId(userId: string, companyId: string) {
    const emp = await repo.findByUserId(userId, companyId);
    if (!emp) throw new Error("Employee not found");
    return emp;
  }

  private async bootstrapLeaveBalances(employee: {
    id: string;
    companyId: string;
    joiningDate: Date;
    isProbation: boolean;
  }) {
    const year = employee.joiningDate.getFullYear();

    const policies = await repo.getLeavePoliciesForCompany(
      employee.companyId,
      year
    );

    const joiningMonth = employee.joiningDate.getMonth() + 1;
    const monthsRemaining = 12 - joiningMonth + 1;

    const balances = [];

    for (const policy of policies) {
      let totalEntitlement =
        (policy.yearlyAllocation / 12) * monthsRemaining;

      if (!policy.probationAllowed && employee.isProbation) {
        totalEntitlement = 0;
      }

      if (policy.monthlyAccrual) {
        totalEntitlement = policy.yearlyAllocation / 12;
      }

      balances.push({
        employeeId: employee.id,
        leaveTypeId: policy.leaveTypeId,
        year,
        allocated: totalEntitlement,
        used: 0,
        carriedForward: 0,
        remaining: totalEntitlement,
      });
    }

    if (balances.length > 0) {
      await repo.createManyLeaveBalances(balances);
    }
  }
}
