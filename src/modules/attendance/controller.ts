// src/modules/attendance/controller.ts
import type { Request, Response } from "express";
import { AttendanceService } from "./service.js";

const service = new AttendanceService();

export async function checkIn(req: Request, res: Response) {
  try {
    const { source, location } = req.body;

    if (
      !source ||
      !location ||
      typeof location.latitude !== "number" ||
      typeof location.longitude !== "number"
    ) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const result = await service.checkIn({
      userId: req.user!.userId,
      companyId: req.companyId!,
      source,
      location,
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function checkOut(req: Request, res: Response) {
  try {
    const { source, location } = req.body;

    if (
      !source ||
      !location ||
      typeof location.latitude !== "number" ||
      typeof location.longitude !== "number"
    ) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const result = await service.checkOut({
      userId: req.user!.userId,
      companyId: req.companyId!,
      source,
      location,
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function getAttendanceDay(req: Request, res: Response) {
  try {
    const { date } = req.query;

    if (typeof date !== "string") {
      return res.status(400).json({ message: "Invalid query" });
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
      typeof attendanceExempt !== "boolean" ||
      !validFrom
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
    const { status, totalMinutes } = req.body;

    if (!attendanceDayId || Array.isArray(attendanceDayId)) {
      return res.status(400).json({ message: "Invalid request" });
    }

    const result = await service.hrUpdateAttendanceDay(
      attendanceDayId,
      status,
      totalMinutes
    );

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}
