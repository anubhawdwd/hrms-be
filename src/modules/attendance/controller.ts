// src/modules/attendance/controller.ts
import type { Request, Response } from "express";
import { AttendanceService } from "./service.js";
import { prisma } from "../../config/prisma.js";

const service = new AttendanceService();

export async function checkIn(req: Request, res: Response) {
    try {
        const companyId = req.header("x-company-id");
        const { employeeId, source, location } = req.body;

        if (
            !companyId ||
            !employeeId ||
            !source ||
            !location ||
            typeof location.latitude !== "number" ||
            typeof location.longitude !== "number"
        ) {
            return res.status(400).json({ message: "Invalid input" });
        }

        const result = await service.checkIn({
            employeeId,
            companyId,
            source,
            location
        });

        res.json(result);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
}

export async function checkOut(req: Request, res: Response) {
    try {
        const companyId = req.header("x-company-id");
        const { employeeId, source, location } = req.body;

        if (
            !companyId ||
            !employeeId ||
            !source ||
            !location ||
            typeof location.latitude !== "number" ||
            typeof location.longitude !== "number"
        ) {
            return res.status(400).json({ message: "Invalid input" });
        }

        const result = await service.checkOut({
            employeeId,
            companyId,
            source,
            location
        });

        res.json(result);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
}

export async function getAttendanceDay(req: Request, res: Response) {
    try {
        const companyId = req.header("x-company-id");
        const { employeeId, date } = req.query;

        if (
            !companyId ||
            typeof employeeId !== "string" ||
            typeof date !== "string"
        ) {
            return res.status(400).json({ message: "Invalid query" });
        }

        const data = await service.getAttendanceDay(
            employeeId,
            companyId,
            date
        );

        res.json(data);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
}

export async function getAttendanceRange(req: Request, res: Response) {
    try {
        const companyId = req.header("x-company-id");
        const { employeeId, from, to } = req.query;

        if (
            !companyId ||
            typeof employeeId !== "string" ||
            typeof from !== "string" ||
            typeof to !== "string"
        ) {
            return res.status(400).json({ message: "Invalid query" });
        }

        const data = await service.getAttendanceRange(
            employeeId,
            companyId,
            from,
            to
        );

        res.json(data);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
}

export async function getAttendanceViolations(
    req: Request,
    res: Response
) {
    try {
        const companyId = req.header("x-company-id");
        const { employeeId, from, to } = req.query;

        if (!companyId) {
            return res.status(400).json({ message: "Missing companyId" });
        }

        const data = await service.getAttendanceViolations(
            companyId,
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
        const companyId = req.header("x-company-id");
        if (!companyId) {
            return res.status(400).json({ message: "Missing companyId" });
        }

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
        const existing = await prisma.employeeAttendanceOverride.findFirst({
            where: {
                employeeId,
                validFrom: new Date(validFrom),
            },
        });

        if (existing) {
            throw new Error(
                "Attendance override already exists for this employee and start date"
            );
        }

        const override = await prisma.employeeAttendanceOverride.create({
            data: {
                employeeId,
                autoPresent,
                attendanceExempt,
                reason,
                validFrom: new Date(validFrom),
                ...(validTo && { validTo: new Date(validTo) }),
            },
        });

        res.status(201).json(override);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
}

// ----------hr-override---------
export async function hrUpsertAttendanceDay(req: Request, res: Response) {
    try {
        const companyId = req.header("x-company-id");
        if (!companyId) {
            return res.status(400).json({ message: "Missing companyId" });
        }

        const result = await service.hrUpsertAttendanceDay({
            ...req.body,
            companyId,
        });

        res.json(result);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
}

export async function hrAddAttendanceEvent(req: Request, res: Response) {
    try {
        const companyId = req.header("x-company-id");
        if (!companyId) {
            return res.status(400).json({ message: "Missing companyId" });
        }

        const result = await service.hrAddAttendanceEvent({
            ...req.body,
            companyId,
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

