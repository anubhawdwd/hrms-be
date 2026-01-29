import { Router } from "express";
import companyRoutes from "../modules/company/routes.js";
import organizationRoutes from "../modules/organization/routes.js";
import attendanceRoutes from "../modules/attendance/routes.js";
import userRoutes from "../modules/user/routes.js";
import employeeRoutes from "../modules/employee/routes.js";

const router = Router();

router.use("/company", companyRoutes);
router.use("/organization", organizationRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/users", userRoutes);
router.use("/employees", employeeRoutes);

export default router;
