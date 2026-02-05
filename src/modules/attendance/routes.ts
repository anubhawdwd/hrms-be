// src/modules/attendance/routes.ts
import { Router } from "express";
import {
  checkIn,
  checkOut,
  getAttendanceDay,
  getAttendanceRange,
  getAttendanceViolations,
  hrAddAttendanceEvent,
  hrUpdateAttendanceDay,
  hrUpsertAttendanceDay,
  upsertEmployeeAttendanceOverride,
} from "./controller.js";
import { authenticateJWT } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { UserRole } from "../../generated/prisma/enums.js";
import { requireSelfOrHR } from "../../middlewares/requireSelfOrHR.js";

const router = Router();

router.post("/check-in",
  authenticateJWT,
  requireSelfOrHR("employeeId"),
  checkIn);
router.post("/check-out",
  authenticateJWT,
  requireSelfOrHR("employeeId"),
  checkOut);

router.get("/day",
  authenticateJWT,
  requireSelfOrHR("employeeId"),
  getAttendanceDay);

router.get("/range",
  authenticateJWT,
  requireSelfOrHR("employeeId"),
  getAttendanceRange);

router.get("/violations",
  authenticateJWT,
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  getAttendanceViolations);

// -------SpecialProvision-for-DefaultAttendance------
router.post("/employee-override",
  authenticateJWT,
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  upsertEmployeeAttendanceOverride);

// 🔑 HR APIs
router.post("/hr/attendance-day",
  authenticateJWT,
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  hrUpsertAttendanceDay);

router.post("/hr/attendance-event",
  authenticateJWT,
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  hrAddAttendanceEvent);

router.patch("/hr/attendance-day/:attendanceDayId",
  authenticateJWT,
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  hrUpdateAttendanceDay);

export default router;
