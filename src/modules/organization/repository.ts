// src/modules/organization/repository.ts
import { prisma } from "../../config/prisma.js";

export class OrganizationRepository {
  // =================== DEPARTMENTS ===================

  createDepartment(name: string, companyId: string) {
    return prisma.department.create({ data: { name, companyId } });
  }

  getDepartments(companyId: string) {
    return prisma.department.findMany({
      where: { companyId },
      orderBy: { createdAt: "asc" },
    });
  }

  updateDepartment(departmentId: string, companyId: string, name: string) {
    return prisma.department.updateMany({
      where: { id: departmentId, companyId, isActive: true },
      data: { name },
    });
  }

  deactivateDepartment(departmentId: string, companyId: string) {
    return prisma.department.updateMany({
      where: { id: departmentId, companyId },
      data: { isActive: false },
    });
  }

  // =================== TEAMS ===================

  async createTeam(name: string, departmentId: string, companyId: string) {
    const department = await prisma.department.findFirst({
      where: { id: departmentId, companyId },
      select: { id: true },
    });

    if (!department) throw new Error("Invalid department for this company");

    return prisma.team.create({
      data: {
        name,
        department: { connect: { id: departmentId } },
      },
    });
  }

  getTeamsByDepartment(departmentId: string, companyId: string) {
    return prisma.team.findMany({
      where: { departmentId, department: { companyId } },
      orderBy: { createdAt: "asc" },
    });
  }

  updateTeam(
    teamId: string,
    companyId: string,
    data: { name?: string; departmentId?: string }
  ) {
    return prisma.team.updateMany({
      where: { id: teamId, department: { companyId }, isActive: true },
      data,
    });
  }

  deactivateTeam(teamId: string, companyId: string) {
    return prisma.team.updateMany({
      where: { id: teamId, department: { companyId } },
      data: { isActive: false },
    });
  }

  // =================== DESIGNATIONS ===================

  createDesignation(name: string, companyId: string) {
    return prisma.designation.create({ data: { name, companyId } });
  }

  getDesignations(companyId: string) {
    return prisma.designation.findMany({
      where: { companyId },
      orderBy: { createdAt: "asc" },
    });
  }

  updateDesignation(designationId: string, companyId: string, name: string) {
    return prisma.designation.updateMany({
      where: { id: designationId, companyId, isActive: true },
      data: { name },
    });
  }

  deactivateDesignation(designationId: string, companyId: string) {
    return prisma.designation.updateMany({
      where: { id: designationId, companyId },
      data: { isActive: false },
    });
  }

  // =================== OFFICE LOCATION ===================

  async upsertOfficeLocation(
    companyId: string,
    latitude: number,
    longitude: number,
    radiusM: number
  ) {
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

  getActiveOfficeLocation(companyId: string) {
    return prisma.officeLocation.findFirst({
      where: { companyId, isActive: true },
    });
  }

  // =================== DESIGNATION ATTENDANCE POLICY ===================

  upsertDesignationAttendancePolicy(
    companyId: string,
    designationId: string,
    autoPresent: boolean,
    attendanceExempt: boolean
  ) {
    return prisma.designationAttendancePolicy.upsert({
      where: { designationId },
      update: { autoPresent, attendanceExempt },
      create: { companyId, designationId, autoPresent, attendanceExempt },
    });
  }

  getDesignationAttendancePolicies(companyId: string) {
    return prisma.designationAttendancePolicy.findMany({
      where: { companyId },
      include: { designation: { select: { name: true } } },
    });
  }

  getDesignationAttendancePolicy(companyId: string, designationId: string) {
    return prisma.designationAttendancePolicy.findFirst({
      where: { companyId, designationId },
    });
  }
}