// src/modules/manager/service.ts
import { prisma } from "../../config/prisma.js";
import { AttendanceService } from "../attendance/service.js";
import { parseDateToUTC } from "../leave/service.js";
import type {
  ReporteeSummary,
  ReporteeLeaveFilter,
  ReporteeLeaveItem,
  ReporteeAttendanceFilter,
} from "./types.js";
import type { AttendanceDashboardResponse } from "../attendance/types.js";

const attendanceService = new AttendanceService();

export class ManagerService {
  /**
   * Resolve the EmployeeProfile ID corresponding to the authenticated user.
   */
  async resolveManagerProfile(userId: string, companyId: string) {
    return prisma.employeeProfile.findFirst({
      where: {
        userId,
        companyId,
      },
      select: {
        id: true,
        displayName: true,
        companyId: true,
      },
    });
  }

  /**
   * Get all reportees (where acting user is primary or secondary manager).
   */
  async getReportees(userId: string, companyId: string): Promise<ReporteeSummary[]> {
    const manager = await this.resolveManagerProfile(userId, companyId);
    if (!manager) {
      return [];
    }

    const reportees = await prisma.employeeProfile.findMany({
      where: {
        companyId,
        OR: [
          { managerId: manager.id },
          { secondaryManagerId: manager.id },
        ],
      },
      include: {
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
        user: { select: { email: true, personalEmail: true } },
      },
      orderBy: [
        { displayName: "asc" },
      ],
    });

    return reportees.map((rep) => ({
      id: rep.id,
      employeeCode: rep.employeeCode,
      displayName: rep.displayName,
      firstName: rep.firstName,
      lastName: rep.lastName,
      personalEmail: rep.user?.personalEmail || null,
      workEmail: rep.user?.email || null,
      department: rep.department,
      designation: rep.designation,
      team: rep.team,
      isPrimaryManager: rep.managerId === manager.id,
      isSecondaryManager: rep.secondaryManagerId === manager.id,
      joiningDate: rep.joiningDate,
    }));
  }

