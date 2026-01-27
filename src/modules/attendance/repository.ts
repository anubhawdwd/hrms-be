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
        status: "PRESENT" | "ABSENT" | "PARTIAL"
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

}
