// src/routes/index.ts
import { Router } from "express";
import companyRoutes from "../modules/company/routes.js";
import organizationRoutes from "../modules/organization/routes.js";
import attendanceRoutes from "../modules/attendance/routes.js";
import userRoutes from "../modules/user/routes.js";
import employeeRoutes from "../modules/employee/routes.js";
import authRoutes from "../modules/auth/routes.js";
import leaveRoutes from "../modules/leave/routes.js";
import reportRoutes from "../modules/report/routes.js";
import errorLogRoutes from "../modules/error-log/routes.js";
import superadminRoutes from "../modules/superadmin/routes.js";
import managerRoutes from "../modules/manager/routes.js";
import notificationRoutes from "../modules/notification/routes.js";
const router = Router();

router.use("/auth", authRoutes);
router.use("/company", companyRoutes);
router.use("/organization", organizationRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/users", userRoutes);
router.use("/leave", leaveRoutes);
router.use("/employees", employeeRoutes);
router.use("/reports", reportRoutes);
router.use("/error-logs", errorLogRoutes);
router.use("/superadmins", superadminRoutes);
router.use("/manager", managerRoutes);
router.use("/notifications", notificationRoutes);

export default router;
