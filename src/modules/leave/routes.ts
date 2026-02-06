// src/modules/leave/routes.ts

import { Router } from "express";
import {
   // Leave Types
   createLeaveType,
   updateLeaveType,
   listLeaveTypes,

   // Leave Policy
   upsertLeavePolicy,
   listLeavePolicies,

   // Leave Requests
   applyLeave,
   listMyLeaveRequests,
   cancelLeaveRequest,

   // Leave Approval
   approveLeave,
   rejectLeave,
   hrCancelApprovedLeave,

   // Leave Balance
   getMyLeaveBalances,

   // Leave Encashment
   requestLeaveEncashment,

   // Employee Leave Override (HR)
   upsertEmployeeLeaveOverride,
   rejectLeaveEncashment,
   approveLeaveEncashment,
   // Holiday Calendar
   createHoliday,
   listHolidays,
   deleteHoliday,
} from "./controller.js";

import { authenticateJWT } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { UserRole } from "../../generated/prisma/enums.js";
import { requireSelfUser } from "../../middlewares/requireSelfUser.js";


const router = Router();


   // LEAVE TYPES (HR / ADMIN)
router.get("/types", listLeaveTypes);

router.post(
   "/types",
   authenticateJWT,
   requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
   createLeaveType
);

router.patch(
   "/types/:leaveTypeId",
   authenticateJWT,
   requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
   updateLeaveType
);


   // LEAVE POLICY (HR / ADMIN)
router.post("/policies",
   authenticateJWT,
   requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
   upsertLeavePolicy);

router.get("/policies",
   authenticateJWT,
   requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
   listLeavePolicies);


   // LEAVE REQUEST (EMPLOYEE)
router.post(
   "/requests",
   authenticateJWT,
   requireSelfUser(),
   applyLeave
);

router.get(
   "/requests/my",
   authenticateJWT,
   requireSelfUser(),
   listMyLeaveRequests
);

router.patch(
  "/requests/:requestId/cancel",
  authenticateJWT,
  requireSelfUser(),
  cancelLeaveRequest
);

   // LEAVE APPROVAL (MANAGER / HR)
router.patch("/requests/:requestId/approve",
   authenticateJWT,
   requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
   approveLeave);

router.patch("/requests/:requestId/reject",
   authenticateJWT,
   requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
   rejectLeave);

router.patch("/requests/:requestId/hr-cancel",
   authenticateJWT,
   requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
   hrCancelApprovedLeave);


   // LEAVE BALANCE
router.get("/balances/my",
   authenticateJWT,
   requireSelfUser(),
   getMyLeaveBalances); // ?employeeId=xxx&year=2026


   // LEAVE ENCASHMENT
router.post("/encashments",
   authenticateJWT,
   // requireRole(UserRole.EMPLOYEE, UserRole.HR, UserRole.COMPANY_ADMIN),
   requireSelfUser(),
   requestLeaveEncashment);

router.patch("/encashments/:encashmentId/approve",
   authenticateJWT,
   requireRole( UserRole.HR, UserRole.COMPANY_ADMIN),
   approveLeaveEncashment);

router.patch("/encashments/:encashmentId/reject",
   authenticateJWT,
   requireRole( UserRole.HR, UserRole.COMPANY_ADMIN),
   rejectLeaveEncashment);

// ------------HR OVERRIDES-----------
router.post("/employee-override",
   authenticateJWT,
   requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
   upsertEmployeeLeaveOverride);

// ------Holiday calendar--------
router.post("/holidays",
   authenticateJWT,
   requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
   createHoliday);

router.get("/holidays/:companyId",
   authenticateJWT,
   requireRole(UserRole.EMPLOYEE, UserRole.HR, UserRole.COMPANY_ADMIN),
   listHolidays);

router.delete("/holidays/:holidayId",
   authenticateJWT,
   requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
   deleteHoliday);

export default router;
