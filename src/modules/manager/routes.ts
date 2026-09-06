// src/modules/manager/routes.ts
import { Router } from "express";
import {
  getReportees,
  getReporteeLeaves,
  getReporteeAttendance,
} from "./controller.js";
import { authenticateJWT } from "../../middlewares/auth.middleware.js";
import { validateCompanyHeader } from "../../middlewares/validateCompany.js";

const router = Router();

router.use(authenticateJWT, validateCompanyHeader);

router.get("/reportees", getReportees);
router.get("/leaves", getReporteeLeaves);
router.get("/attendance", getReporteeAttendance);

export default router;
