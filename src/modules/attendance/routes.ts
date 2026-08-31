// src/modules/attendance/routes.ts
import { Router } from "express";
import {
  checkIn,
  checkOut,
  getAttendanceDashboard,
  getAttendanceDay,
  getAttendanceRange,
  getAttendanceViolations,
  hrAddAttendanceEvent,
  hrUpdateAttendanceDay,
  hrUpsertAttendanceDay,
  upsertEmployeeAttendanceOverride,
  listEmployeeAttendanceOverrides,
  deleteEmployeeAttendanceOverride,
} from "./controller.js";
import { authenticateJWT } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { validateCompanyHeader } from "../../middlewares/validateCompany.js";
import { UserRole } from "../../generated/prisma/enums.js";

const router = Router();

router.use(authenticateJWT, validateCompanyHeader);

// Self-service
router.post("/check-in", checkIn);
router.post("/check-out", checkOut);
router.get("/day", getAttendanceDay);
router.get("/range", getAttendanceRange);

// HR only
router.get(
  "/dashboard",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  getAttendanceDashboard
);

router.get(
  "/violations",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  getAttendanceViolations
);

router.get(
  "/employee-overrides",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  listEmployeeAttendanceOverrides
);

router.post(
  "/employee-override",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  upsertEmployeeAttendanceOverride
);

router.delete(
  "/employee-override/:employeeId",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  deleteEmployeeAttendanceOverride
);

router.post(
  "/hr/attendance-day",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  hrUpsertAttendanceDay
);

router.post(
  "/hr/attendance-event",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  hrAddAttendanceEvent
);

router.patch(
  "/hr/attendance-day/:attendanceDayId",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  hrUpdateAttendanceDay
);

export default router;
