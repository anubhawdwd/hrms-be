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
  getMyEmployeeProfile,
} from "./controller.js";
import { requireSelfUser } from "../../middlewares/requireSelfUser.js";

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
  "/me",
  authenticateJWT,
  requireSelfUser(),
  getMyEmployeeProfile
);


router.get(
  "/:employeeId",
  authenticateJWT,
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  getEmployeeById
);

// SELF UPDATE
router.put(
  "/me/profile",
  authenticateJWT,
  requireSelfUser(),
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
