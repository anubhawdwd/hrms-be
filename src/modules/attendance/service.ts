// src/modules/attendance/service.ts
import { AttendanceRepository } from "./repository.js";
import type {
  CheckInDTO,
  CheckOutDTO,
  HrAddAttendanceEventDTO,
  HrUpsertAttendanceDayDTO,
  UpsertEmployeeAttendanceOverrideDTO,
} from "./types.js";
import { haversineDistanceMeters } from "../../utils/geo.js";
import { prisma } from "../../config/prisma.js";
import { todayDateUTC, parseDateUTC } from "../../utils/date.js";

const repo = new AttendanceRepository();

export class AttendanceService {
  private async resolveEmployee(userId: string, companyId: string) {
    const employee = await repo.findEmployeeByUserId(userId);
    if (!employee) throw new Error("Employee not found");
    if (employee.companyId !== companyId) {
      throw new Error("Employee does not belong to this company");
    }
    return employee;
  }

  // =================== CHECK IN ===================

  async checkIn(dto: CheckInDTO) {
    const employee = await this.resolveEmployee(dto.userId, dto.companyId);

    const { isExempt, isAutoPresent } = await this.resolveAttendancePolicy(
      employee.id
    );

    if (isExempt) return { message: "Attendance exempt employee" };

    const today = todayDateUTC();

    // ─── Only FULL_DAY leave blocks check-in ───
    const fullDayLeave = await repo.findApprovedFullDayLeaveForDate(
      employee.id,
      today
    );

    if (fullDayLeave) {
      let attendanceDay = await repo.findAttendanceDay(employee.id, today);
      if (!attendanceDay) {
        attendanceDay = await repo.createAttendanceDay(
          employee.id,
          employee.companyId,
          today
        );
      }
      await repo.updateAttendanceSummary(attendanceDay.id, 0, "LEAVE");
      return { message: "Employee is on approved full-day leave" };
    }

    // Partial-day leaves (HALF_DAY, QUARTER_DAY, HOURLY) do NOT block check-in.
    // The employee works the rest of the day normally.

    if (isAutoPresent) {
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
      employee.id,
      dto.location.latitude,
      dto.location.longitude,
      dto.source
    );

    let attendanceDay = await repo.findAttendanceDay(employee.id, today);
    if (!attendanceDay) {
      attendanceDay = await repo.createAttendanceDay(
        employee.id,
        employee.companyId,
        today
      );
    }

    const lastEvent = attendanceDay.events.at(-1);
    if (lastEvent?.type === "CHECK_IN") {
      throw new Error("Already checked in");
    }

    await repo.addEvent(attendanceDay.id, "CHECK_IN", dto.source, new Date());
    await repo.updateAttendanceSummary(
      attendanceDay.id,
      attendanceDay.totalMinutes,
      "PRESENT"
    );

    return { message: "Checked in successfully" };
  }

  // =================== CHECK OUT ===================

  async checkOut(dto: CheckOutDTO) {
    const employee = await this.resolveEmployee(dto.userId, dto.companyId);

    const { isExempt, isAutoPresent } = await this.resolveAttendancePolicy(
      employee.id
    );

    if (isExempt) return { message: "Attendance exempt employee" };
    if (isAutoPresent) return { message: "Auto-present employee" };

    const today = todayDateUTC();

    // Only FULL_DAY leave blocks check-out
    const fullDayLeave = await repo.findApprovedFullDayLeaveForDate(
      employee.id,
      today
    );
    if (fullDayLeave)
      return { message: "Employee is on approved full-day leave" };

    await this.validateGeoFence(
      dto.companyId,
      employee.id,
      dto.location.latitude,
      dto.location.longitude,
      dto.source
    );

    const attendanceDay = await repo.findAttendanceDay(employee.id, today);
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

    // Check for partial-day leaves to adjust the effective target
    const partialLeaves = await repo.findApprovedPartialLeavesForDate(
      employee.id,
      today
    );

    let partialLeaveMinutes = 0;
    for (const leave of partialLeaves) {
      switch (leave.durationType) {
        case "HALF_DAY":
          partialLeaveMinutes += 240; // 4 hours
          break;
        case "QUARTER_DAY":
          partialLeaveMinutes += 120; // 2 hours
          break;
        case "HOURLY":
          partialLeaveMinutes += leave.durationValue * 60; // durationValue is in hours
          break;
      }
    }

    // Effective target = 480 (8h) minus partial leave minutes
    const effectiveTarget = Math.max(480 - partialLeaveMinutes, 0);
    const status =
      totalMinutes >= effectiveTarget
        ? "PRESENT"
        : totalMinutes > 0
          ? "PARTIAL"
          : "ABSENT";

    await repo.addEvent(attendanceDay.id, "CHECK_OUT", dto.source, now);
    await repo.updateAttendanceSummary(attendanceDay.id, totalMinutes, status);

    return { message: "Checked out successfully", totalMinutes, status };
  }

