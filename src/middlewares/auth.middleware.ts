// src/middlewares/auth.middleware.ts
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";
import { JWT_ACCESS_SECRET } from "../config/auth.js";
import  { UserRole } from "../generated/prisma/enums.js";

export interface AuthPayload {
    userId: string;
    companyId: string;
    role: UserRole;
}

declare global {
    namespace Express {
        interface Request {
            user?: AuthPayload;
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
        
        const decoded = jwt.verify(
            token,
            JWT_ACCESS_SECRET
        ) as JwtPayload;

        if (
            typeof decoded.sub !== "string" ||
            typeof decoded.companyId !== "string" ||
            typeof decoded.role !== "string"  ||
            !Object.values(UserRole).includes(decoded.role as UserRole)
        ) {
            return res.status(401).json({ message: "Invalid token payload" });
        }

        req.user = {
            userId: decoded.sub,
            companyId: decoded.companyId,
            role: decoded.role as UserRole,
        };


        next();
    } catch {
        return res.status(401).json({ message: "Invalid token" });
    }
}
