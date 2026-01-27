import { AttendanceRepository } from "./repository.js";
import type { CheckInDTO, CheckOutDTO } from "./types.js";
import { haversineDistanceMeters } from "../../utils/geo.js";

const repo = new AttendanceRepository();

function startOfDay(date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

export class AttendanceService {
    async checkIn(dto: CheckInDTO) {
        await this.validateGeoFence(
            dto.companyId,
            dto.location.latitude,
            dto.location.longitude
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
        await this.validateGeoFence(
            dto.companyId,
            dto.location.latitude,
            dto.location.longitude
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
        latitude: number,
        longitude: number
    ) {
        const office = await repo.getActiveOfficeLocation(companyId);

        if (!office) {
            throw new Error("Office location not configured");
        }

        const distance = haversineDistanceMeters(
            latitude,
            longitude,
            office.latitude,
            office.longitude
        );

        if (distance > office.radiusM) {
            throw new Error("Outside office premises");
        }
    }

}
