// tests/reports.test.ts
import { prisma } from "../src/config/prisma.js";
import { reportService } from "../src/modules/report/service.js";
import {
  createIsolatedTestCompany,
  type IsolatedTestContext,
} from "./helpers/isolated-test-context.js";
import {
  LeaveDurationType,
  LeaveRequestStatus,
  UserRole,
} from "../src/generated/prisma/enums.js";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[FAIL] ${message}`);
  }
  console.log(`    ✔ ${message}`);
}

export async function runReportsTests() {
  console.log("\n  [MODULE] Reports Dashboard & Export Suite (Isolated)");

  let ctxA: IsolatedTestContext | null = null;
  let ctxB: IsolatedTestContext | null = null;

  try {
    // Setup Isolated Company A
    ctxA = await createIsolatedTestCompany({ setupStandardLeaveTypes: false });
    const companyIdA = ctxA.company.id;

    // Create 3 Employees in Company A:
    // Emp 1: Manager (Permanent, Active)
    const user1 = await prisma.user.create({
      data: {
        email: `emp1.rep.${Date.now()}_${Math.random().toString().slice(-4)}@isolatedtest.local`,
        companyId: companyIdA,
        role: UserRole.EMPLOYEE,
        authProvider: "LOCAL",
      },
    });

    const emp1 = await prisma.employeeProfile.create({
      data: {
        userId: user1.id,
        companyId: companyIdA,
        designationId: ctxA.designation.id,
        departmentId: ctxA.department.id,
        employeeCode: 101,
        firstName: "Alice",
        lastName: "Manager",
        displayName: "Alice Manager",
        joiningDate: new Date("2024-01-15"),
        isProbation: false,
        isActive: true,
      },
    });

    // Emp 2: Subordinate of Emp 1 (Probation, Active)
    const user2 = await prisma.user.create({
      data: {
        email: `emp2.rep.${Date.now()}_${Math.random().toString().slice(-4)}@isolatedtest.local`,
        companyId: companyIdA,
        role: UserRole.EMPLOYEE,
        authProvider: "LOCAL",
      },
    });

    const emp2 = await prisma.employeeProfile.create({
      data: {
        userId: user2.id,
        companyId: companyIdA,
        designationId: ctxA.designation.id,
        departmentId: ctxA.department.id,
        managerId: emp1.id,
        employeeCode: 102,
        firstName: "Bob",
        lastName: "Subordinate",
        displayName: "Bob Subordinate",
        joiningDate: new Date("2026-03-01"),
        isProbation: true,
        isActive: true,
      },
    });

    // Emp 3: Inactive Employee (no manager, no transactions)
    const user3 = await prisma.user.create({
      data: {
        email: `emp3.rep.${Date.now()}_${Math.random().toString().slice(-4)}@isolatedtest.local`,
        companyId: companyIdA,
        role: UserRole.EMPLOYEE,
        authProvider: "LOCAL",
      },
    });

    const emp3 = await prisma.employeeProfile.create({
      data: {
        userId: user3.id,
        companyId: companyIdA,
        designationId: ctxA.designation.id,
        departmentId: ctxA.department.id,
        employeeCode: 103,
        firstName: "Charlie",
        lastName: "Inactive",
        displayName: "Charlie Inactive",
        isProbation: false,
        isActive: false,
      },
    });

    // Setup Isolated Company B (for cross-company isolation test)
    ctxB = await createIsolatedTestCompany({ setupStandardLeaveTypes: false });
    const companyIdB = ctxB.company.id;

    const userB = await prisma.user.create({
      data: {
        email: `emp.compB.${Date.now()}_${Math.random().toString().slice(-4)}@isolatedtest.local`,
        companyId: companyIdB,
        role: UserRole.EMPLOYEE,
        authProvider: "LOCAL",
      },
    });

    const empB = await prisma.employeeProfile.create({
      data: {
        userId: userB.id,
        companyId: companyIdB,
        designationId: ctxB.designation.id,
        employeeCode: 999,
        firstName: "Zoe",
        lastName: "CompanyB",
        displayName: "Zoe CompanyB",
        isActive: true,
      },
    });

    // ==========================================
    // 1. EMPLOYEE REPORT TESTS
    // ==========================================
    const empReport = await reportService.getEmployeeReport(companyIdA);

    // ctxA has 1 adminEmployee + 3 test employees = 4 employees
    assert(empReport.totalEmployees >= 3, `Employee Report returned all company employees (found ${empReport.totalEmployees})`);
    assert(empReport.data.some((r) => r.employeeCode === 101), "Employee 101 (Alice) is present");
    assert(empReport.data.some((r) => r.employeeCode === 102), "Employee 102 (Bob) is present");
    assert(empReport.data.some((r) => r.employeeCode === 103), "Employee 103 (Charlie - Inactive/No transactions) is present");

    // Company isolation check
    assert(!empReport.data.some((r) => r.employeeCode === 999), "Company B employee Zoe (#999) strictly absent from Company A report");

    // Manager name resolution
    const bobRow = empReport.data.find((r) => r.employeeCode === 102)!;
    assert(bobRow.primaryReportingManager.includes("Alice Manager"), `Manager name correctly resolved as human-readable string: '${bobRow.primaryReportingManager}'`);

    const charlieRow = empReport.data.find((r) => r.employeeCode === 103)!;
    assert(charlieRow.primaryReportingManager === "N/A", "Unassigned manager displayed cleanly as 'N/A'");

    // Employee filters
    const activeOnlyReport = await reportService.getEmployeeReport(companyIdA, { status: "ACTIVE" });
    assert(!activeOnlyReport.data.some((r) => r.employeeCode === 103), "Status ACTIVE filter excludes inactive employee #103");

    // ==========================================
    // 2. LEAVE REPORT CONFIGURATION & DATA
    // ==========================================
    // Configure leave types in Company A:
    // PL (Paid), CLP (Paid), COMP_OFF (Paid), SL (Paid), LWP (Unpaid)
    const plType = await prisma.leaveType.create({
      data: {
        companyId: companyIdA,
        name: "Privilege Leave",
        code: `PL${Date.now().toString().slice(-4)}`,
        isPaid: true,
      },
    });

    const clpType = await prisma.leaveType.create({
      data: {
        companyId: companyIdA,
        name: "Casual Leave",
        code: `CLP${Date.now().toString().slice(-4)}`,
        isPaid: true,
      },
    });

    const compOffType = await prisma.leaveType.create({
      data: {
        companyId: companyIdA,
        name: "Compensatory Off",
        code: `COMP_OFF${Date.now().toString().slice(-4)}`,
        isPaid: true,
      },
    });

    const slType = await prisma.leaveType.create({
      data: {
        companyId: companyIdA,
        name: "Sick Leave",
        code: `SL${Date.now().toString().slice(-4)}`,
        isPaid: true,
      },
    });

    const lwpType = await prisma.leaveType.create({
      data: {
        companyId: companyIdA,
        name: "Leave Without Pay",
        code: "LWP",
        isPaid: false,
      },
    });

    // Grant fractional balances to Alice (Emp 1):
    // PL = 2, CLP = 1.5, COMP_OFF = 0.5, SL = 2.25, LWP = 5.5
    await prisma.leaveBalance.create({
      data: {
        employeeId: emp1.id,
        leaveTypeId: plType.id,
        year: 2026,
        allocated: 12,
        used: 2,
        carriedForward: 0,
        remaining: 10,
      },
    });

    await prisma.leaveBalance.create({
      data: {
        employeeId: emp1.id,
        leaveTypeId: clpType.id,
        year: 2026,
        allocated: 7,
        used: 1.5,
        carriedForward: 0,
        remaining: 5.5,
      },
    });

    await prisma.leaveBalance.create({
      data: {
        employeeId: emp1.id,
        leaveTypeId: compOffType.id,
        year: 2026,
        allocated: 3,
        used: 0.5,
        carriedForward: 0,
        remaining: 2.5,
      },
    });

    await prisma.leaveBalance.create({
      data: {
        employeeId: emp1.id,
        leaveTypeId: slType.id,
        year: 2026,
        allocated: 7,
        used: 2.25,
        carriedForward: 0,
        remaining: 4.75,
      },
    });

    // Approved LWP leave for Alice (5.5 days)
    await prisma.leaveRequest.create({
      data: {
        employeeId: emp1.id,
        leaveTypeId: lwpType.id,
        fromDate: new Date("2026-05-10"),
        toDate: new Date("2026-05-16"),
        durationType: LeaveDurationType.FULL_DAY,
        durationValue: 5.5,
        status: LeaveRequestStatus.APPROVED,
      },
    });

    // Absent attendance day for Alice (1 day)
    await prisma.attendanceDay.create({
      data: {
        employeeId: emp1.id,
        companyId: companyIdA,
        date: new Date("2026-06-15"),
        status: "ABSENT",
        totalMinutes: 0,
      },
    });

    // Bob has CLP: allocated=6, used=0, remaining=6
    await prisma.leaveBalance.create({
      data: {
        employeeId: emp2.id,
        leaveTypeId: clpType.id,
        year: 2026,
        allocated: 6,
        used: 0,
        carriedForward: 0,
        remaining: 6,
      },
    });

    // Charlie has NO leave balances created (must still appear with 0 in report)

    // ==========================================
    // 3. LEAVE REPORT GENERATION (NO PENDING)
    // ==========================================
    const leaveRes1 = await reportService.getLeaveReport(companyIdA, { year: 2026 });
    assert(!("warning" in leaveRes1), "No pending leaves -> report generated immediately without warning");

    const leaveReport1 = leaveRes1 as any;
    assert(leaveReport1.totalEmployees >= 3, `Leave Report contains all company employees (found ${leaveReport1.totalEmployees})`);
    assert(leaveReport1.leaveTypes.length >= 5, `Dynamic leave types detected (found ${leaveReport1.leaveTypes.length})`);

    // Verify Alice row with fractional multi-paid types and LWP
    const aliceLeave = leaveReport1.data.find((r: any) => r.employeeCode === 101)!;
    assert(aliceLeave.leaveTypeMetrics[plType.id].booked === 2, `Alice PL booked is 2 (found ${aliceLeave.leaveTypeMetrics[plType.id].booked})`);
    assert(aliceLeave.leaveTypeMetrics[clpType.id].booked === 1.5, `Alice CLP booked is 1.5 (found ${aliceLeave.leaveTypeMetrics[clpType.id].booked})`);
    assert(aliceLeave.leaveTypeMetrics[compOffType.id].booked === 0.5, `Alice COMP_OFF booked is 0.5 (found ${aliceLeave.leaveTypeMetrics[compOffType.id].booked})`);
    assert(aliceLeave.leaveTypeMetrics[slType.id].booked === 2.25, `Alice SL booked is 2.25 (found ${aliceLeave.leaveTypeMetrics[slType.id].booked})`);
    assert(aliceLeave.paidLeavesTotal === 6.25, `Alice Paid Leaves Total is exactly 2 + 1.5 + 0.5 + 2.25 = 6.25 (found ${aliceLeave.paidLeavesTotal})`);
    assert(aliceLeave.lwpTotal === 5.5, `Alice LWP total is 5.5 days (found ${aliceLeave.lwpTotal})`);
    assert(aliceLeave.absentDays === 1, `Alice absent days count is 1 (found ${aliceLeave.absentDays})`);

    // Verify Charlie row (No leave records -> 0 / N/A)
    const charlieLeave = leaveReport1.data.find((r: any) => r.employeeCode === 103)!;
    assert(charlieLeave.leaveTypeMetrics[plType.id].booked === 0, "Charlie (no records) has PL booked = 0");
    assert(charlieLeave.leaveTypeMetrics[plType.id].balance === 0, "Charlie (no records) has PL balance = 0");
    assert(charlieLeave.paidLeavesTotal === 0, "Charlie paid leaves total = 0");

    // ==========================================
    // 4. PENDING LEAVE APPROVAL & COMPREHENSIVE ABSENCE/LWP FLOW
    // ==========================================
    // Setup Company Holiday on 2026-06-19 (Friday)
    await prisma.holiday.create({
      data: {
        companyId: companyIdA,
        name: "Test Friday Holiday",
        date: new Date("2026-06-19"),
      },
    });

    // Bob (Emp 2) Attendance & Leaves Setup:
    // 1. 2 actual absent working days (Mon 2026-06-15, Tue 2026-06-16)
    await prisma.attendanceDay.create({
      data: {
        employeeId: emp2.id,
        companyId: companyIdA,
        date: new Date("2026-06-15"),
        status: "ABSENT",
        totalMinutes: 0,
      },
    });
    await prisma.attendanceDay.create({
      data: {
        employeeId: emp2.id,
        companyId: companyIdA,
        date: new Date("2026-06-16"),
        status: "ABSENT",
        totalMinutes: 0,
      },
    });

    // 2. 1 approved paid leave day (Wed 2026-06-17)
    await prisma.leaveRequest.create({
      data: {
        employeeId: emp2.id,
        leaveTypeId: plType.id,
        fromDate: new Date("2026-06-17"),
        toDate: new Date("2026-06-17"),
        durationType: LeaveDurationType.FULL_DAY,
        durationValue: 1,
        status: LeaveRequestStatus.APPROVED,
      },
    });

    // 3. 1 present working day (Thu 2026-06-18)
    await prisma.attendanceDay.create({
      data: {
        employeeId: emp2.id,
        companyId: companyIdA,
        date: new Date("2026-06-18"),
        status: "PRESENT",
        totalMinutes: 480,
      },
    });

    // 4. 1 holiday day with ABSENT marker (Fri 2026-06-19) -> must NOT be counted as absent
    await prisma.attendanceDay.create({
      data: {
        employeeId: emp2.id,
        companyId: companyIdA,
        date: new Date("2026-06-19"),
        status: "ABSENT",
        totalMinutes: 0,
      },
    });

    // 5. 1 weekend day with ABSENT marker (Sun 2026-06-21) -> must NOT be counted as absent
    await prisma.attendanceDay.create({
      data: {
        employeeId: emp2.id,
        companyId: companyIdA,
        date: new Date("2026-06-21"),
        status: "ABSENT",
        totalMinutes: 0,
      },
    });

    // 6. 2 approved LWP days (Mon 2026-06-22 to Tue 2026-06-23)
    await prisma.leaveRequest.create({
      data: {
        employeeId: emp2.id,
        leaveTypeId: lwpType.id,
        fromDate: new Date("2026-06-22"),
        toDate: new Date("2026-06-23"),
        durationType: LeaveDurationType.FULL_DAY,
        durationValue: 2,
        status: LeaveRequestStatus.APPROVED,
      },
    });

    // 7. 1 pending LWP day (2026-07-01) -> must be EXCLUDED from LWP Total
    await prisma.leaveRequest.create({
      data: {
        employeeId: emp2.id,
        leaveTypeId: lwpType.id,
        fromDate: new Date("2026-07-01"),
        toDate: new Date("2026-07-01"),
        durationType: LeaveDurationType.FULL_DAY,
        durationValue: 1,
        status: LeaveRequestStatus.PENDING,
      },
    });

    // 8. 1 pending paid leave request (2026-08-10, 3.5 days) -> triggers warning
    await prisma.leaveRequest.create({
      data: {
        employeeId: emp2.id,
        leaveTypeId: clpType.id,
        fromDate: new Date("2026-08-10"),
        toDate: new Date("2026-08-13"),
        durationType: LeaveDurationType.FULL_DAY,
        durationValue: 3.5,
        status: LeaveRequestStatus.PENDING,
      },
    });

    // Create a pending leave in Company B (must NOT trigger warning in Company A)
    const plTypeB = await prisma.leaveType.create({
      data: {
        companyId: companyIdB,
        name: "Privilege Leave",
        code: `PLB${Date.now().toString().slice(-4)}`,
        isPaid: true,
      },
    });

    await prisma.leaveRequest.create({
      data: {
        employeeId: empB.id,
        leaveTypeId: plTypeB.id,
        fromDate: new Date("2026-07-01"),
        toDate: new Date("2026-07-10"),
        durationType: LeaveDurationType.FULL_DAY,
        durationValue: 10,
        status: LeaveRequestStatus.PENDING,
      },
    });

    // Attempt generation without confirmation
    const warnRes = await reportService.getLeaveReport(companyIdA, { year: 2026, confirmPending: false });
    assert("warning" in warnRes && warnRes.warning === "PENDING_LEAVE_APPROVALS", "Pending leave requests return PENDING_LEAVE_APPROVALS warning");

    const warning = warnRes as any;
    assert(warning.pendingCount === 2, `Pending count is exactly 2 in Company A (found ${warning.pendingCount})`);
    assert(warning.pendingTotalDays === 4.5, `Pending total days is exactly fractional 4.5 (1 LWP + 3.5 CLP)`);

    // Confirm generation with confirmPending = true
    const confirmedRes = await reportService.getLeaveReport(companyIdA, { year: 2026, confirmPending: true });
    assert(!("warning" in confirmedRes), "confirmPending=true allows report generation");

    const leaveReportConfirmed = confirmedRes as any;
    assert(leaveReportConfirmed.hasPendingWarning === true, "Report response flags hasPendingWarning: true");

    // Comprehensive assertions for Bob (Emp 2):
    const bobLeaveConfirmed = leaveReportConfirmed.data.find((r: any) => r.employeeCode === 102)!;
    assert(bobLeaveConfirmed.absentDays === 2, `Bob Absent Days is exactly 2 (found ${bobLeaveConfirmed.absentDays})`);
    assert(bobLeaveConfirmed.lwpTotal === 2, `Bob LWP Total is exactly 2 approved days (found ${bobLeaveConfirmed.lwpTotal})`);
    assert(bobLeaveConfirmed.paidLeavesTotal === 1, `Bob Paid Leaves Total is exactly 1 approved PL day (found ${bobLeaveConfirmed.paidLeavesTotal})`);
    assert(bobLeaveConfirmed.leaveTypeMetrics[plType.id].booked === 1, `Bob PL booked is 1 (found ${bobLeaveConfirmed.leaveTypeMetrics[plType.id].booked})`);
    assert(bobLeaveConfirmed.leaveTypeMetrics[clpType.id].booked === 0, `Bob CLP booked is 0 because pending CLP is excluded`);

    // Period boundary check: Querying year 2025 where no pending leaves exist -> no warning
    const year2025Res = await reportService.getLeaveReport(companyIdA, { year: 2025, confirmPending: false });
    assert(!("warning" in year2025Res), "Pending check respects period filter (year 2025 has no pending requests -> no warning)");

    // ==========================================
    // 5. EXCEL & CSV EXPORT GENERATION
    // ==========================================
    const empExcelBuffer = await reportService.generateEmployeeExcel(empReport);
    assert(empExcelBuffer instanceof Buffer && empExcelBuffer.length > 1000, `Employee Excel workbook generated (${empExcelBuffer.length} bytes)`);

    const leaveExcelBuffer = await reportService.generateLeaveExcel(leaveReportConfirmed);
    assert(leaveExcelBuffer instanceof Buffer && leaveExcelBuffer.length > 1000, `Leave Excel workbook generated with multi-level headers (${leaveExcelBuffer.length} bytes)`);

    const empCsv = reportService.generateEmployeeCsv(empReport);
    assert(empCsv.includes("Employee ID,Employee Name,First Name"), "Employee CSV has proper header row");
    assert(empCsv.includes("101,Alice Manager"), "Employee CSV has Alice record");

    const leaveCsv = reportService.generateLeaveCsv(leaveReportConfirmed);
    assert(leaveCsv.includes("Privilege Leave - Booked,Privilege Leave - Balance"), "Leave CSV has flattened dynamic leave type headers");
    assert(leaveCsv.includes("6.25,5.5"), "Leave CSV preserves exact aggregate totals (6.25 paid leaves total, 5.5 LWP total)");

    console.log("    ✔ All Employee and Leave Report scenarios passed!");
  } finally {
    if (ctxA) await ctxA.cleanup();
    if (ctxB) await ctxB.cleanup();
  }
}
