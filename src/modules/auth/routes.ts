// src/modules/auth/routes.ts
import { Router } from "express";

import {
  login,
  googleLogin,
  microsoftLogin,
  refreshToken,
  logout,
  me,
  changePassword,
} from "./controller.js";
import { authenticateJWT } from "../../middlewares/auth.middleware.js";
import { loginRateLimiter, authRateLimiter } from "../../middlewares/rateLimit.middleware.js";

const router = Router();

// user verification
router.get("/me", authenticateJWT, me);

//    AUTH ROUTES
router.post("/login", loginRateLimiter, login);
router.post("/google", loginRateLimiter, googleLogin);
router.post("/microsoft", loginRateLimiter, microsoftLogin);
router.post("/refresh", authRateLimiter, refreshToken);
router.post("/logout", logout);
router.post("/change-password", authenticateJWT, authRateLimiter, changePassword);

export default router;
