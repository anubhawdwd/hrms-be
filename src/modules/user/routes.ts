// src/modules/user/routes.ts

import { Router } from "express";
import { createUser, deactivateUser, listUsers, updateUser } from "./controller.js";

const router = Router();

router.post("/", createUser);
router.get("/", listUsers);

router.patch("/:userId", updateUser);
router.delete("/:userId", deactivateUser);
export default router;
