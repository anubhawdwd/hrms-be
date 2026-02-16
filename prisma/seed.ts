import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  AuthProvider,
  UserRole,
} from "../src/generated/prisma/client.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL not set");
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function seed() {
  const passwordHash = await bcrypt.hash("ChangeMe@123", 12);

  // ================= COMPANY =================
  const company = await prisma.company.upsert({
    where: { name: "Phibonacci Solutions" },
    update: {},
    create: { name: "Phibonacci Solutions" },
  });

  // ================= DEPARTMENTS =================
  const engineering = await prisma.department.upsert({
    where: {
      companyId_name: {
        companyId: company.id,
        name: "Engineering",
      },
    },
    update: {},
    create: { name: "Engineering", companyId: company.id },
  });

  const hrDepartment = await prisma.department.upsert({
    where: {
      companyId_name: {
        companyId: company.id,
        name: "Human Resources",
      },
    },
    update: {},
    create: { name: "Human Resources", companyId: company.id },
  });

  const managementDepartment = await prisma.department.upsert({
    where: {
      companyId_name: {
        companyId: company.id,
        name: "Management",
      },
    },
    update: {},
    create: { name: "Management", companyId: company.id },
  });

  // ================= TEAMS =================
  const platformTeam = await prisma.team.upsert({
    where: {
      departmentId_name: {
        departmentId: engineering.id,
        name: "Platform Team",
      },
    },
    update: {},
    create: { name: "Platform Team", departmentId: engineering.id },
  });

  // ================= DESIGNATIONS =================
  const cto = await prisma.designation.upsert({
    where: { companyId_name: { companyId: company.id, name: "CTO" } },
    update: {},
    create: { name: "CTO", companyId: company.id },
  });

  const cloudArch = await prisma.designation.upsert({
    where: {
      companyId_name: {
        companyId: company.id,
        name: "Cloud and System Architecture",
      },
    },
    update: {},
    create: { name: "Cloud and System Architecture", companyId: company.id },
  });

  const se1 = await prisma.designation.upsert({
    where: {
      companyId_name: {
        companyId: company.id,
        name: "Software Engineer I",
      },
    },
    update: {},
    create: { name: "Software Engineer I", companyId: company.id },
  });

  const tester = await prisma.designation.upsert({
    where: {
      companyId_name: {
        companyId: company.id,
        name: "Software Tester",
      },
    },
    update: {},
    create: { name: "Software Tester", companyId: company.id },
  });

  const hrManager = await prisma.designation.upsert({
    where: {
      companyId_name: {
        companyId: company.id,
        name: "HR Manager",
      },
    },
    update: {},
    create: { name: "HR Manager", companyId: company.id },
  });

  const adminDesignation = await prisma.designation.upsert({
    where: {
      companyId_name: {
        companyId: company.id,
        name: "Company Administrator",
      },
    },
    update: {},
    create: { name: "Company Administrator", companyId: company.id },
  });

  // ================= USERS =================
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@phibonacci.com" },
    update: {},
    create: {
      email: "admin@phibonacci.com",
      passwordHash,
      authProvider: AuthProvider.LOCAL,
      role: UserRole.COMPANY_ADMIN,
      companyId: company.id,
    },
  });

  const hrUser = await prisma.user.upsert({
    where: { email: "hr@phibonacci.com" },
    update: {},
    create: {
      email: "hr@phibonacci.com",
      passwordHash,
      authProvider: AuthProvider.LOCAL,
      role: UserRole.HR,
      companyId: company.id,
    },
  });

  const raviUser = await prisma.user.upsert({
    where: { email: "ravi@phibonacci.com" },
    update: {},
    create: {
      email: "ravi@phibonacci.com",
      passwordHash,
      authProvider: AuthProvider.LOCAL,
      role: UserRole.EMPLOYEE,
      companyId: company.id,
    },
  });

  const ramUser = await prisma.user.upsert({
    where: { email: "ram@phibonacci.com" },
    update: {},
    create: {
      email: "ram@phibonacci.com",
      passwordHash,
      authProvider: AuthProvider.LOCAL,
      role: UserRole.EMPLOYEE,
      companyId: company.id,
    },
  });

  const anubhawUser = await prisma.user.upsert({
    where: { email: "anubhaw@phibonacci.com" },
    update: {},
    create: {
      email: "anubhaw@phibonacci.com",
      passwordHash,
      authProvider: AuthProvider.LOCAL,
      role: UserRole.EMPLOYEE,
      companyId: company.id,
    },
  });

  const sanketUser = await prisma.user.upsert({
    where: { email: "sanket@phibonacci.com" },
    update: {},
    create: {
      email: "sanket@phibonacci.com",
      passwordHash,
      authProvider: AuthProvider.LOCAL,
      role: UserRole.EMPLOYEE,
      companyId: company.id,
    },
  });

  // ================= EMPLOYEE PROFILES =================

  const ravi = await prisma.employeeProfile.upsert({
    where: { userId: raviUser.id },
    update: {},
    create: {
      employeeCode: 1,
      userId: raviUser.id,
      companyId: company.id,
      designationId: cto.id,
      teamId: platformTeam.id,
      firstName: "Ravi",
      middleName: "Kant",
      lastName: "Sharma",
      displayName: "Ravi Kant Sharma",
      dateOfBirth: new Date("1987-01-10"),
      joiningDate: new Date(),
    },
  });

  const ram = await prisma.employeeProfile.upsert({
    where: { userId: ramUser.id },
    update: {},
    create: {
      employeeCode: 2,
      userId: ramUser.id,
      companyId: company.id,
      designationId: cloudArch.id,
      teamId: platformTeam.id,
      managerId: ravi.id,
      firstName: "Ram",
      lastName: "Thakkar",
      displayName: "Ram Thakkar",
      dateOfBirth: new Date("1980-03-15"),
      joiningDate: new Date(),
    },
  });

  await prisma.employeeProfile.upsert({
    where: { userId: anubhawUser.id },
    update: {},
    create: {
      employeeCode: 3,
      userId: anubhawUser.id,
      companyId: company.id,
      designationId: se1.id,
      teamId: platformTeam.id,
      managerId: ram.id,
      firstName: "Anubhaw",
      lastName: "Dwivedi",
      displayName: "Anubhaw Dwivedi",
      dateOfBirth: new Date("1996-02-13"),
      joiningDate: new Date(),
    },
  });

  await prisma.employeeProfile.upsert({
    where: { userId: sanketUser.id },
    update: {},
    create: {
      employeeCode: 4,
      userId: sanketUser.id,
      companyId: company.id,
      designationId: tester.id,
      teamId: platformTeam.id,
      managerId: ravi.id,
      firstName: "Sanket",
      lastName: "Barot",
      displayName: "Sanket Barot",
      dateOfBirth: new Date("2001-03-15"),
      joiningDate: new Date(),
    },
  });

  // HR Employee Profile
  await prisma.employeeProfile.upsert({
    where: { userId: hrUser.id },
    update: {},
    create: {
      employeeCode: 5,
      userId: hrUser.id,
      companyId: company.id,
      designationId: hrManager.id,
      firstName: "Nidhi",
      lastName: "Aggarwal",
      displayName: "Nidhi Aggarwal",
      joiningDate: new Date(),
    },
  });

  // Admin Employee Profile
  await prisma.employeeProfile.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: {
      employeeCode: 6,
      userId: adminUser.id,
      companyId: company.id,
      designationId: adminDesignation.id,
      firstName: "Phi",
      lastName: "Admin",
      displayName: "PhiAdmin",
      joiningDate: new Date(),
    },
  });

    // ===== OFFICE LOCATION =====
