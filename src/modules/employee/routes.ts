// src/modules/employee/routes.ts

import { Router } from "express";
import { authenticateJWT } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { UserRole } from "../../generated/prisma/enums.js";

import {
  createEmployee,
  listEmployees,
  getEmployeeById,
  // updateEmployee,
  changeManager,
  deactivateEmployee,
  updateMyProfile,
  updateEmployeeAdmin,
} from "./controller.js";
import { requireSelfOrHR } from "../../middlewares/requireSelfOrHR.js";

const router = Router();

router.post(
  "/",
  authenticateJWT,
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  createEmployee
);

router.get(
  "/",
  authenticateJWT,
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  listEmployees
);

router.get(
  "/:employeeId",
  authenticateJWT,
  requireSelfOrHR("employeeId"),
  getEmployeeById
);

// router.put(
//   "/:employeeId",
//   authenticateJWT,
//   requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
//     // requireSelfOrHR("employeeId"),
//   updateEmployee
// );

// SELF UPDATE
router.put(
  "/:employeeId/profile",
  authenticateJWT,
  requireSelfOrHR("employeeId"),
  updateMyProfile
);

// ADMIN UPDATE
router.put(
  "/:employeeId/admin",
  authenticateJWT,
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  updateEmployeeAdmin
);


router.delete(
  "/:employeeId",
  authenticateJWT,
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  deactivateEmployee
);

router.patch(
  "/:employeeId/manager",
  authenticateJWT,
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  changeManager
);

export default router;
