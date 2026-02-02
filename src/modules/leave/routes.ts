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

  // Leave Approval
  approveLeave,
  rejectLeave,

  // Leave Balance
  getMyLeaveBalances,

  // Leave Encashment
  requestLeaveEncashment,

  // Employee Leave Override (HR)
  upsertEmployeeLeaveOverride,
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

/* =========================================================
   LEAVE APPROVAL (MANAGER / HR)
========================================================= */
router.patch("/requests/:requestId/approve", approveLeave);
router.patch("/requests/:requestId/reject", rejectLeave);

/* =========================================================
   LEAVE BALANCE
========================================================= */
router.get("/balances/my", getMyLeaveBalances); // ?employeeId=xxx&year=2026

/* =========================================================
   LEAVE ENCASHMENT
========================================================= */
router.post("/encashments", requestLeaveEncashment);

/* =========================================================
   HR OVERRIDES
========================================================= */
router.post("/employee-override", upsertEmployeeLeaveOverride);

export default router;
