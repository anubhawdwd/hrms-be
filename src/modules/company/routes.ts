// src/modules/company/routes.ts

import { Router } from "express";
import {
  createCompany,
  getCompany,
  updateCompany,
} from "./controller.js";

const router = Router();

router.post("/", createCompany);
router.get("/:companyId", getCompany);
router.patch("/:companyId", updateCompany);

export default router;
