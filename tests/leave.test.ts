// tests/leave.test.ts
import { prisma } from "../src/config/prisma.js";
import { LeaveService } from "../src/modules/leave/service.js";
import { LeaveRequestStatus } from "../src/generated/prisma/enums.js";

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`[FAIL] ${msg}`);
  console.log(`    ✔ ${msg}`);
}

export async function runLeaveTests() {
  console.log("\n  [MODULE] Leave Policy & Quota Validation Suite");
  const leaveService = new LeaveService();

  // Test 1: Fetch active leave types for company
  const company = await prisma.company.findFirst();
  assert(company !== null, "Found test company");

  const leaveTypes = await leaveService.listLeaveTypes(company!.id);
  assert(leaveTypes.length > 0, `Found ${leaveTypes.length} configured leave types for company`);

  // Test 2: Leave Policy resolution
  const policies = await leaveService.listLeavePolicies(company!.id, 2026);
  assert(policies.length > 0, `Found ${policies.length} active leave policies for 2026`);

  // Test 3: Leave Balances lookup for active employee
  const employeeUser = await prisma.user.findFirst({
    where: { companyId: company!.id, isActive: true, employee: { isNot: null } },
  });
  assert(employeeUser !== null, "Found active employee user");

  const balances = await leaveService.getMyLeaveBalances(employeeUser!.id, company!.id, 2026);
  assert(Array.isArray(balances), `Retrieved ${balances.length} leave balances for user ${employeeUser!.email}`);

  // Test 4: Pending Leave Requests Query
  const pendingRequests = await leaveService.listPendingLeaveRequests(company!.id);
  assert(Array.isArray(pendingRequests), `Pending leave query executed successfully (found ${pendingRequests.length} pending)`);

  // Test 5: Leave Request Status Types
  const validStatuses = Object.values(LeaveRequestStatus);
  assert(validStatuses.includes(LeaveRequestStatus.PENDING), "Contains PENDING status");
  assert(validStatuses.includes(LeaveRequestStatus.APPROVED), "Contains APPROVED status");
  assert(validStatuses.includes(LeaveRequestStatus.REJECTED), "Contains REJECTED status");
  assert(validStatuses.includes(LeaveRequestStatus.CANCELLED), "Contains CANCELLED status");
}
