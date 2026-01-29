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
} from "./controller.js";

const router = Router();

router.post("/departments", createDepartment);
router.get("/departments", listDepartments);

router.post("/teams", createTeam);
router.get("/teams", listTeams);

router.post("/designations", createDesignation);
router.get("/designations", listDesignations);

router.post("/employees", createEmployee);
router.get("/employees", listEmployees);

router.post("/office-location", setOfficeLocation);
router.get("/office-location", getOfficeLocation);

export default router;
