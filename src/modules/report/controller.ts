// src/modules/report/controller.ts
import type { Request, Response } from "express";
import { reportService } from "./service.js";

export async function getEmployeeReport(req: Request, res: Response) {
  try {
    const companyId = req.companyId!;
    const { departmentId, teamId, status, search } = req.query;

    const report = await reportService.getEmployeeReport(companyId, {
      departmentId: typeof departmentId === "string" ? departmentId : undefined,
      teamId: typeof teamId === "string" ? teamId : undefined,
      status: (typeof status === "string" ? status : "ALL") as any,
      search: typeof search === "string" ? search : undefined,
    });

    res.json(report);
  } catch (err: any) {
    res.status(400).json({ message: err.message || "Failed to generate employee report" });
  }
}

export async function exportEmployeeReport(req: Request, res: Response) {
  try {
    const companyId = req.companyId!;
    const { departmentId, teamId, status, search, format } = req.query;

    const report = await reportService.getEmployeeReport(companyId, {
      departmentId: typeof departmentId === "string" ? departmentId : undefined,
      teamId: typeof teamId === "string" ? teamId : undefined,
      status: (typeof status === "string" ? status : "ALL") as any,
      search: typeof search === "string" ? search : undefined,
    });

    const isCsv = format === "csv";
    const dateStr = new Date().toISOString().slice(0, 10);
    const sanitizedCompanyName = report.companyName.replace(/[^a-zA-Z0-9]/g, "_");

    if (isCsv) {
      const csv = reportService.generateEmployeeCsv(report);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${sanitizedCompanyName}_Employee_Report_${dateStr}.csv"`
      );
      return res.send(csv);
    } else {
      const buffer = await reportService.generateEmployeeExcel(report);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${sanitizedCompanyName}_Employee_Report_${dateStr}.xlsx"`
      );
      return res.send(buffer);
    }
  } catch (err: any) {
    res.status(400).json({ message: err.message || "Failed to export employee report" });
  }
}

export async function getLeaveReport(req: Request, res: Response) {
  try {
    const companyId = req.companyId!;
    const { year, fromDate, toDate, departmentId, teamId, employeeId, confirmPending } =
      req.query;

    const isConfirmed = confirmPending === "true" || confirmPending === "1";

    const report = await reportService.getLeaveReport(companyId, {
      year: year ? parseInt(String(year), 10) : undefined,
      fromDate: typeof fromDate === "string" ? fromDate : undefined,
      toDate: typeof toDate === "string" ? toDate : undefined,
      departmentId: typeof departmentId === "string" ? departmentId : undefined,
      teamId: typeof teamId === "string" ? teamId : undefined,
      employeeId: typeof employeeId === "string" ? employeeId : undefined,
      confirmPending: isConfirmed,
    });

    res.json(report);
  } catch (err: any) {
    res.status(400).json({ message: err.message || "Failed to generate leave report" });
  }
}

export async function exportLeaveReport(req: Request, res: Response) {
  try {
    const companyId = req.companyId!;
    const {
      year,
      fromDate,
      toDate,
      departmentId,
      teamId,
      employeeId,
      confirmPending,
      format,
    } = req.query;

    const isConfirmed = confirmPending === "true" || confirmPending === "1";

    const report = await reportService.getLeaveReport(companyId, {
      year: year ? parseInt(String(year), 10) : undefined,
      fromDate: typeof fromDate === "string" ? fromDate : undefined,
      toDate: typeof toDate === "string" ? toDate : undefined,
      departmentId: typeof departmentId === "string" ? departmentId : undefined,
      teamId: typeof teamId === "string" ? teamId : undefined,
      employeeId: typeof employeeId === "string" ? employeeId : undefined,
      confirmPending: isConfirmed,
    });

    // If a pending warning was returned and export wasn't explicitly confirmed
    if ("warning" in report && report.warning === "PENDING_LEAVE_APPROVALS") {
      return res.status(200).json(report);
    }

    const leaveReport = report as any;
    const isCsv = format === "csv";
    const dateStr = new Date().toISOString().slice(0, 10);
    const sanitizedCompanyName = leaveReport.companyName.replace(/[^a-zA-Z0-9]/g, "_");

    if (isCsv) {
      const csv = reportService.generateLeaveCsv(leaveReport);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${sanitizedCompanyName}_Leave_Report_${leaveReport.year}_${dateStr}.csv"`
      );
      return res.send(csv);
    } else {
      const buffer = await reportService.generateLeaveExcel(leaveReport);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${sanitizedCompanyName}_Leave_Report_${leaveReport.year}_${dateStr}.xlsx"`
      );
      return res.send(buffer);
    }
  } catch (err: any) {
    res.status(400).json({ message: err.message || "Failed to export leave report" });
  }
}
