// tests/manager-self-service.test.ts
import assert from "node:assert";
import { prisma } from "../src/config/prisma.js";
import { ManagerService } from "../src/modules/manager/service.js";
import { LeaveService } from "../src/modules/leave/service.js";
import {
  UserRole,
  AuthProvider,
  LeaveDurationType,
  LeaveRequestStatus,
  LeaveApprovalWorkflow,
} from "../src/generated/prisma/enums.js";

const managerService = new ManagerService();
const leaveService = new LeaveService();

export async function runManagerSelfServiceTests() {
  console.log("▶ Running Manager Self-Service Views (MGR-01/MGR-02) Test Suite...");
  const uniqueSuffix = Date.now().toString();

  // Create isolated test company with TWO_STEP workflow
  const company = await prisma.company.create({
    data: {
      name: `ZZTEST_ManagerCompany_${uniqueSuffix}`,
      leaveApprovalWorkflow: LeaveApprovalWorkflow.TWO_STEP,
    },
  });

  const department = await prisma.department.create({
    data: {
      name: `Engineering_${uniqueSuffix}`,
      companyId: company.id,
    },
  });

  const designation = await prisma.designation.create({
    data: {
      name: `Software Engineer_${uniqueSuffix}`,
      companyId: company.id,
    },
  });

  const leaveType = await prisma.leaveType.create({
    data: {
      companyId: company.id,
      name: "Earned Leave",
      code: `EL_${uniqueSuffix.slice(-4)}`,
      isPaid: true,
      isActive: true,
    },
  });

  let nextEmpCode = 9500;
  async function createTestEmployee(params: {
    email: string;
    displayName: string;
    roles: UserRole[];
    managerId?: string;
    secondaryManagerId?: string;
  }) {
    const user = await prisma.user.create({
      data: {
        email: params.email,
        authProvider: AuthProvider.LOCAL,
        companyId: company.id,
        roles: {
          create: params.roles.map((r) => ({ role: r })),
        },
      },
    });

    const employee = await prisma.employeeProfile.create({
      data: {
        employeeCode: nextEmpCode++,
        firstName: params.displayName.split(" ")[0] ?? "Test",
        lastName: params.displayName.split(" ")[1] ?? "User",
        displayName: params.displayName,
        companyId: company.id,
        userId: user.id,
        departmentId: department.id,
        designationId: designation.id,
        managerId: params.managerId,
        secondaryManagerId: params.secondaryManagerId,
        joiningDate: new Date(),
      },
    });

    return { user, employee };
  }

  try {
    // 1. Setup manager hierarchy
    // Manager A (standard EMPLOYEE role, but has reportees)
    const managerA = await createTestEmployee({
      email: `mgr_a_${uniqueSuffix}@zztest.internal`,
      displayName: "Manager Alpha",
      roles: [UserRole.EMPLOYEE],
    });

    // Manager B (HR role, another manager)
    const managerB = await createTestEmployee({
      email: `mgr_b_${uniqueSuffix}@zztest.internal`,
      displayName: "Manager Beta",
      roles: [UserRole.HR],
    });

    // Reportee 1 (Primary: Manager A)
    const reportee1 = await createTestEmployee({
      email: `rep1_${uniqueSuffix}@zztest.internal`,
      displayName: "Reportee One",
      roles: [UserRole.EMPLOYEE],
      managerId: managerA.employee.id,
    });

    // Reportee 2 (Primary: Manager B, Secondary: Manager A)
    const reportee2 = await createTestEmployee({
      email: `rep2_${uniqueSuffix}@zztest.internal`,
      displayName: "Reportee Two",
      roles: [UserRole.EMPLOYEE],
      managerId: managerB.employee.id,
      secondaryManagerId: managerA.employee.id,
    });

    // Reportee 3 (Primary: Manager B only)
    const reportee3 = await createTestEmployee({
      email: `rep3_${uniqueSuffix}@zztest.internal`,
      displayName: "Reportee Three",
      roles: [UserRole.EMPLOYEE],
      managerId: managerB.employee.id,
    });

    // Regular Employee (No reportees)
    const regularEmp = await createTestEmployee({
      email: `regular_${uniqueSuffix}@zztest.internal`,
      displayName: "Regular Employee",
      roles: [UserRole.EMPLOYEE],
    });

    // 2. Test getReportees
    const mgrAReportees = await managerService.getReportees(
      managerA.user.id,
      company.id
    );
    assert.strictEqual(mgrAReportees.length, 2, "Manager A should have 2 reportees (primary + secondary)");
    const rep1Summary = mgrAReportees.find((r) => r.id === reportee1.employee.id);
    assert(rep1Summary, "Reportee 1 should be in Manager A's reportees");
    assert.strictEqual(rep1Summary?.isPrimaryManager, true);
    assert.strictEqual(rep1Summary?.isSecondaryManager, false);

    const rep2Summary = mgrAReportees.find((r) => r.id === reportee2.employee.id);
    assert(rep2Summary, "Reportee 2 should be in Manager A's reportees via secondaryManagerId");
    assert.strictEqual(rep2Summary?.isPrimaryManager, false);
    assert.strictEqual(rep2Summary?.isSecondaryManager, true);

    const regularReportees = await managerService.getReportees(
      regularEmp.user.id,
      company.id
    );
    assert.strictEqual(regularReportees.length, 0, "Non-manager employee should have 0 reportees");
    console.log("    ✔ getReportees correctly derives reportees for primary, secondary, and unmanaged users");

    // 3. Create leave requests for Reportee 1 & Reportee 3
    // Grant balances first
    await prisma.leaveBalance.createMany({
      data: [
        {
          employeeId: reportee1.employee.id,
          leaveTypeId: leaveType.id,
          year: 2026,
          allocated: 10,
          remaining: 10,
          used: 0,
        },
        {
          employeeId: reportee3.employee.id,
          leaveTypeId: leaveType.id,
          year: 2026,
          allocated: 10,
          remaining: 10,
          used: 0,
        },
      ],
    });

    const leaveReq1 = await leaveService.applyLeave({
      userId: reportee1.user.id,
      companyId: company.id,
      leaveTypeId: leaveType.id,
      fromDate: "2026-11-10",
      toDate: "2026-11-11",
      durationType: LeaveDurationType.FULL_DAY,
      reason: "Vacation",
    });

    const leaveReq3 = await leaveService.applyLeave({
      userId: reportee3.user.id,
      companyId: company.id,
      leaveTypeId: leaveType.id,
      fromDate: "2026-11-15",
      toDate: "2026-11-16",
      durationType: LeaveDurationType.FULL_DAY,
      reason: "Conference",
    });

    // 4. Test getReporteeLeaves
    const mgrALeaves = await managerService.getReporteeLeaves(
      managerA.user.id,
      company.id
    );
    assert(
      mgrALeaves.some((l) => l.id === leaveReq1.id),
      "Manager A should see Reportee 1's leave request"
    );
    assert(
      !mgrALeaves.some((l) => l.id === leaveReq3.id),
      "Manager A must NOT see Reportee 3's leave request (not their reportee)"
    );

    // Test employeeId filter on reportee leaves
    const filteredLeaves = await managerService.getReporteeLeaves(
      managerA.user.id,
      company.id,
      { employeeId: reportee1.employee.id }
    );
    assert.strictEqual(filteredLeaves.length, 1);
    assert.strictEqual(filteredLeaves[0]?.id, leaveReq1.id);

    // Test defensive 403 check on unmanaged employee
    let caughtError: any = null;
    try {
      await managerService.getReporteeLeaves(
        managerA.user.id,
        company.id,
        { employeeId: reportee3.employee.id }
      );
    } catch (err) {
      caughtError = err;
    }
    assert(caughtError, "Querying non-reportee employeeId should throw");
    assert.strictEqual(caughtError.statusCode, 403, "Must return 403 Forbidden for non-reportee leave access");
    console.log("    ✔ getReporteeLeaves correctly scopes records and defends with 403 on non-reportees");

    // 5. Test Manager Action (Approve PENDING_MANAGER leave request)
    assert.strictEqual(leaveReq1.status, LeaveRequestStatus.PENDING_MANAGER);
    const approvedLeave = await leaveService.approveLeave({
      requestId: leaveReq1.id,
      userId: managerA.user.id,
      companyId: company.id,
    });
    assert.strictEqual(
      approvedLeave.status,
      LeaveRequestStatus.PENDING_HR,
      "Manager approval must advance status to PENDING_HR"
    );
    console.log("    ✔ Manager can approve reportee's PENDING_MANAGER request");

    // 6. Test getReporteeAttendance
    const mgrAAttendance = await managerService.getReporteeAttendance(
      managerA.user.id,
      company.id,
      { month: "2026-11" }
    );
    assert.strictEqual(
      mgrAAttendance.employees.length,
      2,
      "Manager A attendance dashboard should only contain Manager A's 2 reportees"
    );
    const attEmpIds = mgrAAttendance.employees.map((e) => e.employeeId);
    assert(attEmpIds.includes(reportee1.employee.id));
    assert(attEmpIds.includes(reportee2.employee.id));
    assert(!attEmpIds.includes(reportee3.employee.id), "Must not contain Reportee 3 in attendance");

    // Test defensive 403 on attendance for non-reportee
    let attCaughtError: any = null;
    try {
      await managerService.getReporteeAttendance(
        managerA.user.id,
        company.id,
        { month: "2026-11", employeeId: reportee3.employee.id }
      );
    } catch (err) {
      attCaughtError = err;
    }
    assert(attCaughtError, "Querying non-reportee attendance should throw");
    assert.strictEqual(attCaughtError.statusCode, 403, "Must return 403 Forbidden for non-reportee attendance access");
    console.log("    ✔ getReporteeAttendance scopes to reportees and enforces 403 on unauthorized employeeId");

    console.log("  ✔ All Manager Self-Service Views (MGR-01/MGR-02) tests passed successfully!");
  } finally {
    // Cleanup test data
    await prisma.leaveRequestDay.deleteMany({
      where: { leaveRequest: { employee: { companyId: company.id } } },
    });
    await prisma.leaveRequest.deleteMany({
      where: { employee: { companyId: company.id } },
    });
    await prisma.leaveBalance.deleteMany({
      where: { employee: { companyId: company.id } },
    });
    await prisma.leaveType.deleteMany({
      where: { companyId: company.id },
    });
    await prisma.employeeProfile.deleteMany({
      where: { companyId: company.id },
    });
    await prisma.userRoleAssignment.deleteMany({
      where: { user: { companyId: company.id } },
    });
    await prisma.user.deleteMany({
      where: { companyId: company.id },
    });
    await prisma.department.deleteMany({
      where: { companyId: company.id },
    });
    await prisma.designation.deleteMany({
      where: { companyId: company.id },
    });
    await prisma.company.delete({
      where: { id: company.id },
    });
    console.log("    ✔ Cleaned up isolated manager self-service test company");
  }
}