  /**
   * Get leave requests for reportees of the acting manager.
   */
  async getReporteeLeaves(
    userId: string,
    companyId: string,
    filter: ReporteeLeaveFilter = {}
  ): Promise<ReporteeLeaveItem[]> {
    const manager = await this.resolveManagerProfile(userId, companyId);
    if (!manager) {
      return [];
    }

    // Get reportee IDs
    const reportees = await prisma.employeeProfile.findMany({
      where: {
        companyId,
        OR: [
          { managerId: manager.id },
          { secondaryManagerId: manager.id },
        ],
      },
      select: { id: true },
    });

    const reporteeIds = reportees.map((r) => r.id);
    if (reporteeIds.length === 0) {
      return [];
    }

    if (filter.employeeId) {
      if (!reporteeIds.includes(filter.employeeId)) {
        const error: any = new Error(
          "Forbidden: Target employee is not in your direct or indirect reportees"
        );
        error.statusCode = 403;
        throw error;
      }
    }

    const whereClause: any = {
      employeeId: filter.employeeId ? filter.employeeId : { in: reporteeIds },
    };

    if (filter.status) {
      whereClause.status = filter.status;
    }

    if (filter.fromDate || filter.toDate) {
      if (filter.fromDate && filter.toDate) {
        whereClause.fromDate = { gte: parseDateToUTC(filter.fromDate) };
        whereClause.toDate = { lte: parseDateToUTC(filter.toDate) };
      } else if (filter.fromDate) {
        whereClause.fromDate = { gte: parseDateToUTC(filter.fromDate) };
      } else if (filter.toDate) {
        whereClause.toDate = { lte: parseDateToUTC(filter.toDate) };
      }
    }

    const leaveRequests = await prisma.leaveRequest.findMany({
      where: whereClause,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            displayName: true,
            department: { select: { name: true } },
            designation: { select: { name: true } },
            team: { select: { name: true } },
          },
        },
        leaveType: {
          select: {
            id: true,
            name: true,
            code: true,
            isPaid: true,
          },
        },
        days: {
          select: {
            id: true,
            date: true,
            status: true,
            isSandwichDay: true,
            deductDays: true,
          },
          orderBy: { date: "asc" },
        },
      },
      orderBy: [
        { createdAt: "desc" },
      ],
    });

    return leaveRequests as unknown as ReporteeLeaveItem[];
  }

  /**
   * Get attendance dashboard for reportees of the acting manager.
   */
  async getReporteeAttendance(
    userId: string,
    companyId: string,
    filter: ReporteeAttendanceFilter
  ): Promise<AttendanceDashboardResponse> {
    const manager = await this.resolveManagerProfile(userId, companyId);
    if (!manager) {
      return {
        month: filter.month,
        startDate: `${filter.month}-01`,
        endDate: `${filter.month}-28`,
        totalDays: 28,
        days: [],
        employees: [],
        dailySummary: {},
        companySummary: {
          totalEmployees: 0,
          totalWorkingDays: 0,
        },
      };
    }

    const reportees = await prisma.employeeProfile.findMany({
      where: {
        companyId,
        OR: [
          { managerId: manager.id },
          { secondaryManagerId: manager.id },
        ],
      },
      select: { id: true },
    });

    const reporteeIds = reportees.map((r) => r.id);

    if (filter.employeeId) {
      if (!reporteeIds.includes(filter.employeeId)) {
        const error: any = new Error(
          "Forbidden: Target employee is not in your direct or indirect reportees"
        );
        error.statusCode = 403;
        throw error;
      }
      return attendanceService.getAttendanceDashboard(
        companyId,
        filter.month,
        filter.employeeId
      );
    }

    if (reporteeIds.length === 0) {
      return {
        month: filter.month,
        startDate: `${filter.month}-01`,
        endDate: `${filter.month}-28`,
        totalDays: 28,
        days: [],
        employees: [],
        dailySummary: {},
        companySummary: {
          totalEmployees: 0,
          totalWorkingDays: 0,
        },
      };
    }

    // Fetch full company dashboard and filter down to reportees
    const fullDashboard = await attendanceService.getAttendanceDashboard(
      companyId,
      filter.month
    );

    const reporteeEmployees = fullDashboard.employees.filter((emp) =>
      reporteeIds.includes(emp.employeeId)
    );

    // Recompute dailySummary scoped specifically to reportees
    const dailySummary: Record<
      string,
      {
        present: number;
        absent: number;
        partial: number;
        onLeave: number;
        pendingLeave: number;
        holiday: number;
        weekend: number;
        unrecorded: number;
      }
    > = {};

    for (const day of fullDashboard.days) {
      dailySummary[day.date] = {
        present: 0,
        absent: 0,
        partial: 0,
        onLeave: 0,
        pendingLeave: 0,
        holiday: 0,
        weekend: 0,
        unrecorded: 0,
      };

      for (const emp of reporteeEmployees) {
        const cell = emp.days[day.date];
        const status = cell?.status;
        const cur = dailySummary[day.date];
        if (!cur) continue;

        switch (status) {
          case "PRESENT":
            cur.present++;
            break;
          case "ABSENT":
            cur.absent++;
            break;
          case "PARTIAL":
            cur.partial++;
            break;
          case "ON_LEAVE":
          case "HALF_DAY_LEAVE":
            cur.onLeave++;
            break;
          case "PENDING_LEAVE":
            cur.pendingLeave++;
            break;
          case "HOLIDAY":
            cur.holiday++;
            break;
          case "WEEKEND":
            cur.weekend++;
            break;
          case "UNRECORDED":
            cur.unrecorded++;
            break;
        }
      }
    }

    return {
      ...fullDashboard,
      employees: reporteeEmployees,
      dailySummary,
    };
  }
}
