// src/modules/attendance/repository.ts
import { prisma } from "../../config/prisma.js";
import { LeaveRequestStatus } from "../../generated/prisma/enums.js";

export class AttendanceRepository {
  // =================== EMPLOYEE LOOKUP ===================

  findEmployeeByUserId(userId: string) {
    return prisma.employeeProfile.findFirst({
      where: { userId },
    });
  }

  // =================== ATTENDANCE DAY ===================

  findAttendanceDay(employeeId: string, date: Date) {
    return prisma.attendanceDay.findFirst({
      where: { employeeId, date },
      include: {
        events: { orderBy: { timestamp: "asc" } },
      },
    });
  }

  createAttendanceDay(employeeId: string, companyId: string, date: Date) {
    return prisma.attendanceDay.create({
      data: {
        employee: { connect: { id: employeeId } },
        company: { connect: { id: companyId } },
        date,
      },
      include: { events: true },
    });
  }

  addEvent(
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

  updateAttendanceSummary(
    attendanceDayId: string,
    totalMinutes: number,
    status: "PRESENT" | "ABSENT" | "PARTIAL" | "LEAVE"
  ) {
    return prisma.attendanceDay.update({
      where: { id: attendanceDayId },
      data: { totalMinutes, status },
    });
  }

  findUnclosedAttendanceDaysBefore(employeeId: string, beforeDate: Date) {
    return prisma.attendanceDay.findMany({
      where: {
        employeeId,
        date: { lt: beforeDate },
      },
      include: {
        events: { orderBy: { timestamp: "asc" } },
      },
      orderBy: { date: "asc" },
    });
  }

  getAttendanceByDay(employeeId: string, companyId: string, date: Date) {
    return prisma.attendanceDay.findFirst({
      where: { employeeId, companyId, date },
      include: {
        events: { orderBy: { timestamp: "asc" } },
      },
    });
  }

  getAttendanceByRange(
    employeeId: string,
    companyId: string,
    from: Date,
    to: Date
  ) {
    return prisma.attendanceDay.findMany({
      where: {
        employeeId,
        companyId,
        date: { gte: from, lte: to },
      },
      orderBy: { date: "asc" },
      include: {
        events: { orderBy: { timestamp: "asc" } },
      },
    });
  }

  // =================== GEO ===================

  getActiveOfficeLocation(companyId: string) {
    return prisma.officeLocation.findFirst({
      where: { companyId, isActive: true },
    });
  }

  logViolation(params: {
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

  getViolations(params: {
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
            createdAt: { gte: params.from, lte: params.to },
          }),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // =================== EMPLOYEE OVERRIDE ===================

  listEmployeeAttendanceOverrides(companyId: string) {
    return prisma.employeeAttendanceOverride.findMany({
      where: {
        employee: { companyId },
      },
      include: {
        employee: {
          select: {
            id: true,
            displayName: true,
            employeeCode: true,
            designation: {
              select: {
                id: true,
                name: true,
                attendancePolicy: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  findEmployeeAttendanceOverride(employeeId: string, validFrom: Date) {
    return prisma.employeeAttendanceOverride.findFirst({
      where: { employeeId, validFrom },
    });
  }

  async upsertEmployeeAttendanceOverride(data: {
    employeeId: string;
    autoPresent: boolean;
    attendanceExempt: boolean;
    reason?: string;
    validFrom: Date;
    validTo?: Date;
  }) {
    const existing = await prisma.employeeAttendanceOverride.findFirst({
      where: { employeeId: data.employeeId },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      return prisma.employeeAttendanceOverride.update({
        where: { id: existing.id },
        data: {
          autoPresent: data.autoPresent,
          attendanceExempt: data.attendanceExempt,
          ...(data.reason !== undefined && { reason: data.reason }),
          validFrom: data.validFrom,
          ...(data.validTo !== undefined && { validTo: data.validTo }),
        },
      });
    }

    return prisma.employeeAttendanceOverride.create({ data });
  }

  createEmployeeAttendanceOverride(data: {
    employeeId: string;
    autoPresent: boolean;
    attendanceExempt: boolean;
    reason?: string;
    validFrom: Date;
    validTo?: Date;
  }) {
    return prisma.employeeAttendanceOverride.create({ data });
  }

  async deleteEmployeeAttendanceOverride(employeeId: string, companyId: string) {
    const employee = await prisma.employeeProfile.findFirst({
      where: { id: employeeId, companyId },
    });
    if (!employee) throw new Error("Employee not found in this company");

    return prisma.employeeAttendanceOverride.deleteMany({
      where: { employeeId },
    });
  }

  // =================== HR OPS ===================

  upsertAttendanceDay(
    employeeId: string,
    companyId: string,
    date: Date,
    status: "PRESENT" | "ABSENT" | "PARTIAL" | "LEAVE",
    totalMinutes: number
  ) {
    return prisma.attendanceDay.upsert({
      where: { employeeId_date: { employeeId, date } },
      update: { status, totalMinutes },
      create: { employeeId, companyId, date, status, totalMinutes },
    });
  }

  addHrEvent(
    attendanceDayId: string,
    type: "CHECK_IN" | "CHECK_OUT",
    source: "WEB" | "PWA",
    timestamp: Date
  ) {
    return prisma.attendanceEvent.create({
      data: { attendanceDayId, type, source, timestamp },
    });
  }

  // =================== LEAVE CHECK ===================

  /**
   * Find approved FULL_DAY leave for a date (blocks entire day attendance)
   */
  findApprovedFullDayLeaveForDate(employeeId: string, date: Date) {
    return prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        status: "APPROVED",
        durationType: "FULL_DAY",
        fromDate: { lte: date },
        toDate: { gte: date },
      },
    });
  }

  /**
   * Find approved partial-day leaves (HALF_DAY, QUARTER_DAY, HOURLY) for a date.
   * These do NOT block check-in — employee works the rest of the day.
   */
  findApprovedPartialLeavesForDate(employeeId: string, date: Date) {
    return prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: "APPROVED",
        durationType: { in: ["HALF_DAY", "QUARTER_DAY", "HOURLY"] },
        fromDate: { lte: date },
        toDate: { gte: date },
      },
      select: {
        id: true,
        durationType: true,
        startTime: true,
        endTime: true,
        durationValue: true,
      },
    });
  }

  // =================== MONTHLY DASHBOARD DATA ===================

  async getMonthlyDashboardData(
    companyId: string,
    startOfMonth: Date,
    endOfMonth: Date,
    targetEmployeeId?: string
  ) {
    const employeeWhere: any = { companyId, isActive: true };
    if (targetEmployeeId) {
      employeeWhere.id = targetEmployeeId;
    }

    const attendanceWhere: any = {
      companyId,
      date: { gte: startOfMonth, lte: endOfMonth },
    };
    if (targetEmployeeId) {
      attendanceWhere.employeeId = targetEmployeeId;
    }

    const leaveWhere: any = {
      companyId,
      status: { in: [LeaveRequestStatus.APPROVED, LeaveRequestStatus.PENDING] },
      OR: [
        { fromDate: { lte: endOfMonth }, toDate: { gte: startOfMonth } },
      ],
    };
    if (targetEmployeeId) {
      leaveWhere.employeeId = targetEmployeeId;
    }

    const overrideWhere: any = {
      employee: { companyId },
    };
    if (targetEmployeeId) {
      overrideWhere.employeeId = targetEmployeeId;
    }

    const [
      employees,
      attendanceDays,
      leaveRequests,
      holidays,
      overrides,
      company,
    ] = await Promise.all([
      prisma.employeeProfile.findMany({
        where: employeeWhere,
        select: {
          id: true,
          employeeCode: true,
          displayName: true,
          firstName: true,
          lastName: true,
          joiningDate: true,
          department: {
            select: {
              name: true,
            },
          },
          designation: {
            select: {
              name: true,
              attendancePolicy: true,
            },
          },
          team: {
            select: {
              name: true,
              department: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { employeeCode: "asc" },
      }),

      prisma.attendanceDay.findMany({
        where: attendanceWhere,
        include: {
          events: { orderBy: { timestamp: "asc" } },
        },
      }),

      prisma.leaveRequest.findMany({
        where: {
          employee: { companyId },
          status: { in: ["APPROVED", "PENDING"] },
          fromDate: { lte: endOfMonth },
          toDate: { gte: startOfMonth },
        },
        select: {
          id: true,
          employeeId: true,
          status: true,
          durationType: true,
          durationValue: true,
          startTime: true,
          endTime: true,
          fromDate: true,
          toDate: true,
          leaveType: {
            select: {
              name: true,
              code: true,
            },
          },
        },
      }),

      prisma.holiday.findMany({
        where: {
          companyId,
          date: { gte: startOfMonth, lte: endOfMonth },
        },
      }),

      prisma.employeeAttendanceOverride.findMany({
        where: {
          employee: { companyId },
          validFrom: { lte: endOfMonth },
          OR: [{ validTo: null }, { validTo: { gte: startOfMonth } }],
        },
      }),

      prisma.company.findUnique({
        where: { id: companyId },
        select: {
          workingMinutes: true,
          lunchMinutes: true,
          breakMinutes: true,
          graceMinutes: true,
          workWeekDays: true,
        },
      }),
    ]);

    return {
      employees,
      attendanceDays,
      leaveRequests,
      holidays,
      overrides,
      companyConfig: company ?? {
        workingMinutes: 480,
        lunchMinutes: 30,
        breakMinutes: 20,
        graceMinutes: 10,
        workWeekDays: 5,
      },
    };
  }
}