  // =================== GET ATTENDANCE ===================

  async getAttendanceDay(
    userId: string,
    companyId: string,
    dateStr: string
  ) {
    const employee = await this.resolveEmployee(userId, companyId);
    const date = parseDateUTC(dateStr);
    if (Number.isNaN(date.getTime())) throw new Error("Invalid date");

    return repo.getAttendanceByDay(employee.id, companyId, date);
  }

  async getAttendanceRange(
    userId: string,
    companyId: string,
    fromStr: string,
    toStr: string
  ) {
    const employee = await this.resolveEmployee(userId, companyId);
    const from = parseDateUTC(fromStr);
    const to = parseDateUTC(toStr);

    if (
      Number.isNaN(from.getTime()) ||
      Number.isNaN(to.getTime()) ||
      from > to
    ) {
      throw new Error("Invalid date range");
    }

    return repo.getAttendanceByRange(employee.id, companyId, from, to);
  }

  // =================== VIOLATIONS ===================

  async getAttendanceViolations(
    companyId: string,
    employeeId?: string,
    from?: string,
    to?: string
  ) {
    return repo.getViolations({
      companyId,
      ...(employeeId && { employeeId }),
      ...(from && to && {
        from: parseDateUTC(from),
        to: parseDateUTC(to),
      }),
    });
  }

  // =================== EMPLOYEE OVERRIDE ===================

  async upsertEmployeeAttendanceOverride(
    dto: UpsertEmployeeAttendanceOverrideDTO
  ) {
    if (dto.autoPresent && dto.attendanceExempt) {
      throw new Error(
        "autoPresent and attendanceExempt cannot both be true"
      );
    }

    const validFrom = parseDateUTC(dto.validFrom);
    const existing = await repo.findEmployeeAttendanceOverride(
      dto.employeeId,
      validFrom
    );

    if (existing) {
      throw new Error(
        "Attendance override already exists for this employee and start date"
      );
    }

    return repo.createEmployeeAttendanceOverride({
      employeeId: dto.employeeId,
      autoPresent: dto.autoPresent,
      attendanceExempt: dto.attendanceExempt,
      ...(dto.reason !== undefined && { reason: dto.reason }),
      validFrom,
      ...(dto.validTo !== undefined && {
        validTo: parseDateUTC(dto.validTo),
      }),
    });
  }

  // =================== HR OPS ===================

  async hrUpsertAttendanceDay(dto: HrUpsertAttendanceDayDTO) {
    const date = parseDateUTC(dto.date);
    if (Number.isNaN(date.getTime())) throw new Error("Invalid date");

    return repo.upsertAttendanceDay(
      dto.employeeId,
      dto.companyId,
      date,
      dto.status,
      dto.totalMinutes ?? 0
    );
  }

  async hrAddAttendanceEvent(dto: HrAddAttendanceEventDTO) {
    const date = parseDateUTC(dto.date);

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
    status: "PRESENT" | "ABSENT" | "PARTIAL" | "LEAVE",
    totalMinutes: number
  ) {
    return prisma.attendanceDay.update({
      where: { id: attendanceDayId },
      data: { status, totalMinutes },
    });
  }

  // =================== PRIVATE HELPERS ===================

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

  private async resolveAttendancePolicy(employeeId: string) {
    const today = new Date();

    const employee = await prisma.employeeProfile.findUnique({
      where: { id: employeeId },
      include: {
        designation: {
          include: { attendancePolicy: true },
        },
        employeeAttendanceOverrides: {
          where: {
            validFrom: { lte: today },
            OR: [{ validTo: null }, { validTo: { gte: today } }],
          },
          orderBy: { validFrom: "desc" },
          take: 1,
        },
      },
    });

    if (!employee) throw new Error("Employee not found");

    const override = employee.employeeAttendanceOverrides[0];

    if (override) {
      return {
        isExempt: override.attendanceExempt,
        isAutoPresent: override.autoPresent,
      };
    }

    const policy = employee.designation.attendancePolicy;

    return {
      isExempt: policy?.attendanceExempt ?? false,
      isAutoPresent: policy?.autoPresent ?? false,
    };
  }
}