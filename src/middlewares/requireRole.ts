// src/middlewares/requireRole.ts
import type { Request, Response, NextFunction } from "express";
import { UserRole } from "../generated/prisma/enums.js";

export function requireRole(...allowedRoles: UserRole[]) {
  return (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!req.user.roles || !req.user.roles.some((r) => allowedRoles.includes(r))) {
      return res.status(403).json({
        message: "Forbidden: insufficient permissions",
      });
    }

    next();
  };
}
