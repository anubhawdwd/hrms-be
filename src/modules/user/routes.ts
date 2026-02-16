// src/modules/user/routes.ts
import { Router } from "express";
import {
  createUser,
  deactivateUser,
  listUsers,
  updateUser,
} from "./controller.js";
import { authenticateJWT } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { validateCompanyHeader } from "../../middlewares/validateCompany.js";
import { UserRole } from "../../generated/prisma/enums.js";

const router = Router();

router.use(authenticateJWT, validateCompanyHeader);

router.post(
  "/",
  requireRole(UserRole.COMPANY_ADMIN, UserRole.HR),
  createUser
);
router.get(
  "/",
  requireRole(UserRole.COMPANY_ADMIN, UserRole.HR),
  listUsers
);
router.patch(
  "/:userId",
  requireRole(UserRole.COMPANY_ADMIN),
  updateUser
);
router.delete(
  "/:userId",
  requireRole(UserRole.COMPANY_ADMIN),
  deactivateUser
);

export default router;
