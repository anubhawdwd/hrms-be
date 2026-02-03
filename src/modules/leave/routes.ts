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

const router = Router();

/* =========================================================
   LEAVE TYPES (HR / ADMIN)
========================================================= */
router.post("/types", createLeaveType);
router.get("/types", listLeaveTypes);
router.patch("/types/:leaveTypeId", updateLeaveType);

/* =========================================================
   LEAVE POLICY (HR / ADMIN)
========================================================= */
router.post("/policies", upsertLeavePolicy);
router.get("/policies", listLeavePolicies); // ?year=2026

/* =========================================================
   LEAVE REQUEST (EMPLOYEE)
========================================================= */
router.post("/requests", applyLeave);
router.get("/requests/my", listMyLeaveRequests); // ?employeeId=xxx
router.patch("/requests/:requestId/cancel", cancelLeaveRequest);

/* =========================================================
   LEAVE APPROVAL (MANAGER / HR)
========================================================= */
router.patch("/requests/:requestId/approve", approveLeave);
router.patch("/requests/:requestId/reject", rejectLeave);
router.patch("/requests/:requestId/hr-cancel", hrCancelApprovedLeave);

/* =========================================================
   LEAVE BALANCE
========================================================= */
router.get("/balances/my", getMyLeaveBalances); // ?employeeId=xxx&year=2026

/* =========================================================
   LEAVE ENCASHMENT
========================================================= */
router.post("/encashments", requestLeaveEncashment);
router.patch("/encashments/:encashmentId/approve", approveLeaveEncashment);
router.patch("/encashments/:encashmentId/reject", rejectLeaveEncashment);

// ------------HR OVERRIDES-----------

router.post("/employee-override", upsertEmployeeLeaveOverride);

// ------Holiday calendar--------
router.post("/holidays", createHoliday);
router.get("/holidays/:companyId", listHolidays);
router.delete("/holidays/:holidayId", deleteHoliday);
export default router;