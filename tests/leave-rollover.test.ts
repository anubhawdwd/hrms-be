// tests/leave-rollover.test.ts
import { prisma } from "../src/config/prisma.js";
import { LeaveService } from "../src/modules/leave/service.js";
import { EmployeeService } from "../src/modules/employee/service.js";
import { AuthProvider, UserRole } from "../src/generated/prisma/enums.js";
import { createIsolatedTestCompany } from "./helpers/isolated-test-context.js";

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`[FAIL] ${msg}`);
  console.log(`    ✔ ${msg}`);
}

export async function runLeaveRolloverTests() {
  console.log("\n  [MODULE] Leave Policy & Year-End Rollover Suite (Isolated)");
  const leaveService = new LeaveService();
  const employeeService = new EmployeeService();

  const ctx = await createIsolatedTestCompany({ setupStandardLeaveTypes: true });

  try {
    const companyId = ctx.company.id;
    const plType = ctx.leaveTypes["PL"];
    const slType = ctx.leaveTypes["SL"];

    // ==============================================================
    // PART 1: LEAVE POLICY PERSISTENCE & CARRY-FORWARD SETTINGS
    // ==============================================================
    const updatedPLPolicy = await leaveService.upsertLeavePolicy({
      companyId,
      leaveTypeId: plType.id,
      year: 2026,
      yearlyAllocation: 15,
      allowCarryForward: true,
      maxCarryForward: 5,
      allowEncashment: true,
      probationAllowed: false,
      monthlyAccrual: false,
    });
    assert(updatedPLPolicy.allowCarryForward === true, "Privilege Leave policy has allowCarryForward: true");
    assert(updatedPLPolicy.maxCarryForward === 5, "Privilege Leave policy has maxCarryForward: 5");

    const updatedSLPolicy = await leaveService.upsertLeavePolicy({
      companyId,
      leaveTypeId: slType.id,
      year: 2026,
      yearlyAllocation: 12,
      allowCarryForward: false,
      maxCarryForward: null,
      allowEncashment: false,
      probationAllowed: true,
      monthlyAccrual: false,
    });
    assert(updatedSLPolicy.allowCarryForward === false, "Sick Leave policy has allowCarryForward: false");
    assert(updatedSLPolicy.maxCarryForward === null, "Sick Leave policy has maxCarryForward: null");

    // Verify reload via listLeavePolicies
    const policies2026 = await leaveService.listLeavePolicies(companyId, 2026);
    const reloadedPL = policies2026.find((p) => p.leaveTypeId === plType.id);
    const reloadedSL = policies2026.find((p) => p.leaveTypeId === slType.id);
    assert(reloadedPL?.allowCarryForward === true && reloadedPL?.maxCarryForward === 5, "Privilege Leave policy reloaded with carry-forward cap: 5");
    assert(reloadedSL?.allowCarryForward === false, "Sick Leave policy reloaded with allowCarryForward: false");

    // ==============================================================
    // PART 2: YEAR-END ROLLOVER EXECUTION & IDEMPOTENCY
    // ==============================================================
    // Create dedicated test employee for rollover
    const testUser = await prisma.user.create({
      data: {
        companyId,
        email: `rollover.test.${Date.now()}@isolatedtest.local`,
        passwordHash: "$2b$10$abcdef",
        roles: {
          create: [{ role: UserRole.EMPLOYEE }],
        },
        authProvider: AuthProvider.LOCAL,
        isActive: true,
      },
    });

    const testEmp = await employeeService.createEmployee({
      userId: testUser.id,
      companyId,
      designationId: ctx.designation.id,
      firstName: "Rollover",
      lastName: "Tester",
      joiningDate: "2026-01-01",
      isProbation: false,
      initialLeaveGrant: null,
    });

    // Seed 2026 balances for the test employee:
    // - Privilege Leave: allocated = 15, used = 7 -> remaining = 8 (policy cap = 5)
    // - Sick Leave: allocated = 12, used = 8 -> remaining = 4 (policy allowCarryForward = false)
    await prisma.leaveBalance.create({
      data: {
        employeeId: testEmp.id,
        leaveTypeId: plType.id,
        year: 2026,
        allocated: 15,
        used: 7,
        carriedForward: 0,
        remaining: 8,
      },
    });

    await prisma.leaveBalance.create({
      data: {
        employeeId: testEmp.id,
        leaveTypeId: slType.id,
        year: 2026,
        allocated: 12,
        used: 8,
        carriedForward: 0,
        remaining: 4,
      },
    });

    // RUN 1: Execute Rollover from 2026 -> 2027
    const rolloverRes1 = await leaveService.runYearEndRollover({
      companyId,
      adminUserId: ctx.adminUser.id,
      fromYear: 2026,
      toYear: 2027,
    });
    assert(rolloverRes1.successCount >= 2, `Rollover Run 1 completed with ${rolloverRes1.successCount} balances processed`);

    // Verify 2027 balances for test employee
    const plBal2027_Run1 = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: testEmp.id,
          leaveTypeId: plType.id,
          year: 2027,
        },
      },
    });
    assert(plBal2027_Run1 !== null, "2027 Privilege Leave balance record created");
    assert(plBal2027_Run1!.carriedForward === 5, `Privilege Leave 2027 carriedForward is capped at 5 (remaining was 8, cap is 5)`);
    assert(plBal2027_Run1!.remaining === 5, `Privilege Leave 2027 remaining initialized to 5`);

    const slBal2027_Run1 = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: testEmp.id,
          leaveTypeId: slType.id,
          year: 2027,
        },
      },
    });
    assert(slBal2027_Run1 !== null, "2027 Sick Leave balance record created");
    assert(slBal2027_Run1!.carriedForward === 0, `Sick Leave 2027 carriedForward is 0 (allowCarryForward was false)`);
    assert(slBal2027_Run1!.remaining === 0, `Sick Leave 2027 remaining is 0`);

    // Check audit trail in EmployeeLeaveOverride
    const plOverride = await prisma.employeeLeaveOverride.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: testEmp.id,
          leaveTypeId: plType.id,
          year: 2027,
        },
      },
    });
    assert(plOverride !== null && plOverride.reason?.includes("Rollover by HR"), "Audit override created with '[Rollover by HR: ...]'");

    // RUN 2: Execute Rollover AGAIN to verify idempotency (zero double-counting)
    const rolloverRes2 = await leaveService.runYearEndRollover({
      companyId,
      adminUserId: ctx.adminUser.id,
      fromYear: 2026,
      toYear: 2027,
    });
    assert(rolloverRes2.successCount >= 2, `Rollover Run 2 (idempotency check) completed`);

    const plBal2027_Run2 = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: testEmp.id,
          leaveTypeId: plType.id,
          year: 2027,
        },
      },
    });
    assert(plBal2027_Run2!.carriedForward === 5, "Idempotency verified: Privilege Leave carriedForward remains 5 (no double-counting)");
    assert(plBal2027_Run2!.remaining === 5, "Idempotency verified: Privilege Leave remaining remains 5");

    const slBal2027_Run2 = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: testEmp.id,
          leaveTypeId: slType.id,
          year: 2027,
        },
      },
    });
    assert(slBal2027_Run2!.carriedForward === 0, "Idempotency verified: Sick Leave carriedForward remains 0");
  } finally {
    await ctx.cleanup();
    console.log("    ✔ Cleaned up isolated rollover test company");
  }
}
