// tests/leave-fixes.test.ts
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

export async function runLeaveFixesTests() {
  console.log("\n  [MODULE] Leave Management Fixes Test Suite (Sandwich, Day-Deletion, Rejection)");

  const leaveService = new LeaveService();
  const employeeService = new EmployeeService();

  const ctx = await createIsolatedTestCompany({
    setupStandardLeaveTypes: true,
    sandwichRuleEnabled: true,
    workWeekDays: 5,
  });

  try {
    const companyId = ctx.company.id;
    const plType = ctx.leaveTypes["PL"]!;

    // Create test employee
    const timestamp = Date.now();
    const testUser = await prisma.user.create({
      data: {
        companyId,
        email: `emp.leavefixes.${timestamp}@isolatedtest.local`,
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
      firstName: "LeaveFix",
      lastName: "Tester",
      joiningDate: "2026-01-01",
      isProbation: false,
      initialLeaveGrant: null,
    });

    // Seed ample PL balance
    await prisma.leaveBalance.create({
      data: {
        employeeId: testEmp.id,
        leaveTypeId: plType.id,
        year: 2026,
        allocated: 30,
        used: 0,
        carriedForward: 0,
        remaining: 30,
      },
    });

    // Create dedicated HR user with an employee profile
    const hrUser = await prisma.user.create({
      data: {
        companyId,
        email: `hr.leavefixes.${timestamp}@isolatedtest.local`,
        passwordHash: "$2b$10$abcdef",
        role: UserRole.HR,
        authProvider: AuthProvider.LOCAL,
        isActive: true,
      },
    });

    const hrEmp = await employeeService.createEmployee({
      userId: hrUser.id,
      companyId,
      designationId: ctx.designation.id,
      firstName: "HR",
      lastName: "Approver",
      joiningDate: "2026-01-01",
      isProbation: false,
      initialLeaveGrant: null,
    });

    // ==============================================================
    // BUG 1: Sandwich Detection Across Separate Requests & Retroactive Balance Adjustment
    // 2026-09-04 = Friday, 2026-09-05 = Sat, 2026-09-06 = Sun, 2026-09-07 = Mon
    // ==============================================================
    console.log("\n  -- Testing Bug 1: Cross-request sandwich detection with retroactive adjustment --");

    // Case 1A: Apply Friday leave first (single day)
    const friReq = await leaveService.applyLeave({
      userId: testUser.id,
      companyId,
      leaveTypeId: plType.id,
      fromDate: "2026-09-04",
      toDate: "2026-09-04",
      durationType: LeaveDurationType.FULL_DAY,
      reason: "Friday leave alone",
    });

    const friDaysInitial = await prisma.leaveRequestDay.findMany({
      where: { leaveRequestId: friReq.id },
      orderBy: { date: "asc" },
    });
    assert(friDaysInitial.length === 1, "Friday leave has 1 day record initially");
    assert(friDaysInitial[0]!.isSandwichDay === false, "Friday is not a sandwich day");

    // Approve Friday leave alone (staggered approval 1)
    await leaveService.approveLeave({
      requestId: friReq.id,
      userId: hrUser.id,
      companyId,
    });

    const balanceAfterFriApprove = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: testEmp.id,
          leaveTypeId: plType.id,
          year: 2026,
        },
      },
    });
    assert(
      balanceAfterFriApprove!.used === 1 && balanceAfterFriApprove!.remaining === 29,
      "Friday approved alone deducted exactly 1 day (used: 1, remaining: 29)"
    );

    // Apply Monday leave second (staggered application 2)
    const monReq = await leaveService.applyLeave({
      userId: testUser.id,
      companyId,
      leaveTypeId: plType.id,
      fromDate: "2026-09-07",
      toDate: "2026-09-07",
      durationType: LeaveDurationType.FULL_DAY,
      reason: "Monday leave after Friday",
    });

    // Verify Friday request was RETROACTIVELY adjusted to reflect the bridge
    const friReqUpdated = await prisma.leaveRequest.findUnique({
      where: { id: friReq.id },
      include: { days: { orderBy: { date: "asc" } } },
    });

    assert(
      friReqUpdated!.durationValue === 3,
      `Friday request durationValue was retroactively adjusted from 1 to 3 (got ${friReqUpdated!.durationValue})`
    );
    assert(
      friReqUpdated!.days.length === 3,
      `Friday request days retroactively expanded to 3 days (Fri, Sat, Sun) (got ${friReqUpdated!.days.length})`
    );
    assert(friReqUpdated!.days[1]!.isSandwichDay === true, "Saturday retroactively added to Friday as sandwich day");
    assert(friReqUpdated!.days[2]!.isSandwichDay === true, "Sunday retroactively added to Friday as sandwich day");

    // Verify Friday's ORIGINAL LeaveBalance deduction is corrected after bridge creation
    const balanceAfterMonApply = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: testEmp.id,
          leaveTypeId: plType.id,
          year: 2026,
        },
      },
    });
    assert(
      balanceAfterMonApply!.used === 3 && balanceAfterMonApply!.remaining === 27,
      "Friday's LeaveBalance deduction was retroactively corrected for 2 bridge days (used: 3, remaining: 27)"
    );

    // Monday request is 1 day (Monday)
    assert(monReq.durationValue === 1, "Monday request durationValue is 1 day (Monday)");
    const monDays = await prisma.leaveRequestDay.findMany({
      where: { leaveRequestId: monReq.id },
    });
    assert(monDays.length === 1, "Monday request has 1 day record (Monday)");

    // Approve Monday leave second (staggered approval 2)
    await leaveService.approveLeave({
      requestId: monReq.id,
      userId: hrUser.id,
      companyId,
    });

    const balanceAfterMonApprove = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: testEmp.id,
          leaveTypeId: plType.id,
          year: 2026,
        },
      },
    });
    assert(
      balanceAfterMonApprove!.used === 4 && balanceAfterMonApprove!.remaining === 26,
      "Final balance after staggered approvals: 4 days used (3 attributed to Friday, 1 to Monday, remaining: 26)"
    );

    // Case 1B: Holiday bridge across separate requests
    // 2026-10-02 = Friday (Gandhi Jayanti holiday), 2026-10-01 = Thursday (leave), 2026-10-05 = Monday (leave)
    // Bridge from Thu to Mon over Fri (Holiday) + Sat + Sun = 3 bridge days
    await leaveService.createHoliday({
      companyId,
      name: "Gandhi Jayanti",
      date: new Date("2026-10-02T00:00:00.000Z"),
    });

    const thuReq = await leaveService.applyLeave({
      userId: testUser.id,
      companyId,
      leaveTypeId: plType.id,
      fromDate: "2026-10-01",
      toDate: "2026-10-01",
      durationType: LeaveDurationType.FULL_DAY,
      reason: "Thursday before holiday bridge",
    });

    const octMonReq = await leaveService.applyLeave({
      userId: testUser.id,
      companyId,
      leaveTypeId: plType.id,
      fromDate: "2026-10-05",
      toDate: "2026-10-05",
      durationType: LeaveDurationType.FULL_DAY,
      reason: "Monday after holiday bridge",
    });

    const thuReqUpdated = await prisma.leaveRequest.findUnique({
      where: { id: thuReq.id },
      include: { days: { orderBy: { date: "asc" } } },
    });

    assert(
      thuReqUpdated!.days.length === 4,
      `Thursday request retroactively expanded to 4 days: Thu + Fri(Holiday) + Sat + Sun (got ${thuReqUpdated!.days.length})`
    );
    assert(thuReqUpdated!.days[1]!.isSandwichDay === true, "Friday holiday is sandwich-marked on Thursday request");
    assert(thuReqUpdated!.days[2]!.isSandwichDay === true, "Saturday is sandwich-marked on Thursday request");
    assert(thuReqUpdated!.days[3]!.isSandwichDay === true, "Sunday is sandwich-marked on Thursday request");

    const octMonDays = await prisma.leaveRequestDay.findMany({
      where: { leaveRequestId: octMonReq.id },
    });
    assert(octMonDays.length === 1, "Monday request has 1 regular leave day");
    assert(octMonDays[0]!.isSandwichDay === false, "Monday is regular leave day");

    // ==============================================================
    // FEATURE 2: HR Select Individual Days -> Delete -> Approve Rest with Delta Recalc
    // ==============================================================
    console.log("\n  -- Testing Feature 2: Day-level delete and delta balance recalculation --");

    // Apply a 4-day leave: 2026-11-03 (Tue) to 2026-11-06 (Fri)
    const multiReq = await leaveService.applyLeave({
      userId: testUser.id,
      companyId,
      leaveTypeId: plType.id,
      fromDate: "2026-11-03",
      toDate: "2026-11-06",
      durationType: LeaveDurationType.FULL_DAY,
      reason: "4 day vacation",
    });

    let multiDays = await prisma.leaveRequestDay.findMany({
      where: { leaveRequestId: multiReq.id },
      orderBy: { date: "asc" },
    });
    assert(multiDays.length === 4, "Initially 4 days in request");

    // Delete 1 day (e.g. Wednesday 2026-11-04) while PENDING
    const wednesdayDay = multiDays.find((d) => d.date.toISOString().slice(0, 10) === "2026-11-04")!;
    const updatedPendingReq = (await leaveService.deleteLeaveRequestDays({
      requestId: multiReq.id,
      dayIds: [wednesdayDay.id],
      adminUserId: hrUser.id,
      companyId,
    })) as any;

    assert(updatedPendingReq.durationValue === 3, "Duration reduced to 3 days after deleting Wednesday");

    const remainingPendingDays = await prisma.leaveRequestDay.findMany({
      where: { leaveRequestId: multiReq.id },
      orderBy: { date: "asc" },
    });
    assert(remainingPendingDays.length === 3, "Hard-deleted Wednesday, 3 day rows remain in DB");
    assert(
      !remainingPendingDays.some((d) => d.id === wednesdayDay.id),
      "Wednesday row is completely gone from DB"
    );

    // Now approve the remaining 3 days
    const balanceBeforeApprove = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: testEmp.id,
          leaveTypeId: plType.id,
          year: 2026,
        },
      },
    });

    await leaveService.approveLeave({
      requestId: multiReq.id,
      userId: hrUser.id,
      companyId,
    });

    const balanceAfterApprove = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: testEmp.id,
          leaveTypeId: plType.id,
          year: 2026,
        },
      },
    });

    assert(
      balanceBeforeApprove!.remaining - balanceAfterApprove!.remaining === 3,
      "Approved remaining 3 days and exactly 3 days deducted from balance"
    );

    // Now test deleting a day from an ALREADY APPROVED request (delta balance restoration)
    const friDayInApproved = remainingPendingDays.find(
      (d) => d.date.toISOString().slice(0, 10) === "2026-11-06"
    )!;

    await leaveService.deleteLeaveRequestDays({
      requestId: multiReq.id,
      dayIds: [friDayInApproved.id],
      adminUserId: hrUser.id,
      companyId,
    });

    const balanceAfterApprovedDayDelete = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: testEmp.id,
          leaveTypeId: plType.id,
          year: 2026,
        },
      },
    });

    assert(
      balanceAfterApprovedDayDelete!.remaining - balanceAfterApprove!.remaining === 1,
      "Delta balance restored: 1 day returned to remaining balance upon deleting 1 approved day"
    );
    assert(
      balanceAfterApprove!.used - balanceAfterApprovedDayDelete!.used === 1,
      "Delta balance restored: 1 day decremented from used balance upon deleting 1 approved day"
    );

    // ==============================================================
    // BUG 3: Leave Reject Across Admin Dashboard
    // ==============================================================
    console.log("\n  -- Testing Bug 3: Leave rejection from Admin & HR --");

    // 3A: Rejection by CompanyAdmin (who might not have an EmployeeProfile)
    const rejectReq1 = await leaveService.applyLeave({
      userId: testUser.id,
      companyId,
      leaveTypeId: plType.id,
      fromDate: "2026-12-01",
      toDate: "2026-12-01",
      durationType: LeaveDurationType.FULL_DAY,
      reason: "To be rejected by Company Admin",
    });

    const rejected1 = await leaveService.rejectLeave({
      requestId: rejectReq1.id,
      userId: ctx.adminUser.id, // Company Admin User ID
      companyId,
      reason: "Not approved due to project deadline",
    });

    assert(rejected1.status === LeaveRequestStatus.REJECTED, "Leave status is REJECTED by Company Admin");
    assert(
      rejected1.reason?.includes("[Rejected by HR] Not approved due to project deadline"),
      "Reason correctly recorded on rejection"
    );

    const rejectReq1Days = await prisma.leaveRequestDay.findMany({
      where: { leaveRequestId: rejectReq1.id },
    });
    assert(
      rejectReq1Days.every((d) => d.status === LeaveRequestStatus.REJECTED),
      "All LeaveRequestDay rows are marked REJECTED"
    );

    // 3B: Rejection by HR user (has EmployeeProfile)
    const rejectReq2 = await leaveService.applyLeave({
      userId: testUser.id,
      companyId,
      leaveTypeId: plType.id,
      fromDate: "2026-12-02",
      toDate: "2026-12-02",
      durationType: LeaveDurationType.FULL_DAY,
      reason: "To be rejected by HR",
    });

    const rejected2 = await leaveService.rejectLeave({
      requestId: rejectReq2.id,
      userId: hrUser.id,
      companyId,
      reason: "Staffing constraint",
    });

    // ==============================================================
    // FEATURE 4: Per-Day Approve & Reject Status Transition with Balance Delta
    // ==============================================================
    console.log("\n  -- Testing Feature 4: Per-day approve/reject status transition & balance delta --");

    const balBeforePerDay = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: testEmp.id,
          leaveTypeId: plType.id,
          year: 2026,
        },
      },
    });
    const startingRemaining = balBeforePerDay!.remaining;
    const startingUsed = balBeforePerDay!.used;

    // Apply a 3-day leave: 2026-12-08 (Tue) to 2026-12-10 (Thu)
    const perDayReq = await leaveService.applyLeave({
      userId: testUser.id,
      companyId,
      leaveTypeId: plType.id,
      fromDate: "2026-12-08",
      toDate: "2026-12-10",
      durationType: LeaveDurationType.FULL_DAY,
      reason: "3 day per-day approval test",
    });

    const perDays = await prisma.leaveRequestDay.findMany({
      where: { leaveRequestId: perDayReq.id },
      orderBy: { date: "asc" },
    });
    assert(perDays.length === 3, "Per-day request has 3 days");

    // 4A: Approve Day 1 individually
    const updatedReqAfterDay1 = await leaveService.updateLeaveRequestDayStatus({
      requestId: perDayReq.id,
      dayId: perDays[0]!.id,
      status: LeaveRequestStatus.APPROVED,
      adminUserId: hrUser.id,
      companyId,
    });

    const balAfterDay1Approve = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: testEmp.id,
          leaveTypeId: plType.id,
          year: 2026,
        },
      },
    });
    assert(
      balAfterDay1Approve!.used === startingUsed + 1 &&
        balAfterDay1Approve!.remaining === startingRemaining - 1,
      "Per-day approve on Day 1 deducted exactly 1 day from balance"
    );
    assert(
      updatedReqAfterDay1.status === LeaveRequestStatus.PENDING,
      "Parent request remains PENDING while other days are still pending"
    );

    // 4B: Approve Day 2 individually
    await leaveService.updateLeaveRequestDayStatus({
      requestId: perDayReq.id,
      dayId: perDays[1]!.id,
      status: LeaveRequestStatus.APPROVED,
      adminUserId: hrUser.id,
      companyId,
    });

    const balAfterDay2Approve = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: testEmp.id,
          leaveTypeId: plType.id,
          year: 2026,
        },
      },
    });
    assert(
      balAfterDay2Approve!.used === startingUsed + 2 &&
        balAfterDay2Approve!.remaining === startingRemaining - 2,
      "Per-day approve on Day 2 deducted another 1 day from balance"
    );

    // 4C: Reject Day 3 individually (all 3 days now resolved: 2 approved, 1 rejected)
    const updatedReqAfterDay3 = await leaveService.updateLeaveRequestDayStatus({
      requestId: perDayReq.id,
      dayId: perDays[2]!.id,
      status: LeaveRequestStatus.REJECTED,
      adminUserId: hrUser.id,
      companyId,
    });

    assert(
      updatedReqAfterDay3.status === LeaveRequestStatus.APPROVED,
      "Parent request transitions to APPROVED once all days resolved (with >=1 approved)"
    );
    assert(
      updatedReqAfterDay3.durationValue === 2,
      `Parent durationValue recalculated to 2 days (got ${updatedReqAfterDay3.durationValue})`
    );

    // 4D: Change Day 2 from APPROVED to REJECTED (Balance restoration)
    const updatedReqAfterDay2Reject = await leaveService.updateLeaveRequestDayStatus({
      requestId: perDayReq.id,
      dayId: perDays[1]!.id,
      status: LeaveRequestStatus.REJECTED,
      adminUserId: hrUser.id,
      companyId,
    });

    const balAfterDay2Reject = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: testEmp.id,
          leaveTypeId: plType.id,
          year: 2026,
        },
      },
    });
    assert(
      balAfterDay2Reject!.used === startingUsed + 1 &&
        balAfterDay2Reject!.remaining === startingRemaining - 1,
      "Rejecting previously approved Day 2 restored 1 day back to balance"
    );
    assert(
      updatedReqAfterDay2Reject.durationValue === 1,
      `Parent durationValue updated to 1 day after Day 2 rejected (got ${updatedReqAfterDay2Reject.durationValue})`
    );
    assert(
      updatedReqAfterDay2Reject.status === LeaveRequestStatus.APPROVED,
      "Parent request remains APPROVED as Day 1 is still approved"
    );

    // 4E: Change Day 1 from APPROVED to REJECTED (All days now rejected)
    const updatedReqAfterAllReject = await leaveService.updateLeaveRequestDayStatus({
      requestId: perDayReq.id,
      dayId: perDays[0]!.id,
      status: LeaveRequestStatus.REJECTED,
      adminUserId: hrUser.id,
      companyId,
    });

    const balAfterAllReject = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: testEmp.id,
          leaveTypeId: plType.id,
          year: 2026,
        },
      },
    });
    assert(
      balAfterAllReject!.used === startingUsed &&
        balAfterAllReject!.remaining === startingRemaining,
      "Rejecting Day 1 restored balance completely back to starting value"
    );
    assert(
      updatedReqAfterAllReject.status === LeaveRequestStatus.REJECTED,
      "Parent request transitions to REJECTED once all days are rejected"
    );
    assert(
      updatedReqAfterAllReject.durationValue === 0,
      "Parent durationValue becomes 0 when all days are rejected"
    );

    console.log("  ✔ All leave management fixes verified successfully!");
  } finally {
    await ctx.cleanup();
  }
}

if (process.argv[1]?.endsWith("leave-fixes.test.ts")) {
  runLeaveFixesTests()
    .then(() => {
      console.log("Leave fixes test completed successfully.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Test failed:", err);
      process.exit(1);
    });
}
