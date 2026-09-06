// tests/leave-two-step-approval.test.ts
import assert from "node:assert";
import { prisma } from "../src/config/prisma.js";
import { LeaveService } from "../src/modules/leave/service.js";
import { OrganizationService } from "../src/modules/organization/service.js";
import {
  UserRole,
  AuthProvider,
  LeaveDurationType,
  LeaveRequestStatus,
  LeaveApprovalWorkflow,
} from "../src/generated/prisma/enums.js";

const leaveService = new LeaveService();
const orgService = new OrganizationService();

export async function runLeaveTwoStepApprovalTests() {
  console.log("▶ Running 2-Step Leave Approval Workflow (LEV-03) Test Suite...");
  const uniqueSuffix = Date.now().toString();

  // Create isolated test company
  const company = await prisma.company.create({
    data: {
      name: `ZZTEST_TwoStepCompany_${uniqueSuffix}`,
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
      name: "Casual Leave",
      code: `CL_${uniqueSuffix.slice(-4)}`,
      isPaid: true,
      isActive: true,
    },
  });

  let nextEmpCode = 9100;
  // Helper to create user + employee
  async function createTestEmployee(params: {
    email: string;
    displayName: string;
    roles: UserRole[];
    managerId?: string;
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
        userId: user.id,
        companyId: company.id,
        departmentId: department.id,
        designationId: designation.id,
        firstName: params.displayName,
        lastName: "Test",
        displayName: params.displayName,
        employeeCode: nextEmpCode++,
        managerId: params.managerId,
        joiningDate: new Date("2026-01-01"),
      },
    });

    // Create leave balance for current year
    const year = new Date().getFullYear();
    await prisma.leaveBalance.create({
      data: {
        employeeId: employee.id,
        leaveTypeId: leaveType.id,
        year,
        allocated: 10,
        used: 0,
        remaining: 10,
      },
    });

    return { user, employee };
  }

  let managerUser: any;
  let managerProfile: any;
  let hrUser: any;
  let hrProfile: any;
  let coworkerUser: any;
  let coworkerProfile: any;
  let applicantUser: any;
  let applicantProfile: any;
  let unmanagedUser: any;
  let unmanagedProfile: any;

  try {
    // 1. Setup Test Users
    const manager = await createTestEmployee({
      email: `manager_${uniqueSuffix}@zztest.internal`,
      displayName: "Reporting Manager",
      roles: [UserRole.EMPLOYEE],
    });
    managerUser = manager.user;
    managerProfile = manager.employee;

    const hr = await createTestEmployee({
      email: `hr_${uniqueSuffix}@zztest.internal`,
      displayName: "HR Admin",
      roles: [UserRole.HR, UserRole.COMPANY_ADMIN],
    });
    hrUser = hr.user;
    hrProfile = hr.employee;

    const coworker = await createTestEmployee({
      email: `coworker_${uniqueSuffix}@zztest.internal`,
      displayName: "Random Coworker",
      roles: [UserRole.EMPLOYEE],
    });
    coworkerUser = coworker.user;
    coworkerProfile = coworker.employee;

    const applicant = await createTestEmployee({
      email: `applicant_${uniqueSuffix}@zztest.internal`,
      displayName: "Applicant Employee",
      roles: [UserRole.EMPLOYEE],
      managerId: managerProfile.id,
    });
    applicantUser = applicant.user;
    applicantProfile = applicant.employee;

    const unmanaged = await createTestEmployee({
      email: `unmanaged_${uniqueSuffix}@zztest.internal`,
      displayName: "Unmanaged Employee",
      roles: [UserRole.EMPLOYEE],
    });
    unmanagedUser = unmanaged.user;
    unmanagedProfile = unmanaged.employee;

    console.log("    --- 1. Testing Two-Step Application Initial Status ---");
    const leaveReq1 = await leaveService.applyLeave({
      userId: applicantUser.id,
      companyId: company.id,
      leaveTypeId: leaveType.id,
      fromDate: "2026-10-12",
      toDate: "2026-10-12",
      durationType: LeaveDurationType.FULL_DAY,
      reason: "Vacation day 1",
    });

    assert.strictEqual(
      leaveReq1.status,
      LeaveRequestStatus.PENDING_MANAGER,
      "Leave request for employee with manager under TWO_STEP policy must start in PENDING_MANAGER"
    );
    console.log("    ✔ Request initial status is PENDING_MANAGER");

    console.log("    --- 2. Testing Coworker Unauthorized Approval (Condition 1 Check) ---");
    let coworkerApproveBlocked = false;
    try {
      await leaveService.approveLeave({
        requestId: leaveReq1.id,
        userId: coworkerUser.id,
        companyId: company.id,
      });
    } catch (err: any) {
      coworkerApproveBlocked = true;
      assert.strictEqual(err.statusCode, 403, "Coworker approval attempt must throw 403 Forbidden");
    }
    assert(coworkerApproveBlocked, "Non-manager coworker must be blocked from approving");
    console.log("    ✔ Coworker approval rejected with 403 Forbidden");

    console.log("    --- 3. Testing Premature HR Approval Blocking ---");
    let hrPrematureBlocked = false;
    try {
      await leaveService.approveLeave({
        requestId: leaveReq1.id,
        userId: hrUser.id,
        companyId: company.id,
      });
    } catch (err: any) {
      hrPrematureBlocked = true;
      assert.strictEqual(err.statusCode, 400, "HR premature approval must throw 400 Bad Request");
      assert(err.message.includes("Awaiting reporting manager approval"), "Error must mention awaiting manager");
    }
    assert(hrPrematureBlocked, "HR approval before manager approval must be blocked");
    console.log("    ✔ Premature HR approval blocked before manager approval");

    console.log("    --- 4. Testing Reporting Manager Approval & Zero-Balance Deduction ---");
    const afterManagerApprove = await leaveService.approveLeave({
      requestId: leaveReq1.id,
      userId: managerUser.id,
      companyId: company.id,
    });

    assert.strictEqual(
      afterManagerApprove.status,
      LeaveRequestStatus.PENDING_HR,
      "Manager approval must advance request status to PENDING_HR"
    );

    // Verify leave balance was NOT deducted yet
    const year = new Date().getFullYear();
    const balanceAfterManager = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: applicantProfile.id,
          leaveTypeId: leaveType.id,
          year,
        },
      },
    });
    assert.strictEqual(balanceAfterManager?.used, 0, "Leave balance used must be 0 after manager approval");
    assert.strictEqual(balanceAfterManager?.remaining, 10, "Leave balance remaining must remain 10 after manager approval");
    console.log("    ✔ Manager approved -> transitioned to PENDING_HR with 0 balance deduction");

    console.log("    --- 5. Testing Duplicate Manager Approval Rejection ---");
    let duplicateManagerBlocked = false;
    try {
      await leaveService.approveLeave({
        requestId: leaveReq1.id,
        userId: managerUser.id,
        companyId: company.id,
      });
    } catch (err: any) {
      duplicateManagerBlocked = true;
      assert.strictEqual(err.statusCode, 400, "Duplicate manager approval must be rejected");
    }
    assert(duplicateManagerBlocked, "Manager cannot approve a request already in PENDING_HR");
    console.log("    ✔ Duplicate manager approval blocked");

    console.log("    --- 6. Testing HR Final Approval & Single Balance Deduction ---");
    const afterHrApprove = await leaveService.approveLeave({
      requestId: leaveReq1.id,
      userId: hrUser.id,
      companyId: company.id,
    });

    assert.strictEqual(
      afterHrApprove.status,
      LeaveRequestStatus.APPROVED,
      "HR approval must complete request to APPROVED"
    );

    const balanceAfterHr = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: applicantProfile.id,
          leaveTypeId: leaveType.id,
          year,
        },
      },
    });
    assert.strictEqual(balanceAfterHr?.used, 1, "Leave balance used must be exactly 1 after HR approval");
    assert.strictEqual(balanceAfterHr?.remaining, 9, "Leave balance remaining must be exactly 9 after HR approval");
    console.log("    ✔ HR approved -> completed to APPROVED with exactly 1 deduction");

    console.log("    --- 7. Testing Manager Immediate Rejection ---");
    const leaveReq2 = await leaveService.applyLeave({
      userId: applicantUser.id,
      companyId: company.id,
      leaveTypeId: leaveType.id,
      fromDate: "2026-10-14",
      toDate: "2026-10-14",
      durationType: LeaveDurationType.FULL_DAY,
      reason: "Day to reject",
    });

    assert.strictEqual(leaveReq2.status, LeaveRequestStatus.PENDING_MANAGER);

    // Coworker reject attempt -> 403
    let coworkerRejectBlocked = false;
    try {
      await leaveService.rejectLeave({
        requestId: leaveReq2.id,
        userId: coworkerUser.id,
        companyId: company.id,
        reason: "Unauthorized reject",
      });
    } catch (err: any) {
      coworkerRejectBlocked = true;
      assert.strictEqual(err.statusCode, 403, "Coworker rejection attempt must throw 403");
    }
    assert(coworkerRejectBlocked, "Coworker cannot reject");

    // Manager rejects
    const afterManagerReject = await leaveService.rejectLeave({
      requestId: leaveReq2.id,
      userId: managerUser.id,
      companyId: company.id,
      reason: "Project deadline conflict",
    });

    assert.strictEqual(
      afterManagerReject.status,
      LeaveRequestStatus.REJECTED,
      "Manager reject must immediately set status to REJECTED"
    );
    assert(afterManagerReject.reason?.includes("[Rejected by Manager]"), "Reason must note rejected by Manager");

    const balanceAfterReject = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: applicantProfile.id,
          leaveTypeId: leaveType.id,
          year,
        },
      },
    });
    assert.strictEqual(balanceAfterReject?.used, 1, "Balance used must remain 1 after rejection");
    console.log("    ✔ Manager reject immediately sets REJECTED with no HR step needed");

    console.log("    --- 8. Testing Unmanaged Employee Direct-to-HR Bypass in TWO_STEP Company ---");
    const leaveReqUnmanaged = await leaveService.applyLeave({
      userId: unmanagedUser.id,
      companyId: company.id,
      leaveTypeId: leaveType.id,
      fromDate: "2026-10-20",
      toDate: "2026-10-20",
      durationType: LeaveDurationType.FULL_DAY,
      reason: "No manager assigned",
    });

    assert(
      leaveReqUnmanaged.status === LeaveRequestStatus.PENDING || leaveReqUnmanaged.status === LeaveRequestStatus.PENDING_HR,
      "Employee without manager must route directly to HR even when company policy is TWO_STEP"
    );

    const afterUnmanagedHrApprove = await leaveService.approveLeave({
      requestId: leaveReqUnmanaged.id,
      userId: hrUser.id,
      companyId: company.id,
    });
    assert.strictEqual(afterUnmanagedHrApprove.status, LeaveRequestStatus.APPROVED);
    console.log("    ✔ Unmanaged employee routes directly to HR for single-step approval");

    console.log("    --- 9. Testing DIRECT_TO_HR Company Toggle ---");
    await orgService.updateWorkingHoursConfig(company.id, {
      leaveApprovalWorkflow: LeaveApprovalWorkflow.DIRECT_TO_HR,
    });

    const leaveReqSingleStep = await leaveService.applyLeave({
      userId: applicantUser.id,
      companyId: company.id,
      leaveTypeId: leaveType.id,
      fromDate: "2026-10-22",
      toDate: "2026-10-22",
      durationType: LeaveDurationType.FULL_DAY,
      reason: "Single step test",
    });

    assert(
      leaveReqSingleStep.status === LeaveRequestStatus.PENDING || leaveReqSingleStep.status === LeaveRequestStatus.PENDING_HR,
      "When company toggle is DIRECT_TO_HR, application routes directly to HR"
    );

    const afterSingleStepApprove = await leaveService.approveLeave({
      requestId: leaveReqSingleStep.id,
      userId: hrUser.id,
      companyId: company.id,
    });
    assert.strictEqual(afterSingleStepApprove.status, LeaveRequestStatus.APPROVED);
    console.log("    ✔ DIRECT_TO_HR toggle routes directly to HR for single-step approval");

    console.log("  ✔ All 2-Step Leave Approval Workflow (LEV-03) tests passed successfully!");
  } finally {
    // Cleanup isolated test company & records
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
    console.log("    ✔ Cleaned up isolated two-step test company");
  }
}
