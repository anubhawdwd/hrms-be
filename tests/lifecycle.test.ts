// tests/lifecycle.test.ts
import { prisma } from "../src/config/prisma.js";
import { EmployeeService } from "../src/modules/employee/service.js";
import { AuthService } from "../src/modules/auth/service.js";
import { LeaveService } from "../src/modules/leave/service.js";
import {
  AttendanceEventType,
  AttendanceSource,
  LeaveDurationType,
  LeaveRequestStatus,
  AuthProvider,
  UserRole,
} from "../src/generated/prisma/enums.js";
import { createIsolatedTestCompany } from "./helpers/isolated-test-context.js";
import bcrypt from "bcrypt";

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`[FAIL] ${msg}`);
  console.log(`    ✔ ${msg}`);
}

export async function runLifecycleTests() {
  console.log("\n  [MODULE] Employee Lifecycle & Soft Offboarding Suite (Isolated)");
  const employeeService = new EmployeeService();
  const authService = new AuthService();
  const leaveService = new LeaveService();

  const ctx = await createIsolatedTestCompany({ setupStandardLeaveTypes: true });

  try {
    const companyId = ctx.company.id;
    const plType = ctx.leaveTypes["PL"];

    const testPassword = "LifecyclePassword@123";
    const passwordHash = await bcrypt.hash(testPassword, 10);

    const testUser = await prisma.user.create({
      data: {
        companyId,
        email: `lifecycle.emp.${Date.now()}@isolatedtest.local`,
        passwordHash,
        role: UserRole.EMPLOYEE,
        authProvider: AuthProvider.LOCAL,
        isActive: true,
      },
    });

    const testEmp = await employeeService.createEmployee({
      userId: testUser.id,
      companyId,
      designationId: ctx.designation.id,
      firstName: "Lifecycle",
      lastName: "Tester",
      joiningDate: "2026-01-01",
      isProbation: false,
      initialLeaveGrant: null,
    });

    assert(testEmp !== null, `Created isolated test employee #${testEmp.employeeCode} (${testEmp.displayName})`);

    const empId = testEmp.id;
    const userId = testEmp.userId;

    // Setup 1: Simulate an open attendance session for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attDay = await prisma.attendanceDay.create({
      data: {
        employeeId: empId,
        companyId,
        date: today,
      },
    });

    const checkInTime = new Date(Date.now() - 3660000); // ~61 mins ago
    await prisma.attendanceEvent.create({
      data: {
        attendanceDayId: attDay.id,
        type: AttendanceEventType.CHECK_IN,
        source: AttendanceSource.WEB,
        timestamp: checkInTime,
      },
    });

    // Seed Leave Balance
    await prisma.leaveBalance.create({
      data: {
        employeeId: empId,
        leaveTypeId: plType.id,
        year: 2026,
        allocated: 20,
        used: 0,
        carriedForward: 0,
        remaining: 20,
      },
    });

    // Setup 2: Pending leave request
    const pendingReq = await leaveService.applyLeave({
      userId,
      companyId,
      leaveTypeId: plType.id,
      fromDate: "2026-11-01",
      toDate: "2026-11-02",
      durationType: LeaveDurationType.FULL_DAY,
      reason: "Pending leave to test auto-rejection",
    });

    // Setup 3: Future approved leave request
    const futureLeave = await leaveService.markLeaveByAdmin({
      employeeId: empId,
      adminUserId: ctx.adminUser.id,
      companyId,
      leaveTypeId: plType.id,
      fromDate: "2026-12-01",
      toDate: "2026-12-03",
      durationType: LeaveDurationType.FULL_DAY,
      reason: "Pre-approved year-end leave",
    });

    // Setup 4: Active login session & refresh token
    const loginRes = await authService.login({
      email: testUser.email,
      password: testPassword,
    });
    assert(typeof loginRes.accessToken === "string", "Test employee logged in successfully before offboarding");

    // ==========================================
    // ACTION: Offboard Employee
    // ==========================================
    const offboardRes = await employeeService.offboardEmployee(
      empId,
      companyId,
      {
        effectiveDate: "2026-08-31",
        reason: "Resigned to pursue higher education",
      }
    );
    assert(offboardRes.message.includes("success"), "Offboarding API returned success");

    // 1. Verify EmployeeProfile.isActive
    const updatedEmp = await prisma.employeeProfile.findUnique({ where: { id: empId } });
    assert(updatedEmp?.isActive === false, "EmployeeProfile.isActive set to false");

    // 2. Verify User.isActive
    const updatedUser = await prisma.user.findUnique({ where: { id: userId } });
    assert(updatedUser?.isActive === false, "User.isActive synchronized to false");

    // 3. Verify Refresh Tokens revoked
    const activeTokens = await prisma.refreshToken.findMany({ where: { userId } });
    assert(activeTokens.length === 0, "All user refresh tokens and active sessions invalidated");

    // 4. Verify login blocked
    let loginBlocked = false;
    try {
      await authService.login({
        email: testUser.email,
        password: testPassword,
      });
    } catch (err: any) {
      loginBlocked = true;
      assert(err.message.includes("Inactive"), "Authentication blocked with 'Inactive Users not allowed'");
    }
    assert(loginBlocked, "Inactive user cannot log in");

    // 5. Verify Attendance auto-checkout
    const finalAttDay = await prisma.attendanceDay.findUnique({
      where: { id: attDay.id },
      include: { events: true },
    });
    const checkOutEvent = finalAttDay?.events.find((e) => e.type === AttendanceEventType.CHECK_OUT);
    assert(checkOutEvent !== undefined, "Open attendance session automatically closed with CHECK_OUT event");
    assert((finalAttDay?.totalMinutes ?? 0) >= 60, `Total attendance minutes recalculated (${finalAttDay?.totalMinutes}m recorded)`);

    // 6. Verify pending leave auto-rejected
    const finalPendingReq = await prisma.leaveRequest.findUnique({ where: { id: pendingReq.id } });
    assert(finalPendingReq?.status === LeaveRequestStatus.REJECTED, "Pending leave auto-rejected per Decision 3");
    assert(finalPendingReq?.reason?.includes("Employee offboarded") ?? false, "Pending leave contains 'Employee offboarded' audit reason");

    // 7. Verify future approved leave auto-cancelled
    const finalFutureLeave = await prisma.leaveRequest.findUnique({ where: { id: futureLeave.id } });
    assert(finalFutureLeave?.status === LeaveRequestStatus.CANCELLED, "Future approved leave auto-cancelled per Decision 2");
    assert(finalFutureLeave?.reason?.includes("Offboarded on") ?? false, "Future leave contains 'Offboarded on 2026-08-31' audit reason");

    // ==========================================
    // ACTION: Reactivate Employee
    // ==========================================
    const reactivateRes = await employeeService.reactivateEmployee(
      empId,
      companyId
    );
    assert(reactivateRes.message.includes("success"), "Reactivation API returned success");

    const reactivatedEmp = await prisma.employeeProfile.findUnique({ where: { id: empId } });
    assert(reactivatedEmp?.isActive === true, "EmployeeProfile.isActive restored to true");

    const reactivatedUser = await prisma.user.findUnique({ where: { id: userId } });
    assert(reactivatedUser?.isActive === true, "User.isActive restored to true");

    const reloginRes = await authService.login({
      email: testUser.email,
      password: testPassword,
    });
    assert(typeof reloginRes.accessToken === "string", "Reactivated user can log in successfully");
  } finally {
    await ctx.cleanup();
    console.log("    ✔ Cleaned up isolated lifecycle test company");
  }
}
