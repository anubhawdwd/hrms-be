// src/modules/report/routes.ts
import { Router } from "express";
import { authenticateJWT } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { validateCompanyHeader } from "../../middlewares/validateCompany.js";
import { UserRole } from "../../generated/prisma/enums.js";
import {
  getEmployeeReport,
  exportEmployeeReport,
  getLeaveReport,
  exportLeaveReport,
} from "./controller.js";

const router = Router();

router.use(authenticateJWT, validateCompanyHeader);
router.use(requireRole(UserRole.HR, UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN));

// Employee Report
router.get("/employee", getEmployeeReport);
router.get("/employee/export", exportEmployeeReport);

// Leave Report
router.get("/leave", getLeaveReport);
router.get("/leave/export", exportLeaveReport);

export default router;
