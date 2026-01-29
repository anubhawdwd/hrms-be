// src/modules/user/routes.ts

import { Router } from "express";
import { createUser, listUsers } from "./controller.js";

const router = Router();

router.post("/", createUser);
router.get("/", listUsers);

export default router;
