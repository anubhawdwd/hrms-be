// tests/zoho-balance-edit.test.ts
import { prisma } from "../src/config/prisma.js";
import { LeaveService } from "../src/modules/leave/service.js";
import { EmployeeService } from "../src/modules/employee/service.js";
import {
  AuthProvider,
  UserRole,
  LeaveDurationType,
  LeaveRequestStatus,
} from "../src/generated/prisma/enums.js";
import { createIsolatedTestCompany } from "./helpers/isolated-test-context.js";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[FAIL] ${message}`);
  }
  console.log(`    ✔ ${message}`);
}

export async function runZohoBalanceEditTests() {
  console.log("\n  [MODULE] Zoho-Style Leave Balance Correction Suite (Isolated)");

  const leaveService = new LeaveService();
  const employeeService = new EmployeeService();

  const ctx = await createIsolatedTestCompany({ setupStandardLeaveTypes: true });

  try {
    const companyId = ctx.company.id;
    const plType = ctx.leaveTypes["PL"];
    const slType = ctx.leaveTypes["SL"];
    const patlType = ctx.leaveTypes["PATL"];

    // 1. Create dedicated isolated test employee
    const testUser = await prisma.user.create({
      data: {
        companyId,
        email: `zoho.balance.${Date.now()}@isolatedtest.local`,
        passwordHash: "$2b$10$abcdef",
        role: UserRole.EMPLOYEE,
        authProvider: AuthProvider.LOCAL,
        isActive: true,
      },
    });

    const testEmp = await employeeService.createEmployee({
      userId: testUser.id,
      companyId,
      designationId: ctx.designation.id,
      firstName: "Zoho",
      lastName: "Tester",
      joiningDate: "2026-01-01",
      isProbation: false,
      initialLeaveGrant: null,
    });

    // Seed initial balance: Allocated=12, Used=3, CarriedForward=0, Remaining=9
    const initialPL = await prisma.leaveBalance.create({
      data: {
        employeeId: testEmp.id,
        leaveTypeId: plType.id,
        year: 2026,
        allocated: 12,
        used: 3,
        carriedForward: 0,
        remaining: 9,
      },
    });

    // Create a mock approved leave request to ensure historical leave requests exist
    const sampleRequest = await prisma.leaveRequest.create({
      data: {
        employeeId: testEmp.id,
        leaveTypeId: plType.id,
        fromDate: new Date("2026-03-01T00:00:00.000Z"),
        toDate: new Date("2026-03-03T00:00:00.000Z"),
        durationType: LeaveDurationType.FULL_DAY,
        durationValue: 3,
        status: LeaveRequestStatus.APPROVED,
        reason: "Historical booked leave",
      },
    });

    // ==============================================================
    // SCENARIO 1: 9 -> 15 (Target Available Balance = 15)
    // ==============================================================
    const res1 = await leaveService.adjustLeaveAllocation({
      employeeId: testEmp.id,
      adminUserId: ctx.adminUser.id,
      companyId,
      leaveTypeId: plType.id,
      newBalance: 15,
      reason: "Annual performance bonus increase",
    });

    assert(res1.remaining === 15, "Scenario 1: Target Available Balance corrected from 9 to 15 (found 15)");
    assert(res1.used === 3, "Scenario 1 & 5: Booked/Used remains strictly unchanged at 3 (found 3)");
    assert(res1.carriedForward === 0, "Scenario 1 & 6: Carried forward remains strictly unchanged at 0");
    assert(res1.allocated === 18, "Scenario 1: Underlying allocation adjusted to 18 (15 available + 3 booked = 18)");

    // ==============================================================
    // SCENARIO 2: 15 -> 5 (Target Available Balance = 5)
    // ==============================================================
    const res2 = await leaveService.adjustLeaveAllocation({
      employeeId: testEmp.id,
      adminUserId: ctx.adminUser.id,
      companyId,
      leaveTypeId: plType.id,
      newBalance: 5,
      reason: "Policy correction downward",
    });

    assert(res2.remaining === 5, "Scenario 2: Target Available Balance corrected from 15 to 5 (found 5)");
    assert(res2.used === 3, "Scenario 2 & 5: Booked/Used remains strictly unchanged at 3");
    assert(res2.allocated === 8, "Scenario 2: Underlying allocation adjusted to 8 (5 available + 3 booked = 8)");

    // ==============================================================
    // SCENARIO 3: 5 -> 0 (Target Available Balance = 0)
    // ==============================================================
    const res3 = await leaveService.adjustLeaveAllocation({
      employeeId: testEmp.id,
      adminUserId: ctx.adminUser.id,
      companyId,
      leaveTypeId: plType.id,
      newBalance: 0,
      reason: "Quota zeroed out for remaining year",
    });

    assert(res3.remaining === 0, "Scenario 3: Target Available Balance reduced to 0 (found 0)");
    assert(res3.used === 3, "Scenario 3 & 5: Booked/Used remains strictly unchanged at 3");
    assert(res3.allocated === 3, "Scenario 3: Underlying allocation adjusted to 3 (0 available + 3 booked = 3)");

    // ==============================================================
    // SCENARIO 4: Decimal/Hourly Precision (3.5 -> 6.25)
    // ==============================================================
    const res4_setup = await leaveService.adjustLeaveAllocation({
      employeeId: testEmp.id,
      adminUserId: ctx.adminUser.id,
      companyId,
      leaveTypeId: plType.id,
      newBalance: 3.5,
    });
    assert(res4_setup.remaining === 3.5, "Scenario 4: Available balance set to decimal 3.5");

    const res4 = await leaveService.adjustLeaveAllocation({
      employeeId: testEmp.id,
      adminUserId: ctx.adminUser.id,
      companyId,
      leaveTypeId: plType.id,
      newBalance: 6.25,
      reason: "Hourly comp adjustment",
    });
    assert(res4.remaining === 6.25, "Scenario 4: Decimal balance 3.5 -> 6.25 preserved exactly (found 6.25)");
    assert(res4.used === 3, "Scenario 4: Booked/Used remains strictly 3");
    assert(res4.allocated === 9.25, "Scenario 4: Underlying allocation adjusted to decimal 9.25 (6.25 + 3 = 9.25)");

    // ==============================================================
    // SCENARIO 6: Carry Forward Preserved with Balance Correction
    // e.g. Allocated=12, Used=3, CarriedForward=2, Remaining=11
    // HR enters 15 -> Allocated becomes 16, Carry stays 2, Used stays 3, Remaining becomes 15
    // ==============================================================
    const slBal = await prisma.leaveBalance.create({
      data: {
        employeeId: testEmp.id,
        leaveTypeId: slType.id,
        year: 2026,
        allocated: 12,
        used: 3,
        carriedForward: 2,
        remaining: 11,
      },
    });

    const res6 = await leaveService.adjustLeaveAllocation({
      employeeId: testEmp.id,
      adminUserId: ctx.adminUser.id,
      companyId,
      leaveTypeId: slType.id,
      newBalance: 15,
      reason: "Adjusted SL with carry-forward",
    });
    assert(res6.remaining === 15, "Scenario 6: Available balance corrected to 15");
    assert(res6.carriedForward === 2, "Scenario 6: Carried Forward strictly preserved at 2 (found 2)");
    assert(res6.used === 3, "Scenario 6: Booked/Used strictly preserved at 3 (found 3)");
    assert(res6.allocated === 16, "Scenario 6: Underlying allocation adjusted to 16 (15 target + 3 used - 2 carry = 16)");

    // ==============================================================
    // SCENARIO 7: Existing Historical Leave Requests Remain Unchanged
    // ==============================================================
    const checkRequest = await prisma.leaveRequest.findUnique({
      where: { id: sampleRequest.id },
    });
    assert(checkRequest!.status === LeaveRequestStatus.APPROVED, "Scenario 7: Historical leave request status remains APPROVED");
    assert(checkRequest!.durationValue === 3, "Scenario 7: Historical leave request durationValue remains 3");

    // ==============================================================
    // SCENARIO 8: Querying/Reopening shows newly saved balance
    // ==============================================================
    const refreshedBalances = await leaveService.getLeaveBalancesByEmployeeId(testEmp.id, companyId, 2026);
    const plQueried = refreshedBalances.find((b) => b.leaveTypeId === plType.id);
    assert(plQueried!.remaining === 6.25, "Scenario 8: Querying balance returns newly saved balance of 6.25");

    // ==============================================================
    // SCENARIO 9: Granting a brand-new leave type with 0 initial balance
    // ==============================================================
    const res9 = await leaveService.adjustLeaveAllocation({
      employeeId: testEmp.id,
      adminUserId: ctx.adminUser.id,
      companyId,
      leaveTypeId: patlType.id,
      newBalance: 10,
      reason: "New paternity quota grant",
    });
    assert(res9.remaining === 10, "Scenario 9: Unassigned leave type granted with 10 available days");
    assert(res9.allocated === 10, "Scenario 9: New allocation initialized to 10");
    assert(res9.used === 0, "Scenario 9: New used initialized to 0");

    // ==============================================================
    // SCENARIO 10: Idempotency & No duplicate balance records
    // ==============================================================
    const allPLBalances = await prisma.leaveBalance.findMany({
      where: { employeeId: testEmp.id, leaveTypeId: plType.id, year: 2026 },
    });
    assert(allPLBalances.length === 1, "Scenario 10: Exactly 1 leave balance record exists (no duplicate created)");

    console.log("    ✔ All 10 Zoho-style balance correction scenarios passed!");
  } finally {
    await ctx.cleanup();
    console.log("    ✔ Cleaned up isolated Zoho balance test company");
  }
}
