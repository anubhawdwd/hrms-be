// src/modules/company/routes.ts

import { Router } from "express";
import {
  createCompany,
  getCompany,
  getCompanyUsers,
  listCompanies,
  resetCompanyUserPassword,
  updateCompany,
} from "./controller.js";
import { authenticateJWT } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { UserRole } from "../../generated/prisma/enums.js";

const router = Router();

router.post(
  "/",
  authenticateJWT,
  requireRole(UserRole.SUPER_ADMIN),
  createCompany
);

router.get(
  "/",
  authenticateJWT,
  requireRole(UserRole.SUPER_ADMIN),
  listCompanies   
);

router.get(
  "/:companyId",
  authenticateJWT,
  requireRole(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN),
  getCompany
);

router.patch(
  "/:companyId",
  authenticateJWT,
  requireRole(UserRole.SUPER_ADMIN),
  updateCompany
);

router.get(
  "/:companyId/users",
  authenticateJWT,
  requireRole(UserRole.SUPER_ADMIN),
  getCompanyUsers
);

router.post(
  "/:companyId/users/:userId/reset-password",
  authenticateJWT,
  requireRole(UserRole.SUPER_ADMIN),
  resetCompanyUserPassword
);

export default router;

