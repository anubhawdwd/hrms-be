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
import { requireSelfUser } from "../../middlewares/requireSelfUser.js";

const router = Router();

router.post("/check-in",
  authenticateJWT,
  requireSelfUser(),
  checkIn);
router.post("/check-out",
  authenticateJWT,
  requireSelfUser(),
  checkOut);

router.get("/day",
  authenticateJWT,
  requireSelfUser(),
  getAttendanceDay);

router.get("/range",
  authenticateJWT,
  requireSelfUser(),
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
