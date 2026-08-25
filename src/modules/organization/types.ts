// src/modules/organization/types.ts
export interface CreateDepartmentDTO {
  name: string;
  companyId: string;
}

export interface CreateTeamDTO {
  name: string;
  departmentId: string;
  companyId: string;
}

export interface CreateDesignationDTO {
  name: string;
  companyId: string;
}

// export interface CreateEmployeeProfileDTO {
//   userId: string;
//   companyId: string;
//   teamId: string;
//   designationId: string;

//   firstName: string;
//   middleName?: string;
//   lastName: string;
//   displayName?: string;

//   managerId?: string;
//   joiningDate: string;
// }

export interface UpsertDesignationAttendancePolicyDTO {
  designationId: string;
  autoPresent: boolean;
  attendanceExempt: boolean;
}

export interface SetOfficeLocationDTO {
  companyId: string;
  latitude: number;
  longitude: number;
  radiusM: number;
  geoFencingEnabled?: boolean;
}

export interface UpdateOfficeLocationDTO {
  companyId: string;
  latitude?: number;
  longitude?: number;
  radiusM?: number;
  geoFencingEnabled?: boolean;
}


