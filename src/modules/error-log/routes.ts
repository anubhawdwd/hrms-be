// src/modules/error-log/routes.ts
import { Router } from "express";
import {
  captureFrontendError,
  deleteErrorLogs,
  deleteErrorLogsBulk,
  listErrorLogs,
  purgeErrorLogs,
} from "./controller.js";
import { authenticateJWT } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { UserRole } from "../../generated/prisma/enums.js";

const router = Router();

// Ingest frontend errors (lightweight endpoint, can be called anonymously or authenticated)
router.post("/frontend", captureFrontendError);

// SuperAdmin error log viewer & maintenance endpoints
router.get(
  "/",
  authenticateJWT,
  requireRole(UserRole.SUPER_ADMIN),
  listErrorLogs
);

router.delete(
  "/bulk",
  authenticateJWT,
  requireRole(UserRole.SUPER_ADMIN),
  deleteErrorLogsBulk
);

router.delete(
  "/",
  authenticateJWT,
  requireRole(UserRole.SUPER_ADMIN),
  deleteErrorLogs
);

router.post(
  "/purge",
  authenticateJWT,
  requireRole(UserRole.SUPER_ADMIN),
  purgeErrorLogs
);

export default router;

