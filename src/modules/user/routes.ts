// src/modules/user/routes.ts

import { Router } from "express";
import { createUser, deactivateUser, listUsers, updateUser } from "./controller.js";
import { authenticateJWT } from "../../middlewares/auth.middleware.js";
import * as controller from "./controller.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { UserRole } from "../../generated/prisma/enums.js";

const router = Router();

router.post(
    "/",
    authenticateJWT,
    requireRole(UserRole.COMPANY_ADMIN, UserRole.HR),
    createUser
);

router.get(
    "/",
    authenticateJWT,
    requireRole(UserRole.COMPANY_ADMIN, UserRole.HR, UserRole.SUPER_ADMIN),
    listUsers
);

router.patch(
    "/:userId",
    authenticateJWT,
    requireRole(UserRole.COMPANY_ADMIN),
    updateUser
);

router.delete(
    "/:userId",
    authenticateJWT,
    requireRole(UserRole.COMPANY_ADMIN),
    deactivateUser
);

export default router;
