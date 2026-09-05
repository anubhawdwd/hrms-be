import type { Request, Response, NextFunction } from "express";

export function validateCompanyHeader(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const headerCompanyId = req.header("x-company-id");

  // SUPER_ADMIN can access any company or operate without tenant scope
  if (req.user && req.user.role === "SUPER_ADMIN") {
    (req as any).companyId = headerCompanyId || null;
    return next();
  }

  if (!headerCompanyId) {
    return res.status(400).json({ message: "Missing x-company-id header" });
  }

  if (req.user && req.user.companyId !== headerCompanyId) {
    return res.status(403).json({ message: "Company mismatch" });
  }

  // Attach to request for downstream use
  (req as any).companyId = headerCompanyId;
  next();
}