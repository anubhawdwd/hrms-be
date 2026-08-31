// src/modules/attendance/service.ts
import { AttendanceRepository } from "./repository.js";
import { computeDailyAttendanceSessions } from "./calculations.js";
import type {
  CheckInDTO,
  CheckOutDTO,
  HrAddAttendanceEventDTO,
  HrUpsertAttendanceDayDTO,
  UpsertEmployeeAttendanceOverrideDTO,
  AttendanceDashboardResponse,
  AttendanceDashboardEmployeeRow,
  AttendanceDashboardCell,
  AttendanceDashboardDailySummary,
  DashboardAttendanceStatus,
} from "./types.js";
import { haversineDistanceMeters } from "../../utils/geo.js";
import { prisma } from "../../config/prisma.js";
import {
  todayDateUTC,
  parseDateUTC,
  endOfDayUTC,
  endOfDayIST,
  getTodayDateStringIST,
} from "../../utils/date.js";

const repo = new AttendanceRepository();

export class AttendanceService {
  private resolveAttendanceDayRecord<
    T extends { id: string; status: string; events?: Array<{ type: string }> } | null
  >(day: T): T {
    if (!day) return day;
    const hasCheckIn = day.events?.some((e) => e.type === "CHECK_IN");
    if (hasCheckIn && day.status !== "LEAVE" && day.status !== "PRESENT") {
      day.status = "PRESENT" as any;
      prisma.attendanceDay
        .update({
          where: { id: day.id },
          data: { status: "PRESENT" },
        })
        .catch(() => {});
    }
    return day;
  }

  private async resolveEmployee(userId: string, companyId: string) {
    const employee = await repo.findEmployeeByUserId(userId);
    if (!employee) throw new Error("Employee not found");
    if (employee.companyId !== companyId) {
      throw new Error("Employee does not belong to this company");
    }
    return employee;
  }

