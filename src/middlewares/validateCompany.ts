import type { Request, Response, NextFunction } from "express";

export function validateCompanyHeader(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const headerCompanyId = req.header("x-company-id");

  if (!headerCompanyId) {
    return res.status(400).json({ message: "Missing x-company-id header" });
  }

  // SUPER_ADMIN can access any company
  if (req.user && req.user.role !== "SUPER_ADMIN") {
    if (req.user.companyId !== headerCompanyId) {
      return res.status(403).json({ message: "Company mismatch" });
    }
  }

  // Attach to request for downstream use
  (req as any).companyId = headerCompanyId;
  next();
}