// tests/sandwich-policy.test.ts
import { prisma } from "../src/config/prisma.js";
import { LeaveService } from "../src/modules/leave/service.js";
import { EmployeeService } from "../src/modules/employee/service.js";
import {
  AuthProvider,
  UserRole,
  LeaveDurationType,
  AttendanceStatus,
} from "../src/generated/prisma/enums.js";
import { createIsolatedTestCompany } from "./helpers/isolated-test-context.js";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[FAIL] ${message}`);
  }
  console.log(`    ✔ ${message}`);
}

export async function runSandwichPolicyTests() {
  console.log("\n  [MODULE] Simplified Sandwich Policy & Holiday Suite (Isolated)");

  const leaveService = new LeaveService();
  const employeeService = new EmployeeService();

  const ctx = await createIsolatedTestCompany({ setupStandardLeaveTypes: true });

  try {
    const companyId = ctx.company.id;
    const plType = ctx.leaveTypes["PL"];
    const slType = ctx.leaveTypes["SL"];

    // 1. Create dedicated test employee
    const testUser = await prisma.user.create({
      data: {
        companyId,
        email: `sandwich.simplified.${Date.now()}@isolatedtest.local`,
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
      firstName: "Sandwich",
      lastName: "Tester",
      joiningDate: "2026-01-01",
      isProbation: false,
      initialLeaveGrant: null,
    });

    // Seed ample balances
    await prisma.leaveBalance.create({
      data: {
        employeeId: testEmp.id,
        leaveTypeId: plType.id,
        year: 2026,
        allocated: 50,
        used: 0,
        carriedForward: 0,
        remaining: 50,
      },
    });

    await prisma.leaveBalance.create({
      data: {
        employeeId: testEmp.id,
        leaveTypeId: slType.id,
        year: 2026,
        allocated: 50,
        used: 0,
        carriedForward: 0,
        remaining: 50,
      },
    });

    // ==============================================================
    // SCENARIO 1: Leave application on existing holiday -> BLOCKED
    // ==============================================================
    await leaveService.createHoliday({
      companyId,
      name: "Independence Day",
      date: new Date("2026-08-15T00:00:00.000Z"),
    });

    let holidayBlocked = false;
    try {
      await leaveService.applyLeave({
        userId: testUser.id,
        companyId,
        leaveTypeId: plType.id,
        fromDate: "2026-08-15",
        toDate: "2026-08-15",
        durationType: LeaveDurationType.FULL_DAY,
        reason: "Holiday leave attempt",
      });
    } catch (err: any) {
      if (err.message.includes("Leave cannot be applied on a company holiday")) {
        holidayBlocked = true;
      }
    }
    assert(holidayBlocked, "Scenario 1: Leave application on existing holiday is blocked in backend with clear error");

    // ==============================================================
    // SCENARIO 2: Existing leave + Holiday created later -> Leave remains unchanged
    // ==============================================================
    const leaveBeforeHoliday = await leaveService.applyLeave({
      userId: testUser.id,
      companyId,
      leaveTypeId: plType.id,
      fromDate: "2026-10-02",
      toDate: "2026-10-02",
      durationType: LeaveDurationType.FULL_DAY,
      reason: "Gandhi Jayanti leave before holiday declared",
    });
    await leaveService.approveLeave({
      requestId: leaveBeforeHoliday.id,
      approverUserId: ctx.adminUser.id,
      companyId,
    });

    // Now HR declares Gandhi Jayanti as a holiday
    await leaveService.createHoliday({
      companyId,
      name: "Gandhi Jayanti",
      date: new Date("2026-10-02T00:00:00.000Z"),
    });

    // Verify leave request and day status remain unchanged
    const leaveAfterHolidayCreated = await prisma.leaveRequest.findUnique({
      where: { id: leaveBeforeHoliday.id },
      include: { days: true },
    });
    assert(leaveAfterHolidayCreated!.status === "APPROVED", "Scenario 2: Existing leave status remains APPROVED when holiday declared later");
    assert(leaveAfterHolidayCreated!.durationValue === 1, "Scenario 2: Existing leave durationValue remains 1");
    assert(leaveAfterHolidayCreated!.days[0].status === "APPROVED", "Scenario 2: Child day status remains APPROVED");
    assert(leaveAfterHolidayCreated!.days[0].deductDays === 1, "Scenario 2: Child day deductDays remains 1");

    // ==============================================================
    // SCENARIO 3: Company Sandwich OFF -> Separate Friday & Monday (0 sandwich)
    // ==============================================================
    await prisma.company.update({
      where: { id: companyId },
      data: { sandwichRuleEnabled: false, workWeekDays: 5 },
    });

    const reqFriOff = await leaveService.applyLeave({
      userId: testUser.id,
      companyId,
      leaveTypeId: plType.id,
      fromDate: "2026-08-07", // Friday
      toDate: "2026-08-07",
      durationType: LeaveDurationType.FULL_DAY,
      reason: "Friday off test",
    });
    const reqMonOff = await leaveService.applyLeave({
      userId: testUser.id,
      companyId,
      leaveTypeId: plType.id,
      fromDate: "2026-08-10", // Monday
      toDate: "2026-08-10",
      durationType: LeaveDurationType.FULL_DAY,
      reason: "Monday off test",
    });
    assert(reqFriOff.durationValue === 1, "Scenario 3: Friday request deducts 1 day when Sandwich is OFF");
    assert(reqMonOff.durationValue === 1, "Scenario 3: Monday request deducts 1 day when Sandwich is OFF");
    assert(reqFriOff.durationValue + reqMonOff.durationValue === 2, "Scenario 3: Total deduction across Friday + Monday is 2 days when Sandwich is OFF");

    await prisma.leaveRequestDay.deleteMany({ where: { leaveRequestId: { in: [reqFriOff.id, reqMonOff.id] } } });
    await prisma.leaveRequest.deleteMany({ where: { id: { in: [reqFriOff.id, reqMonOff.id] } } });

    // ==============================================================
    // SCENARIO 4 & 7: Sandwich ON + Thu Leave + Fri Holiday + Sat/Sun Weekend + Mon Leave
    // Total = 5 days
    // ==============================================================
    await prisma.company.update({
      where: { id: companyId },
      data: { sandwichRuleEnabled: true, workWeekDays: 5 },
    });

    await leaveService.createHoliday({
      companyId,
      name: "Good Friday",
      date: new Date("2026-04-03T00:00:00.000Z"), // Friday
    });

    const reqThuHoliday = await leaveService.applyLeave({
      userId: testUser.id,
      companyId,
      leaveTypeId: plType.id,
      fromDate: "2026-04-02", // Thursday
      toDate: "2026-04-02",
      durationType: LeaveDurationType.FULL_DAY,
      reason: "Thursday leave before Good Friday",
    });
    assert(reqThuHoliday.durationValue === 1, "Scenario 4: Thursday leave deducts 1 day");

    const reqMonHoliday = await leaveService.applyLeave({
      userId: testUser.id,
      companyId,
      leaveTypeId: plType.id,
      fromDate: "2026-04-06", // Monday
      toDate: "2026-04-06",
      durationType: LeaveDurationType.FULL_DAY,
      reason: "Monday leave after Easter weekend",
    });

    const reqThuHolidayUpdated = await prisma.leaveRequest.findUnique({ where: { id: reqThuHoliday.id } });
    assert(reqThuHolidayUpdated!.durationValue === 4, "Scenario 4: Thursday request retroactively bridges Good Friday + Sat + Sun = 4 days");
    assert(reqMonHoliday.durationValue === 1, "Scenario 4: Monday request is 1 day (Monday)");
    assert(reqThuHolidayUpdated!.durationValue + reqMonHoliday.durationValue === 5, "Scenario 4: Total combined deduction across Thu leave + Fri holiday + Sat + Sun + Mon leave = 5 days");

    await prisma.leaveRequestDay.deleteMany({ where: { leaveRequestId: { in: [reqThuHoliday.id, reqMonHoliday.id] } } });
    await prisma.leaveRequest.deleteMany({ where: { id: { in: [reqThuHoliday.id, reqMonHoliday.id] } } });

    // ==============================================================
    // SCENARIO 5: Working Day between leaves -> Sandwich BROKEN
    // Thu 16 Apr = Leave
    // Fri 17 Apr = Working (Attendance logged)
    // Sat 18 Apr & Sun 19 Apr = Weekend
    // Mon 20 Apr = Leave
    // ==============================================================
    await prisma.attendanceDay.create({
      data: {
        employeeId: testEmp.id,
        companyId,
        date: new Date("2026-04-17T00:00:00.000Z"),
        status: AttendanceStatus.PRESENT,
        totalMinutes: 480,
      },
    });

    const reqThuWork = await leaveService.applyLeave({
      userId: testUser.id,
      companyId,
      leaveTypeId: plType.id,
      fromDate: "2026-04-16",
      toDate: "2026-04-16",
      durationType: LeaveDurationType.FULL_DAY,
      reason: "Thursday leave",
    });

    const reqMonWork = await leaveService.applyLeave({
      userId: testUser.id,
      companyId,
      leaveTypeId: plType.id,
      fromDate: "2026-04-20",
      toDate: "2026-04-20",
      durationType: LeaveDurationType.FULL_DAY,
      reason: "Monday leave after Friday work",
    });

    assert(reqMonWork.durationValue === 1, "Scenario 5: Friday working day breaks sandwich chain => Monday deducts only 1 day");
    assert(reqThuWork.durationValue + reqMonWork.durationValue === 2, "Scenario 5: Total deduction across separate Thu & Mon with Friday working is 2 days (NO sandwich)");

    await prisma.attendanceDay.deleteMany({ where: { employeeId: testEmp.id, date: new Date("2026-04-17T00:00:00.000Z") } });
    await prisma.leaveRequestDay.deleteMany({ where: { leaveRequestId: { in: [reqThuWork.id, reqMonWork.id] } } });
    await prisma.leaveRequest.deleteMany({ where: { id: { in: [reqThuWork.id, reqMonWork.id] } } });

    // ==============================================================
    // SCENARIO 6: Weekend-Only Span between leaves -> Sandwich applies (4 days)
    // ==============================================================
    const reqFri6 = await leaveService.applyLeave({
      userId: testUser.id,
      companyId,
      leaveTypeId: plType.id,
      fromDate: "2026-08-14", // Friday
      toDate: "2026-08-14",
      durationType: LeaveDurationType.FULL_DAY,
      reason: "Friday leave",
    });
    const reqMon6 = await leaveService.applyLeave({
      userId: testUser.id,
      companyId,
      leaveTypeId: plType.id,
      fromDate: "2026-08-17", // Monday
      toDate: "2026-08-17",
      durationType: LeaveDurationType.FULL_DAY,
      reason: "Monday leave",
    });

    const reqFri6Updated = await prisma.leaveRequest.findUnique({ where: { id: reqFri6.id } });
    assert(reqFri6Updated!.durationValue === 3, "Scenario 6: Friday request retroactively bridges Sat + Sun = 3 days");
    assert(reqMon6.durationValue === 1, "Scenario 6: Monday request is 1 day");
    assert(reqFri6Updated!.durationValue + reqMon6.durationValue === 4, "Scenario 6: Total combined deduction is 4 days (Fri + Sat + Sun + Mon)");

    // ==============================================================
    // SCENARIO 8: Multiple holidays & weekends between leaves
    // Wed 23 Dec = Leave
    // Thu 24 Dec = Holiday
    // Fri 25 Dec = Holiday (Christmas)
    // Sat 26 Dec = Weekend
    // Sun 27 Dec = Weekend
    // Mon 28 Dec = Leave
    // Total = 6 days (Wed 1 + Thu 1 + Fri 1 + Sat 1 + Sun 1 + Mon 1)
    // ==============================================================
    await leaveService.createHoliday({ companyId, name: "Christmas Eve", date: new Date("2026-12-24T00:00:00.000Z") });
    await leaveService.createHoliday({ companyId, name: "Christmas Day", date: new Date("2026-12-25T00:00:00.000Z") });

    const reqWed8 = await leaveService.applyLeave({
      userId: testUser.id,
      companyId,
      leaveTypeId: plType.id,
      fromDate: "2026-12-23",
      toDate: "2026-12-23",
      durationType: LeaveDurationType.FULL_DAY,
      reason: "Pre-Christmas leave",
    });
    const reqMon8 = await leaveService.applyLeave({
      userId: testUser.id,
      companyId,
      leaveTypeId: plType.id,
      fromDate: "2026-12-28",
      toDate: "2026-12-28",
      durationType: LeaveDurationType.FULL_DAY,
      reason: "Post-Christmas leave",
    });

    const reqWed8Updated = await prisma.leaveRequest.findUnique({ where: { id: reqWed8.id } });
    assert(reqWed8Updated!.durationValue === 5, "Scenario 8: Wednesday request retroactively bridges 2 holidays + 2 weekend days = 5 days");
    assert(reqMon8.durationValue === 1, "Scenario 8: Monday request is 1 day");
    assert(reqWed8Updated!.durationValue + reqMon8.durationValue === 6, "Scenario 8: Total combined deduction across multiple holidays and weekends is 6 days");

    // ==============================================================
    // SCENARIO 10 & 11: Approved Leave Deletion & Idempotent Balance Restoration
    // ==============================================================
    const balBeforeDel = await prisma.leaveBalance.findUnique({
      where: { employeeId_leaveTypeId_year: { employeeId: testEmp.id, leaveTypeId: plType.id, year: 2026 } },
    });

    const leaveToApproveAndDel = await leaveService.applyLeave({
      userId: testUser.id,
      companyId,
      leaveTypeId: plType.id,
      fromDate: "2026-11-10",
      toDate: "2026-11-12",
      durationType: LeaveDurationType.FULL_DAY,
      reason: "3 days leave for delete test",
    });
    await leaveService.approveLeave({ requestId: leaveToApproveAndDel.id, approverUserId: ctx.adminUser.id, companyId });

    const balAfterApprove = await prisma.leaveBalance.findUnique({
      where: { employeeId_leaveTypeId_year: { employeeId: testEmp.id, leaveTypeId: plType.id, year: 2026 } },
    });
    assert(balAfterApprove!.remaining === balBeforeDel!.remaining - 3, "Scenario 10: 3 days deducted upon approval");

    // Delete the approved leave request
    await leaveService.deleteLeaveRequest({
      requestId: leaveToApproveAndDel.id,
      adminUserId: ctx.adminUser.id,
      companyId,
    });

    const balAfterDel = await prisma.leaveBalance.findUnique({
      where: { employeeId_leaveTypeId_year: { employeeId: testEmp.id, leaveTypeId: plType.id, year: 2026 } },
    });
    assert(balAfterDel!.remaining === balBeforeDel!.remaining, "Scenario 10: Exactly 3 days restored to balance after deleting approved leave request");

    // Repeat delete (idempotency check)
    let secondDeleteThrew = false;
    try {
      await leaveService.deleteLeaveRequest({
        requestId: leaveToApproveAndDel.id,
        adminUserId: ctx.adminUser.id,
        companyId,
      });
    } catch {
      secondDeleteThrew = true;
    }
    assert(secondDeleteThrew, "Scenario 11: Repeating delete on already deleted request throws not found error");

    const balAfterRepeat = await prisma.leaveBalance.findUnique({
      where: { employeeId_leaveTypeId_year: { employeeId: testEmp.id, leaveTypeId: plType.id, year: 2026 } },
    });
    assert(balAfterRepeat!.remaining === balBeforeDel!.remaining, "Scenario 11: Balance remains strictly unchanged with zero double restoration");

    console.log("    ✔ All simplified sandwich, holiday, and balance safety tests passed!");
  } finally {
    await ctx.cleanup();
    console.log("    ✔ Cleaned up isolated sandwich policy test company");
  }
}
