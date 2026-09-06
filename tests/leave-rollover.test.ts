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
  console.log("\n  [MODULE] LEV-12 Leave Policy & Year-End Rollover Suite (Isolated)");
  const leaveService = new LeaveService();
  const employeeService = new EmployeeService();

  const ctx = await createIsolatedTestCompany({ setupStandardLeaveTypes: true });

  try {
    const companyId = ctx.company.id;
    const plType = ctx.leaveTypes["PL"];
    const slType = ctx.leaveTypes["SL"];

    // ==============================================================
    // PART 1: CONFIGURE CURRENT YEAR-LESS POLICIES
    // ==============================================================
    // Privilege Leave: 18 days allocation, allows up to 5 days carry-forward
    await leaveService.upsertLeavePolicy({
      companyId,
      leaveTypeId: plType.id,
      yearlyAllocation: 18,
      allowCarryForward: true,
      maxCarryForward: 5,
      allowEncashment: false,
      probationAllowed: false,
      monthlyAccrual: false,
    });

    // Sick Leave: 12 days allocation, no carry-forward
    await leaveService.upsertLeavePolicy({
      companyId,
      leaveTypeId: slType.id,
      yearlyAllocation: 12,
      allowCarryForward: false,
      maxCarryForward: null,
      allowEncashment: false,
      probationAllowed: false,
      monthlyAccrual: false,
    });

    // ==============================================================
    // PART 2: SEED EMPLOYEE & 2026 FROM-YEAR BALANCES
    // ==============================================================
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

    // Seed 2026 balances:
    // - PL 2026: allocated 15, used 7 -> remaining 8 (policy cap is 5)
    // - SL 2026: allocated 12, used 8 -> remaining 4 (policy carryForward is false -> 0)
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

    // ==============================================================
    // PART 3: DRY-RUN PREVIEW (ZERO DATABASE WRITES)
    // ==============================================================
    console.log("    --- 1. Testing Dry-Run Preview (Zero DB Mutations) ---");
    const preview = await leaveService.previewYearEndRollover({
      companyId,
      fromYear: 2026,
      toYear: 2027,
    });

    assert(preview.fromYear === 2026 && preview.toYear === 2027, "Preview reflects requested years (2026 -> 2027)");
    assert(preview.totalEmployees >= 1, `Preview reports active employees (found ${preview.totalEmployees})`);
    assert(preview.alreadyRolledOver === false, "Preview indicates rollover has not run yet (alreadyRolledOver: false)");
    assert(preview.alreadyRolledOverCount === 0, "alreadyRolledOverCount is 0 initially");

    // Check PL projected calculation
    const plItem = preview.items.find((i) => i.employeeId === testEmp.id && i.leaveTypeCode === "PL");
    assert(Boolean(plItem), "Privilege Leave preview item found");
    assert(plItem!.fromYearRemaining === 8, "PL fromYearRemaining is 8");
    assert(plItem!.policyAllocated === 18, "PL policyAllocated is 18 (from current year-less policy)");
    assert(plItem!.carryForwardDays === 5, "PL carryForwardDays capped at 5");
    assert(plItem!.toYearProjectedRemaining === 23, "PL projected remaining is 23 (18 allocated + 5 carriedForward - 0 used)");

    // Check SL projected calculation
    const slItem = preview.items.find((i) => i.employeeId === testEmp.id && i.leaveTypeCode === "SL");
    assert(Boolean(slItem), "Sick Leave preview item found");
    assert(slItem!.policyAllocated === 12, "SL policyAllocated is 12");
    assert(slItem!.carryForwardDays === 0, "SL carryForwardDays is 0 (allowCarryForward: false)");
    assert(slItem!.toYearProjectedRemaining === 12, "SL projected remaining is 12 (12 allocated + 0 carriedForward - 0 used)");

    // Verify ZERO 2027 records exist in DB after dry run preview
    const balances2027BeforeCommit = await prisma.leaveBalance.findMany({
      where: { employeeId: testEmp.id, year: 2027 },
    });
    assert(balances2027BeforeCommit.length === 0, "Zero 2027 LeaveBalance records written during dry-run preview");

    // ==============================================================
    // PART 4: ATOMIC COMMIT EXECUTION (RUN 1)
    // ==============================================================
    console.log("    --- 2. Testing Atomic Transaction Commit (Run 1) ---");
    const commitRes1 = await leaveService.runYearEndRollover({
      companyId,
      adminUserId: ctx.adminUser.id,
      fromYear: 2026,
      toYear: 2027,
      reason: "Annual 2026->2027 HR Rollover",
    });

    assert(commitRes1.success === true, "Rollover commit succeeded");
    assert(commitRes1.processedCount >= 2, `Processed ${commitRes1.processedCount} balances atomically`);
    assert(Boolean(commitRes1.auditLogId), "Audit log ID returned");

    // Verify 2027 balances in DB
    const plBal2027 = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: testEmp.id,
          leaveTypeId: plType.id,
          year: 2027,
        },
      },
    });
    assert(plBal2027 !== null, "2027 PL balance record created in DB");
    assert(plBal2027!.allocated === 18, "PL allocated initialized to 18 (from current policy)");
    assert(plBal2027!.carriedForward === 5, "PL carriedForward is 5 (capped)");
    assert(plBal2027!.remaining === 23, "PL remaining is 23 (18 allocated + 5 carriedForward - 0 used)");

    const slBal2027 = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: testEmp.id,
          leaveTypeId: slType.id,
          year: 2027,
        },
      },
    });
    assert(slBal2027 !== null, "2027 SL balance record created in DB");
    assert(slBal2027!.allocated === 12, "SL allocated initialized to 12");
    assert(slBal2027!.carriedForward === 0, "SL carriedForward is 0");
    assert(slBal2027!.remaining === 12, "SL remaining is 12");

    // Verify AuditLog table entry
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        companyId,
        action: "YEAR_END_ROLLOVER",
      },
    });
    assert(auditLog !== null, "AuditLog entry persisted in database");
    assert(auditLog!.actorId === ctx.adminUser.id, "AuditLog actorId matches acting admin");
    const details = auditLog!.details as any;
    assert(details.fromYear === 2026 && details.toYear === 2027, "AuditLog details contains fromYear & toYear");
    assert(details.items && details.items.length >= 2, "AuditLog details contains per-employee before/after items");

    // ==============================================================
    // PART 5: IDEMPOTENCY GUARD & FORCE OVERWRITE (RUN 2)
    // ==============================================================
    console.log("    --- 3. Testing Idempotency Guard & Force Overwrite ---");

    // Preview should now report alreadyRolledOver: true
    const previewAfterRun1 = await leaveService.previewYearEndRollover({
      companyId,
      fromYear: 2026,
      toYear: 2027,
    });
    assert(previewAfterRun1.alreadyRolledOver === true, "Preview after Run 1 reflects alreadyRolledOver: true");
    assert(previewAfterRun1.alreadyRolledOverCount >= 1, `alreadyRolledOverCount is ${previewAfterRun1.alreadyRolledOverCount}`);

    // Commit without forceOverwrite should throw 409
    let blockedError: any = null;
    try {
      await leaveService.runYearEndRollover({
        companyId,
        adminUserId: ctx.adminUser.id,
        fromYear: 2026,
        toYear: 2027,
        forceOverwrite: false,
      });
    } catch (err: any) {
      blockedError = err;
    }
    assert(blockedError !== null, "Repeat rollover without forceOverwrite was blocked");
    assert(blockedError.statusCode === 409, "Blocked error returned status code 409");

    // Create an HR-only user
    const hrUser = await prisma.user.create({
      data: {
        companyId,
        email: `hr.only.${Date.now()}@isolatedtest.local`,
        passwordHash: "$2b$10$abcdef",
        roles: {
          create: [{ role: UserRole.HR }],
        },
        authProvider: AuthProvider.LOCAL,
        isActive: true,
      },
    });

    // 1. HR-only user attempting forceOverwrite: true must be blocked with 403
    let hrRoleBlockedError: any = null;
    try {
      await leaveService.runYearEndRollover({
        companyId,
        adminUserId: hrUser.id,
        fromYear: 2026,
        toYear: 2027,
        forceOverwrite: true,
        reason: "HR attempting overwrite",
      });
    } catch (err: any) {
      hrRoleBlockedError = err;
    }
    assert(hrRoleBlockedError !== null, "HR-only user attempting forceOverwrite: true is blocked");
    assert(hrRoleBlockedError.statusCode === 403, "HR-only user received 403 Forbidden");

    // 2. COMPANY_ADMIN user attempting forceOverwrite: true without reason must be blocked with 400
    let missingReasonError: any = null;
    try {
      await leaveService.runYearEndRollover({
        companyId,
        adminUserId: ctx.adminUser.id,
        fromYear: 2026,
        toYear: 2027,
        forceOverwrite: true,
        reason: "",
      });
    } catch (err: any) {
      missingReasonError = err;
    }
    assert(missingReasonError !== null, "forceOverwrite without reason is blocked");
    assert(missingReasonError.statusCode === 400, "Missing reason returned 400 Bad Request");

    // 3. COMPANY_ADMIN user attempting forceOverwrite: true with valid reason should succeed
    const commitRes2 = await leaveService.runYearEndRollover({
      companyId,
      adminUserId: ctx.adminUser.id,
      fromYear: 2026,
      toYear: 2027,
      forceOverwrite: true,
      reason: "Company Admin approved re-run with updated policies",
    });
    assert(commitRes2.success === true, "COMPANY_ADMIN with valid reason and forceOverwrite: true succeeded");

    // 4. Multi-role user (EMPLOYEE + COMPANY_ADMIN, e.g. Ravi) attempting forceOverwrite: true must also succeed
    const multiRoleUser = await prisma.user.create({
      data: {
        companyId,
        email: `ravi.multirole.${Date.now()}@isolatedtest.local`,
        passwordHash: "$2b$10$abcdef",
        roles: {
          create: [{ role: UserRole.EMPLOYEE }, { role: UserRole.COMPANY_ADMIN }],
        },
        authProvider: AuthProvider.LOCAL,
        isActive: true,
      },
    });

    const multiRoleCommitRes = await leaveService.runYearEndRollover({
      companyId,
      adminUserId: multiRoleUser.id,
      fromYear: 2026,
      toYear: 2027,
      forceOverwrite: true,
      reason: "Multi-role Admin (Ravi) approved force overwrite",
    });
    assert(multiRoleCommitRes.success === true, "Multi-role user (EMPLOYEE + COMPANY_ADMIN) successfully executed forceOverwrite");

    // Re-verify balances are still consistent and not double-counted
    const plBal2027_AfterOverwrite = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: testEmp.id,
          leaveTypeId: plType.id,
          year: 2027,
        },
      },
    });
    assert(plBal2027_AfterOverwrite!.allocated === 18, "PL allocated remains 18 after force overwrite");
    assert(plBal2027_AfterOverwrite!.carriedForward === 5, "PL carriedForward remains 5 (no double counting)");
    assert(plBal2027_AfterOverwrite!.remaining === 23, "PL remaining remains 23 (allocated + carriedForward - used)");

    // ==============================================================
    // PART 6: MULTI-YEAR ROLLOVER USING CURRENT YEAR-LESS POLICY (2027 -> 2028)
    // ==============================================================
    console.log("    --- 4. Testing Multi-Year Rollover Seamlessly Using Current Policy (2027 -> 2028) ---");
    // In 2027: PL has remaining = 23 (from previous rollover)
    // Now perform rollover from 2027 to 2028 without creating any new 2028 policy
    const preview2028 = await leaveService.previewYearEndRollover({
      companyId,
      fromYear: 2027,
      toYear: 2028,
    });
    const pl2028Item = preview2028.items.find((i) => i.employeeId === testEmp.id && i.leaveTypeCode === "PL");
    assert(Boolean(pl2028Item), "2028 preview found for PL");
    assert(pl2028Item!.fromYearRemaining === 23, "2027 remaining balance of 23 detected");
    assert(pl2028Item!.policyAllocated === 18, "2028 rollover seamlessly uses current policy allocation (18)");
    assert(pl2028Item!.carryForwardDays === 5, "2028 rollover seamlessly uses current policy cap (5)");
    assert(pl2028Item!.toYearProjectedRemaining === 23, "2028 projected remaining is 23 (18 allocated + 5 carriedForward - 0 used)");

    const commitRes2028 = await leaveService.runYearEndRollover({
      companyId,
      adminUserId: ctx.adminUser.id,
      fromYear: 2027,
      toYear: 2028,
      reason: "Annual 2027->2028 Rollover",
    });
    assert(commitRes2028.success === true, "2027->2028 Rollover commit succeeded without separate policy setup");

    const plBal2028 = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: testEmp.id,
          leaveTypeId: plType.id,
          year: 2028,
        },
      },
    });
    assert(plBal2028 !== null, "2028 PL balance record created in DB");
    assert(plBal2028!.allocated === 18, "2028 PL allocated initialized to 18");
    assert(plBal2028!.carriedForward === 5, "2028 PL carriedForward is 5");
    assert(plBal2028!.remaining === 23, "2028 PL remaining is 23");

    console.log("  ✔ All LEV-12 Year-End Rollover tests passed successfully!");
  } finally {
    await ctx.cleanup();
    console.log("    ✔ Cleaned up isolated rollover test company");
  }
}
