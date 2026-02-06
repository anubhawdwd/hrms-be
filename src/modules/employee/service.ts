// src/modules/employee/service.ts

import { EmployeeRepository } from "./repository.js";
import type {
    CreateEmployeeDTO,
    UpdateEmployeeDTO,
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

        const last = await repo.getLastEmployeeCode(dto.companyId);
        const nextEmployeeCode = (last?.employeeCode ?? 0) + 1;

        const employee = await repo.createEmployee({
            userId: dto.userId,
            companyId: dto.companyId,
            teamId: dto.teamId,
            designationId: dto.designationId,
            ...(dto.managerId !== undefined && {
                managerId: dto.managerId,
            }),
            employeeCode: nextEmployeeCode,
            firstName: dto.firstName.trim(),
            ...(dto.middleName !== undefined && {
                middleName: dto.middleName.trim(),
            }),
            lastName: dto.lastName.trim(),
            displayName,
            joiningDate,
            ...(dto.isProbation !== undefined && {
                isProbation: dto.isProbation,
            }),
        });

        /* 👇 NEW */
        await this.bootstrapLeaveBalances(employee);

        return employee;

    }

    async getEmployeeById(employeeId: string, companyId: string) {
        const employee = await repo.findById(employeeId, companyId);
        if (!employee) {
            throw new Error("Employee not found");
        }
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
        }
    ) {
        const emp = await repo.findByUserId(userId, companyId);
        if (!emp) throw new Error("Employee not found");

        return repo.updateEmployee(emp.id, companyId, {
            ...(dto.firstName && { firstName: dto.firstName }),
            ...(dto.middleName !== undefined && { middleName: dto.middleName }),
            ...(dto.lastName && { lastName: dto.lastName }),
            ...(dto.displayName && { displayName: dto.displayName }),
        });
    }

    
    async updateEmployeeAdmin(employeeId: string, companyId: string, dto: {
        teamId?: string;
        designationId?: string;
        joiningDate?: string;
        isProbation?: boolean;
        firstName?: string;
        middleName?: string;
        lastName?: string;
        displayName?: string;
    }) {
        return repo.updateEmployee(employeeId, companyId, {
            ...(dto.teamId && { teamId: dto.teamId }),
            ...(dto.designationId && { designationId: dto.designationId }),
            ...(dto.joiningDate && { joiningDate: new Date(dto.joiningDate) }),
            ...(dto.isProbation !== undefined && { isProbation: dto.isProbation }),

            ...(dto.firstName && { firstName: dto.firstName }),
            ...(dto.middleName !== undefined && { middleName: dto.middleName }),
            ...(dto.lastName && { lastName: dto.lastName }),
            ...(dto.displayName && { displayName: dto.displayName }),
        });
    }


    async deactivateEmployee(
        employeeId: string,
        companyId: string
    ) {
        return repo.deactivateEmployee(employeeId, companyId);
    }

    async changeManager(dto: ChangeManagerDTO) {
        return repo.changeManager(
            dto.employeeId,
            dto.companyId,
            dto.managerId
        );
    }

    private async bootstrapLeaveBalances(employee: any) {
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
                const monthly = policy.yearlyAllocation / 12;
                totalEntitlement = monthly;
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

    private async topUpLeaveAfterProbation(employee: any) {
        const year = new Date().getFullYear();

        const policies = await repo.getLeavePoliciesForCompany(
            employee.companyId,
            year
        );

        const joiningMonth = employee.joiningDate.getMonth() + 1;
        const monthsRemaining = 12 - joiningMonth + 1;

        for (const policy of policies) {
            if (!policy.probationAllowed) continue;

            const shouldHave =
                (policy.yearlyAllocation / 12) * monthsRemaining;

            const balance = await repo.getLeaveBalance(
                employee.id,
                policy.leaveTypeId,
                year
            );

            if (!balance) continue;

            const delta = shouldHave - balance.allocated;

            if (delta > 0) {
                await repo.incrementLeaveBalance(balance.id, delta);
            }
        }
    }

    async getEmployeeByUserId(userId: string, companyId: string) {
        const emp = await repo.findByUserId(userId, companyId);
        if (!emp) throw new Error("Employee not found");
        return emp;
    }

}
