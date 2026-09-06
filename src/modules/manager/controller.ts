// src/modules/manager/controller.ts
import type { Request, Response } from "express";
import { ManagerService } from "./service.js";

const service = new ManagerService();

export async function getReportees(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    const companyId = req.companyId;

    if (!userId || !companyId) {
      return res.status(401).json({ message: "Unauthorized or missing company context" });
    }

    const result = await service.getReportees(userId, companyId);
    return res.json(result);
  } catch (err: any) {
    const status = err.statusCode || 400;
    return res.status(status).json({ message: err.message });
  }
}

export async function getReporteeLeaves(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    const companyId = req.companyId;

    if (!userId || !companyId) {
      return res.status(401).json({ message: "Unauthorized or missing company context" });
    }

    const { status, employeeId, fromDate, toDate } = req.query;
    const filter: any = {};
    if (status) filter.status = status as any;
    if (employeeId) filter.employeeId = String(employeeId);
    if (fromDate) filter.fromDate = String(fromDate);
    if (toDate) filter.toDate = String(toDate);

    const result = await service.getReporteeLeaves(userId, companyId, filter);
    return res.json(result);
  } catch (err: any) {
    const status = err.statusCode || 400;
    return res.status(status).json({ message: err.message });
  }
}

export async function getReporteeAttendance(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    const companyId = req.companyId;

    if (!userId || !companyId) {
      return res.status(401).json({ message: "Unauthorized or missing company context" });
    }

    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    const filter: any = { month };
    if (req.query.employeeId) {
      filter.employeeId = String(req.query.employeeId);
    }

    const result = await service.getReporteeAttendance(userId, companyId, filter);
    return res.json(result);
  } catch (err: any) {
    const status = err.statusCode || 400;
    return res.status(status).json({ message: err.message });
  }
}
