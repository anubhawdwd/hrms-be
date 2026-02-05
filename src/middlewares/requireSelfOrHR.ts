// src/middlewares/requireSelfOrHR.ts

import type { Request, Response, NextFunction } from "express";
import { UserRole } from "../generated/prisma/enums.js";

export function requireSelfOrHR(paramName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // HR and Company Admin can access anyone
    if (
      user.role === UserRole.HR ||
      user.role === UserRole.COMPANY_ADMIN
    ) {
      return next();
    }

    const targetId = req.params[paramName];

    if (!targetId) {
      return res.status(400).json({ message: "Missing target id" });
    }

    if (user.userId !== targetId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    next();
  };
}
