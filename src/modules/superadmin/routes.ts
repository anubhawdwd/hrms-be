// src/modules/superadmin/routes.ts
import { Router } from "express";
import {
  createSuperAdmin,
  listSuperAdmins,
  resetSuperAdminPassword,
  deactivateSuperAdmin,
} from "./controller.js";
import { authenticateJWT } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { UserRole } from "../../generated/prisma/enums.js";

const router = Router();

// Enforce both JWT authentication and SUPER_ADMIN role guard for all routes in this module
router.use(authenticateJWT, requireRole(UserRole.SUPER_ADMIN));

router.post("/", createSuperAdmin);
router.get("/", listSuperAdmins);
router.post("/:userId/reset-password", resetSuperAdminPassword);
router.delete("/:userId", deactivateSuperAdmin);

export default router;
