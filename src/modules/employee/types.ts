// src/modules/employee/types.ts

export interface CreateEmployeeDTO {
  userId: string;
  companyId: string;
  departmentId?: string;
  teamId?: string;
  designationId: string;

  firstName: string;
  middleName?: string;
  lastName: string;
  displayName?: string;
  dateOfBirth?: string;

  managerId?: string;
  joiningDate: string;
  isProbation?: boolean;
  initialLeaveGrant?: {
    leaveTypeId: string;
    allocated: number;
  } | null;
}

export interface UpdateEmployeeDTO {
  departmentId?: string | null;
  teamId?: string | null;
  designationId?: string;

  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  displayName?: string;
  dateOfBirth?: string | null;
  joiningDate?: string;
  isProbation?: boolean;
}

export interface ChangeManagerDTO {
  employeeId: string;
  managerId?: string; // null = remove manager
  companyId: string;
}
