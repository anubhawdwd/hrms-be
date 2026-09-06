// src/middlewares/rateLimit.middleware.ts
import rateLimit from "express-rate-limit";

/**
 * General authentication endpoint rate limiter.
 * Configured generously for 100-user LAN deployments with morning check-in bursts.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "test" ? 2000 : 120, // 120 auth requests per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many authentication requests from this IP. Please try again in a few minutes.",
  },
});

/**
 * Strict login rate limiter.
 * Protects against password brute-forcing while permitting 30 attempts per 15 min window per IP
 * (plenty of tolerance for office shared IPs/kiosks and typing errors during morning rush).
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "test" ? 2000 : 30, // 30 login attempts per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many login attempts from this IP. Please wait a few minutes before trying again.",
  },
});
