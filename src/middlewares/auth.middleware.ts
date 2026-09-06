// src/middlewares/auth.middleware.ts
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";
import { JWT_ACCESS_SECRET } from "../config/auth.js";
import { UserRole } from "../generated/prisma/enums.js";

export interface AuthPayload {
  userId: string;
  companyId?: string | null;
  roles: UserRole[];
  role?: UserRole; // TD-06: temporary compatibility shim for Phase 2/3
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
      companyId?: string;
    }
  }
}

export function authenticateJWT(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Missing token" });
    }

    const token = header.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Missing token" });
    }

    const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as JwtPayload;

    const hasValidCompanyId =
      decoded.companyId === null ||
      decoded.companyId === undefined ||
      typeof decoded.companyId === "string";

    const hasValidRoles =
      Array.isArray(decoded.roles) &&
      decoded.roles.length > 0 &&
      decoded.roles.every((r: any) => Object.values(UserRole).includes(r));

    if (
      typeof decoded.sub !== "string" ||
      !hasValidCompanyId ||
      !hasValidRoles
    ) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    const roles = decoded.roles as UserRole[];

    req.user = {
      userId: decoded.sub,
      companyId: typeof decoded.companyId === "string" ? decoded.companyId : null,
      roles,
      role: roles[0] || UserRole.EMPLOYEE, // TD-06 shim
    };

    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}