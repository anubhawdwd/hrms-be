// src/modules/auth/routes.ts
import { Router } from "express";

import {
  login,
  googleLogin,
  microsoftLogin,
  refreshToken,
  logout,
} from "./controller.js";

const router = Router();

//    AUTH ROUTES

router.post("/login", login);
router.post("/google", googleLogin);
router.post("/microsoft", microsoftLogin);
router.post("/refresh", refreshToken);
router.post("/logout", logout);

export default router;
