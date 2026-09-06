// tests/run-all.ts
import { prisma } from "../src/config/prisma.js";
import { runAuthTests } from "./auth.test.js";
import { runAttendanceTests } from "./attendance.test.js";
import { runLeaveTests } from "./leave.test.js";
import { runLifecycleTests } from "./lifecycle.test.js";
import { runOnboardingLeaveTests } from "./onboarding-leave.test.js";
import { runLeaveRolloverTests } from "./leave-rollover.test.js";
import { runBulkAllocateTests } from "./bulk-allocate.test.js";
import { runLeaveTypeCatalogTests } from "./leave-types.test.js";
import { runMonthlyOverviewTests } from "./monthly-overview.test.js";
import { runSandwichPolicyTests } from "./sandwich-policy.test.js";
import { runZohoBalanceEditTests } from "./zoho-balance-edit.test.js";
import { runReportsTests } from "./reports.test.js";
import { runSuperAdminAndErrorLogTests } from "./superadmin-errorlog.test.js";
import { runSuperAdminCapabilitiesTests } from "./superadmin-capabilities.test.js";
import { runEmployeeOnboardingTests } from "./employee-onboarding.test.js";
import { runUserEmailUpdateTests } from "./user-email-update.test.js";
import { runLeaveFixesTests } from "./leave-fixes.test.js";
import { runHolidayTypeTests } from "./holiday-type.test.js";
import { runMultiRoleTests } from "./multi-role.test.js";
import { runLeaveTwoStepApprovalTests } from "./leave-two-step-approval.test.js";
import { runManagerSelfServiceTests } from "./manager-self-service.test.js";

interface DatabaseSnapshot {
  companiesCount: number;
  usersCount: number;
  userRoleAssignmentsCount: number;
  employeeProfilesCount: number;
  leaveBalancesCount: number;
  leavePoliciesCount: number;
  leaveTypesCount: number;
  leaveRequestsCount: number;
  leaveRequestDaysCount: number;
  overridesCount: number;
  attendanceDaysCount: number;
  attendanceEventsCount: number;
  holidaysCount: number;
  errorLogsCount: number;
  auditLogsCount: number;
  leaveBalanceChecksum: string;
}

async function captureDatabaseSnapshot(): Promise<DatabaseSnapshot> {
  const [
    companiesCount,
    usersCount,
    userRoleAssignmentsCount,
    employeeProfilesCount,
    leaveBalancesCount,
    leavePoliciesCount,
    leaveTypesCount,
    leaveRequestsCount,
    leaveRequestDaysCount,
    overridesCount,
    attendanceDaysCount,
    attendanceEventsCount,
    holidaysCount,
    errorLogsCount,
    auditLogsCount,
    allBalances,
  ] = await Promise.all([
    prisma.company.count(),
    prisma.user.count(),
    prisma.userRoleAssignment.count(),
    prisma.employeeProfile.count(),
    prisma.leaveBalance.count(),
    prisma.leavePolicy.count(),
    prisma.leaveType.count(),
    prisma.leaveRequest.count(),
    prisma.leaveRequestDay.count(),
    prisma.employeeLeaveOverride.count(),
    prisma.attendanceDay.count(),
    prisma.attendanceEvent.count(),
    prisma.holiday.count(),
    prisma.errorLog.count(),
    prisma.auditLog.count(),
    prisma.leaveBalance.findMany({
      select: {
        id: true,
        allocated: true,
        used: true,
        carriedForward: true,
        remaining: true,
      },
      orderBy: { id: "asc" },
    }),
  ]);

  // Compute balance checksum
  const leaveBalanceChecksum = JSON.stringify(allBalances);

  return {
    companiesCount,
    usersCount,
    employeeProfilesCount,
    leaveBalancesCount,
    leavePoliciesCount,
    leaveTypesCount,
    leaveRequestsCount,
    leaveRequestDaysCount,
    overridesCount,
    attendanceDaysCount,
    attendanceEventsCount,
    holidaysCount,
    errorLogsCount,
    auditLogsCount,
    leaveBalanceChecksum,
  };
}