const existingOffice = await prisma.officeLocation.findFirst({
  where: { companyId: company.id },
});

if (!existingOffice) {
  await prisma.officeLocation.create({
    data: {
      companyId: company.id,
      latitude: 23.052228,
      longitude: 72.493801,
      radiusM: 200,
    },
  });
}

  // ===== LEAVE TYPES =====
  const casualLeave = await prisma.leaveType.upsert({
    where: {
      companyId_code: {
        companyId: company.id,
        code: "CL",
      },
    },
    update: {},
    create: {
      companyId: company.id,
      name: "Casual Leave",
      code: "CL",
      isPaid: true,
    },
  });

  const sickLeave = await prisma.leaveType.upsert({
    where: {
      companyId_code: {
        companyId: company.id,
        code: "SL",
      },
    },
    update: {},
    create: {
      companyId: company.id,
      name: "Sick Leave",
      code: "SL",
      isPaid: true,
    },
  });

  const currentYear = new Date().getFullYear();

  // ===== LEAVE POLICIES =====
  await prisma.leavePolicy.upsert({
    where: {
      leaveTypeId_year: {
        leaveTypeId: casualLeave.id,
        year: currentYear,
      },
    },
    update: {},
    create: {
      companyId: company.id,
      leaveTypeId: casualLeave.id,
      year: currentYear,
      yearlyAllocation: 12,
      allowCarryForward: false,
      probationAllowed: true,
    },
  });

  await prisma.leavePolicy.upsert({
    where: {
      leaveTypeId_year: {
        leaveTypeId: sickLeave.id,
        year: currentYear,
      },
    },
    update: {},
    create: {
      companyId: company.id,
      leaveTypeId: sickLeave.id,
      year: currentYear,
      yearlyAllocation: 6,
      allowCarryForward: false,
      probationAllowed: true,
    },
  });

  // ===== LEAVE BALANCES (FOR ALL EMPLOYEES) =====

  const employees = await prisma.employeeProfile.findMany({
    where: { companyId: company.id },
  });

  for (const emp of employees) {
    await prisma.leaveBalance.upsert({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: emp.id,
          leaveTypeId: casualLeave.id,
          year: currentYear,
        },
      },
      update: {},
      create: {
        employeeId: emp.id,
        leaveTypeId: casualLeave.id,
        year: currentYear,
        allocated: 12,
        remaining: 12,
      },
    });

    await prisma.leaveBalance.upsert({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: emp.id,
          leaveTypeId: sickLeave.id,
          year: currentYear,
        },
      },
      update: {},
      create: {
        employeeId: emp.id,
        leaveTypeId: sickLeave.id,
        year: currentYear,
        allocated: 6,
        remaining: 6,
      },
    });
  }

  console.log("Leave types, policies, balances, and office location seeded.");

  

  console.log("Phibonacci Solutions fully seeded successfully.");
}

seed()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
