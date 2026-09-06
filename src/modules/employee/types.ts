// src/modules/employee/types.ts
import { AuthProvider, Gender, UserRole } from "../../generated/prisma/enums.js";

export interface OnboardEmployeeDTO {
  // Credentials
  email: string;
  authProvider?: AuthProvider;
  role?: UserRole;
  roles?: UserRole[];
  password?: string;

  // Profile
  firstName: string;
  middleName?: string;
  lastName: string;
  displayName?: string;
  personalEmail?: string;
  phone?: string;
  gender?: Gender;
  dateOfBirth?: string;
  joiningDate: string;

  // Org
  departmentId?: string;
  teamId?: string;
  designationId: string;
  managerId?: string;
  secondaryManagerId?: string;

  // Employment
  isProbation?: boolean;
  employeeCode?: number;
  initialLeaveGrant?: {
    leaveTypeId: string;
    allocated: number;
  } | null;
}

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
  personalEmail?: string;
  phone?: string;
  gender?: Gender;
  dateOfBirth?: string;

  managerId?: string;
  secondaryManagerId?: string;
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
  personalEmail?: string | null;
  phone?: string | null;
  gender?: Gender | null;
  dateOfBirth?: string | null;
  joiningDate?: string;
  isProbation?: boolean;
  isActive?: boolean;
  managerId?: string | null;
  secondaryManagerId?: string | null;
}

export interface ChangeManagerDTO {
  employeeId: string;
  managerId?: string | null; // null = remove manager
  companyId: string;
}
