// src/modules/error-log/controller.ts
import type { Request, Response } from "express";
import { ErrorLogService } from "./service.js";

const service = new ErrorLogService();

export async function captureFrontendError(req: Request, res: Response) {
  try {
    const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.ip;
    const userAgent = req.headers["user-agent"];

    const result = await service.logFrontendError(
      req.body,
      ipAddress,
      userAgent
    );

    res.status(201).json({ success: true, logId: result?.id });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function listErrorLogs(req: Request, res: Response) {
  try {
    const { page, limit, source, statusCode, companyId, startDate, endDate, search } = req.query;

    const data = await service.listErrorLogs({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      source: source as any,
      statusCode: statusCode ? Number(statusCode) : undefined,
      companyId: companyId as string,
      startDate: startDate as string,
      endDate: endDate as string,
      search: search as string,
    });

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}

export async function deleteErrorLogs(req: Request, res: Response) {
  try {
    const { ids } = req.body;
    const result = await service.deleteLogsByIds(ids);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function deleteErrorLogsBulk(req: Request, res: Response) {
  try {
    const { source, statusCode, companyId, startDate, endDate, search } = req.query;

    const result = await service.deleteLogsByFilter({
      source: source as any,
      statusCode: statusCode ? Number(statusCode) : undefined,
      companyId: companyId as string,
      startDate: startDate as string,
      endDate: endDate as string,
      search: search as string,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}

export async function purgeErrorLogs(req: Request, res: Response) {
  try {
    const days = req.body?.retentionDays ? Number(req.body.retentionDays) : 20;
    const result = await service.purgeExpiredLogs(days);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}

