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

        return repo.createEmployee({
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
        });
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

    async updateEmployee(
        employeeId: string,
        companyId: string,
        dto: UpdateEmployeeDTO
    ) {
        const updateData: any = {};

        if (dto.firstName) updateData.firstName = dto.firstName.trim();
        if (dto.middleName !== undefined) updateData.middleName = dto.middleName;
        if (dto.lastName) updateData.lastName = dto.lastName.trim();
        if (dto.displayName) updateData.displayName = dto.displayName.trim();
        if (dto.teamId) updateData.teamId = dto.teamId;
        if (dto.designationId) updateData.designationId = dto.designationId;

        if (dto.joiningDate) {
            const date = new Date(dto.joiningDate);
            if (Number.isNaN(date.getTime())) {
                throw new Error("Invalid joining date");
            }
            updateData.joiningDate = date;
        }

        return repo.updateEmployee(employeeId, companyId, updateData);
    }

    async changeManager(dto: ChangeManagerDTO) {
        return repo.changeManager(
            dto.employeeId,
            dto.companyId,
            dto.managerId
        );
    }
}
