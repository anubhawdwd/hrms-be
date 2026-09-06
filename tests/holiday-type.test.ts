// tests/holiday-type.test.ts
import { prisma } from "../src/config/prisma.js";
import { LeaveService } from "../src/modules/leave/service.js";
import { EmployeeService } from "../src/modules/employee/service.js";
import {
  AuthProvider,
  UserRole,
  LeaveDurationType,
  HolidayType,
} from "../src/generated/prisma/enums.js";
import { createIsolatedTestCompany } from "./helpers/isolated-test-context.js";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[FAIL] ${message}`);
  }
  console.log(`    ✔ ${message}`);
}

export async function runHolidayTypeTests() {
  console.log("\n  [MODULE] Holiday Type Distinction Test Suite (LEV-16: Normal vs Restricted)");

  const leaveService = new LeaveService();
  const employeeService = new EmployeeService();

  const ctx = await createIsolatedTestCompany({
    setupStandardLeaveTypes: true,
    sandwichRuleEnabled: false,
    workWeekDays: 5,
  });

  try {
    const companyId = ctx.company.id;
    const clType = ctx.leaveTypes["CLP"] || ctx.leaveTypes["CL"]!;
    const rhType = ctx.leaveTypes["RH"] || (await prisma.leaveType.create({
      data: {
        companyId,
        name: "Restricted Holiday",
        code: "RH",
        isPaid: true,
        autoGrantOnOnboarding: false,
      },
    }));

    const timestamp = Date.now();

    // 1. Create 2 test employees:
    // Emp 1: Eligible for RH (has RH balance) + CL balance
    // Emp 2: Standard employee without RH (CL balance only)
    const user1 = await prisma.user.create({
      data: {
        companyId,
        email: `emp1.rh.${timestamp}@zztest.internal`,
        passwordHash: "$2b$10$abcdef",
        roles: {
          create: [{ role: UserRole.EMPLOYEE }],
        },
        authProvider: AuthProvider.LOCAL,
        isActive: true,
      },
    });

    const emp1 = await employeeService.createEmployee({
      userId: user1.id,
      companyId,
      designationId: ctx.designation.id,
      firstName: "RHEligible",
      lastName: "User",
      joiningDate: "2026-01-01",
      isProbation: false,
      initialLeaveGrant: null,
    });

    const user2 = await prisma.user.create({
      data: {
        companyId,
        email: `emp2.standard.${timestamp}@zztest.internal`,
        passwordHash: "$2b$10$abcdef",
        roles: {
          create: [{ role: UserRole.EMPLOYEE }],
        },
        authProvider: AuthProvider.LOCAL,
        isActive: true,
      },
    });

    const emp2 = await employeeService.createEmployee({
      userId: user2.id,
      companyId,
      designationId: ctx.designation.id,
      firstName: "Standard",
      lastName: "User",
      joiningDate: "2026-01-01",
      isProbation: false,
      initialLeaveGrant: null,
    });

    // Seed balances for 2026
    const year = 2026;
    // Emp1: 2 RH days, 5 CL days
    await prisma.leaveBalance.upsert({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: emp1.id,
          leaveTypeId: rhType.id,
          year,
        },
      },
      create: {
        employeeId: emp1.id,
        leaveTypeId: rhType.id,
        year,
        allocated: 2,
        used: 0,
        carriedForward: 0,
        remaining: 2,
      },
      update: { allocated: 2, remaining: 2, used: 0 },
    });

    await prisma.leaveBalance.upsert({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: emp1.id,
          leaveTypeId: clType.id,
          year,
        },
      },
      create: {
        employeeId: emp1.id,
        leaveTypeId: clType.id,
        year,
        allocated: 5,
        used: 0,
        carriedForward: 0,
        remaining: 5,
      },
      update: { allocated: 5, remaining: 5, used: 0 },
    });

    // Emp2: 0 RH, 5 CL days
    await prisma.leaveBalance.upsert({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: emp2.id,
          leaveTypeId: clType.id,
          year,
        },
      },
      create: {
        employeeId: emp2.id,
        leaveTypeId: clType.id,
        year,
        allocated: 5,
        used: 0,
        carriedForward: 0,
        remaining: 5,
      },
      update: { allocated: 5, remaining: 5, used: 0 },
    });

    // ─── TEST 1: Default Holiday Type is NORMAL ───
    console.log("    --- 1. Testing Default Holiday Type ---");
    const defaultHoliday = await leaveService.createHoliday({
      companyId,
      name: "Independence Day",
      date: new Date("2026-08-15T00:00:00.000Z"),
    });
    assert(defaultHoliday.type === HolidayType.NORMAL, "Holiday created without explicit type defaults to NORMAL");

    const normalHoliday = await leaveService.createHoliday({
      companyId,
      name: "Republic Day",
      date: new Date("2026-01-26T00:00:00.000Z"),
      type: HolidayType.NORMAL,
    });
    assert(normalHoliday.type === HolidayType.NORMAL, "Explicit NORMAL holiday type persisted");

    const restrictedHoliday = await leaveService.createHoliday({
      companyId,
      name: "Maha Shivratri",
      date: new Date("2026-02-17T00:00:00.000Z"),
      type: HolidayType.RESTRICTED,
    });
    assert(restrictedHoliday.type === HolidayType.RESTRICTED, "RESTRICTED holiday type persisted");

    // ─── TEST 2: Normal Holiday Blocks Leave Applications ───
    console.log("    --- 2. Testing Normal Holiday Blocking ---");
    let normalBlocked = false;
    try {
      await leaveService.applyLeave({
        companyId,
        userId: user1.id,
        leaveTypeId: clType.id,
        fromDate: "2026-01-26",
        toDate: "2026-01-26",
        durationType: LeaveDurationType.FULL_DAY,
        reason: "Test leave on normal holiday",
      });
    } catch (err: any) {
      if (err.message === "Leave cannot be applied on a company holiday.") {
        normalBlocked = true;
      }
    }
    assert(normalBlocked, "Employee leave application on NORMAL holiday date is blocked");

    // Also verify admin apply on normal holiday is blocked
    let adminNormalBlocked = false;
    try {
      await leaveService.markLeaveByAdmin({
        companyId,
        adminUserId: ctx.adminUser.id,
        employeeId: emp1.id,
        leaveTypeId: clType.id,
        fromDate: "2026-01-26",
        toDate: "2026-01-26",
        durationType: LeaveDurationType.FULL_DAY,
        reason: "Admin apply on normal holiday",
      });
    } catch (err: any) {
      if (err.message === "Leave cannot be applied on a company holiday.") {
        adminNormalBlocked = true;
      }
    }
    assert(adminNormalBlocked, "Admin leave application on NORMAL holiday date is blocked");

    // ─── TEST 3: Restricted Holiday Allows RH Application for Eligible Employee ───
    console.log("    --- 3. Testing Restricted Holiday + RH Application ---");
    const rhLeave = await leaveService.applyLeave({
      companyId,
      userId: user1.id,
      leaveTypeId: rhType.id,
      fromDate: "2026-02-17",
      toDate: "2026-02-17",
      durationType: LeaveDurationType.FULL_DAY,
      reason: "RH on Restricted Holiday",
    });
    assert(!!rhLeave.id, "RH application on RESTRICTED holiday succeeded");

    // Approve the RH leave and verify balance
    await leaveService.approveLeave({
      companyId,
      approverUserId: ctx.adminUser.id,
      requestId: rhLeave.id,
    });

    const emp1RhBal = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: emp1.id,
          leaveTypeId: rhType.id,
          year,
        },
      },
    });
    assert(emp1RhBal?.used === 1, "Approved RH leave deducted exactly 1 used day from RH balance");
    assert(emp1RhBal?.remaining === 1, "RH remaining balance correctly updated to 1");

    // ─── TEST 4: Restricted Holiday Allows Standard Leave for Other Employee ───
    console.log("    --- 4. Testing Restricted Holiday + Normal Leave Application ---");
    const clLeave = await leaveService.applyLeave({
      companyId,
      userId: user2.id,
      leaveTypeId: clType.id,
      fromDate: "2026-02-17",
      toDate: "2026-02-17",
      durationType: LeaveDurationType.FULL_DAY,
      reason: "CL on Restricted Holiday date",
    });
    assert(!!clLeave.id, "Standard CL leave on RESTRICTED holiday date succeeded without special handling");

    await leaveService.approveLeave({
      companyId,
      approverUserId: ctx.adminUser.id,
      requestId: clLeave.id,
    });

    const emp2ClBal = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: emp2.id,
          leaveTypeId: clType.id,
          year,
        },
      },
    });
    assert(emp2ClBal?.used === 1, "Approved CL leave on restricted holiday date deducted 1 used day from CL balance");
    assert(emp2ClBal?.remaining === 4, "CL remaining balance correctly updated to 4");

    // ─── TEST 5: Listing Holidays returns type field ───
    console.log("    --- 5. Testing List Holidays Output ---");
    const allHolidays = await leaveService.listHolidays(companyId);
    const listedRestricted = allHolidays.find((h) => h.name === "Maha Shivratri");
    const listedNormal = allHolidays.find((h) => h.name === "Republic Day");
    assert(listedRestricted?.type === HolidayType.RESTRICTED, "listHolidays correctly returns RESTRICTED type");
    assert(listedNormal?.type === HolidayType.NORMAL, "listHolidays correctly returns NORMAL type");

    console.log("  ✔ All Holiday Type Distinction (LEV-16) tests passed successfully!");
  } finally {
    await ctx.cleanup();
  }
}
