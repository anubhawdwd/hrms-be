// tests/bulk-allocate.test.ts
import { prisma } from "../src/config/prisma.js";
import { LeaveService } from "../src/modules/leave/service.js";
import { EmployeeService } from "../src/modules/employee/service.js";
import { AuthProvider, UserRole } from "../src/generated/prisma/enums.js";
import { createIsolatedTestCompany } from "./helpers/isolated-test-context.js";

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`[FAIL] ${msg}`);
  console.log(`    ✔ ${msg}`);
}

export async function runBulkAllocateTests() {
  console.log("\n  [MODULE] Bulk Leave Allocation Suite (Isolated)");
  const leaveService = new LeaveService();
  const employeeService = new EmployeeService();

  const ctx = await createIsolatedTestCompany({ setupStandardLeaveTypes: true });

  try {
    const companyId = ctx.company.id;
    const plType = ctx.leaveTypes["PL"];
    const slType = ctx.leaveTypes["SL"];

    // 1. Create two test employees inside the isolated company:
    // - Employee 1: Permanent (isProbation: false)
    // - Employee 2: Probation (isProbation: true)
    const userPerm = await prisma.user.create({
      data: {
        companyId,
        email: `perm.bulk.${Date.now()}@isolatedtest.local`,
        passwordHash: "$2b$10$abcdef",
        role: UserRole.EMPLOYEE,
        authProvider: AuthProvider.LOCAL,
        isActive: true,
      },
    });
    const empPerm = await employeeService.createEmployee({
      userId: userPerm.id,
      companyId,
      designationId: ctx.designation.id,
      firstName: "BulkPerm",
      lastName: "Employee",
      joiningDate: "2026-01-01",
      isProbation: false,
      initialLeaveGrant: null,
    });

    const userProb = await prisma.user.create({
      data: {
        companyId,
        email: `prob.bulk.${Date.now()}@isolatedtest.local`,
        passwordHash: "$2b$10$abcdef",
        role: UserRole.EMPLOYEE,
        authProvider: AuthProvider.LOCAL,
        isActive: true,
      },
    });
    const empProb = await employeeService.createEmployee({
      userId: userProb.id,
      companyId,
      designationId: ctx.designation.id,
      firstName: "BulkProb",
      lastName: "Employee",
      joiningDate: "2026-01-01",
      isProbation: true,
      initialLeaveGrant: null,
    });

    // Seed prior carriedForward balance on empPerm for PL in 2026
    await prisma.leaveBalance.create({
      data: {
        employeeId: empPerm.id,
        leaveTypeId: plType.id,
        year: 2026,
        allocated: 0,
        used: 0,
        carriedForward: 5,
        remaining: 5,
      },
    });

    // ==============================================================
    // TEST 1: Bulk allocate PL = 12 to ALL_ACTIVE
    // ==============================================================
    const resAll = await leaveService.bulkAllocateLeaves({
      companyId,
      adminUserId: ctx.adminUser.id,
      leaveTypeId: plType.id,
      year: 2026,
      allocated: 12,
      scope: "ALL_ACTIVE",
      reason: "Company-wide annual PL allocation",
    });
    // Count should be 3 (Admin, empPerm, empProb)
    assert(resAll.successCount === 3, `Bulk allocated PL=12 to all active employees (${resAll.successCount} processed)`);

    // Verify empPerm PL balance: allocated = 12, carriedForward = 5 preserved -> remaining = 17
    const permPL = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: empPerm.id,
          leaveTypeId: plType.id,
          year: 2026,
        },
      },
    });
    assert(permPL !== null, "Permanent employee PL balance exists");
    assert(permPL!.allocated === 12, "Permanent employee allocated PL updated to 12");
    assert(permPL!.carriedForward === 5, "Carried forward balance of 5 strictly preserved (not overwritten)");
    assert(permPL!.remaining === 17, `Remaining balance accurately calculated to 17 (12 + 5 = 17)`);

    // Verify empProb PL balance: allocated = 12, carriedForward = 0 -> remaining = 12
    const probPL = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: empProb.id,
          leaveTypeId: plType.id,
          year: 2026,
        },
      },
    });
    assert(probPL !== null && probPL.allocated === 12, "Probation employee received 12 PL under ALL_ACTIVE scope");

    // ==============================================================
    // TEST 2: Bulk allocate SL = 8 to Permanent Only (BY_EMPLOYMENT_TYPE, isProbation: false)
    // ==============================================================
    const resPerm = await leaveService.bulkAllocateLeaves({
      companyId,
      adminUserId: ctx.adminUser.id,
      leaveTypeId: slType.id,
      year: 2026,
      allocated: 8,
      scope: "BY_EMPLOYMENT_TYPE",
      isProbation: false,
      reason: "Permanent employee SL grant",
    });
    // 2 permanent employees: Admin, empPerm
    assert(resPerm.successCount === 2, `Bulk allocated SL=8 to Permanent employees (${resPerm.successCount} processed)`);

    const permSL = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: empPerm.id,
          leaveTypeId: slType.id,
          year: 2026,
        },
      },
    });
    assert(permSL !== null && permSL.allocated === 8, "Permanent employee received 8 SL");

    const probSL = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: empProb.id,
          leaveTypeId: slType.id,
          year: 2026,
        },
      },
    });
    assert(probSL === null, "Probation employee untouched for Permanent-only SL bulk allocation");

    // ==============================================================
    // TEST 3: Audit Override logging verification
    // ==============================================================
    const permOverride = await prisma.employeeLeaveOverride.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: empPerm.id,
          leaveTypeId: plType.id,
          year: 2026,
        },
      },
    });
    assert(permOverride !== null && permOverride.reason?.includes("Bulk Allocated by HR"), "Audit trail entry created with '[Bulk Allocated by HR: ...]'");
  } finally {
    await ctx.cleanup();
    console.log("    ✔ Cleaned up isolated bulk allocate test company");
  }
}
