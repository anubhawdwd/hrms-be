// src/modules/employee/routes.ts

import { Router } from "express";
import {
  createEmployee,
  listEmployees,
  getEmployeeById,
  updateEmployee,
  changeManager,
} from "./controller.js";

const router = Router();

router.post("/", createEmployee);
router.get("/", listEmployees);
router.get("/:employeeId", getEmployeeById);
router.put("/:employeeId", updateEmployee);
router.patch("/:employeeId/manager", changeManager);

export default router;
