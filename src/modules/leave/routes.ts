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
// All pending leave requests for company (HR/Admin view)
router.get(
  "/requests/pending",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  listPendingLeaveRequests
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