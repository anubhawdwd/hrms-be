// src/modules/organization/routes.ts
import { Router } from "express";
import {
  getTeamsSetting,
  updateTeamsSetting,
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
  updateOfficeLocation,
  getOfficeLocation,
  upsertDesignationAttendancePolicy,
  listDesignationAttendancePolicies,
  getDesignationAttendancePolicy,
  getWorkingHours,
  updateWorkingHours,
} from "./controller.js";
import { authenticateJWT } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { validateCompanyHeader } from "../../middlewares/validateCompany.js";
import { UserRole } from "../../generated/prisma/enums.js";

const router = Router();
router.use(authenticateJWT, validateCompanyHeader);

// Public/Employee read access to company working hours
router.get("/working-hours", getWorkingHours);

// Management routes requiring COMPANY_ADMIN or HR role
router.use(requireRole(UserRole.COMPANY_ADMIN, UserRole.HR));

router.get("/teams-setting", getTeamsSetting);
router.patch("/teams-setting", updateTeamsSetting);

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
router.patch("/office-location", updateOfficeLocation);

router.patch("/working-hours", updateWorkingHours);
router.put("/working-hours", updateWorkingHours);

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
