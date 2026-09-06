// tests/leave.test.ts
import { prisma } from "../src/config/prisma.js";
import { LeaveService } from "../src/modules/leave/service.js";
import { EmployeeService } from "../src/modules/employee/service.js";
import { LeaveDurationType, LeaveRequestStatus, UserRole, AuthProvider } from "../src/generated/prisma/enums.js";
import { createIsolatedTestCompany } from "./helpers/isolated-test-context.js";

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`[FAIL] ${msg}`);
  console.log(`    ✔ ${msg}`);
}

export async function runLeaveTests() {
  console.log("\n  [MODULE] Leave Policy & Quota Validation Suite (Isolated)");
  const leaveService = new LeaveService();
  const employeeService = new EmployeeService();

  const ctx = await createIsolatedTestCompany({ setupStandardLeaveTypes: true });

  try {
    const companyId = ctx.company.id;

    // Test 1: Fetch active leave types for company
    const leaveTypes = await leaveService.listLeaveTypes(companyId);
    assert(leaveTypes.length >= 9, `Found ${leaveTypes.length} configured leave types for isolated company`);

    // Test 2: Leave Policy resolution
    const policies = await leaveService.listLeavePolicies(companyId, 2026);
    assert(policies.length >= 9, `Found ${policies.length} active leave policies for 2026`);

    // Create an isolated employee user & profile with balances
    const empUser = await prisma.user.create({
      data: {
        companyId,
        email: `emp.leave.${Date.now()}@isolatedtest.local`,
        passwordHash: "$2b$10$abcdef",
        roles: {
          create: [{ role: UserRole.EMPLOYEE }],
        },
        authProvider: AuthProvider.LOCAL,
        isActive: true,
      },
    });

    const empProfile = await employeeService.createEmployee({
      userId: empUser.id,
      companyId,
      designationId: ctx.designation.id,
      firstName: "Leave",
      lastName: "Tester",
      joiningDate: "2026-01-01",
      isProbation: false,
      initialLeaveGrant: null,
    });

    const plType = ctx.leaveTypes["PL"];
    const slType = ctx.leaveTypes["SL"];

    // Seed initial PL & SL balance
    const plBal = await prisma.leaveBalance.create({
      data: {
        employeeId: empProfile.id,
        leaveTypeId: plType.id,
        year: 2026,
        allocated: 15,
        used: 0,
        carriedForward: 0,
        remaining: 15,
      },
    });

    // Test 3: Leave Balances lookup for active employee
    const balances = await leaveService.getMyLeaveBalances(empUser.id, companyId, 2026);
    assert(Array.isArray(balances) && balances.length === 1, `Retrieved ${balances.length} leave balances for user ${empUser.email}`);

    // Test 4: Pending Leave Requests Query
    const pendingRequests = await leaveService.listPendingLeaveRequests(companyId);
    assert(Array.isArray(pendingRequests), `Pending leave query executed successfully (found ${pendingRequests.length} pending)`);

    // Test 5: Leave Request Status Types
    const validStatuses = Object.values(LeaveRequestStatus);
    assert(validStatuses.includes(LeaveRequestStatus.PENDING), "Contains PENDING status");
    assert(validStatuses.includes(LeaveRequestStatus.APPROVED), "Contains APPROVED status");
    assert(validStatuses.includes(LeaveRequestStatus.REJECTED), "Contains REJECTED status");
    assert(validStatuses.includes(LeaveRequestStatus.CANCELLED), "Contains CANCELLED status");

    // Test 6: HR / Admin fetching employee leave balance breakdown (Issue 3.1)
    const adminBalances = await leaveService.getLeaveBalancesByEmployeeId(empProfile.id, companyId, 2026);
    assert(Array.isArray(adminBalances) && adminBalances.length === 1, `HR successfully fetched ${adminBalances.length} balance items for employee #${empProfile.employeeCode}`);

    // Test 7: HR-Initiated "Mark Leave" Action (Issue 3.2)
    const startRemaining = plBal.remaining;
    const startUsed = plBal.used;

    const markedLeave = await leaveService.markLeaveByAdmin({
      employeeId: empProfile.id,
      adminUserId: ctx.adminUser.id,
      companyId,
      leaveTypeId: plType.id,
      fromDate: "2026-10-05",
      toDate: "2026-10-05",
      durationType: LeaveDurationType.FULL_DAY,
      reason: "Direct verbal approval for emergency personal matter",
    });

    assert(markedLeave.status === LeaveRequestStatus.APPROVED, "HR-marked leave created in APPROVED status immediately");
    assert(markedLeave.reason?.includes("Marked by HR"), "Leave contains '[Marked by HR: ...]' audit trail prefix");

    // Verify balance deduction
    const updatedBal = await prisma.leaveBalance.findUnique({
      where: { id: plBal.id },
    });
    assert(updatedBal!.remaining === startRemaining - 1, `Remaining balance deducted from ${startRemaining} to ${updatedBal!.remaining}`);
    assert(updatedBal!.used === startUsed + 1, `Used quota incremented from ${startUsed} to ${updatedBal!.used}`);

    // Test 8: Overlapping leave prevention on HR mark
    let hrOverlapBlocked = false;
    try {
      await leaveService.markLeaveByAdmin({
        employeeId: empProfile.id,
        adminUserId: ctx.adminUser.id,
        companyId,
        leaveTypeId: plType.id,
        fromDate: "2026-10-05",
        toDate: "2026-10-05",
        durationType: LeaveDurationType.FULL_DAY,
        reason: "HR attempting to mark duplicate leave on same date",
      });
    } catch (err: any) {
      hrOverlapBlocked = true;
      assert(err.message.includes("Employee already has"), "HR-marked conflicting leave rejected with message: " + err.message);
    }
    assert(hrOverlapBlocked, "HR-marked overlapping leave strictly rejected");

    // Test 9: Verify All Leave Types Have autoGrantOnOnboarding: false
    const autoGrantedTypes = await prisma.leaveType.findMany({
      where: { companyId, autoGrantOnOnboarding: true },
    });
    const notAutoGrantedTypes = await prisma.leaveType.findMany({
      where: { companyId, autoGrantOnOnboarding: false },
    });
    assert(autoGrantedTypes.length === 0, "Confirmed autoGrantOnOnboarding is false for all leave types in test company");
    assert(notAutoGrantedTypes.length >= 9, "All configured leave types have autoGrantOnOnboarding: false for explicit HR onboarding grant");

    // Test 10: HR / Admin Edit & Grant Leave Allocation (Issue C)
    const adjustedAlloc = 20;
    const editResult = await leaveService.adjustLeaveAllocation({
      employeeId: empProfile.id,
      adminUserId: ctx.adminUser.id,
      companyId,
      leaveTypeId: plType.id,
      allocated: adjustedAlloc,
      reason: "Performance bonus leave grant",
    });
    assert(editResult.allocated === adjustedAlloc, "Leave allocation successfully adjusted to " + adjustedAlloc);
    assert(editResult.remaining === adjustedAlloc - updatedBal!.used + updatedBal!.carriedForward, "Remaining balance accurately updated to " + editResult.remaining);

    // Part 2: Grant unallocated leave type (e.g. Paternity Leave)
    const patlType = ctx.leaveTypes["PATL"];
    const grantResult = await leaveService.adjustLeaveAllocation({
      employeeId: empProfile.id,
      adminUserId: ctx.adminUser.id,
      companyId,
      leaveTypeId: patlType.id,
      allocated: 5,
      reason: "New father paternity grant",
    });
    assert(grantResult.allocated === 5, "Successfully granted " + patlType.name + " with 5 days allocation");
    assert(grantResult.remaining === 5, "New balance initialized with 5 remaining days");

    // Verify audit override record was logged
    const overrideLog = await prisma.employeeLeaveOverride.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: empProfile.id,
          leaveTypeId: patlType.id,
          year: 2026,
        },
      },
    });
    assert(overrideLog !== null && overrideLog.reason?.includes("Allocated by HR"), "Audit override record created with '[Allocated by HR: ...]'");

    // Test 11: LWP Universal Availability & Zero-Balance Application Verification
    const lwpType = ctx.leaveTypes["LWP"] || (await leaveService.ensureLwpLeaveType(companyId));
    assert(lwpType !== null && lwpType.code === "LWP" && lwpType.isPaid === false, "LWP leave type is active, code=LWP, and isPaid=false");

    // Verify employee has ZERO leave balance record for LWP
    const lwpBalBefore = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: empProfile.id,
          leaveTypeId: lwpType.id,
          year: 2026,
        },
      },
    });
    assert(lwpBalBefore === null, "Confirmed employee has ZERO LeaveBalance records for LWP");

    // Employee applies for 3 days of LWP with NO balance record
    const appliedLwp = await leaveService.applyLeave({
      userId: empUser.id,
      companyId,
      leaveTypeId: lwpType.id,
      fromDate: "2026-11-10",
      toDate: "2026-11-12",
      durationType: LeaveDurationType.FULL_DAY,
      reason: "Unpaid leave for personal travel",
    });
    assert(appliedLwp.id !== undefined, "LWP applied successfully without any balance record or constraint");
    assert(appliedLwp.durationValue === 3, "LWP duration calculated as 3 days");
    assert(appliedLwp.status === LeaveRequestStatus.PENDING, "LWP request created in PENDING status");

    // HR approves the LWP request
    const approvedLwp = await leaveService.approveLeave({
      requestId: appliedLwp.id,
      approverUserId: ctx.adminUser.id,
      companyId,
    });
    assert(approvedLwp.status === LeaveRequestStatus.APPROVED, "LWP request successfully APPROVED by HR");

    // Verify still ZERO balance record exists or mutated for LWP
    const lwpBalAfter = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: empProfile.id,
          leaveTypeId: lwpType.id,
          year: 2026,
        },
      },
    });
    assert(lwpBalAfter === null, "Confirmed no LeaveBalance record created or corrupted for LWP after approval");

    // Admin marks LWP leave for employee directly without balance
    const adminMarkedLwp = await leaveService.markLeaveByAdmin({
      employeeId: empProfile.id,
      adminUserId: ctx.adminUser.id,
      companyId,
      leaveTypeId: lwpType.id,
      fromDate: "2026-11-20",
      toDate: "2026-11-20",
      durationType: LeaveDurationType.FULL_DAY,
      reason: "Emergency unpaid leave",
    });
    assert(adminMarkedLwp.status === LeaveRequestStatus.APPROVED, "Admin successfully marked LWP leave directly as APPROVED with no balance constraint");
  } finally {
    await ctx.cleanup();
    console.log("    ✔ Cleaned up isolated leave test company");
  }
}
