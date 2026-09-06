// tests/helpers/isolated-test-context.ts
import { prisma } from "../../src/config/prisma.js";
import { EmployeeService } from "../../src/modules/employee/service.js";
import { AuthProvider, UserRole } from "../../src/generated/prisma/enums.js";
import bcrypt from "bcrypt";

export interface IsolatedTestContext {
  company: {
    id: string;
    name: string;
    subdomain: string;
  };
  department: {
    id: string;
    name: string;
  };
  designation: {
    id: string;
    name: string;
  };
  adminUser: {
    id: string;
    email: string;
    role: UserRole;
  };
  adminEmployee: {
    id: string;
    displayName: string;
    employeeCode: string | null;
  };
  leaveTypes: Record<
    string,
    {
      id: string;
      name: string;
      code: string;
      isPaid: boolean;
      autoGrantOnOnboarding: boolean;
    }
  >;
  cleanup: () => Promise<void>;
}

export async function createIsolatedTestCompany(options?: {
  sandwichRuleEnabled?: boolean;
  workWeekDays?: number;
  setupStandardLeaveTypes?: boolean;
}): Promise<IsolatedTestContext> {
  const employeeService = new EmployeeService();
  const timestamp = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;

  // 1. Create dedicated isolated company
  const company = await prisma.company.create({
    data: {
      name: `Isolated Test Org ${timestamp}`,
      workWeekDays: options?.workWeekDays ?? 5,
      sandwichRuleEnabled: options?.sandwichRuleEnabled ?? false,
    },
  });

  // 2. Create isolated department and designation
  const department = await prisma.department.create({
    data: {
      companyId: company.id,
      name: "Engineering",
    },
  });

  const designation = await prisma.designation.create({
    data: {
      companyId: company.id,
      name: "Software Engineer",
    },
  });

  // 3. Create isolated admin user & profile
  const passwordHash = await bcrypt.hash("TestPass@123", 10);
  const adminUser = await prisma.user.create({
    data: {
      companyId: company.id,
      email: `admin.${timestamp}@isolatedtest.local`,
      passwordHash,
      roles: {
        create: [{ role: UserRole.COMPANY_ADMIN }],
      },
      authProvider: AuthProvider.LOCAL,
      isActive: true,
    },
  });

  const adminEmployee = await employeeService.createEmployee({
    userId: adminUser.id,
    companyId: company.id,
    designationId: designation.id,
    firstName: "TestAdmin",
    lastName: "Owner",
    joiningDate: "2026-01-01",
    isProbation: false,
    initialLeaveGrant: null,
  });

  // 4. Optionally setup standard leave types and 2026 policies
  const leaveTypes: IsolatedTestContext["leaveTypes"] = {};
  if (options?.setupStandardLeaveTypes !== false) {
    const defaultTypes = [
      { name: "Privilege Leave", code: "PL", isPaid: true, allowCarry: true, maxCarry: 12, yearly: 15 },
      { name: "Sick Leave", code: "SL", isPaid: true, allowCarry: false, maxCarry: null, yearly: 12 },
      { name: "Casual Leave (Probation)", code: "CLP", isPaid: true, allowCarry: false, maxCarry: null, yearly: 12 },
      { name: "Marriage Leave", code: "ML", isPaid: true, allowCarry: false, maxCarry: null, yearly: 5 },
      { name: "Maternity Leave", code: "MATL", isPaid: true, allowCarry: false, maxCarry: null, yearly: 90 },
      { name: "Paternity Leave", code: "PATL", isPaid: true, allowCarry: false, maxCarry: null, yearly: 10 },
      { name: "Leave Without Pay", code: "LWP", isPaid: false, allowCarry: false, maxCarry: null, yearly: 30 },
      { name: "Restricted Holiday", code: "RH", isPaid: true, allowCarry: false, maxCarry: null, yearly: 2 },
      { name: "Compensatory Off", code: "COMP_OFF", isPaid: true, allowCarry: false, maxCarry: null, yearly: 5 },
    ];

    for (const dt of defaultTypes) {
      const createdType = await prisma.leaveType.create({
        data: {
          companyId: company.id,
          name: dt.name,
          code: dt.code,
          isPaid: dt.isPaid,
          autoGrantOnOnboarding: false,
        },
      });

      await prisma.leavePolicy.create({
        data: {
          companyId: company.id,
          leaveTypeId: createdType.id,
          year: 2026,
          yearlyAllocation: dt.yearly,
          allowCarryForward: dt.allowCarry,
          maxCarryForward: dt.maxCarry,
          allowEncashment: false,
          probationAllowed: true,
          monthlyAccrual: false,
        },
      });

      leaveTypes[dt.code] = {
        id: createdType.id,
        name: createdType.name,
        code: createdType.code,
        isPaid: createdType.isPaid,
        autoGrantOnOnboarding: createdType.autoGrantOnOnboarding,
      };
    }
  }

  // Cleanup helper that wipes every entity tied to this test company
  const cleanup = async () => {
    await cleanupIsolatedCompany(company.id);
  };

  return {
    company,
    department,
    designation,
    adminUser,
    adminEmployee,
    leaveTypes,
    cleanup,
  };
}

export async function cleanupIsolatedCompany(companyId: string) {
  try {
    // 1. Delete Attendance Events & Days
    await prisma.attendanceEvent.deleteMany({
      where: { attendanceDay: { companyId } },
    });
    await prisma.attendanceDay.deleteMany({
      where: { companyId },
    });

    // 2. Delete Leave Request Days & Leave Requests
    await prisma.leaveRequestDay.deleteMany({
      where: { leaveRequest: { employee: { companyId } } },
    });
    await prisma.leaveRequest.deleteMany({
      where: { employee: { companyId } },
    });

    // 3. Delete Leave Balances & Overrides
    await prisma.employeeLeaveOverride.deleteMany({
      where: { employee: { companyId } },
    });
    await prisma.leaveBalance.deleteMany({
      where: { employee: { companyId } },
    });

    // 4. Delete Leave Policies & Leave Types
    await prisma.leavePolicy.deleteMany({
      where: { companyId },
    });
    await prisma.leaveType.deleteMany({
      where: { companyId },
    });

    // 5. Delete Holidays
    await prisma.holiday.deleteMany({
      where: { companyId },
    });

    // 6. Delete Refresh Tokens, Audit Logs & Error Logs
    await prisma.refreshToken.deleteMany({
      where: { user: { companyId } },
    });
    await prisma.auditLog.deleteMany({
      where: { companyId },
    });
    await prisma.errorLog.deleteMany({
      where: { companyId },
    });

    // 7. Delete Employee Profiles & Users
    await prisma.employeeProfile.deleteMany({
      where: { companyId },
    });
    await prisma.user.deleteMany({
      where: { companyId },
    });

    // 8. Delete Designations, Departments & Company
    await prisma.designation.deleteMany({
      where: { companyId },
    });
    await prisma.department.deleteMany({
      where: { companyId },
    });
    await prisma.company.delete({
      where: { id: companyId },
    });
  } catch (err) {
    console.error(`[WARN] Failed to completely cleanup isolated test company ${companyId}:`, err);
  }
}
