// src/routes/index.ts
import { Router } from "express";
import companyRoutes from "../modules/company/routes.js";
import organizationRoutes from "../modules/organization/routes.js";
import attendanceRoutes from "../modules/attendance/routes.js";
import userRoutes from "../modules/user/routes.js";
import employeeRoutes from "../modules/employee/routes.js";
import authRoutes from "../modules/auth/routes.js";
import platformRoutes from "../modules/platform/routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/platform", platformRoutes);
router.use("/company", companyRoutes);
router.use("/organization", organizationRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/users", userRoutes);
router.use("/employees", employeeRoutes);

export default router;
