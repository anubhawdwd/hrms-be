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

export default router;
