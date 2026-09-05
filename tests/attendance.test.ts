import { getTodayDateStringIST } from "../src/utils/date.js";
// tests/attendance.test.ts
import { computeDailyAttendanceSessions } from "../src/modules/attendance/calculations.js";
import { AttendanceService } from "../src/modules/attendance/service.js";
import { EmployeeService } from "../src/modules/employee/service.js";
import { prisma } from "../src/config/prisma.js";
import { AttendanceEventType, AuthProvider, UserRole } from "../src/generated/prisma/enums.js";
import { createIsolatedTestCompany } from "./helpers/isolated-test-context.js";

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`[FAIL] ${msg}`);
  console.log(`    ✔ ${msg}`);
}

export async function runAttendanceTests() {
  console.log("\n  [MODULE] Attendance Calculation & Multi-Session Engine");

  // Test 1: Single Normal 8h Session (09:00 -> 17:00)
  const singleSessionEvents = [
    { type: AttendanceEventType.CHECK_IN, timestamp: new Date("2026-08-25T09:00:00Z") },
    { type: AttendanceEventType.CHECK_OUT, timestamp: new Date("2026-08-25T17:00:00Z") },
  ];
  const res1 = computeDailyAttendanceSessions(singleSessionEvents);
  assert(res1.completedMinutes === 480, "Single 8-hour shift computes exactly 480 completed minutes");
  assert(res1.isCheckedIn === false, "Shift is closed (isCheckedIn: false)");
  assert(res1.lastCheckOut !== null, "Effective check-out timestamp is 17:00:00");
  assert(res1.sessions.length === 1, "Recorded exactly 1 completed session pair");

  // Test 2: Interrupted Multi-Session Day, Currently Active (09:00 In -> 13:00 Out -> 13:05 In, evaluated at 14:05)
  const interruptedEvents = [
    { type: AttendanceEventType.CHECK_IN, timestamp: new Date("2026-08-25T09:00:00Z") },
    { type: AttendanceEventType.CHECK_OUT, timestamp: new Date("2026-08-25T13:00:00Z") },
    { type: AttendanceEventType.CHECK_IN, timestamp: new Date("2026-08-25T13:05:00Z") },
  ];
  const evalNow = new Date("2026-08-25T14:05:00Z");
  const res2 = computeDailyAttendanceSessions(interruptedEvents, evalNow);
  assert(res2.completedMinutes === 240, "Completed session 1 duration is 240 minutes (4 hours)");
  assert(res2.liveMinutes === 60, "Current active session duration is 60 minutes (1 hour)");
  assert(res2.totalLiveMinutes === 300, "Cumulative daily presence is 300 minutes (5 hours)");
  assert(res2.isCheckedIn === true, "User is currently checked in (isCheckedIn: true)");
  assert(res2.lastCheckOut === null, "Effective check-out is null (represents 'In progress')");

  // Test 3: Completed Multi-Session Day (09:00 In -> 13:00 Out -> 13:05 In -> 17:00 Out)
  const twoCompletedSessions = [
    { type: AttendanceEventType.CHECK_IN, timestamp: new Date("2026-08-25T09:00:00Z") },
    { type: AttendanceEventType.CHECK_OUT, timestamp: new Date("2026-08-25T13:00:00Z") },
    { type: AttendanceEventType.CHECK_IN, timestamp: new Date("2026-08-25T13:05:00Z") },
    { type: AttendanceEventType.CHECK_OUT, timestamp: new Date("2026-08-25T17:00:00Z") },
  ];
  const res3 = computeDailyAttendanceSessions(twoCompletedSessions);
  assert(res3.completedMinutes === 475, "Two completed sessions calculate 240 + 235 = 475 minutes (7h 55m, not 8h)");
  assert(res3.sessions.length === 2, "Recorded 2 distinct session pairs without span inflation");
  assert(res3.isCheckedIn === false, "Day is fully closed (isCheckedIn: false)");

  // Test 4: Triple Session Day (09:00-11:00, 11:30-14:00, 14:30-18:00)
  const tripleSessions = [
    { type: AttendanceEventType.CHECK_IN, timestamp: new Date("2026-08-25T09:00:00Z") },
    { type: AttendanceEventType.CHECK_OUT, timestamp: new Date("2026-08-25T11:00:00Z") }, // 120m
    { type: AttendanceEventType.CHECK_IN, timestamp: new Date("2026-08-25T11:30:00Z") },
    { type: AttendanceEventType.CHECK_OUT, timestamp: new Date("2026-08-25T14:00:00Z") }, // 150m
    { type: AttendanceEventType.CHECK_IN, timestamp: new Date("2026-08-25T14:30:00Z") },
    { type: AttendanceEventType.CHECK_OUT, timestamp: new Date("2026-08-25T18:00:00Z") }, // 210m
  ];
  const res4 = computeDailyAttendanceSessions(tripleSessions);
  assert(res4.completedMinutes === 480, "Triple session sum is 120 + 150 + 210 = 480 minutes (8h)");
  assert(res4.sessions.length === 3, "Recorded 3 distinct sessions");

  // Test 5: Defensive recovery on consecutive punches (IN -> IN -> OUT)
  const malformedEvents = [
    { type: AttendanceEventType.CHECK_IN, timestamp: new Date("2026-08-25T09:00:00Z") },
    { type: AttendanceEventType.CHECK_IN, timestamp: new Date("2026-08-25T09:05:00Z") }, // Duplicate punch
    { type: AttendanceEventType.CHECK_OUT, timestamp: new Date("2026-08-25T17:00:00Z") },
  ];
  const res5 = computeDailyAttendanceSessions(malformedEvents);
  assert(res5.completedMinutes === 475, "Defensively handles duplicate consecutive CHECK_IN (computes 475m from active punch)");
  assert(res5.sessions.length === 1, "Produces 1 valid matched session");

  // Test 6: Auto-close synthesized session
  const openPastDayEvents = [
    { type: AttendanceEventType.CHECK_IN, timestamp: new Date("2026-08-25T09:00:00Z") },
    { type: AttendanceEventType.CHECK_OUT, timestamp: new Date("2026-08-25T23:59:59.999Z") }, // Auto-close punch
  ];
  const res6 = computeDailyAttendanceSessions(openPastDayEvents);
  assert(res6.completedMinutes === 900, "Auto-closed session computes bounded duration to end of day");

  // Test 7: Isolated End-to-End AttendanceService Status Computation & Dashboard Parity
  console.log("\n    --- AttendanceService & Dashboard Status Resolution (Isolated) ---");
  const attendanceService = new AttendanceService();
  const employeeService = new EmployeeService();
  const ctx = await createIsolatedTestCompany({ setupStandardLeaveTypes: false });

  try {
    const companyId = ctx.company.id;
    const user = await prisma.user.create({
      data: {
        companyId,
        email: `att.test.${Date.now()}@isolatedtest.local`,
        passwordHash: "$2b$10$abcdef",
        role: UserRole.EMPLOYEE,
        authProvider: AuthProvider.LOCAL,
        isActive: true,
      },
    });

    const emp = await employeeService.createEmployee({
      userId: user.id,
      companyId,
      designationId: ctx.designation.id,
      firstName: "AttTest",
      lastName: "Employee",
      joiningDate: "2026-01-01",
      isProbation: false,
      initialLeaveGrant: null,
    });

    // 1. Employee checks in today
    await attendanceService.checkIn({
      userId: user.id,
      companyId,
      source: "WEB",
    });

    // Today is in-progress: getAttendanceDashboard should show PRESENT
    const todayStr = getTodayDateStringIST();
    const yearMonth = todayStr.slice(0, 7);

    const activeDashboard = await attendanceService.getAttendanceDashboard(companyId, yearMonth, emp.id);
    const activeCell = activeDashboard.employees[0]?.days[todayStr];
    assert(activeCell?.status === "PRESENT", "Active in-progress shift today resolves to PRESENT on dashboard");

    // 2. Employee checks out early (completed minutes = 0 or a few seconds, < 520 required minutes)
    const checkOutRes = await attendanceService.checkOut({
      userId: user.id,
      companyId,
      source: "WEB",
    });

    // Check checkout returned status
    assert(checkOutRes.status === "PARTIAL" || checkOutRes.status === "ABSENT", "Checkout with < required minutes returns non-PRESENT (PARTIAL)");

    // 3. Verify getAttendanceDay returns PARTIAL and does NOT mutate to PRESENT
    const attDayRecord = await attendanceService.getAttendanceDay(user.id, companyId, todayStr);
    assert(attDayRecord?.status === "PARTIAL" || attDayRecord?.status === "ABSENT", "getAttendanceDay preserves PARTIAL status without overwriting to PRESENT");

    // 4. Verify getAttendanceRange returns PARTIAL
    const attRangeRecords = await attendanceService.getAttendanceRange(user.id, companyId, todayStr, todayStr);
    assert(attRangeRecords[0]?.status === "PARTIAL" || attRangeRecords[0]?.status === "ABSENT", "getAttendanceRange returns PARTIAL status");

    // 5. Verify getAttendanceDashboard returns PARTIAL for today once checked out
    const closedDashboard = await attendanceService.getAttendanceDashboard(companyId, yearMonth, emp.id);
    const closedCell = closedDashboard.employees[0]?.days[todayStr];
    assert(closedCell?.status === "PARTIAL" || closedCell?.status === "ABSENT", "Dashboard reflects PARTIAL status once checked out with insufficient hours");
  } finally {
    await ctx.cleanup();
  }
}

