// src/modules/employee/routes.ts
import { Router } from "express";
import { authenticateJWT } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { validateCompanyHeader } from "../../middlewares/validateCompany.js";
import { UserRole } from "../../generated/prisma/enums.js";

import {
  createEmployee,
  listEmployees,
  getEmployeeById,
  changeManager,
  deactivateEmployee,
  updateMyProfile,
  updateEmployeeAdmin,
  getMyEmployeeProfile,
} from "./controller.js";

const router = Router();

router.use(authenticateJWT, validateCompanyHeader);

router.post(
  "/",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  createEmployee
);

router.get("/", listEmployees);

router.get("/me", getMyEmployeeProfile);

router.get(
  "/:employeeId",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  getEmployeeById
);

router.put("/me/profile", updateMyProfile);

router.put(
  "/:employeeId/admin",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  updateEmployeeAdmin
);

router.delete(
  "/:employeeId",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  deactivateEmployee
);

router.patch(
  "/:employeeId/manager",
  requireRole(UserRole.HR, UserRole.COMPANY_ADMIN),
  changeManager
);

export default router;
