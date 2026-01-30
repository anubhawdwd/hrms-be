import { AttendanceRepository } from "./repository.js";
import type { CheckInDTO, CheckOutDTO, HrAddAttendanceEventDTO, HrUpsertAttendanceDayDTO } from "./types.js";
import { haversineDistanceMeters } from "../../utils/geo.js";
import { prisma } from "../../config/prisma.js";

const repo = new AttendanceRepository();

function startOfDay(date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

export class AttendanceService {
    async checkIn(dto: CheckInDTO) {
        const { employee, isExempt, isAutoPresent } =
            await this.resolveAttendancePolicy(dto.employeeId);

        // 1️⃣ Attendance exempt → ignore
        if (isExempt) {
            return { message: "Attendance exempt employee" };
        }

        // 2️⃣ Auto-present → mark present and exit
        if (isAutoPresent) {
            const today = startOfDay();

            let attendanceDay = await repo.findAttendanceDay(employee.id, today);

            if (!attendanceDay) {
                attendanceDay = await repo.createAttendanceDay(
                    employee.id,
                    employee.companyId,
                    today
                );
            }

            await repo.updateAttendanceSummary(
                attendanceDay.id,
                attendanceDay.totalMinutes,
                "PRESENT"
            );

            return { message: "Auto-present applied" };
        }

        await this.validateGeoFence(
            dto.companyId,
            dto.employeeId,
            dto.location.latitude,
            dto.location.longitude,
            dto.source
        );


        const today = startOfDay();

        let attendanceDay = await repo.findAttendanceDay(dto.employeeId, today);

        if (!attendanceDay) {
            attendanceDay = await repo.createAttendanceDay(
                dto.employeeId,
                dto.companyId,
                today
            );
        }

        const lastEvent = attendanceDay.events.at(-1);

        if (lastEvent?.type === "CHECK_IN") {
            throw new Error("Already checked in");
        }

        await repo.addEvent(
            attendanceDay.id,
            "CHECK_IN",
            dto.source,
            new Date()
        );
        await repo.updateAttendanceSummary(
            attendanceDay.id,
            attendanceDay.totalMinutes,
            "PRESENT"
        );
        return { message: "Checked in successfully" };
    }

    async checkOut(dto: CheckOutDTO) {
        const { isExempt, isAutoPresent } =
            await this.resolveAttendancePolicy(dto.employeeId);

        // 1️⃣ Exempt employees → no-op
        if (isExempt) {
            return { message: "Attendance exempt employee" };
        }

        // 2️⃣ Auto-present → no check-out required
        if (isAutoPresent) {
            return { message: "Auto-present employee" };
        }


        await this.validateGeoFence(
            dto.companyId,
            dto.employeeId,
            dto.location.latitude,
            dto.location.longitude,
            dto.source
        );


        const today = startOfDay();

        const attendanceDay = await repo.findAttendanceDay(dto.employeeId, today);

        if (!attendanceDay) {
            throw new Error("Cannot check out without checking in");
        }

        const lastEvent = attendanceDay.events.at(-1);

        if (!lastEvent || lastEvent.type !== "CHECK_IN") {
            throw new Error("Invalid check-out");
        }

        const now = new Date();
        const minutesWorked = Math.ceil(
            (now.getTime() - new Date(lastEvent.timestamp).getTime()) / 60000
        );

        const totalMinutes = attendanceDay.totalMinutes + minutesWorked;

        const status =
            totalMinutes >= 480
                ? "PRESENT"
                : totalMinutes > 0
                    ? "PARTIAL"
                    : "ABSENT";

        await repo.addEvent(
            attendanceDay.id,
            "CHECK_OUT",
            dto.source,
            now
        );

        await repo.updateAttendanceSummary(
            attendanceDay.id,
            totalMinutes,
            status
        );

        return { message: "Checked out successfully", totalMinutes, status };
    }

    async getAttendanceDay(
        employeeId: string,
        companyId: string,
        dateStr: string
    ) {
        const date = new Date(dateStr);
        date.setHours(0, 0, 0, 0);

        if (Number.isNaN(date.getTime())) {
            throw new Error("Invalid date");
        }

        return repo.getAttendanceByDay(employeeId, companyId, date);
    }

    async getAttendanceRange(
        employeeId: string,
        companyId: string,
        fromStr: string,
        toStr: string
    ) {
        const from = new Date(fromStr);
        const to = new Date(toStr);

        from.setHours(0, 0, 0, 0);
        to.setHours(0, 0, 0, 0);

        if (
            Number.isNaN(from.getTime()) ||
            Number.isNaN(to.getTime()) ||
            from > to
        ) {
            throw new Error("Invalid date range");
        }

        return repo.getAttendanceByRange(employeeId, companyId, from, to);
    }

    private async validateGeoFence(
        companyId: string,
        employeeId: string,
        latitude: number,
        longitude: number,
        source: "WEB" | "PWA"
    ) {
        const office = await repo.getActiveOfficeLocation(companyId);
        const company = await prisma.company.findUnique({
            where: { id: companyId },
            select: { logGeoFenceViolations: true },
        });

        if (!office) {
            if (company?.logGeoFenceViolations) {
                await repo.logViolation({
                    employeeId,
                    companyId,
                    latitude,
                    longitude,
                    distanceM: 0,
                    reason: "NO_OFFICE_CONFIG",
                    source,
                });
            }
            throw new Error("Office location not configured");
        }


        const distance = haversineDistanceMeters(
            latitude,
            longitude,
            office.latitude,
            office.longitude
        );

        if (distance > office.radiusM) {
            await repo.logViolation({
                employeeId,
                companyId,
                latitude,
                longitude,
                distanceM: distance,
                reason: "OUTSIDE_RADIUS",
                source,
            });

            throw new Error("Outside office premises");
        }
    }

    async getAttendanceViolations(
        companyId: string,
        employeeId?: string,
        from?: string,
        to?: string
    ) {
        const fromDate = from ? new Date(from) : undefined;
        const toDate = to ? new Date(to) : undefined;

        const params: {
            companyId: string;
            employeeId?: string;
            from?: Date;
            to?: Date;
        } = {
            companyId,
            ...(employeeId && { employeeId }),
            ...(fromDate && toDate && { from: fromDate, to: toDate }),
        };

        return repo.getViolations(params);
    }

    private async resolveAttendancePolicy(employeeId: string) {
        const today = new Date();

        const employee = await prisma.employeeProfile.findUnique({
            where: { id: employeeId },
            include: {
                designation: {
                    include: {
                        attendancePolicy: true,
                    },
                },
                employeeAttendanceOverrides: {
                    where: {
                        validFrom: { lte: today },
                        OR: [
                            { validTo: null },
                            { validTo: { gte: today } },
                        ],
                    },
                    orderBy: { validFrom: "desc" },
                    take: 1,
                },
            },
        });

        if (!employee) {
            throw new Error("Employee not found");
        }

        // 1️⃣ Employee-level override (highest priority)
        const override = employee.employeeAttendanceOverrides[0];

        if (override) {
            return {
                employee,
                isExempt: override.attendanceExempt,
                isAutoPresent: override.autoPresent,
            };
        }

        // 2️⃣ Designation-level policy
        const policy = employee.designation.attendancePolicy;

        return {
            employee,
            isExempt: policy?.attendanceExempt ?? false,
            isAutoPresent: policy?.autoPresent ?? false,
        };
    }

    async hrUpsertAttendanceDay(dto: HrUpsertAttendanceDayDTO) {
        const date = new Date(dto.date);
        date.setHours(0, 0, 0, 0);

        if (Number.isNaN(date.getTime())) {
            throw new Error("Invalid date");
        }

        return repo.upsertAttendanceDay(
            dto.employeeId,
            dto.companyId,
            date,
            dto.status,
            dto.totalMinutes ?? 0
        );
    }

    async hrAddAttendanceEvent(dto: HrAddAttendanceEventDTO) {
        const date = new Date(dto.date);
        date.setHours(0, 0, 0, 0);

        let attendanceDay = await repo.findAttendanceDay(dto.employeeId, date);

        if (!attendanceDay) {
            attendanceDay = await repo.createAttendanceDay(
                dto.employeeId,
                dto.companyId,
                date
            );
        }

        return repo.addHrEvent(
            attendanceDay.id,
            dto.type,
            dto.source,
            new Date(dto.timestamp)
        );
    }

    async hrUpdateAttendanceDay(
        attendanceDayId: string,
        status: "PRESENT" | "ABSENT" | "PARTIAL",
        totalMinutes: number
    ) {
        return prisma.attendanceDay.update({
            where: { id: attendanceDayId },
            data: {
                status,
                totalMinutes,
            },
        });
    }

}
