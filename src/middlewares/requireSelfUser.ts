// src/middlewares/requireSelfUser.ts

import type { Request, Response, NextFunction } from "express";

export function requireSelfUser() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  };
}