  /**
   * Automatically close any previous calendar day attendance records that
   * have a CHECK_IN but no CHECK_OUT at 23:59:59 of that day.
   */
  async autoCloseUnclosedAttendanceDays(
    employeeId: string,
    companyId: string,
    beforeDate: Date
  ) {
    const unclosedDays = await repo.findUnclosedAttendanceDaysBefore(
      employeeId,
      beforeDate
    );

    if (unclosedDays.length === 0) return;

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        workingMinutes: true,
        lunchMinutes: true,
        breakMinutes: true,
        graceMinutes: true,
      },
    });
    const workingMinutes = company?.workingMinutes ?? 480;
    const lunchMinutes = company?.lunchMinutes ?? 30;
    const breakMinutes = company?.breakMinutes ?? 20;
    const graceMinutes = company?.graceMinutes ?? 10;
    const expectedPresenceMinutes =
      workingMinutes + lunchMinutes + breakMinutes;

    for (const day of unclosedDays) {
      const lastEvent = day.events.at(-1);
      if (!lastEvent || lastEvent.type !== "CHECK_IN") {
        continue;
      }

      // Automatically close at 23:59:59.999 IST of that calendar day
      const endOfDay = endOfDayIST(day.date);
      const updatedEvents = [
        ...day.events,
        { type: "CHECK_OUT" as const, timestamp: endOfDay, source: lastEvent.source },
      ];
      const calc = computeDailyAttendanceSessions(updatedEvents, endOfDay);
      const totalMinutes = calc.completedMinutes;
      // Business rule: CHECK_IN exists -> PRESENT
      const status = "PRESENT";

      await repo.addEvent(day.id, "CHECK_OUT", lastEvent.source, endOfDay);
      await repo.updateAttendanceSummary(day.id, totalMinutes, status);
    }
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
      dto.location,
      dto.source
    );

    await this.autoCloseUnclosedAttendanceDays(
      employee.id,
      dto.companyId,
      today
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

    // Automatically close any unclosed prior calendar days before processing checkout
    await this.autoCloseUnclosedAttendanceDays(
      employee.id,
      dto.companyId,
      today
    );

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
      dto.location,
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
    const updatedEvents = [
      ...attendanceDay.events,
      { type: "CHECK_OUT" as const, timestamp: now, source: dto.source },
    ];
    const calc = computeDailyAttendanceSessions(updatedEvents, now);
    const totalMinutes = calc.completedMinutes;

    // Check for partial-day leaves to adjust the effective target
    const partialLeaves = await repo.findApprovedPartialLeavesForDate(
      employee.id,
      today
    );

    // Fetch company working-hours config (workingMinutes, lunchMinutes, breakMinutes, graceMinutes)
    const company = await prisma.company.findUnique({
      where: { id: dto.companyId },
      select: {
        workingMinutes: true,
        lunchMinutes: true,
        breakMinutes: true,
        graceMinutes: true,
      },
    });
    const workingMinutes = company?.workingMinutes ?? 480;
    const lunchMinutes = company?.lunchMinutes ?? 30;
    const breakMinutes = company?.breakMinutes ?? 20;
    const graceMinutes = company?.graceMinutes ?? 10;
    const expectedPresenceMinutes =
      workingMinutes + lunchMinutes + breakMinutes;

    let partialLeaveMinutes = 0;
    for (const leave of partialLeaves) {
      switch (leave.durationType) {
        case "HALF_DAY":
          partialLeaveMinutes += Math.round(workingMinutes / 2);
          break;
        case "QUARTER_DAY":
          partialLeaveMinutes += Math.round(workingMinutes / 4);
          break;
        case "HOURLY":
          partialLeaveMinutes += leave.durationValue * 60; // durationValue is in hours
          break;
      }
    }

    // Effective presence target = (working + lunch + break) - partial leave - grace period
    // Default: 480 + 30 + 20 - 10 = 520 minutes (8h 40m)
    const effectiveTarget = Math.max(
      expectedPresenceMinutes - partialLeaveMinutes - graceMinutes,
      0
    );
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
    await this.autoCloseUnclosedAttendanceDays(
      employee.id,
      companyId,
      todayDateUTC()
    );
    const date = parseDateUTC(dateStr);
    if (Number.isNaN(date.getTime())) throw new Error("Invalid date");

    const day = await repo.getAttendanceByDay(employee.id, companyId, date);
    return this.resolveAttendanceDayRecord(day);
  }

  async getAttendanceDayByEmployeeId(
    employeeId: string,
    companyId: string,
    dateStr: string
  ) {
    await this.autoCloseUnclosedAttendanceDays(
      employeeId,
      companyId,
      todayDateUTC()
    );
    const date = parseDateUTC(dateStr);
    if (Number.isNaN(date.getTime())) throw new Error("Invalid date");

    const day = await repo.getAttendanceByDay(employeeId, companyId, date);
    return this.resolveAttendanceDayRecord(day);
  }

  async getAttendanceRange(
    userId: string,
    companyId: string,
    fromStr: string,
    toStr: string
  ) {
    const employee = await this.resolveEmployee(userId, companyId);
    await this.autoCloseUnclosedAttendanceDays(
      employee.id,
      companyId,
      todayDateUTC()
    );
    const from = parseDateUTC(fromStr);
    const to = parseDateUTC(toStr);

    if (
      Number.isNaN(from.getTime()) ||
      Number.isNaN(to.getTime()) ||
      from > to
    ) {
      throw new Error("Invalid date range");
    }

    const days = await repo.getAttendanceByRange(employee.id, companyId, from, to);
    return days.map((d) => this.resolveAttendanceDayRecord(d));
  }

  // =================== MONTHLY ATTENDANCE DASHBOARD ===================

  async getAttendanceDashboard(
    companyId: string,
    monthStr: string
  ): Promise<AttendanceDashboardResponse> {
    if (!monthStr || !/^\d{4}-(0[1-9]|1[0-2])$/.test(monthStr)) {
      throw new Error("Invalid month format. Expected YYYY-MM");
    }

    const parts = monthStr.split("-");
    const year = parseInt(parts[0] ?? "2000", 10);
    const monthIndex = parseInt(parts[1] ?? "1", 10) - 1; // 0-indexed month

    // Calculate month boundary in UTC
    const totalDaysInMonth = new Date(
      Date.UTC(year, monthIndex + 1, 0)
    ).getUTCDate();
    const startOfMonth = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
    const endOfMonth = new Date(
      Date.UTC(year, monthIndex, totalDaysInMonth, 23, 59, 59, 999)
    );
    const today = todayDateUTC();
    const todayStr = today.toISOString().slice(0, 10);

    // 1. Fetch batched monthly data in a single round-trip
    const {
      employees,
      attendanceDays,
      leaveRequests,
      holidays,
      overrides,
      companyConfig,
    } = await repo.getMonthlyDashboardData(
      companyId,
      startOfMonth,
      endOfMonth
    );

    const workingMinutes = companyConfig?.workingMinutes ?? 480;
    const lunchMinutes = companyConfig?.lunchMinutes ?? 30;
    const breakMinutes = companyConfig?.breakMinutes ?? 20;
    const graceMinutes = companyConfig?.graceMinutes ?? 10;
    const expectedPresenceMinutes =
      workingMinutes + lunchMinutes + breakMinutes;

    // 2. Build in-memory indexes
    const holidaysMap = new Map<string, string>();
    for (const h of holidays) {
      const dStr = h.date.toISOString().slice(0, 10);
      holidaysMap.set(dStr, h.name);
    }

    const attendanceMap = new Map<string, (typeof attendanceDays)[0]>();
    for (const a of attendanceDays) {
      const dStr = a.date.toISOString().slice(0, 10);
      attendanceMap.set(`${a.employeeId}:${dStr}`, a);
    }

    const leavesMap = new Map<string, typeof leaveRequests>();
    for (const l of leaveRequests) {
      if (!leavesMap.has(l.employeeId)) {
        leavesMap.set(l.employeeId, []);
      }
      leavesMap.get(l.employeeId)!.push(l);
    }

    const overridesMap = new Map<string, typeof overrides>();
    for (const o of overrides) {
      if (!overridesMap.has(o.employeeId)) {
        overridesMap.set(o.employeeId, []);
      }
      overridesMap.get(o.employeeId)!.push(o);
    }

    // 3. Build days metadata array
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const daysMeta: AttendanceDashboardResponse["days"] = [];
    let totalWorkingDays = 0;

    for (let d = 1; d <= totalDaysInMonth; d++) {
      const curDate = new Date(Date.UTC(year, monthIndex, d));
      const dateStr = curDate.toISOString().slice(0, 10);
      const dayOfWeekNum = curDate.getUTCDay();
      const isWeekend = dayOfWeekNum === 0 || dayOfWeekNum === 6;
      const holidayName = holidaysMap.get(dateStr) ?? null;

      if (!isWeekend && !holidayName) {
        totalWorkingDays++;
      }

      daysMeta.push({
        date: dateStr,
        dayOfWeek: dayNames[dayOfWeekNum] ?? "Day",
        dayNumber: d,
        isWeekend,
        holidayName,
      });
    }

    // 4. Initialize daily summary counters
    const dailySummary: Record<string, AttendanceDashboardDailySummary> = {};
    for (const d of daysMeta) {
      dailySummary[d.date] = {
        present: 0,
        absent: 0,
        partial: 0,
        onLeave: 0,
        pendingLeave: 0,
        holiday: 0,
        weekend: 0,
        unrecorded: 0,
      };
    }

    // 5. Aggregate employee rows
    const employeeRows: AttendanceDashboardEmployeeRow[] = [];

    for (const emp of employees) {
      const desigPolicy = emp.designation?.attendancePolicy;
      const empOverrides = overridesMap.get(emp.id) ?? [];
      const empLeaves = leavesMap.get(emp.id) ?? [];

      const employeeDays: Record<string, AttendanceDashboardCell> = {};
      const empSummary = {
        present: 0,
        absent: 0,
        partial: 0,
        onLeave: 0,
        pendingLeave: 0,
        holiday: 0,
        weekend: 0,
        unrecorded: 0,
      };

      for (const day of daysMeta) {
        const cellDate = new Date(Date.UTC(year, monthIndex, day.dayNumber));
        const isFuture = cellDate.getTime() > today.getTime();

        // Check override on this specific date
        const activeOverride = empOverrides.find(
          (o) =>
            o.validFrom <= cellDate &&
            (!o.validTo || o.validTo >= cellDate)
        );
        const isExempt =
          activeOverride?.attendanceExempt ??
          desigPolicy?.attendanceExempt ??
          false;
        const isAutoPresent =
          activeOverride?.autoPresent ??
          desigPolicy?.autoPresent ??
          false;

        // Lookup attendance
        const attDay = attendanceMap.get(`${emp.id}:${day.date}`);

        // Lookup leaves covering this day
        const activeLeaves = empLeaves.filter(
          (l) => l.fromDate <= cellDate && l.toDate >= cellDate
        );
        const approvedFullDay = activeLeaves.find(
          (l) => l.status === "APPROVED" && l.durationType === "FULL_DAY"
        );
        const approvedPartial = activeLeaves.find(
          (l) => l.status === "APPROVED" && l.durationType !== "FULL_DAY"
        );
        const pendingLeave = activeLeaves.find((l) => l.status === "PENDING");

        // Timestamps & worked minutes via canonical multi-session calculation
        let checkIn: string | null = null;
        let checkOut: string | null = null;
        let totalMinutes = attDay?.totalMinutes ?? 0;

        if (attDay?.events && attDay.events.length > 0) {
          const isPastDate = day.date < todayStr;
          const isToday = day.date === todayStr;
          const eventsForCalc = [...attDay.events];

          // If past unclosed day, synthesize end of day closing event for calculation
          const lastEvt = eventsForCalc.at(-1);
          if (isPastDate && lastEvt?.type === "CHECK_IN") {
            eventsForCalc.push({
              type: "CHECK_OUT" as const,
              timestamp: endOfDayUTC(attDay.date),
            } as any);
          }

          const calc = computeDailyAttendanceSessions(
            eventsForCalc,
            isPastDate ? endOfDayUTC(attDay.date) : new Date()
          );

          checkIn = calc.firstCheckIn ? calc.firstCheckIn.toISOString() : null;
          checkOut = calc.lastCheckOut ? calc.lastCheckOut.toISOString() : null;

          if (isToday && calc.isCheckedIn) {
            // Active shift today: totalMinutes represents cumulative completed + current live session
            totalMinutes = calc.totalLiveMinutes;
          } else {
            totalMinutes = calc.completedMinutes;
          }
        }

        const relevantLeave =
          approvedFullDay || approvedPartial || pendingLeave;
        const leaveType = relevantLeave?.leaveType?.name ?? null;
        const leaveDuration = relevantLeave?.durationType ?? null;
        const holidayName = day.holidayName;

        // Deterministic status resolution
        let status: DashboardAttendanceStatus = "UNRECORDED";

        const hasPunches = (attDay?.events?.length ?? 0) > 0;
        const hasRecordedMinutes = totalMinutes > 0;
        const isDbPresent = attDay?.status === "PRESENT";
        const isDbPartial = attDay?.status === "PARTIAL";

        if (hasPunches || hasRecordedMinutes || isDbPresent || isDbPartial) {
          // Physical punches, manual HR adjustments, or worked time exist
          let partialLeaveMinutes = 0;
          if (approvedPartial) {
            switch (approvedPartial.durationType) {
              case "HALF_DAY":
                partialLeaveMinutes = Math.round(workingMinutes / 2);
                break;
              case "QUARTER_DAY":
                partialLeaveMinutes = Math.round(workingMinutes / 4);
                break;
              case "HOURLY":
                partialLeaveMinutes =
                  (approvedPartial.durationValue || 0) * 60;
                break;
            }
          }
          const effectiveTarget = Math.max(
            expectedPresenceMinutes - partialLeaveMinutes - graceMinutes,
            0
          );

          if (totalMinutes >= effectiveTarget) {
            status = "PRESENT";
          } else if (isDbPresent && day.date === todayStr) {
            // In-progress shift for today
            status = "PRESENT";
          } else if (isDbPartial || totalMinutes > 0) {
            status = "PARTIAL";
          } else if (attDay?.status === "LEAVE") {
            status = approvedPartial ? "HALF_DAY_LEAVE" : "ON_LEAVE";
          } else {
            status = "ABSENT";
          }
        } else if (approvedFullDay) {
          status = "ON_LEAVE";
        } else if (approvedPartial) {
          status = "HALF_DAY_LEAVE";
        } else if (isExempt || isAutoPresent) {
          if (holidayName) {
            status = "HOLIDAY";
          } else if (day.isWeekend) {
            status = "WEEKEND";
          } else if (isFuture) {
            status = "UNRECORDED";
          } else {
            status = "PRESENT";
            if (isAutoPresent && totalMinutes === 0) {
              totalMinutes = workingMinutes;
            }
          }
        } else if (pendingLeave) {
          status = "PENDING_LEAVE";
        } else if (holidayName) {
          status = "HOLIDAY";
        } else if (day.isWeekend) {
          status = "WEEKEND";
        } else if (isFuture) {
          status = "UNRECORDED";
        } else {
          status = "ABSENT";
        }

        const cell: AttendanceDashboardCell = {
          date: day.date,
          status,
          checkIn,
          checkOut,
          totalMinutes,
          leaveType,
          leaveDuration,
          holidayName,
          isAutoPresent,
          isExempt,
        };
        employeeDays[day.date] = cell;

        // Tally summaries
        const currentDaily = dailySummary[day.date];
        switch (status) {
          case "PRESENT":
            empSummary.present++;
            if (currentDaily) currentDaily.present++;
            break;
          case "ABSENT":
            empSummary.absent++;
            if (currentDaily) currentDaily.absent++;
            break;
          case "PARTIAL":
            empSummary.partial++;
            if (currentDaily) currentDaily.partial++;
            break;
          case "ON_LEAVE":
            empSummary.onLeave++;
            if (currentDaily) currentDaily.onLeave++;
            break;
          case "HALF_DAY_LEAVE":
            empSummary.onLeave++;
            if (currentDaily) currentDaily.onLeave++;
            break;
          case "PENDING_LEAVE":
            empSummary.pendingLeave++;
            if (currentDaily) currentDaily.pendingLeave++;
            break;
          case "HOLIDAY":
            empSummary.holiday++;
            if (currentDaily) currentDaily.holiday++;
            break;
          case "WEEKEND":
            empSummary.weekend++;
            if (currentDaily) currentDaily.weekend++;
            break;
          case "UNRECORDED":
            empSummary.unrecorded++;
            if (currentDaily) currentDaily.unrecorded++;
            break;
        }
      }

      employeeRows.push({
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        displayName: emp.displayName,
        firstName: emp.firstName,
        lastName: emp.lastName,
        departmentName: emp.department?.name ?? emp.team?.department?.name ?? null,
        designationName: emp.designation?.name ?? null,
        days: employeeDays,
        summary: empSummary,
      });
    }

    return {
      month: monthStr,
      startDate: daysMeta[0]?.date ?? `${monthStr}-01`,
      endDate:
        daysMeta[daysMeta.length - 1]?.date ??
        `${monthStr}-${totalDaysInMonth}`,
      totalDays: totalDaysInMonth,
      days: daysMeta,
      employees: employeeRows,
      dailySummary,
      companySummary: {
        totalEmployees: employees.length,
        totalWorkingDays,
      },
    };
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

  async listEmployeeAttendanceOverrides(companyId: string) {
    return repo.listEmployeeAttendanceOverrides(companyId);
  }

  async deleteEmployeeAttendanceOverride(employeeId: string, companyId: string) {
    return repo.deleteEmployeeAttendanceOverride(employeeId, companyId);
  }

  async upsertEmployeeAttendanceOverride(
    dto: UpsertEmployeeAttendanceOverrideDTO & { companyId: string }
  ) {
    if (dto.autoPresent && dto.attendanceExempt) {
      throw new Error(
        "autoPresent and attendanceExempt cannot both be true"
      );
    }

    const employee = await prisma.employeeProfile.findFirst({
      where: { id: dto.employeeId, companyId: dto.companyId },
    });
    if (!employee) throw new Error("Employee not found in this company");

    const validFrom = dto.validFrom
      ? parseDateUTC(dto.validFrom)
      : new Date("2026-01-01T00:00:00.000Z");
    const validTo = dto.validTo ? parseDateUTC(dto.validTo) : undefined;

    return repo.upsertEmployeeAttendanceOverride({
      employeeId: dto.employeeId,
      autoPresent: dto.autoPresent,
      attendanceExempt: dto.attendanceExempt,
      ...(dto.reason !== undefined && { reason: dto.reason }),
      validFrom,
      ...(validTo !== undefined && { validTo }),
    });
  }

  // =================== HR OPS ===================

  private calculateAttendanceTimes(
    checkInStr?: string,
    checkOutStr?: string
  ): {
    checkInDate: Date | undefined;
    checkOutDate: Date | undefined;
    calculatedMinutes: number;
  } {
    let checkInDate: Date | undefined;
    let checkOutDate: Date | undefined;
    let calculatedMinutes = 0;
    const now = new Date();

    if (checkInStr) {
      checkInDate = new Date(checkInStr);
      if (Number.isNaN(checkInDate.getTime())) {
        throw new Error("Invalid check-in time format");
      }
      if (checkInDate.getTime() > now.getTime()) {
        throw new Error("Check-in time cannot be in the future");
      }
    }

    if (checkOutStr) {
      checkOutDate = new Date(checkOutStr);
      if (Number.isNaN(checkOutDate.getTime())) {
        throw new Error("Invalid check-out time format");
      }
      if (checkOutDate.getTime() > now.getTime()) {
        throw new Error("Check-out time cannot be in the future");
      }
    }

    if (checkInDate && checkOutDate) {
      if (checkOutDate < checkInDate) {
        throw new Error("Check-out time cannot be earlier than check-in time");
      }
      calculatedMinutes = Math.max(
        Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / 60000),
        0
      );
    }

    return { checkInDate, checkOutDate, calculatedMinutes };
  }

  async hrUpsertAttendanceDay(dto: HrUpsertAttendanceDayDTO) {
    const todayStr = getTodayDateStringIST();
    if (dto.date > todayStr) {
      throw new Error("Cannot create or modify attendance for a future date");
    }

    const date = parseDateUTC(dto.date);
    if (Number.isNaN(date.getTime())) throw new Error("Invalid date");

    const { checkInDate, checkOutDate, calculatedMinutes } =
      this.calculateAttendanceTimes(dto.checkIn, dto.checkOut);

    let totalMinutes = dto.totalMinutes ?? 0;
    if (checkInDate && checkOutDate) {
      totalMinutes = calculatedMinutes;
    }

    // Business rule: Having a valid check-in establishes PRESENT immediately
    let status = dto.status;
    if (!status) {
      status = "PRESENT";
    }

    const attendanceDay = await prisma.attendanceDay.upsert({
      where: { employeeId_date: { employeeId: dto.employeeId, date } },
      update: { status, totalMinutes },
      create: {
        employeeId: dto.employeeId,
        companyId: dto.companyId,
        date,
        status,
        totalMinutes,
      },
      include: { events: { orderBy: { timestamp: "asc" } } },
    });

    // Synchronize events without creating duplicates
    if (checkInDate) {
      const existingIn = attendanceDay.events.find((e) => e.type === "CHECK_IN");
      if (existingIn) {
        await prisma.attendanceEvent.update({
          where: { id: existingIn.id },
          data: { timestamp: checkInDate },
        });
      } else {
        await prisma.attendanceEvent.create({
          data: {
            attendanceDayId: attendanceDay.id,
            type: "CHECK_IN",
            source: "WEB",
            timestamp: checkInDate,
          },
        });
      }
    }

    if (checkOutDate) {
      const existingOut = attendanceDay.events
        .filter((e) => e.type === "CHECK_OUT")
        .at(-1);
      if (existingOut) {
        await prisma.attendanceEvent.update({
          where: { id: existingOut.id },
          data: { timestamp: checkOutDate },
        });
      } else {
        await prisma.attendanceEvent.create({
          data: {
            attendanceDayId: attendanceDay.id,
            type: "CHECK_OUT",
            source: "WEB",
            timestamp: checkOutDate,
          },
        });
      }
    }

    return prisma.attendanceDay.findUnique({
      where: { id: attendanceDay.id },
      include: { events: { orderBy: { timestamp: "asc" } } },
    });
  }

  async hrAddAttendanceEvent(dto: HrAddAttendanceEventDTO) {
    const todayStr = getTodayDateStringIST();
    if (dto.date > todayStr) {
      throw new Error("Cannot create or modify attendance for a future date");
    }

    const evtTime = new Date(dto.timestamp);
    if (Number.isNaN(evtTime.getTime())) {
      throw new Error("Invalid event timestamp format");
    }
    if (evtTime.getTime() > Date.now()) {
      throw new Error("Event timestamp cannot be in the future");
    }

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
      evtTime
    );
  }

  async hrUpdateAttendanceDay(
    attendanceDayId: string,
    payload: {
      status?: "PRESENT" | "ABSENT" | "PARTIAL" | "LEAVE";
      totalMinutes?: number;
      checkIn?: string;
      checkOut?: string;
    }
  ) {
    const attendanceDay = await prisma.attendanceDay.findUnique({
      where: { id: attendanceDayId },
      include: { events: { orderBy: { timestamp: "asc" } } },
    });

    if (!attendanceDay) {
      throw new Error("Attendance day record not found");
    }

    const { checkInDate, checkOutDate, calculatedMinutes } =
      this.calculateAttendanceTimes(payload.checkIn, payload.checkOut);

    let totalMinutes = payload.totalMinutes ?? attendanceDay.totalMinutes;
    if (checkInDate && checkOutDate) {
      totalMinutes = calculatedMinutes;
    }

    let status = payload.status ?? attendanceDay.status;
    if (!payload.status && checkInDate) {
      status = "PRESENT";
    }

    // Synchronize events without creating duplicates
    if (checkInDate) {
      const existingIn = attendanceDay.events.find((e) => e.type === "CHECK_IN");
      if (existingIn) {
        await prisma.attendanceEvent.update({
          where: { id: existingIn.id },
          data: { timestamp: checkInDate },
        });
      } else {
        await prisma.attendanceEvent.create({
          data: {
            attendanceDayId: attendanceDay.id,
            type: "CHECK_IN",
            source: "WEB",
            timestamp: checkInDate,
          },
        });
      }
    }

    if (checkOutDate) {
      const existingOut = attendanceDay.events
        .filter((e) => e.type === "CHECK_OUT")
        .at(-1);
      if (existingOut) {
        await prisma.attendanceEvent.update({
          where: { id: existingOut.id },
          data: { timestamp: checkOutDate },
        });
      } else {
        await prisma.attendanceEvent.create({
          data: {
            attendanceDayId: attendanceDay.id,
            type: "CHECK_OUT",
            source: "WEB",
            timestamp: checkOutDate,
          },
        });
      }
    }

    return prisma.attendanceDay.update({
      where: { id: attendanceDayId },
      data: { status, totalMinutes },
      include: { events: { orderBy: { timestamp: "asc" } } },
    });
  }

  // =================== PRIVATE HELPERS ===================

  private async validateGeoFence(
    companyId: string,
    employeeId: string,
    location: { latitude: number; longitude: number } | undefined,
    source: "WEB" | "PWA"
  ) {
    const office = await repo.getActiveOfficeLocation(companyId);
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { logGeoFenceViolations: true },
    });

    if (!office) {
      if (company?.logGeoFenceViolations && location) {
        await repo.logViolation({
          employeeId,
          companyId,
          latitude: location.latitude,
          longitude: location.longitude,
          distanceM: 0,
          reason: "NO_OFFICE_CONFIG",
          source,
        });
      }
      throw new Error("Office location not configured");
    }

    // Skip radius validation if geo-fencing is disabled company-wide
    if (!office.geoFencingEnabled) {
      return;
    }

    // When geo-fencing is enabled, location must be provided
    if (
      !location ||
      typeof location.latitude !== "number" ||
      typeof location.longitude !== "number"
    ) {
      throw new Error("Location coordinates required for geo-fenced attendance");
    }

    const distance = haversineDistanceMeters(
      location.latitude,
      location.longitude,
      office.latitude,
      office.longitude
    );

    if (distance > office.radiusM) {
      await repo.logViolation({
        employeeId,
        companyId,
        latitude: location.latitude,
        longitude: location.longitude,
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