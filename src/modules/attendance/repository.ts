// src/modules/attendance/repository.ts
import { prisma } from "../../config/prisma.js";

export class AttendanceRepository {
    async findAttendanceDay(employeeId: string, date: Date) {
        return prisma.attendanceDay.findFirst({
            where: {
                employeeId,
                date,
            },
            include: {
                events: {
                    orderBy: { timestamp: "asc" },
                },
            },
        });
    }

    async createAttendanceDay(employeeId: string, companyId: string, date: Date) {
        return prisma.attendanceDay.create({
            data: {
                employee: { connect: { id: employeeId } },
                company: { connect: { id: companyId } },
                date,
            },
            include: {
                events: true,
            },
        });
    }

    async addEvent(
        attendanceDayId: string,
        type: "CHECK_IN" | "CHECK_OUT",
        source: "WEB" | "PWA",
        timestamp: Date
    ) {
        return prisma.attendanceEvent.create({
            data: {
                attendanceDay: { connect: { id: attendanceDayId } },
                type,
                source,
                timestamp,
            },
        });
    }

    async updateAttendanceSummary(
        attendanceDayId: string,
        totalMinutes: number,
        status: "PRESENT" | "ABSENT" | "PARTIAL" | "LEAVE"
    ) {
        return prisma.attendanceDay.update({
            where: { id: attendanceDayId },
            data: {
                totalMinutes,
                status,
            },
        });
    }

    async getAttendanceByDay(
        employeeId: string,
        companyId: string,
        date: Date
    ) {
        return prisma.attendanceDay.findFirst({
            where: {
                employeeId,
                companyId,
                date,
            },
            include: {
                events: {
                    orderBy: { timestamp: "asc" },
                },
            },
        });
    }

    async getAttendanceByRange(
        employeeId: string,
        companyId: string,
        from: Date,
        to: Date
    ) {
        return prisma.attendanceDay.findMany({
            where: {
                employeeId,
                companyId,
                date: {
                    gte: from,
                    lte: to,
                },
            },
            orderBy: {
                date: "asc",
            },
            include: {
                events: {
                    orderBy: { timestamp: "asc" },
                },
            },
        });
    }

    async getActiveOfficeLocation(companyId: string) {
        return prisma.officeLocation.findFirst({
            where: {
                companyId,
                isActive: true,
            },
        });
    }
    // -----violation Log-----
    async logViolation(params: {
        employeeId: string;
        companyId: string;
        latitude: number;
        longitude: number;
        distanceM: number;
        reason: string;
        source: "WEB" | "PWA";
    }) {
        return prisma.attendanceViolation.create({
            data: {
                employee: { connect: { id: params.employeeId } },
                company: { connect: { id: params.companyId } },
                latitude: params.latitude,
                longitude: params.longitude,
                distanceM: params.distanceM,
                reason: params.reason,
                source: params.source,
            },
        });
    }
    // -----violation log sorting for display----
    async getViolations(params: {
        companyId: string;
        employeeId?: string;
        from?: Date;
        to?: Date;
    }) {
        return prisma.attendanceViolation.findMany({
            where: {
                companyId: params.companyId,
                ...(params.employeeId && { employeeId: params.employeeId }),
                ...(params.from &&
                    params.to && {
                    createdAt: {
                        gte: params.from,
                        lte: params.to,
                    },
                }),
            },
            orderBy: { createdAt: "desc" },
        });
    }

    async getEmployeeWithAttendancePolicy(employeeId: string) {
        return prisma.employeeProfile.findUnique({
            where: { id: employeeId },
            include: {
                designation: {
                    include: {
                        attendancePolicy: true,
                    },
                },
            },
        });
    }
    // ------HR updateAttendance------
    async upsertAttendanceDay(
        employeeId: string,
        companyId: string,
        date: Date,
        status: "PRESENT" | "ABSENT" | "PARTIAL" | "LEAVE",
        totalMinutes: number
    ) {
        return prisma.attendanceDay.upsert({
            where: {
                employeeId_date: {
                    employeeId,
                    date,
                },
            },
            update: {
                status,
                totalMinutes,
            },
            create: {
                employeeId,
                companyId,
                date,
                status,
                totalMinutes,
            },
        });
    }

    async addHrEvent(
        attendanceDayId: string,
        type: "CHECK_IN" | "CHECK_OUT",
        source: "WEB" | "PWA",
        timestamp: Date
    ) {
        return prisma.attendanceEvent.create({
            data: {
                attendanceDayId,
                type,
                source,
                timestamp,
            },
        });
    }

    findApprovedLeaveForDate(employeeId: string, date: Date) {
        return prisma.leaveRequest.findFirst({
            where: {
                employeeId,
                status: "APPROVED",
                fromDate: { lte: date },
                toDate: { gte: date },
            },
        });
    }

}
