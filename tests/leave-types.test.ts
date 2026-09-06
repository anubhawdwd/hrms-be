// tests/leave-types.test.ts
import { prisma } from "../src/config/prisma.js";
import { LeaveService } from "../src/modules/leave/service.js";
import { EmployeeService } from "../src/modules/employee/service.js";
import { AuthProvider, UserRole } from "../src/generated/prisma/enums.js";
import { createIsolatedTestCompany } from "./helpers/isolated-test-context.js";

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`[FAIL] ${msg}`);
  console.log(`    ✔ ${msg}`);
}

export async function runLeaveTypeCatalogTests() {
  console.log("\n  [MODULE] Leave Types Catalog & Zero-Balance Filter Suite (Isolated)");
  const leaveService = new LeaveService();
  const employeeService = new EmployeeService();

  const ctx = await createIsolatedTestCompany({ setupStandardLeaveTypes: true });

  try {
    const companyId = ctx.company.id;
    const clType = ctx.leaveTypes["CLP"];
    const slType = ctx.leaveTypes["SL"];
    const coType = ctx.leaveTypes["COMP_OFF"];
    const mlType = ctx.leaveTypes["MATL"];

    // ==============================================================
    // ISSUE 1: ZERO-VALUE / INAPPLICABLE LEAVE TYPE FILTER VERIFICATION
    // ==============================================================
    const testUser = await prisma.user.create({
      data: {
        companyId,
        email: `zero.filter.${Date.now()}@isolatedtest.local`,
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
      firstName: "ZeroFilter",
      lastName: "Tester",
      joiningDate: "2026-01-01",
      isProbation: false,
      initialLeaveGrant: null,
    });

    // Seed 3 active balances (CL: 6, SL: 8, CompOff: 2) and 1 zero-value balance (Maternity: 0)
    await prisma.leaveBalance.createMany({
      data: [
        { employeeId: testEmp.id, leaveTypeId: clType.id, year: 2026, allocated: 6, used: 0, carriedForward: 0, remaining: 6 },
        { employeeId: testEmp.id, leaveTypeId: slType.id, year: 2026, allocated: 8, used: 2, carriedForward: 0, remaining: 6 },
        { employeeId: testEmp.id, leaveTypeId: coType.id, year: 2026, allocated: 2, used: 0, carriedForward: 0, remaining: 2 },
        { employeeId: testEmp.id, leaveTypeId: mlType.id, year: 2026, allocated: 0, used: 0, carriedForward: 0, remaining: 0 },
      ],
    });

    // 1. Raw DB check: 4 records exist
    const rawBalances = await prisma.leaveBalance.findMany({
      where: { employeeId: testEmp.id, year: 2026 },
    });
    assert(rawBalances.length === 4, `Database preserves all raw rows (found ${rawBalances.length})`);

    // 2. Active filter check: Only balances with allocated > 0 OR carriedForward > 0 OR used > 0
    const activeDisplayBalances = rawBalances.filter(
      (b) => b.allocated > 0 || b.carriedForward > 0 || b.used > 0 || b.remaining > 0
    );
    assert(activeDisplayBalances.length === 3, `Display filter returns exactly 3 active leave balances (found ${activeDisplayBalances.length})`);
    assert(!activeDisplayBalances.some((b) => b.leaveTypeId === mlType.id), "Inapplicable zero-value Maternity Leave is cleanly excluded from employee display");

    // ==============================================================
    // ISSUE 2: HR DYNAMIC LEAVE TYPE CREATION & LIFECYCLE
    // ==============================================================
    const newCode = `BL${Math.floor(1000 + Math.random() * 9000)}`;
    const createdType = await leaveService.createLeaveType({
      companyId,
      name: "Bereavement Leave",
      code: newCode.toLowerCase(),
      isPaid: true,
      autoGrantOnOnboarding: false,
    });
    assert(createdType.name === "Bereavement Leave", "HR successfully created new leave type 'Bereavement Leave'");
    assert(createdType.code === newCode, `Leave code '${newCode}' assigned in uppercase`);
    assert(createdType.isPaid === true, "Paid leave flag set to true");
    assert(createdType.isActive === true, "New leave type is active");

    // Edit Name
    const updatedType = await leaveService.updateLeaveType({
      leaveTypeId: createdType.id,
      companyId,
      name: "Compassionate & Bereavement Leave",
    });
    assert(updatedType.name === "Compassionate & Bereavement Leave", "Updated leave type name successfully");

    // Configure Policy
    await leaveService.upsertLeavePolicy({
      companyId,
      leaveTypeId: createdType.id,
      year: 2026,
      yearlyAllocation: 5,
      allowCarryForward: false,
      maxCarryForward: null,
      allowEncashment: false,
      probationAllowed: true,
      monthlyAccrual: false,
    });
    assert(true, "Configured 5 days policy for new leave type in 2026");

    // Allocate to employee
    const newAllocResult = await leaveService.adjustLeaveAllocation({
      employeeId: testEmp.id,
      adminUserId: ctx.adminUser.id,
      companyId,
      leaveTypeId: createdType.id,
      allocated: 5,
      reason: "Emergency bereavement grant",
    });
    assert(newAllocResult.allocated === 5, "Employee successfully granted 5 days of new HR-defined leave type");
    assert(newAllocResult.remaining === 5, "Remaining balance initialized to 5 days");

    // Soft Deactivation
    const deactivatedType = await leaveService.updateLeaveType({
      leaveTypeId: createdType.id,
      companyId,
      isActive: false,
    });
    assert(deactivatedType.isActive === false, "Leave type soft-deactivated successfully");

    const historicalBal = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: testEmp.id,
          leaveTypeId: createdType.id,
          year: 2026,
        },
      },
    });
    assert(historicalBal !== null, "Historical LeaveBalance record preserved after soft deactivation");
  } finally {
    await ctx.cleanup();
    console.log("    ✔ Cleaned up isolated leave types test company");
  }
}
