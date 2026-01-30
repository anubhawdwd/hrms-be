import { Router } from "express";
import {
  createDepartment,
  listDepartments,
  createTeam,
  listTeams,
  createDesignation,
  listDesignations,
  createEmployee,
  listEmployees,
  setOfficeLocation,
  getOfficeLocation,
  upsertDesignationAttendancePolicy,
  listDesignationAttendancePolicies,
  getDesignationAttendancePolicy,
  updateDepartment,
  deactivateDepartment,
  updateTeam,
  deactivateTeam,
  updateDesignation,
  deactivateDesignation,
  deactivateEmployee,
  updateEmployee,
} from "./controller.js";

const router = Router();

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

router.post("/employees", createEmployee);
router.get("/employees", listEmployees);
router.patch("/employees/:employeeId", updateEmployee);
router.delete("/employees/:employeeId", deactivateEmployee);

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
