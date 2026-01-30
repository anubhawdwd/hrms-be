import { prisma } from "../../config/prisma.js";

export class OrganizationRepository {
  // ---------- Departments ----------
  async createDepartment(name: string, companyId: string) {
    return prisma.department.create({
      data: {
        name,
        companyId,
      },
    });
  }

  async getDepartments(companyId: string) {
    return prisma.department.findMany({
      where: { companyId },
      orderBy: { createdAt: "asc" },
    });
  }

  async updateDepartment(
    departmentId: string,
    companyId: string,
    name: string
  ) {
    return prisma.department.updateMany({
      where: { id: departmentId, companyId, isActive: true },
      data: { name },
    });
  }

  async deactivateDepartment(departmentId: string, companyId: string) {
    return prisma.department.updateMany({
      where: { id: departmentId, companyId },
      data: { isActive: false },
    });
  }

  // ---------- Teams ----------

  async createTeam(
    name: string,
    departmentId: string,
    companyId: string
  ) {
    // Step 1: Ensure department belongs to company
    const department = await prisma.department.findFirst({
      where: {
        id: departmentId,
        companyId,
      },
      select: { id: true },
    });

    if (!department) {
      throw new Error("Invalid department for this company");
    }

    // Step 2: Create team using relation connect
    return prisma.team.create({
      data: {
        name,
        department: {
          connect: {
            id: departmentId,
          },
        },
      },
    });
  }

  async getTeamsByDepartment(departmentId: string, companyId: string) {
    return prisma.team.findMany({
      where: {
        departmentId,
        department: {
          companyId,
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async updateTeam(
    teamId: string,
    companyId: string,
    data: {
      name?: string;
      departmentId?: string;
    }
  ) {
    return prisma.team.updateMany({
      where: {
        id: teamId,
        department: { companyId },
        isActive: true,
      },
      data,
    });
  }

  async deactivateTeam(teamId: string, companyId: string) {
    return prisma.team.updateMany({
      where: {
        id: teamId,
        department: { companyId },
      },
      data: { isActive: false },
    });
  }

  // ---------- Designations ----------

  async createDesignation(name: string, companyId: string) {
    return prisma.designation.create({
      data: {
        name,
        companyId,
      },
    });
  }

  async getDesignations(companyId: string) {
    return prisma.designation.findMany({
      where: { companyId },
      orderBy: { createdAt: "asc" },
    });
  }

  async updateDesignation(
    designationId: string,
    companyId: string,
    name: string
  ) {
    return prisma.designation.updateMany({
      where: { id: designationId, companyId, isActive: true },
      data: { name },
    });
  }

  async deactivateDesignation(
    designationId: string,
    companyId: string
  ) {
    return prisma.designation.updateMany({
      where: { id: designationId, companyId },
      data: { isActive: false },
    });
  }

  // ---------- EmployeeProfile ----------
  async createEmployeeProfile(data: {
    userId: string;
    companyId: string;
    teamId: string;
    designationId: string;
    employeeCode: number;
    firstName: string;
    middleName?: string;
    lastName: string;
    displayName: string;
    managerId?: string;
    joiningDate: Date;
  }) {
    return prisma.employeeProfile.create({
      data: {
        employeeCode: data.employeeCode,
        user: { connect: { id: data.userId } },
        company: { connect: { id: data.companyId } },
        team: { connect: { id: data.teamId } },
        designation: { connect: { id: data.designationId } },

        firstName: data.firstName,
        ...(data.middleName && { middleName: data.middleName }),
        lastName: data.lastName,
        displayName: data.displayName,

        ...(data.managerId && {
          manager: { connect: { id: data.managerId } },
        }),

        joiningDate: data.joiningDate,
      },
    });
  }

  async updateEmployee(
    employeeId: string,
    companyId: string,
    data: any
  ) {
    return prisma.employeeProfile.updateMany({
      where: { id: employeeId, companyId, isActive: true },
      data,
    });
  }

  async deactivateEmployee(employeeId: string, companyId: string) {
    return prisma.employeeProfile.updateMany({
      where: { id: employeeId, companyId },
      data: { isActive: false },
    });
  }


  async listEmployees(companyId: string) {
    return prisma.employeeProfile.findMany({
      where: { companyId },
      include: {
        user: { select: { email: true } },
        team: { select: { name: true } },
        designation: { select: { name: true } },
        manager: {
          select: {
            id: true,
            user: { select: { email: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async getLastEmployeeCode(companyId: string) {
    return prisma.employeeProfile.findFirst({
      where: { companyId },
      orderBy: { employeeCode: "desc" },
      select: { employeeCode: true },
    });
  }

  // ------Office Geo Location-----

  async upsertOfficeLocation(
    companyId: string,
    latitude: number,
    longitude: number,
    radiusM: number
  ) {
    // deactivate old locations
    await prisma.officeLocation.updateMany({
      where: { companyId, isActive: true },
      data: { isActive: false },
    });

    return prisma.officeLocation.create({
      data: {
        company: { connect: { id: companyId } },
        latitude,
        longitude,
        radiusM,
        isActive: true,
      },
    });
  }

  async getActiveOfficeLocation(companyId: string) {
    return prisma.officeLocation.findFirst({
      where: { companyId, isActive: true },
    });
  }

  // ---------- Designation Attendance Policy ----------

  async upsertDesignationAttendancePolicy(
    companyId: string,
    designationId: string,
    autoPresent: boolean,
    attendanceExempt: boolean
  ) {
    return prisma.designationAttendancePolicy.upsert({
      where: { designationId },
      update: {
        autoPresent,
        attendanceExempt,
      },
      create: {
        companyId,
        designationId,
        autoPresent,
        attendanceExempt,
      },
    });
  }

  async getDesignationAttendancePolicies(companyId: string) {
    return prisma.designationAttendancePolicy.findMany({
      where: { companyId },
      include: {
        designation: { select: { name: true } },
      },
    });
  }

  async getDesignationAttendancePolicy(
    companyId: string,
    designationId: string
  ) {
    return prisma.designationAttendancePolicy.findFirst({
      where: {
        companyId,
        designationId,
      },
    });
  }


}

