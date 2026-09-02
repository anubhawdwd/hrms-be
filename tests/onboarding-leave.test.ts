// tests/onboarding-leave.test.ts
import { prisma } from "../src/config/prisma.js";
import { EmployeeService } from "../src/modules/employee/service.js";
import { LeaveService } from "../src/modules/leave/service.js";
import { AuthProvider, UserRole } from "../src/generated/prisma/enums.js";
import { createIsolatedTestCompany } from "./helpers/isolated-test-context.js";

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`[FAIL] ${msg}`);
  console.log(`    ✔ ${msg}`);
}

export async function runOnboardingLeaveTests() {
  console.log("\n  [MODULE] Conditional Onboarding Leave Allocation Suite (Isolated)");
  const employeeService = new EmployeeService();
  const leaveService = new LeaveService();

  const ctx = await createIsolatedTestCompany({ setupStandardLeaveTypes: true });

  try {
    const companyId = ctx.company.id;
    const clpType = ctx.leaveTypes["CLP"];

    // Verify all leave types have autoGrantOnOnboarding === false
    const autoGrantedCount = await prisma.leaveType.count({
      where: { companyId, autoGrantOnOnboarding: true },
    });
    assert(autoGrantedCount === 0, "Confirmed autoGrantOnOnboarding is false on ALL leave types in test company");

    // ==========================================
    // SCENARIO 1: Probation with default 6 days
    // ==========================================
    const user1 = await prisma.user.create({
      data: {
        companyId,
        email: `probation.def.${Date.now()}@isolatedtest.local`,
        passwordHash: "$2b$10$abcdef",
        role: UserRole.EMPLOYEE,
        authProvider: AuthProvider.LOCAL,
        isActive: true,
      },
    });

    const emp1 = await employeeService.createEmployee({
      userId: user1.id,
      companyId,
      designationId: ctx.designation.id,
      firstName: "Probation",
      lastName: "DefaultSix",
      joiningDate: "2026-08-31",
      isProbation: true,
      initialLeaveGrant: {
        leaveTypeId: clpType.id,
        allocated: 6,
      },
    });

    const balances1 = await prisma.leaveBalance.findMany({
      where: { employeeId: emp1.id, year: 2026 },
      include: { leaveType: true },
    });

    assert(balances1.length === 1, "Scenario 1: Created exactly 1 LeaveBalance record (found " + balances1.length + ")");
    assert(balances1[0].allocated === 6, "Scenario 1: Allocation is exactly 6 days (found " + balances1[0].allocated + ")");
    assert(balances1[0].remaining === 6, "Scenario 1: Remaining is exactly 6 days (found " + balances1[0].remaining + ")");
    assert(balances1[0].leaveTypeId === clpType.id, "Scenario 1: Granted leave type is Casual Leave (Probation)");

    // ==========================================
    // SCENARIO 2: Probation with custom 10 days
    // ==========================================
    const user2 = await prisma.user.create({
      data: {
        companyId,
        email: `probation.custom.${Date.now()}@isolatedtest.local`,
        passwordHash: "$2b$10$abcdef",
        role: UserRole.EMPLOYEE,
        authProvider: AuthProvider.LOCAL,
        isActive: true,
      },
    });

    const emp2 = await employeeService.createEmployee({
      userId: user2.id,
      companyId,
      designationId: ctx.designation.id,
      firstName: "Probation",
      lastName: "CustomTen",
      joiningDate: "2026-08-31",
      isProbation: true,
      initialLeaveGrant: {
        leaveTypeId: clpType.id,
        allocated: 10,
      },
    });

    const balances2 = await prisma.leaveBalance.findMany({
      where: { employeeId: emp2.id, year: 2026 },
    });

    assert(balances2.length === 1, "Scenario 2: Created exactly 1 LeaveBalance record (found " + balances2.length + ")");
    assert(balances2[0].allocated === 10, "Scenario 2: Allocation is exactly 10 days (found " + balances2[0].allocated + ")");
    assert(balances2[0].remaining === 10, "Scenario 2: Remaining is exactly 10 days (found " + balances2[0].remaining + ")");

    // ==========================================
    // SCENARIO 3: Permanent with NO initial grant
    // ==========================================
    const user3 = await prisma.user.create({
      data: {
        companyId,
        email: `perm.nogrant.${Date.now()}@isolatedtest.local`,
        passwordHash: "$2b$10$abcdef",
        role: UserRole.EMPLOYEE,
        authProvider: AuthProvider.LOCAL,
        isActive: true,
      },
    });

    const emp3 = await employeeService.createEmployee({
      userId: user3.id,
      companyId,
      designationId: ctx.designation.id,
      firstName: "Permanent",
      lastName: "ZeroOnboarding",
      joiningDate: "2026-08-31",
      isProbation: false,
      initialLeaveGrant: null,
    });

    const balances3 = await prisma.leaveBalance.findMany({
      where: { employeeId: emp3.id, year: 2026 },
    });

    assert(balances3.length === 0, "Scenario 3: Permanent employee created with exactly 0 LeaveBalance records (found " + balances3.length + ")");

    // ==========================================
    // SCENARIO 4: HR manually grants leave post-onboarding
    // ==========================================
    const grantRes = await leaveService.adjustLeaveAllocation({
      employeeId: emp3.id,
      adminUserId: ctx.adminUser.id,
      companyId,
      leaveTypeId: ctx.leaveTypes["PL"].id,
      allocated: 12,
      reason: "Annual leave entitlement granted post-onboarding",
    });

    assert(grantRes.allocated === 12, "Scenario 4: HR successfully granted 12 days to permanent employee via Quick Edit flow");

    const balances4 = await prisma.leaveBalance.findMany({
      where: { employeeId: emp3.id, year: 2026 },
    });
    assert(balances4.length === 1, "Scenario 4: Employee now has 1 LeaveBalance record after HR manual grant");
  } finally {
    await ctx.cleanup();
    console.log("    ✔ Cleaned up isolated onboarding leave test company");
  }
}
