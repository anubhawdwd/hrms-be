// src/modules/user/routes.ts
import { Router } from "express";
import {
  createUser,
  deactivateUser,
  listUsers,
  resetPassword,
  updateUser,
  updateUserEmail,
} from "./controller.js";
import { authenticateJWT } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { validateCompanyHeader } from "../../middlewares/validateCompany.js";
import { UserRole } from "../../generated/prisma/enums.js";

const router = Router();

router.use(authenticateJWT, validateCompanyHeader);

router.post(
  "/",
  requireRole(UserRole.COMPANY_ADMIN, UserRole.HR, UserRole.SUPER_ADMIN),
  createUser
);
router.get(
  "/",
  requireRole(UserRole.COMPANY_ADMIN, UserRole.HR, UserRole.SUPER_ADMIN),
  listUsers
);
router.post(
  "/:userId/reset-password",
  requireRole(UserRole.COMPANY_ADMIN, UserRole.HR, UserRole.SUPER_ADMIN),
  resetPassword
);
router.patch(
  "/:userId/email",
  requireRole(UserRole.COMPANY_ADMIN, UserRole.HR),
  updateUserEmail
);
router.patch(
  "/:userId",
  requireRole(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN),
  updateUser
);
router.delete(
  "/:userId",
  requireRole(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN),
  deactivateUser
);

export default router;
