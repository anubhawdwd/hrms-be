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
        roles: {
          create: [{ role: UserRole.EMPLOYEE }],
        },
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
        roles: {
          create: [{ role: UserRole.EMPLOYEE }],
        },
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
        roles: {
          create: [{ role: UserRole.EMPLOYEE }],
        },
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
        roles: {
          create: [{ role: UserRole.EMPLOYEE }],
        },
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
        fromDate: new Date("2026-06-10"),
        toDate: new Date("2026-06-14"),
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
    const leaveRes1 = await reportService.getLeaveReport(companyIdA, {
      fromDate: "2026-06-10",
      toDate: "2026-06-15",
    });
    assert(!("warning" in leaveRes1), "No pending leaves -> report generated immediately without warning");

    const leaveReport1 = leaveRes1 as any;
    assert(leaveReport1.totalEmployees >= 3, `Leave Report contains all company employees (found ${leaveReport1.totalEmployees})`);
    assert(leaveReport1.leaveTypes.length >= 5, `Dynamic leave types detected (found ${leaveReport1.leaveTypes.length})`);

    // Verify Alice row with fractional multi-paid types and LWP
    const aliceLeave = leaveReport1.data.find((r: any) => r.employeeCode === 101)!;
    assert(aliceLeave.leaveTypeMetrics[plType.id].used === 2, `Alice PL used is 2 (found ${aliceLeave.leaveTypeMetrics[plType.id].used})`);
    assert(aliceLeave.leaveTypeMetrics[clpType.id].used === 1.5, `Alice CLP used is 1.5 (found ${aliceLeave.leaveTypeMetrics[clpType.id].used})`);
    assert(aliceLeave.leaveTypeMetrics[compOffType.id].used === 0.5, `Alice COMP_OFF used is 0.5 (found ${aliceLeave.leaveTypeMetrics[compOffType.id].used})`);
    assert(aliceLeave.leaveTypeMetrics[slType.id].used === 2.25, `Alice SL used is 2.25 (found ${aliceLeave.leaveTypeMetrics[slType.id].used})`);
    assert(aliceLeave.paidLeavesUsed === 6.25, `Alice Paid Leaves — Used is exactly 2 + 1.5 + 0.5 + 2.25 = 6.25 (found ${aliceLeave.paidLeavesUsed})`);
    assert(aliceLeave.lwpTotal === 5.5, `Alice LWP total is 5.5 days (found ${aliceLeave.lwpTotal})`);
    assert(aliceLeave.absentDays === 1, `Alice absent days count is 1 (found ${aliceLeave.absentDays})`);

    // Verify Charlie row (No leave records -> 0 / N/A)
    const charlieLeave = leaveReport1.data.find((r: any) => r.employeeCode === 103)!;
    assert(charlieLeave.leaveTypeMetrics[plType.id].used === 0, "Charlie (no records) has PL used = 0");
    assert(charlieLeave.leaveTypeMetrics[plType.id].balance === 0, "Charlie (no records) has PL balance = 0");
    assert(charlieLeave.paidLeavesUsed === 0, "Charlie paid leaves used = 0");

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

    // 6. 2 approved LWP days over weekend (Sat 2026-06-20, Sun 2026-06-21) -> must be counted in LWP Total
    await prisma.leaveRequest.create({
      data: {
        employeeId: emp2.id,
        leaveTypeId: lwpType.id,
        fromDate: new Date("2026-06-20"),
        toDate: new Date("2026-06-21"),
        durationType: LeaveDurationType.FULL_DAY,
        durationValue: 2,
        status: LeaveRequestStatus.APPROVED,
      },
    });

    // 7. 1 pending LWP day (2026-06-20) -> must be EXCLUDED from LWP Total
    await prisma.leaveRequest.create({
      data: {
        employeeId: emp2.id,
        leaveTypeId: lwpType.id,
        fromDate: new Date("2026-06-20"),
        toDate: new Date("2026-06-20"),
        durationType: LeaveDurationType.FULL_DAY,
        durationValue: 1,
        status: LeaveRequestStatus.PENDING,
      },
    });

    // 8. 1 pending paid leave request (2026-06-21, 3.5 days) -> triggers warning
    await prisma.leaveRequest.create({
      data: {
        employeeId: emp2.id,
        leaveTypeId: clpType.id,
        fromDate: new Date("2026-06-21"),
        toDate: new Date("2026-06-21"),
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
        fromDate: new Date("2026-06-20"),
        toDate: new Date("2026-06-21"),
        durationType: LeaveDurationType.FULL_DAY,
        durationValue: 10,
        status: LeaveRequestStatus.PENDING,
      },
    });

    // Attempt generation without confirmation
    const warnRes = await reportService.getLeaveReport(companyIdA, {
      fromDate: "2026-06-15",
      toDate: "2026-06-21",
      confirmPending: false,
    });
    assert("warning" in warnRes && warnRes.warning === "PENDING_LEAVE_APPROVALS", "Pending leave requests return PENDING_LEAVE_APPROVALS warning");

    const warning = warnRes as any;
    assert(warning.pendingCount === 2, `Pending count is exactly 2 in Company A (found ${warning.pendingCount})`);
    assert(warning.pendingTotalDays === 4.5, `Pending total days is exactly fractional 4.5 (1 LWP + 3.5 CLP)`);

    // Confirm generation with confirmPending = true
    const confirmedRes = await reportService.getLeaveReport(companyIdA, {
      fromDate: "2026-06-15",
      toDate: "2026-06-21",
      confirmPending: true,
    });
    assert(!("warning" in confirmedRes), "confirmPending=true allows report generation");

    const leaveReportConfirmed = confirmedRes as any;
    assert(leaveReportConfirmed.hasPendingWarning === true, "Report response flags hasPendingWarning: true");

    // Comprehensive assertions for Bob (Emp 2):
    const bobLeaveConfirmed = leaveReportConfirmed.data.find((r: any) => r.employeeCode === 102)!;
    assert(bobLeaveConfirmed.absentDays === 2, `Bob Absent Days is exactly 2 (found ${bobLeaveConfirmed.absentDays})`);
    assert(bobLeaveConfirmed.lwpTotal === 2, `Bob LWP Total is exactly 2 approved days (found ${bobLeaveConfirmed.lwpTotal})`);
    assert(bobLeaveConfirmed.paidLeavesUsed === 1, `Bob Paid Leaves — Used is exactly 1 approved PL day (found ${bobLeaveConfirmed.paidLeavesUsed})`);
    assert(bobLeaveConfirmed.leaveTypeMetrics[plType.id].used === 1, `Bob PL used is 1 (found ${bobLeaveConfirmed.leaveTypeMetrics[plType.id].used})`);
    assert(bobLeaveConfirmed.leaveTypeMetrics[clpType.id].used === 0, `Bob CLP used is 0 because pending CLP is excluded`);

    // Pre-joining date verification: Create a newly joined employee (joined on 2026-06-18)
    const userNew = await prisma.user.create({
      data: {
        email: `newemp.rep.${Date.now()}@isolatedtest.local`,
        companyId: companyIdA,
        roles: {
          create: [{ role: UserRole.EMPLOYEE }],
        },
        authProvider: "LOCAL",
      },
    });
    const empNew = await prisma.employeeProfile.create({
      data: {
        userId: userNew.id,
        companyId: companyIdA,
        designationId: ctxA.designation.id,
        employeeCode: 104,
        firstName: "New",
        lastName: "Joiner",
        displayName: "New Joiner",
        joiningDate: new Date("2026-06-18"),
        isActive: true,
      },
    });

    const newJoinerReportRes = await reportService.getLeaveReport(companyIdA, {
      fromDate: "2026-06-15",
      toDate: "2026-06-21",
      confirmPending: true,
    });
    const newJoinerRow = (newJoinerReportRes as any).data.find((r: any) => r.employeeCode === 104)!;
    // June 15, 16, 17 are before joiningDate (June 18) -> not counted as absent. June 18 is absent (no punch), June 19 is holiday, June 20, 21 are weekend -> absentDays = 1.
    assert(newJoinerRow.absentDays === 1, `New Joiner skips pre-joining days and has exactly 1 absent day (found ${newJoinerRow.absentDays})`);

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
    assert(leaveCsv.includes("Privilege Leave - Balance,Privilege Leave - Used"), "Leave CSV has flattened dynamic leave type headers with Balance, Used order");
    assert(leaveCsv.includes("Total Paid Leaves - Balance,Total Paid Leaves - Used"), "Leave CSV has Total Paid Leaves Balance and Used headers");
    assert(leaveCsv.includes("102,Bob Subordinate"), "Leave CSV contains Bob record");
    assert(leaveCsv.includes("6,1,2,2"), "Leave CSV preserves exact aggregate totals for Bob (6 balance, 1 paid leaves used, 2 LWP total, 2 absent days)");

    // ==========================================
    // 6. ATTENDANCE REPORT GENERATION & EXPORT
    // ==========================================
    const attMonthReport = await reportService.getAttendanceReport(companyIdA, {
      year: 2026,
      month: "06",
    });

    assert(attMonthReport.reportType === "ATTENDANCE", "Attendance report has correct reportType");
    assert(attMonthReport.startDate === "2026-06-01" && attMonthReport.endDate === "2026-06-30", "Month mode sets exact start and end of June 2026");
    assert(attMonthReport.totalDays === 30, "June 2026 has exactly 30 days");
    assert(attMonthReport.daysHeader.length === 30, "daysHeader contains 30 day definitions");
    assert(attMonthReport.totalEmployees >= 3, "Attendance report includes all active employees");

    // Check header info for holiday & weekend
    const friHolidayHeader = attMonthReport.daysHeader.find((d: any) => d.date === "2026-06-19");
    assert(friHolidayHeader?.holidayName === "Test Friday Holiday", "Header marks June 19 as Test Friday Holiday");

    const satHeader = attMonthReport.daysHeader.find((d: any) => d.date === "2026-06-20");
    assert(satHeader?.isWeekend === true, "Header marks June 20 as weekend");

    // Check Bob's row and lightweight cells
    const bobAtt = attMonthReport.data.find((r: any) => r.employeeCode === 102)!;
    assert(!!bobAtt, "Bob row found in attendance report");
    assert(bobAtt.summary.totalWorkingDays > 0, `Bob totalWorkingDays calculated (${bobAtt.summary.totalWorkingDays})`);
    
    // Check cell lightweight structure (no nested session array)
    const bobJune15Cell = bobAtt.days["2026-06-15"];
    assert(!!bobJune15Cell, "Bob June 15 cell exists");
    assert((bobJune15Cell as any).sessions === undefined, "Cell does NOT eagerly load sessions array (remains lightweight for drilldown)");
    assert(bobJune15Cell.status === "ABSENT", `Bob June 15 status is ABSENT (found ${bobJune15Cell.status})`);

    const bobJune19Cell = bobAtt.days["2026-06-19"];
    assert(bobJune19Cell.status === "HOLIDAY", `Bob June 19 status is HOLIDAY (found ${bobJune19Cell.status})`);

    const bobJune20Cell = bobAtt.days["2026-06-20"];
    assert(bobJune20Cell.status === "ON_LEAVE", `Bob June 20 status is ON_LEAVE due to approved weekend LWP (found ${bobJune20Cell.status})`);

    const bobJune27Cell = bobAtt.days["2026-06-27"];
    assert(bobJune27Cell.status === "WEEKEND", `Bob June 27 status is WEEKEND (found ${bobJune27Cell.status})`);


    // Custom Date Range mode
    const attRangeReport = await reportService.getAttendanceReport(companyIdA, {
      fromDate: "2026-06-15",
      toDate: "2026-06-21",
    });
    assert(attRangeReport.totalDays === 7, "Custom range 2026-06-15 to 2026-06-21 has 7 days");
    assert(attRangeReport.daysHeader.length === 7, "daysHeader has 7 days for range");

    // Search filter
    const attSearchReport = await reportService.getAttendanceReport(companyIdA, {
      fromDate: "2026-06-15",
      toDate: "2026-06-21",
      search: "Bob",
    });
    assert(attSearchReport.data.length === 1 && attSearchReport.data[0].displayName.includes("Bob"), "Search filter 'Bob' isolates Bob's row");

    // Attendance Excel Export
    const attExcelBuffer = await reportService.generateAttendanceExcel(attMonthReport);
    assert(attExcelBuffer instanceof Buffer && attExcelBuffer.length > 1000, `Attendance Excel workbook generated (${attExcelBuffer.length} bytes)`);

    // Attendance CSV Export
    const attCsv = reportService.generateAttendanceCsv(attMonthReport);
    assert(attCsv.includes("Employee ID,Employee Name,Work Email"), "Attendance CSV has proper headers");
    assert(attCsv.includes("102,Bob Subordinate"), "Attendance CSV contains Bob's summary row");
    assert(attCsv.includes("2026-06-19 (Fri)"), "Attendance CSV includes timeline day columns");


    console.log("    ✔ All Employee, Leave, and Attendance Report scenarios passed!");
  } finally {
    if (ctxA) await ctxA.cleanup();
    if (ctxB) await ctxB.cleanup();
  }
}