async function main() {
  const startTime = Date.now();
  console.log("==================================================");
  console.log("HRMS MASTER AUTOMATED TEST SUITE (ISOLATED RUNNER)");
  console.log("==================================================");

  // 1. Capture Pre-Test Snapshot
  console.log("\n[SAFETY CHECK] Capturing baseline database state...");
  const preSnapshot = await captureDatabaseSnapshot();
  console.log(`  Existing Database Records:
    • Companies: ${preSnapshot.companiesCount}
    • Users: ${preSnapshot.usersCount}
    • Employee Profiles: ${preSnapshot.employeeProfilesCount}
    • Leave Balances: ${preSnapshot.leaveBalancesCount}
    • Leave Policies: ${preSnapshot.leavePoliciesCount}
    • Leave Types: ${preSnapshot.leaveTypesCount}
    • Leave Requests: ${preSnapshot.leaveRequestsCount}
    • Overrides: ${preSnapshot.overridesCount}
    • Error Logs: ${preSnapshot.errorLogsCount}
    • Audit Logs: ${preSnapshot.auditLogsCount}`);

  try {
    await runAuthTests();
    await runAttendanceTests();
    await runLeaveTests();
    await runLifecycleTests();
    await runOnboardingLeaveTests();
    await runLeaveRolloverTests();
    await runBulkAllocateTests();
    await runLeaveTypeCatalogTests();
    await runMonthlyOverviewTests();
    await runSandwichPolicyTests();
    await runZohoBalanceEditTests();
    await runReportsTests();
    await runSuperAdminAndErrorLogTests();
    await runSuperAdminCapabilitiesTests();
    await runEmployeeOnboardingTests();
    await runUserEmailUpdateTests();
    await runLeaveFixesTests();
    await runHolidayTypeTests();
    await runMultiRoleTests();
    await runLeaveTwoStepApprovalTests();
    await runManagerSelfServiceTests();

    // 2. Post-Test Safety & Zero-Mutation Verification
    console.log("\n[SAFETY CHECK] Verifying zero-mutation on non-test organization data...");
    const postSnapshot = await captureDatabaseSnapshot();

    const diffs: string[] = [];
    if (postSnapshot.companiesCount !== preSnapshot.companiesCount) {
      diffs.push(`Companies count changed: ${preSnapshot.companiesCount} -> ${postSnapshot.companiesCount}`);
    }
    if (postSnapshot.usersCount !== preSnapshot.usersCount) {
      diffs.push(`Users count changed: ${preSnapshot.usersCount} -> ${postSnapshot.usersCount}`);
    }
    if (postSnapshot.userRoleAssignmentsCount !== preSnapshot.userRoleAssignmentsCount) {
      diffs.push(`User role assignments count changed: ${preSnapshot.userRoleAssignmentsCount} -> ${postSnapshot.userRoleAssignmentsCount}`);
    }
    if (postSnapshot.employeeProfilesCount !== preSnapshot.employeeProfilesCount) {
      diffs.push(`Employee profiles count changed: ${preSnapshot.employeeProfilesCount} -> ${postSnapshot.employeeProfilesCount}`);
    }
    if (postSnapshot.leaveBalancesCount !== preSnapshot.leaveBalancesCount) {
      diffs.push(`Leave balances count changed: ${preSnapshot.leaveBalancesCount} -> ${postSnapshot.leaveBalancesCount}`);
    }
    if (postSnapshot.leavePoliciesCount !== preSnapshot.leavePoliciesCount) {
      diffs.push(`Leave policies count changed: ${preSnapshot.leavePoliciesCount} -> ${postSnapshot.leavePoliciesCount}`);
    }
    if (postSnapshot.leaveTypesCount !== preSnapshot.leaveTypesCount) {
      diffs.push(`Leave types count changed: ${preSnapshot.leaveTypesCount} -> ${postSnapshot.leaveTypesCount}`);
    }
    if (postSnapshot.leaveRequestsCount !== preSnapshot.leaveRequestsCount) {
      diffs.push(`Leave requests count changed: ${preSnapshot.leaveRequestsCount} -> ${postSnapshot.leaveRequestsCount}`);
    }
    if (postSnapshot.leaveRequestDaysCount !== preSnapshot.leaveRequestDaysCount) {
      diffs.push(`Leave request days count changed: ${preSnapshot.leaveRequestDaysCount} -> ${postSnapshot.leaveRequestDaysCount}`);
    }
    if (postSnapshot.overridesCount !== preSnapshot.overridesCount) {
      diffs.push(`Overrides count changed: ${preSnapshot.overridesCount} -> ${postSnapshot.overridesCount}`);
    }
    if (postSnapshot.attendanceDaysCount !== preSnapshot.attendanceDaysCount) {
      diffs.push(`Attendance days count changed: ${preSnapshot.attendanceDaysCount} -> ${postSnapshot.attendanceDaysCount}`);
    }
    if (postSnapshot.attendanceEventsCount !== preSnapshot.attendanceEventsCount) {
      diffs.push(`Attendance events count changed: ${preSnapshot.attendanceEventsCount} -> ${postSnapshot.attendanceEventsCount}`);
    }
    if (postSnapshot.errorLogsCount !== preSnapshot.errorLogsCount) {
      diffs.push(`Error logs count changed: ${preSnapshot.errorLogsCount} -> ${postSnapshot.errorLogsCount}`);
    }
    if (postSnapshot.auditLogsCount !== preSnapshot.auditLogsCount) {
      diffs.push(`Audit logs count changed: ${preSnapshot.auditLogsCount} -> ${postSnapshot.auditLogsCount}`);
    }
    if (postSnapshot.leaveBalanceChecksum !== preSnapshot.leaveBalanceChecksum) {
      diffs.push(`Leave balance values checksum mismatch (one or more existing balances were modified!)`);
    }

    if (diffs.length > 0) {
      throw new Error(`[CRITICAL ISOLATION BREACH] Real database was mutated during tests:\n${diffs.join("\n")}`);
    }

    console.log("  ✔ Safety Check Passed: 0 records added, 0 records deleted, 0 balances modified in real database.");

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log("\n==================================================");
    console.log(`ALL TEST SUITES PASSED CLEANLY & ISOLATED! (${duration}s)`);
    console.log("==================================================\n");
    process.exit(0);
  } catch (error) {
    console.error("\nTEST SUITE FAILED:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
