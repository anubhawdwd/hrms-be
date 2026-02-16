// src/modules/organization/routes.ts
import { Router } from "express";
import {
  createDepartment,
  listDepartments,
  updateDepartment,
  deactivateDepartment,
  createTeam,
  listTeams,
  updateTeam,
  deactivateTeam,
  createDesignation,
  listDesignations,
  updateDesignation,
  deactivateDesignation,
  setOfficeLocation,
  getOfficeLocation,
  upsertDesignationAttendancePolicy,
  listDesignationAttendancePolicies,
  getDesignationAttendancePolicy,
} from "./controller.js";
import { authenticateJWT } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { validateCompanyHeader } from "../../middlewares/validateCompany.js";
import { UserRole } from "../../generated/prisma/enums.js";

const router = Router();
router.use(
  authenticateJWT,
  validateCompanyHeader,
  requireRole(UserRole.COMPANY_ADMIN, UserRole.HR)
);

router.post("/departments", createDepartment);
router.get("/departments", listDepartments);
router.patch("/departments/:departmentId", updateDepartment);
router.delete("/departments/:departmentId", deactivateDepartment);

router.post("/teams", createTeam);
router.get("/teams", listTeams);
router.patch("/teams/:teamId", updateTeam);
router.delete("/teams/:teamId", deactivateTeam);

router.post("/designations", createDesignation);
router.get("/designations", listDesignations);
router.patch("/designations/:designationId", updateDesignation);
router.delete("/designations/:designationId", deactivateDesignation);

router.post("/office-location", setOfficeLocation);
router.get("/office-location", getOfficeLocation);
router.put("/office-location", setOfficeLocation);

router.post(
  "/designation-attendance-policy",
  upsertDesignationAttendancePolicy
);
router.get(
  "/designation-attendance-policy",
  listDesignationAttendancePolicies
);
router.get(
  "/designation-attendance-policy/:designationId",
  getDesignationAttendancePolicy
);

export default router;
