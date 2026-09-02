// src/modules/leave/routes.ts
import { Router } from "express";
import {
  createLeaveType,
  updateLeaveType,
  listLeaveTypes,
  upsertLeavePolicy,
  listLeavePolicies,
  applyLeave,
  listMyLeaveRequests,
  cancelLeaveRequest,
  approveLeave,
  rejectLeave,
  hrCancelApprovedLeave,
  updateLeaveRequestDayStatus,
  toggleSandwichBridgeDayExemption,
  getMyLeaveBalances,
  requestLeaveEncashment,
  approveLeaveEncashment,
  rejectLeaveEncashment,
  upsertEmployeeLeaveOverride,
  createHoliday,
  listHolidays,
  deleteHoliday,
  listTodayLeaves,
  listPendingLeaveRequests,
  listRecentLeaveRequests,
  listEmployeeLeaveRequests,
  getEmployeeLeaveBalancesAdmin,
  updateEmployeeLeaveAllocation,
  bulkAllocateLeaveBalances,
  runYearEndRollover,
  markLeaveByAdmin,
  deleteLeaveRequest,
  getLwpReport,
} from "./controller.js";

import { authenticateJWT } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { validateCompanyHeader } from "../../middlewares/validateCompany.js";
import { UserRole } from "../../generated/prisma/enums.js";

const router = Router();

// All leave routes need auth + company validation
router.use(authenticateJWT, validateCompanyHeader);

// LEAVE TYPES
router.get("/types", listLeaveTypes);
router.post(
  "/types",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  createLeaveType
);
router.patch(
  "/types/:leaveTypeId",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  updateLeaveType
);

// LEAVE POLICY
router.post(
  "/policies",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  upsertLeavePolicy
);
router.get(
  "/policies",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  listLeavePolicies
);

// LEAVE REQUESTS (self-service)
router.post("/requests", applyLeave);
router.get("/requests/my", listMyLeaveRequests);
router.patch("/requests/:requestId/cancel", cancelLeaveRequest);
router.delete(
  "/requests/:requestId",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  deleteLeaveRequest
);

// LEAVE APPROVAL (HR)
router.patch(
  "/requests/:requestId/approve",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  approveLeave
);
router.patch(
  "/requests/:requestId/reject",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  rejectLeave
);
router.patch(
  "/requests/:requestId/hr-cancel",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  hrCancelApprovedLeave
);

// HR DAY-LEVEL APPROVAL / REJECTION
router.patch(
  "/requests/:requestId/days/:dayId/status",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  updateLeaveRequestDayStatus
);

// HR SANDWICH BRIDGE DAY EXCEPTION
router.patch(
  "/requests/:requestId/sandwich-days/:dayId/exempt",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  toggleSandwichBridgeDayExemption
);

// YEAR-END ROLLOVER
router.post(
  "/rollover",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  runYearEndRollover
);

// LEAVE BALANCE
router.get("/balances/my", getMyLeaveBalances);

// TODAY LEAVES
router.get("/today", listTodayLeaves);

// ENCASHMENT
router.post("/encashments", requestLeaveEncashment);
router.patch(
  "/encashments/:encashmentId/approve",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  approveLeaveEncashment
);
router.patch(
  "/encashments/:encashmentId/reject",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  rejectLeaveEncashment
);

// HR OVERRIDES
router.post(
  "/employee-override",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  upsertEmployeeLeaveOverride
);

// All pending / recent leave requests for company (HR/Admin view)
router.get(
  "/requests/employee/:employeeId",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  listEmployeeLeaveRequests
);

router.get(
  "/balances/employee/:employeeId",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  getEmployeeLeaveBalancesAdmin
);

router.post(
  "/balances/bulk-allocate",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  bulkAllocateLeaveBalances
);

router.put(
  "/balances/employee/:employeeId",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  updateEmployeeLeaveAllocation
);

router.post(
  "/balances/employee/:employeeId",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  updateEmployeeLeaveAllocation
);

router.post(
  "/requests/admin/mark",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  markLeaveByAdmin
);

router.get(
  "/requests/pending",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  listPendingLeaveRequests
);
router.get(
  "/requests/recent",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  listRecentLeaveRequests
);

// HOLIDAYS
router.post(
  "/holidays",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  createHoliday
);
router.get("/holidays", listHolidays);
router.delete(
  "/holidays/:holidayId",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  deleteHoliday
);

export default router;
// LWP / UNPAID LEAVE REPORT
router.get(
  "/reports/lwp",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  getLwpReport
);
