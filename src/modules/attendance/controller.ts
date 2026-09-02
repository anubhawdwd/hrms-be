// src/modules/attendance/controller.ts
import type { Request, Response } from "express";
import { AttendanceService } from "./service.js";
import { UserRole } from "../../generated/prisma/enums.js";

const service = new AttendanceService();

export async function checkIn(req: Request, res: Response) {
  try {
    const { source, location } = req.body;

    if (!source || (source !== "WEB" && source !== "PWA")) {
      return res.status(400).json({ message: "Invalid source" });
    }

    if (
      location &&
      (typeof location.latitude !== "number" ||
        typeof location.longitude !== "number")
    ) {
      return res.status(400).json({ message: "Invalid location format" });
    }

    const result = await service.checkIn({
      userId: req.user!.userId,
      companyId: req.companyId!,
      source,
      ...(location && { location }),
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function checkOut(req: Request, res: Response) {
  try {
    const { source, location } = req.body;

    if (!source || (source !== "WEB" && source !== "PWA")) {
      return res.status(400).json({ message: "Invalid source" });
    }

    if (
      location &&
      (typeof location.latitude !== "number" ||
        typeof location.longitude !== "number")
    ) {
      return res.status(400).json({ message: "Invalid location format" });
    }

    const result = await service.checkOut({
      userId: req.user!.userId,
      companyId: req.companyId!,
      source,
      ...(location && { location }),
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function getAttendanceDay(req: Request, res: Response) {
  try {
    const { date, employeeId } = req.query;

    if (typeof date !== "string") {
      return res.status(400).json({ message: "Invalid query" });
    }

    if (employeeId && typeof employeeId === "string") {
      const allowedRoles: UserRole[] = [
        UserRole.HR,
        UserRole.COMPANY_ADMIN,
        UserRole.SUPER_ADMIN,
      ];
      if (!req.user || !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          message: "Unauthorized to view other employee attendance records",
        });
      }

      const data = await service.getAttendanceDayByEmployeeId(
        employeeId,
        req.companyId!,
        date
      );
      return res.json(data);
    }

    const data = await service.getAttendanceDay(
      req.user!.userId,
      req.companyId!,
      date
    );

    res.json(data);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function getAttendanceRange(req: Request, res: Response) {
  try {
    const { from, to } = req.query;

    if (typeof from !== "string" || typeof to !== "string") {
      return res.status(400).json({ message: "Invalid query" });
    }

    const data = await service.getAttendanceRange(
      req.user!.userId,
      req.companyId!,
      from,
      to
    );

    res.json(data);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function getAttendanceViolations(req: Request, res: Response) {
  try {
    const { employeeId, from, to } = req.query;

    const data = await service.getAttendanceViolations(
      req.companyId!,
      typeof employeeId === "string" ? employeeId : undefined,
      typeof from === "string" ? from : undefined,
      typeof to === "string" ? to : undefined
    );

    res.json(data);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function listEmployeeAttendanceOverrides(
  req: Request,
  res: Response
) {
  try {
    res.json(await service.listEmployeeAttendanceOverrides(req.companyId!));
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function deleteEmployeeAttendanceOverride(
  req: Request,
  res: Response
) {
  try {
    const { employeeId } = req.params;
    if (!employeeId || Array.isArray(employeeId)) {
      return res.status(400).json({ message: "Invalid request" });
    }

    await service.deleteEmployeeAttendanceOverride(employeeId, req.companyId!);
    res.json({ message: "Employee attendance override deleted" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function upsertEmployeeAttendanceOverride(
  req: Request,
  res: Response
) {
  try {
    const {
      employeeId,
      autoPresent,
      attendanceExempt,
      reason,
      validFrom,
      validTo,
    } = req.body;

    if (
      !employeeId ||
      typeof autoPresent !== "boolean" ||
      typeof attendanceExempt !== "boolean"
    ) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const override = await service.upsertEmployeeAttendanceOverride({
      employeeId,
      autoPresent,
      attendanceExempt,
      reason,
      validFrom,
      validTo,
      companyId: req.companyId!,
    });

    res.status(201).json(override);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function hrUpsertAttendanceDay(req: Request, res: Response) {
  try {
    const result = await service.hrUpsertAttendanceDay({
      ...req.body,
      companyId: req.companyId!,
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function hrAddAttendanceEvent(req: Request, res: Response) {
  try {
    const result = await service.hrAddAttendanceEvent({
      ...req.body,
      companyId: req.companyId!,
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function hrUpdateAttendanceDay(req: Request, res: Response) {
  try {
    const { attendanceDayId } = req.params;
    const { status, totalMinutes, checkIn, checkOut } = req.body;

    if (!attendanceDayId || Array.isArray(attendanceDayId)) {
      return res.status(400).json({ message: "Invalid request" });
    }

    const result = await service.hrUpdateAttendanceDay(attendanceDayId, {
      status,
      totalMinutes,
      checkIn,
      checkOut,
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function getMyMonthlyAttendance(req: Request, res: Response) {
  try {
    const { month } = req.query;

    if (!month || typeof month !== "string") {
      return res.status(400).json({ message: "month is required in YYYY-MM format" });
    }

    const result = await service.getMyMonthlyAttendance({
      companyId: req.companyId!,
      userId: req.user!.userId,
      monthStr: month,
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function getAttendanceDashboard(req: Request, res: Response) {
  try {
    const { month } = req.query;

    if (!month || typeof month !== "string") {
      return res
        .status(400)
        .json({ message: "Query parameter 'month' is required in YYYY-MM format" });
    }

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return res
        .status(400)
        .json({ message: "Invalid month format. Expected YYYY-MM (e.g. 2026-08)" });
    }

    const data = await service.getAttendanceDashboard(req.companyId!, month);

    res.json(data);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

