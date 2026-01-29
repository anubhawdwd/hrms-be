// src/modules/employee/types.ts

export interface CreateEmployeeDTO {
  userId: string;
  companyId: string;
  teamId: string;
  designationId: string;

  firstName: string;
  middleName?: string;
  lastName: string;
  displayName?: string;

  managerId?: string;
  joiningDate: string;
}

export interface UpdateEmployeeDTO {
  teamId?: string;
  designationId?: string;

  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  displayName?: string;

  joiningDate?: string;
}

export interface ChangeManagerDTO {
  employeeId: string;
  managerId?: string; // null = remove manager
  companyId: string;
}
