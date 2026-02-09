// src/modules/auth/routes.ts
import { Router } from "express";

import {
  login,
  googleLogin,
  microsoftLogin,
  refreshToken,
  logout,
  me
} from "./controller.js";
import { authenticateJWT } from "../../middlewares/auth.middleware.js";

const router = Router();

// user verification
router.get("/me", authenticateJWT, me);

//    AUTH ROUTES
router.post("/login", login);
router.post("/google", googleLogin);
router.post("/microsoft", microsoftLogin);
router.post("/refresh", refreshToken);
router.post("/logout", logout);


export default router;
