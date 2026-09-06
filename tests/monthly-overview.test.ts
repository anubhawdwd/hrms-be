// tests/monthly-overview.test.ts
import { prisma } from "../src/config/prisma.js";
import { AttendanceService } from "../src/modules/attendance/service.js";
import { EmployeeService } from "../src/modules/employee/service.js";
import { AuthProvider, UserRole, AttendanceEventType, AttendanceSource } from "../src/generated/prisma/enums.js";
import { createIsolatedTestCompany } from "./helpers/isolated-test-context.js";

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`[FAIL] ${msg}`);
  console.log(`    ✔ ${msg}`);
}

export async function runMonthlyOverviewTests() {
  console.log("\n  [MODULE] Employee Monthly Overview & Self-Only Enforcement Suite (Isolated)");
  const attendanceService = new AttendanceService();
  const employeeService = new EmployeeService();

  const ctx = await createIsolatedTestCompany({ setupStandardLeaveTypes: false });

  try {
    const companyId = ctx.company.id;

    // Create two distinct test employees: Emp A (Alice) and Emp B (Bob)
    const userA = await prisma.user.create({
      data: {
        companyId,
        email: `emp.a.${Date.now()}@isolatedtest.local`,
        passwordHash: "$2b$10$abcdef",
        roles: {
          create: [{ role: UserRole.EMPLOYEE }],
        },
        authProvider: AuthProvider.LOCAL,
        isActive: true,
      },
    });
    const empA = await employeeService.createEmployee({
      userId: userA.id,
      companyId,
      designationId: ctx.designation.id,
      firstName: "Alice",
      lastName: "Employee",
      joiningDate: "2026-01-01",
      isProbation: false,
      initialLeaveGrant: null,
    });

    const userB = await prisma.user.create({
      data: {
        companyId,
        email: `emp.b.${Date.now()}@isolatedtest.local`,
        passwordHash: "$2b$10$abcdef",
        roles: {
          create: [{ role: UserRole.EMPLOYEE }],
        },
        authProvider: AuthProvider.LOCAL,
        isActive: true,
      },
    });
    const empB = await employeeService.createEmployee({
      userId: userB.id,
      companyId,
      designationId: ctx.designation.id,
      firstName: "Bob",
      lastName: "Employee",
      joiningDate: "2026-01-01",
      isProbation: false,
      initialLeaveGrant: null,
    });

    // Setup attendance for Alice on 2026-09-02 (PRESENT, 540 min = 9h)
    const dayDate = new Date("2026-09-02T00:00:00Z");
    const attDayA = await prisma.attendanceDay.create({
      data: {
        employeeId: empA.id,
        companyId,
        date: dayDate,
        totalMinutes: 540,
      },
    });

    await prisma.attendanceEvent.createMany({
      data: [
        {
          attendanceDayId: attDayA.id,
          type: AttendanceEventType.CHECK_IN,
          source: AttendanceSource.WEB,
          timestamp: new Date("2026-09-02T09:00:00Z"),
        },
        {
          attendanceDayId: attDayA.id,
          type: AttendanceEventType.CHECK_OUT,
          source: AttendanceSource.WEB,
          timestamp: new Date("2026-09-02T18:00:00Z"),
        },
      ],
    });

    // 1. Query dashboard for Alice (2026-09) with targetEmployeeId = empA.id
    const overviewA = await attendanceService.getAttendanceDashboard(
      companyId,
      "2026-09",
      empA.id
    );

    assert(overviewA.month === "2026-09", "Month string matches 2026-09");
    assert(overviewA.days.length === 30, "September has 30 days");
    assert(overviewA.employees.length === 1, "Returns employee row for Alice");
    assert(overviewA.employees[0].employeeId === empA.id, "Employee ID in response matches Alice (Emp A)");
    assert(overviewA.employees[0].displayName === empA.displayName, "Employee name matches Alice");

    const cellA = overviewA.employees[0].days["2026-09-02"];
    assert(cellA !== undefined, "Cell for 2026-09-02 exists");
    assert(cellA.status === "PRESENT", `Status for 2026-09-02 is PRESENT (found ${cellA.status})`);
    assert(cellA.totalMinutes === 540, `Presence duration is 540 minutes (found ${cellA.totalMinutes})`);

    // 2. Query dashboard for Bob with targetEmployeeId = empB.id
    const overviewB = await attendanceService.getAttendanceDashboard(
      companyId,
      "2026-09",
      empB.id
    );

    assert(overviewB.employees.length === 1, "Returns employee row for Bob");
    assert(overviewB.employees[0].employeeId === empB.id, "Bob's query returns Bob's data (empB.id)");
    assert(overviewB.employees[0].employeeId !== empA.id, "Self-only strictly enforced: Bob cannot receive Alice's records");
    assert(overviewB.employees[0].days["2026-09-02"].status !== "PRESENT", "Bob has no PRESENT attendance on 2026-09-02");
  } finally {
    await ctx.cleanup();
    console.log("    ✔ Cleaned up isolated monthly overview test company");
  }
}
