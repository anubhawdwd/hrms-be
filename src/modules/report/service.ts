// src/modules/report/service.ts
import ExcelJS from "exceljs";
import { prisma } from "../../config/prisma.js";
import { LeaveRequestStatus } from "../../generated/prisma/enums.js";
import { formatDateUTC, parseDateUTC, endOfDayUTC } from "../../utils/date.js";
import type {
  EmployeeReportFilterParams,
  EmployeeReportResponse,
  EmployeeReportRow,
  LeaveReportFilterParams,
  LeaveReportResponse,
  LeaveReportSuccessResponse,
  DynamicLeaveTypeColumn,
  LeaveReportEmployeeRow,
  AttendanceReportFilterParams,
  AttendanceReportResponse,
  AttendanceReportEmployeeRow,
  AttendanceReportHeaderDay,
  AttendanceReportDayCell,
  DashboardAttendanceStatus,
} from "./types.js";


export class ReportService {
  // =================== EMPLOYEE REPORT ===================

  async getEmployeeReport(
    companyId: string,
    filters: EmployeeReportFilterParams = {}
  ): Promise<EmployeeReportResponse> {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });
    if (!company) throw new Error("Company not found");

    const whereClause: any = { companyId };

    if (filters.departmentId) {
      whereClause.departmentId = filters.departmentId;
    }
    if (filters.teamId) {
      whereClause.teamId = filters.teamId;
    }
    if (filters.status === "ACTIVE") {
      whereClause.isActive = true;
    } else if (filters.status === "INACTIVE") {
      whereClause.isActive = false;
    }

    if (filters.search?.trim()) {
      const q = filters.search.trim();
      whereClause.OR = [
        { displayName: { contains: q, mode: "insensitive" } },
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { user: { email: { contains: q, mode: "insensitive" } } },
      ];
    }

    const employees = await prisma.employeeProfile.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            email: true,
            personalEmail: true,
            roles: { select: { role: true } },
            authProvider: true,
            isActive: true,
          },
        },
        department: { select: { name: true } },
        designation: { select: { name: true } },
        team: { select: { name: true } },
        manager: {
          select: {
            displayName: true,
            employeeCode: true,
          },
        },
      },
      orderBy: { employeeCode: "asc" },
    });

    const rows: EmployeeReportRow[] = employees.map((emp) => {
      const managerName = emp.manager
        ? `${emp.manager.displayName} (#${emp.manager.employeeCode})`
        : "N/A";

      const roles = emp.user?.roles?.map((r: any) => r.role) || [];

      return {
        employeeCode: emp.employeeCode,
        displayName: emp.displayName || `${emp.firstName} ${emp.lastName}`.trim(),
        firstName: emp.firstName,
        middleName: emp.middleName || "",
        lastName: emp.lastName,
        email: emp.user?.email || "N/A",
        personalEmail: emp.user?.personalEmail || "N/A",
        phone: "N/A",
        designation: emp.designation?.name || "N/A",
        department: emp.department?.name || "N/A",
        team: emp.team?.name || "N/A",
        primaryReportingManager: managerName,
        joiningDate: emp.joiningDate
          ? emp.joiningDate.toISOString().slice(0, 10)
          : "N/A",
        dateOfBirth: emp.dateOfBirth
          ? emp.dateOfBirth.toISOString().slice(0, 10)
          : "N/A",
        employmentStatus: emp.isActive ? "Active" : "Inactive",
        employeeType: emp.isProbation ? "Probation" : "Permanent",
        role: roles.join(", ") || "EMPLOYEE",
        authProvider: emp.user?.authProvider || "LOCAL",
      };
    });

    let departmentLabel = "All Departments";
    if (filters.departmentId) {
      const dept = await prisma.department.findUnique({
        where: { id: filters.departmentId },
        select: { name: true },
      });
      if (dept) departmentLabel = dept.name;
    }

    let teamLabel = "All Teams";
    if (filters.teamId) {
      const team = await prisma.team.findUnique({
        where: { id: filters.teamId },
        select: { name: true },
      });
      if (team) teamLabel = team.name;
    }

    let statusLabel = "All Status";
    if (filters.status === "ACTIVE") statusLabel = "Active Only";
    if (filters.status === "INACTIVE") statusLabel = "Inactive Only";

    return {
      reportType: "EMPLOYEE",
      companyName: company.name,
      departmentLabel,
      teamLabel,
      statusLabel,
      generatedAt: new Date().toISOString(),
      totalEmployees: rows.length,
      data: rows,
    };
  }

  // =================== LEAVE REPORT ===================

  async getLeaveReport(
    companyId: string,
    filters: LeaveReportFilterParams = {}
  ): Promise<LeaveReportResponse> {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, workWeekDays: true },
    });
    if (!company) throw new Error("Company not found");

    const currentYear = new Date().getFullYear();
    let targetYear = filters.year || currentYear;

    // Date range boundaries for the selected year/filter
    let rangeStart = new Date(Date.UTC(targetYear, 0, 1, 0, 0, 0, 0));
    let rangeEnd = new Date(Date.UTC(targetYear, 11, 31, 23, 59, 59, 999));
    let periodLabel = `Calendar Year ${targetYear}`;
    let dateRangeLabel = `${formatDateUTC(rangeStart)} → ${formatDateUTC(rangeEnd)}`;

    if (filters.fromDate) {
      rangeStart = parseDateUTC(filters.fromDate);
      targetYear = rangeStart.getUTCFullYear();
    }
    if (filters.toDate) {
      rangeEnd = endOfDayUTC(parseDateUTC(filters.toDate));
    }

    if (filters.fromDate || filters.toDate) {
      periodLabel = `Custom Period`;
      dateRangeLabel = `${formatDateUTC(rangeStart)} → ${formatDateUTC(rangeEnd)}`;
    }

    let departmentLabel = "All Departments";
    if (filters.departmentId) {
      const dept = await prisma.department.findUnique({
        where: { id: filters.departmentId },
        select: { name: true },
      });
      if (dept) departmentLabel = dept.name;
    }

    let teamLabel = "All Teams";
    if (filters.teamId) {
      const team = await prisma.team.findUnique({
        where: { id: filters.teamId },
        select: { name: true },
      });
      if (team) teamLabel = team.name;
    }

    // 1. Check for Pending Leave Approvals within company and period
    const pendingLeaveWhere: any = {
      employee: { companyId },
      status: { in: [LeaveRequestStatus.PENDING, LeaveRequestStatus.PENDING_MANAGER, LeaveRequestStatus.PENDING_HR] },
      fromDate: { lte: rangeEnd },
      toDate: { gte: rangeStart },
    };

    if (filters.departmentId) {
      pendingLeaveWhere.employee.departmentId = filters.departmentId;
    }
    if (filters.teamId) {
      pendingLeaveWhere.employee.teamId = filters.teamId;
    }
    if (filters.employeeId) {
      pendingLeaveWhere.employeeId = filters.employeeId;
    }

    const pendingRequests = await prisma.leaveRequest.findMany({
      where: pendingLeaveWhere,
      select: { id: true, employeeId: true, fromDate: true, toDate: true, durationValue: true, days: true },
    });

    const pendingCount = pendingRequests.length;
    const pendingTotalDays = pendingRequests.reduce(
      (sum, r) => sum + r.durationValue,
      0
    );

    // If pending leaves exist and user has NOT confirmed, return warning
    if (pendingCount > 0 && !filters.confirmPending) {
      return {
        warning: "PENDING_LEAVE_APPROVALS",
        hasPending: true,
        pendingCount,
        pendingTotalDays: Number(pendingTotalDays.toFixed(2)),
        message: `There are ${pendingCount} pending leave requests totaling ${pendingTotalDays} days/hours for the selected period. Pending leave will not be counted as Booked/Used in this report unless it is approved.`,
      };
    }

    // 2. Fetch all employees for this company (LEFT JOIN base: all employees MUST appear)
    const empWhere: any = { companyId };
    if (filters.departmentId) empWhere.departmentId = filters.departmentId;
    if (filters.teamId) empWhere.teamId = filters.teamId;
    if (filters.employeeId) empWhere.id = filters.employeeId;

    const [
      employees,
      leaveTypes,
      leaveBalances,
      approvedLeaveRequests,
      companyHolidays,
      attendanceDays,
    ] = await Promise.all([
      prisma.employeeProfile.findMany({
        where: empWhere,
        include: {
          user: { select: { email: true } },
          department: { select: { name: true } },
          designation: { select: { name: true } },
          team: { select: { name: true } },
        },
        orderBy: { employeeCode: "asc" },
      }),
      prisma.leaveType.findMany({
        where: { companyId, isActive: true },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, code: true, isPaid: true },
      }),
      prisma.leaveBalance.findMany({
        where: { employee: { companyId }, year: targetYear },
        select: {
          employeeId: true,
          leaveTypeId: true,
          allocated: true,
          used: true,
          carriedForward: true,
          remaining: true,
        },
      }),
      prisma.leaveRequest.findMany({
        where: {
          employee: { companyId },
          status: LeaveRequestStatus.APPROVED,
          fromDate: { lte: rangeEnd },
          toDate: { gte: rangeStart },
        },
        include: { leaveType: true, days: true },
      }),
      prisma.holiday.findMany({
        where: {
          companyId,
          date: { gte: rangeStart, lte: rangeEnd },
        },
        select: { date: true, type: true },
      }),
      prisma.attendanceDay.findMany({
        where: {
          employee: { companyId },
          date: { gte: rangeStart, lte: rangeEnd },
        },
        include: { events: true },
      }),
    ]);

    // Build fast in-memory lookup structures
    // Balance map: employeeId -> leaveTypeId -> { used, remaining }
    const balanceMap = new Map<string, Map<string, { used: number; remaining: number }>>();
    for (const b of leaveBalances) {
      if (!balanceMap.has(b.employeeId)) {
        balanceMap.set(b.employeeId, new Map());
      }
      balanceMap.get(b.employeeId)!.set(b.leaveTypeId, {
        used: b.used,
        remaining: b.remaining,
      });
    }

    // Approved leaves sum: employeeId -> { paidTotal, lwpTotal, byType }
    const leaveUsageMap = new Map<
      string,
      { paidTotal: number; lwpTotal: number; byType: Map<string, number> }
    >();

    // Approved leave dates set by employee: employeeId -> Set<YYYY-MM-DD>
    const approvedLeaveDatesByEmp = new Map<string, Set<string>>();

    for (const req of approvedLeaveRequests) {
      const empId = req.employeeId;
      if (!leaveUsageMap.has(empId)) {
        leaveUsageMap.set(empId, { paidTotal: 0, lwpTotal: 0, byType: new Map() });
      }
      const u = leaveUsageMap.get(empId)!;

      // Track approved leave dates
      if (!approvedLeaveDatesByEmp.has(empId)) {
        approvedLeaveDatesByEmp.set(empId, new Set());
      }
      const dateSet = approvedLeaveDatesByEmp.get(empId)!;

      // Determine deduction days
      let days = 0;
      if (req.days && req.days.length > 0) {
        for (const d of req.days) {
          if (d.status === LeaveRequestStatus.APPROVED) {
            dateSet.add(formatDateUTC(d.date));
            days += d.deductDays;
          }
        }
      } else {
        days = req.durationValue;
        const cur = new Date(req.fromDate);
        const end = new Date(req.toDate);
        while (cur <= end) {
          dateSet.add(formatDateUTC(cur));
          cur.setUTCDate(cur.getUTCDate() + 1);
        }
      }

      const isUnpaid = !req.leaveType.isPaid || req.leaveType.code === "LWP";
      if (isUnpaid) {
        u.lwpTotal += days;
      } else {
        u.paidTotal += days;
      }

      const curTypeDays = u.byType.get(req.leaveTypeId) || 0;
      u.byType.set(req.leaveTypeId, curTypeDays + days);
    }

    // Pending leave dates set by employee: employeeId -> Set<YYYY-MM-DD>
    const pendingLeaveDatesByEmp = new Map<string, Set<string>>();
    for (const req of pendingRequests) {
      if (!pendingLeaveDatesByEmp.has(req.employeeId)) {
        pendingLeaveDatesByEmp.set(req.employeeId, new Set());
      }
      const dateSet = pendingLeaveDatesByEmp.get(req.employeeId)!;
      if (req.days && req.days.length > 0) {
        for (const d of req.days) {
          dateSet.add(formatDateUTC(d.date));
        }
      } else {
        const cur = new Date(req.fromDate);
        const end = new Date(req.toDate);
        while (cur <= end) {
          dateSet.add(formatDateUTC(cur));
          cur.setUTCDate(cur.getUTCDate() + 1);
        }
      }
    }

    // Holiday dates set (normal company holidays only)
    const holidaysSet = new Set<string>();
    for (const h of companyHolidays) {
      if (h.type !== "RESTRICTED") {
        holidaysSet.add(formatDateUTC(h.date));
      }
    }

    // Attendance records map: `${empId}:${YYYY-MM-DD}` -> AttendanceDay
    const attendanceMap = new Map<string, (typeof attendanceDays)[0]>();
    for (const att of attendanceDays) {
      const dStr = formatDateUTC(att.date);
      attendanceMap.set(`${att.employeeId}:${dStr}`, att);
    }

    // Today in UTC
    const now = new Date();
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayStr = formatDateUTC(todayUtc);
    const workWeekDays = company.workWeekDays ?? 5;

    // Generate Rows (all employees included)
    const rows: LeaveReportEmployeeRow[] = employees.map((emp) => {
      const empBalances = balanceMap.get(emp.id);
      const empUsage = leaveUsageMap.get(emp.id);

      const leaveTypeMetrics: Record<
        string,
        {
          used: number;
          balance: number;
          booked?: number;
        }
      > = {};

      for (const lt of leaveTypes) {
        const bal = empBalances?.get(lt.id);
        const used = bal ? bal.used : (empUsage?.byType.get(lt.id) || 0);
        const balance = bal ? bal.remaining : 0;

        leaveTypeMetrics[lt.id] = {
          used: Number(used.toFixed(2)),
          balance: Number(balance.toFixed(2)),
          booked: Number(used.toFixed(2)),
        };
      }

      // Paid Leaves Used & Balance: SUM across all PAID leave types (excluding LWP)
      let paidLeavesUsed = 0;
      let paidLeavesBalance = 0;
      for (const lt of leaveTypes) {
        if (lt.isPaid && lt.code !== "LWP") {
          paidLeavesUsed += leaveTypeMetrics[lt.id]?.used || 0;
          paidLeavesBalance += leaveTypeMetrics[lt.id]?.balance || 0;
        }
      }

      // LWP Total: SUM of approved Leave Without Pay / Unpaid leave used
      const unpaidUsed = leaveTypes
        .filter((lt) => !lt.isPaid || lt.code === "LWP")
        .reduce((sum, lt) => sum + (leaveTypeMetrics[lt.id]?.used || 0), 0);
      const lwpTotal = Math.max(empUsage?.lwpTotal || 0, unpaidUsed);

      // Absent Days: dynamic evaluation of past working days on or after joiningDate
      const empJoiningDateStr = emp.joiningDate
        ? formatDateUTC(emp.joiningDate)
        : null;
      const empApprovedLeaves = approvedLeaveDatesByEmp.get(emp.id);

      let absentDaysCount = 0;
      const cur = new Date(rangeStart);
      while (cur <= rangeEnd) {
        const dStr = formatDateUTC(cur);

        // Do not evaluate future dates
        if (dStr > todayStr) {
          cur.setUTCDate(cur.getUTCDate() + 1);
          continue;
        }

        // Skip any date before employee's joining date
        if (empJoiningDateStr && dStr < empJoiningDateStr) {
          cur.setUTCDate(cur.getUTCDate() + 1);
          continue;
        }

        // Skip weekends
        const dayOfWeek = cur.getUTCDay();
        const isWeekend =
          workWeekDays === 6
            ? dayOfWeek === 0
            : dayOfWeek === 0 || dayOfWeek === 6;
        if (isWeekend) {
          cur.setUTCDate(cur.getUTCDate() + 1);
          continue;
        }

        // Skip normal holidays
        if (holidaysSet.has(dStr)) {
          cur.setUTCDate(cur.getUTCDate() + 1);
          continue;
        }

        // Skip approved leaves
        if (empApprovedLeaves && empApprovedLeaves.has(dStr)) {
          cur.setUTCDate(cur.getUTCDate() + 1);
          continue;
        }

        // Check attendance record
        const att = attendanceMap.get(`${emp.id}:${dStr}`);
        if (att) {
          if (
            att.status === "PRESENT" ||
            att.status === "PARTIAL" ||
            att.status === "LEAVE" ||
            att.totalMinutes > 0 ||
            (att.events && att.events.length > 0)
          ) {
            cur.setUTCDate(cur.getUTCDate() + 1);
            continue;
          }
        }

        // Unrecorded working day on/after joining date = Absent
        absentDaysCount++;
        cur.setUTCDate(cur.getUTCDate() + 1);
      }

      return {
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        displayName: emp.displayName,
        email: emp.user?.email || "N/A",
        department: emp.department?.name || "N/A",
        designation: emp.designation?.name || "N/A",
        team: emp.team?.name || "N/A",
        leaveTypeMetrics,
        paidLeavesUsed: Number(paidLeavesUsed.toFixed(2)),
        paidLeavesBalance: Number(paidLeavesBalance.toFixed(2)),
        paidLeavesTotal: Number(paidLeavesUsed.toFixed(2)),
        lwpTotal: Number(lwpTotal.toFixed(2)),
        absentDays: absentDaysCount,
      };
    });

    const successResponse: LeaveReportSuccessResponse = {
      reportType: "LEAVE",
      companyName: company.name,
      year: targetYear,
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      periodLabel,
      dateRangeLabel,
      departmentLabel,
      teamLabel,
      generatedAt: new Date().toISOString(),
      totalEmployees: rows.length,
      leaveTypes,
      hasPendingWarning: pendingCount > 0,
      pendingCount,
      pendingTotalDays: Number(pendingTotalDays.toFixed(2)),
      reportNote:
        pendingCount > 0
          ? "Pending leave approvals are excluded from Booked/Used totals."
          : undefined,
      data: rows,
    };

    return successResponse;
  }

  // =================== EXCEL GENERATION ===================

  async generateEmployeeExcel(report: EmployeeReportResponse): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "HRMS";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Employee Directory");

    // Title Block
    worksheet.addRow([`${report.companyName} - Employee Report`]);
    worksheet.addRow([`Generated on: ${new Date(report.generatedAt).toLocaleString()} | Total Employees: ${report.totalEmployees}`]);
    worksheet.addRow([]); // Blank line

    worksheet.getRow(1).font = { bold: true, size: 14, color: { argb: "FF1E293B" } };
    worksheet.getRow(2).font = { italic: true, size: 10, color: { argb: "FF64748B" } };

    // Header Row
    const headers = [
      "Employee ID",
      "Employee Name",
      "First Name",
      "Middle Name",
      "Last Name",
      "Work Email",
      "Personal Email",
      "Designation",
      "Department",
      "Team",
      "Primary Manager",
      "Joining Date",
      "Date of Birth",
      "Employment Status",
      "Employee Type",
      "Role",
      "Auth Provider",
    ];

    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0284C7" }, // Sky Blue 600
    };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };

    for (const r of report.data) {
      const dataRow = worksheet.addRow([
        r.employeeCode,
        r.displayName,
        r.firstName,
        r.middleName,
        r.lastName,
        r.email,
        r.personalEmail,
        r.designation,
        r.department,
        r.team,
        r.primaryReportingManager,
        r.joiningDate,
        r.dateOfBirth,
        r.employmentStatus,
        r.employeeType,
        r.role,
        r.authProvider,
      ]);
      dataRow.alignment = { vertical: "middle" };
    }

    // Auto-fit column widths
    worksheet.columns.forEach((col) => {
      let maxLen = 12;
      col.eachCell?.({ includeEmpty: false }, (cell) => {
        const str = cell.value ? cell.value.toString() : "";
        if (str.length > maxLen) maxLen = Math.min(str.length + 3, 40);
      });
      col.width = maxLen;
    });

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async generateLeaveExcel(report: LeaveReportSuccessResponse): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "HRMS";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Leave Matrix");

    // Title Block
    worksheet.addRow([`${report.companyName} - Leave Report (${report.year})`]);
    worksheet.addRow([
      `Generated: ${new Date(report.generatedAt).toLocaleString()} | Total Employees: ${report.totalEmployees}`,
    ]);

    if (report.hasPendingWarning) {
      worksheet.addRow([
        `NOTE: There are ${report.pendingCount} pending leave requests (${report.pendingTotalDays} days). Pending leaves are EXCLUDED from Used totals until approved.`,
      ]);
      worksheet.getRow(3).font = { bold: true, color: { argb: "FFB45309" }, italic: true };
    } else {
      worksheet.addRow([]);
    }

    worksheet.getRow(1).font = { bold: true, size: 14, color: { argb: "FF1E293B" } };
    worksheet.getRow(2).font = { italic: true, size: 10, color: { argb: "FF64748B" } };

    // Two-Level Grouped Header Construction
    // Row 4: Top headers (Leave Types merged across Balance & Used)
    // Row 5: Sub-headers ("Balance", "Used", etc.)
    const topRowValues: string[] = ["Employee ID", "Employee Name", "Work Email", "Department", "Designation"];
    const subRowValues: string[] = ["", "", "", "", ""];

    let colIndex = 6; // 1-based index in Excel where dynamic leave types start

    for (const lt of report.leaveTypes) {
      topRowValues.push(lt.name, ""); // Spans 2 columns
      subRowValues.push("Balance", "Used");
      colIndex += 2;
    }

    // Total Paid Leaves (Grouped Merged Header) + Special aggregate columns
    topRowValues.push("Total Paid Leaves", "", "LWP Total", "Absent Days");
    subRowValues.push("Balance", "Used", "Total Days", "Days");

    const headerRow1 = worksheet.addRow(topRowValues);
    const headerRow2 = worksheet.addRow(subRowValues);

    headerRow1.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow1.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A8A" }, // Dark Slate/Navy Blue
    };
    headerRow1.alignment = { vertical: "middle", horizontal: "center" };

    headerRow2.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow2.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2563EB" }, // Blue 600
    };
    headerRow2.alignment = { vertical: "middle", horizontal: "center" };

    // Merge non-leave type base columns across Row 4 & Row 5
    for (let c = 1; c <= 5; c++) {
      worksheet.mergeCells(4, c, 5, c);
    }

    // Merge each dynamic leave type top header across its 2 columns
    let mergeStart = 6;
    for (let i = 0; i < report.leaveTypes.length; i++) {
      worksheet.mergeCells(4, mergeStart, 4, mergeStart + 1);
      mergeStart += 2;
    }

    // Merge "Total Paid Leaves" top header across its 2 columns
    worksheet.mergeCells(4, mergeStart, 4, mergeStart + 1);

    // Merge LWP Total and Absent Days base columns across Row 4 & Row 5
    worksheet.mergeCells(4, mergeStart + 2, 5, mergeStart + 2);
    worksheet.mergeCells(4, mergeStart + 3, 5, mergeStart + 3);

    // Add Data Rows
    for (const r of report.data) {
      const rowValues: any[] = [
        r.employeeCode,
        r.displayName,
        r.email,
        r.department,
        r.designation,
      ];

      for (const lt of report.leaveTypes) {
        const m = r.leaveTypeMetrics[lt.id] || { used: 0, balance: 0 };
        rowValues.push(m.balance, m.used ?? m.booked ?? 0);
      }

      rowValues.push(r.paidLeavesBalance, r.paidLeavesUsed, r.lwpTotal, r.absentDays);

      const dRow = worksheet.addRow(rowValues);
      dRow.alignment = { vertical: "middle" };
    }

    // Auto-fit column widths
    worksheet.columns.forEach((col) => {
      let maxLen = 12;
      col.eachCell?.({ includeEmpty: false }, (cell) => {
        const str = cell.value ? cell.value.toString() : "";
        if (str.length > maxLen) maxLen = Math.min(str.length + 3, 35);
      });
      col.width = maxLen;
    });

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  // =================== CSV GENERATION ===================

  generateEmployeeCsv(report: EmployeeReportResponse): string {
    const headers = [
      "Employee ID",
      "Employee Name",
      "First Name",
      "Middle Name",
      "Last Name",
      "Work Email",
      "Personal Email",
      "Designation",
      "Department",
      "Team",
      "Primary Manager",
      "Joining Date",
      "Date of Birth",
      "Employment Status",
      "Employee Type",
      "Role",
      "Auth Provider",
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const lines: string[] = [];
    lines.push(headers.map(escapeCsv).join(","));

    for (const r of report.data) {
      const row = [
        r.employeeCode,
        r.displayName,
        r.firstName,
        r.middleName,
        r.lastName,
        r.email,
        r.personalEmail,
        r.designation,
        r.department,
        r.team,
        r.primaryReportingManager,
        r.joiningDate,
        r.dateOfBirth,
        r.employmentStatus,
        r.employeeType,
        r.role,
        r.authProvider,
      ];
      lines.push(row.map(escapeCsv).join(","));
    }

    return lines.join("\r\n");
  }

  generateLeaveCsv(report: LeaveReportSuccessResponse): string {
    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Flattened header structure
    const headers = [
      "Employee ID",
      "Employee Name",
      "Work Email",
      "Department",
      "Designation",
    ];

    for (const lt of report.leaveTypes) {
      headers.push(`${lt.name} - Balance`);
      headers.push(`${lt.name} - Used`);
    }

    headers.push("Total Paid Leaves - Balance", "Total Paid Leaves - Used", "LWP Total", "Absent Days");

    const lines: string[] = [];
    lines.push(headers.map(escapeCsv).join(","));

    for (const r of report.data) {
      const row: any[] = [
        r.employeeCode,
        r.displayName,
        r.email,
        r.department,
        r.designation,
      ];

      for (const lt of report.leaveTypes) {
        const m = r.leaveTypeMetrics[lt.id] || { used: 0, balance: 0 };
        row.push(m.balance);
        row.push(m.used ?? m.booked ?? 0);
      }

      row.push(r.paidLeavesBalance);
      row.push(r.paidLeavesUsed);
      row.push(r.lwpTotal);
      row.push(r.absentDays);

      lines.push(row.map(escapeCsv).join(","));
    }

    return lines.join("\r\n");
  }

  // =================== ATTENDANCE REPORT ===================

  async getAttendanceReport(
    companyId: string,
    filters: AttendanceReportFilterParams = {}
  ): Promise<AttendanceReportResponse> {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        name: true,
        workingMinutes: true,
        lunchMinutes: true,
        breakMinutes: true,
        graceMinutes: true,
        workWeekDays: true,
      },
    });
    if (!company) throw new Error("Company not found");

    const workingMinutes = company.workingMinutes ?? 480;
    const lunchMinutes = company.lunchMinutes ?? 30;
    const breakMinutes = company.breakMinutes ?? 20;
    const graceMinutes = company.graceMinutes ?? 10;
    const expectedPresenceMinutes = workingMinutes + lunchMinutes + breakMinutes;
    const workWeekDays = company.workWeekDays ?? 5;

    // Resolve date range
    let rangeStart: Date;
    let rangeEnd: Date;
    let periodLabel = "";
    let dateRangeLabel = "";

    if (filters.fromDate && filters.toDate) {
      rangeStart = parseDateUTC(filters.fromDate);
      rangeEnd = endOfDayUTC(parseDateUTC(filters.toDate));
      periodLabel = "Custom Range";
      dateRangeLabel = `${formatDateUTC(rangeStart)} to ${formatDateUTC(rangeEnd)}`;
    } else if (filters.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(filters.month)) {
      const parts = filters.month.split("-");
      const year = parseInt(parts[0] ?? "2000", 10);
      const monthIndex = parseInt(parts[1] ?? "1", 10) - 1;
      const totalDays = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
      rangeStart = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
      rangeEnd = new Date(Date.UTC(year, monthIndex, totalDays, 23, 59, 59, 999));
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      periodLabel = `${monthNames[monthIndex]} ${year}`;
      dateRangeLabel = `${formatDateUTC(rangeStart)} to ${formatDateUTC(rangeEnd)}`;
    } else {
      const targetYear = filters.year || new Date().getFullYear();
      let monthIndex: number;
      if (filters.month && !isNaN(parseInt(filters.month, 10))) {
        monthIndex = parseInt(filters.month, 10) - 1;
      } else {
        monthIndex = new Date().getMonth();
      }
      const totalDays = new Date(Date.UTC(targetYear, monthIndex + 1, 0)).getUTCDate();
      rangeStart = new Date(Date.UTC(targetYear, monthIndex, 1, 0, 0, 0, 0));
      rangeEnd = new Date(Date.UTC(targetYear, monthIndex, totalDays, 23, 59, 59, 999));
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      periodLabel = `${monthNames[monthIndex]} ${targetYear}`;
      dateRangeLabel = `${formatDateUTC(rangeStart)} to ${formatDateUTC(rangeEnd)}`;
    }

    // Build days header
    const daysHeader: AttendanceReportHeaderDay[] = [];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const cur = new Date(rangeStart);
    let totalWorkingDays = 0;

    // Fetch holidays in range
    const holidays = await prisma.holiday.findMany({
      where: {
        companyId,
        date: { gte: rangeStart, lte: rangeEnd },
      },
      select: { date: true, name: true, type: true },
    });
    const holidayMap = new Map<string, string>();
    for (const h of holidays) {
      if (h.type !== "RESTRICTED") {
        holidayMap.set(formatDateUTC(h.date), h.name);
      }
    }

    while (cur <= rangeEnd) {
      const dateStr = formatDateUTC(cur);
      const dayOfWeekNum = cur.getUTCDay();
      const isWeekend =
        workWeekDays === 6
          ? dayOfWeekNum === 0
          : dayOfWeekNum === 0 || dayOfWeekNum === 6;
      const holidayName = holidayMap.get(dateStr) || null;

      if (!isWeekend && !holidayName) {
        totalWorkingDays++;
      }

      daysHeader.push({
        date: dateStr,
        dayOfWeek: dayNames[dayOfWeekNum] || "Day",
        dayNumber: cur.getUTCDate(),
        isWeekend,
        holidayName,
      });

      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    // Filter employees
    const empWhere: any = { companyId, isActive: true };
    if (filters.departmentId) empWhere.departmentId = filters.departmentId;
    if (filters.teamId) empWhere.teamId = filters.teamId;
    if (filters.employeeId) empWhere.id = filters.employeeId;

    if (filters.search?.trim()) {
      const q = filters.search.trim();
      empWhere.OR = [
        { displayName: { contains: q, mode: "insensitive" } },
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { user: { email: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [
      employees,
      attendanceDays,
      leaveRequests,
      overrides,
      departments,
      teams,
    ] = await Promise.all([
      prisma.employeeProfile.findMany({
        where: empWhere,
        include: {
          user: { select: { email: true } },
          department: { select: { id: true, name: true } },
          designation: {
            select: {
              id: true,
              name: true,
              attendancePolicy: true,
            },
          },
          team: { select: { id: true, name: true } },
        },
        orderBy: { employeeCode: "asc" },
      }),
      prisma.attendanceDay.findMany({
        where: {
          employee: { companyId },
          date: { gte: rangeStart, lte: rangeEnd },
        },
        include: {
          events: {
            orderBy: { timestamp: "asc" },
            select: { type: true, timestamp: true },
          },
        },
      }),
      prisma.leaveRequest.findMany({
        where: {
          employee: { companyId },
          status: {
            in: [
              LeaveRequestStatus.APPROVED,
              LeaveRequestStatus.PENDING,
              LeaveRequestStatus.PENDING_MANAGER,
              LeaveRequestStatus.PENDING_HR,
            ],
          },
          fromDate: { lte: rangeEnd },
          toDate: { gte: rangeStart },
        },
        include: {
          leaveType: { select: { id: true, name: true, code: true, isPaid: true } },
          days: true,
        },
      }),
      prisma.employeeAttendanceOverride.findMany({
        where: { employee: { companyId } },
      }),
      filters.departmentId
        ? prisma.department.findUnique({ where: { id: filters.departmentId }, select: { name: true } })
        : null,
      filters.teamId
        ? prisma.team.findUnique({ where: { id: filters.teamId }, select: { name: true } })
        : null,
    ]);

    // Build fast in-memory indexes
    const attendanceMap = new Map<string, (typeof attendanceDays)[0]>();
    for (const a of attendanceDays) {
      attendanceMap.set(`${a.employeeId}:${formatDateUTC(a.date)}`, a);
    }

    const leavesMap = new Map<string, typeof leaveRequests>();
    for (const l of leaveRequests) {
      if (!leavesMap.has(l.employeeId)) leavesMap.set(l.employeeId, []);
      leavesMap.get(l.employeeId)!.push(l);
    }

    const overridesMap = new Map<string, typeof overrides>();
    for (const o of overrides) {
      if (!overridesMap.has(o.employeeId)) overridesMap.set(o.employeeId, []);
      overridesMap.get(o.employeeId)!.push(o);
    }

    const todayStr = formatDateUTC(new Date());

    // Daily summary initialization
    const dailySummary: AttendanceReportResponse["dailySummary"] = {};
    for (const d of daysHeader) {
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

    const rows: AttendanceReportEmployeeRow[] = [];
    let totalPresentSum = 0;
    let totalWorkingDaysSum = 0;

    for (const emp of employees) {
      const desigPolicy = emp.designation?.attendancePolicy;
      const empOverrides = overridesMap.get(emp.id) ?? [];
      const empLeaves = leavesMap.get(emp.id) ?? [];

      const empDays: Record<string, AttendanceReportDayCell> = {};
      const empSummary = {
        present: 0,
        absent: 0,
        partial: 0,
        onLeave: 0,
        pendingLeave: 0,
        holiday: 0,
        weekend: 0,
        unrecorded: 0,
        totalWorkingDays,
        totalPresentDays: 0,
        attendancePercentage: 0,
      };

      for (const d of daysHeader) {
        const attDay = attendanceMap.get(`${emp.id}:${d.date}`);
        const isFuture = d.date > todayStr;
        const isPreJoining = Boolean(
          emp.joiningDate && formatDateUTC(emp.joiningDate) > d.date
        );

        // Check overrides for this day
        const dayDate = parseDateUTC(d.date);
        let isAutoPresent = Boolean(desigPolicy?.autoPresent);
        let isExempt = Boolean(desigPolicy?.attendanceExempt);

        for (const ov of empOverrides) {
          const fromMatch = !ov.validFrom || ov.validFrom <= dayDate;
          const toMatch = !ov.validTo || ov.validTo >= dayDate;
          if (fromMatch && toMatch) {
            if (ov.autoPresent) isAutoPresent = true;
            if (ov.attendanceExempt) isExempt = true;
          }
        }

        // Check leaves for this day
        let approvedFullDay: (typeof leaveRequests)[0] | null = null;
        let approvedPartial: (typeof leaveRequests)[0] | null = null;
        let pendingLeave: (typeof leaveRequests)[0] | null = null;

        for (const req of empLeaves) {
          const reqFromStr = formatDateUTC(req.fromDate);
          const reqToStr = formatDateUTC(req.toDate);
          if (d.date >= reqFromStr && d.date <= reqToStr) {
            if (req.days && req.days.length > 0) {
              const matchedDay = req.days.find((dayRow) => formatDateUTC(dayRow.date) === d.date);
              if (matchedDay) {
                if (matchedDay.status === LeaveRequestStatus.APPROVED) {
                  if (req.durationType === "FULL_DAY") approvedFullDay = req;
                  else approvedPartial = req;
                } else if (
                  matchedDay.status === LeaveRequestStatus.PENDING ||
                  matchedDay.status === LeaveRequestStatus.PENDING_MANAGER ||
                  matchedDay.status === LeaveRequestStatus.PENDING_HR
                ) {
                  pendingLeave = req;
                }
              }
            } else {
              if (req.status === LeaveRequestStatus.APPROVED) {
                if (req.durationType === "FULL_DAY") approvedFullDay = req;
                else approvedPartial = req;
              } else if (
                req.status === LeaveRequestStatus.PENDING ||
                req.status === LeaveRequestStatus.PENDING_MANAGER ||
                req.status === LeaveRequestStatus.PENDING_HR
              ) {
                pendingLeave = req;
              }
            }
          }
        }

        // Punch times
        let checkIn: string | null = null;
        let checkOut: string | null = null;
        let totalMinutes = attDay?.totalMinutes ?? 0;
        const hasPunches = Boolean(attDay?.events && attDay.events.length > 0);
        const hasRecordedMinutes = totalMinutes > 0;
        const isDbPresent = attDay?.status === "PRESENT";
        const isDbPartial = attDay?.status === "PARTIAL";

        if (attDay?.events && attDay.events.length > 0) {
          const checkIns = attDay.events.filter((e) => e.type === "CHECK_IN");
          const checkOuts = attDay.events.filter((e) => e.type === "CHECK_OUT");
          if (checkIns.length > 0) {
            checkIn = new Date(checkIns[0]!.timestamp).toISOString();
          }
          if (checkOuts.length > 0) {
            checkOut = new Date(checkOuts[checkOuts.length - 1]!.timestamp).toISOString();
          }
        }

        let status: DashboardAttendanceStatus;
        let leaveType: string | null = null;
        let leaveDuration: AttendanceReportDayCell["leaveDuration"] = null;
        let holidayName = d.holidayName;

        if (approvedFullDay) {
          leaveType = approvedFullDay.leaveType.name;
          leaveDuration = "FULL_DAY";
        } else if (approvedPartial) {
          leaveType = approvedPartial.leaveType.name;
          leaveDuration = approvedPartial.durationType as any;
        }

        if (isPreJoining && !hasPunches && !hasRecordedMinutes && !isDbPresent && !isDbPartial) {
          status = "UNRECORDED";
          holidayName = null;
        } else if (hasPunches || hasRecordedMinutes || isDbPresent || isDbPartial) {
          let partialLeaveMinutes = 0;
          if (approvedPartial) {
            if (approvedPartial.durationType === "HALF_DAY") {
              partialLeaveMinutes = Math.round(workingMinutes / 2);
            } else if (approvedPartial.durationType === "QUARTER_DAY") {
              partialLeaveMinutes = Math.round(workingMinutes / 4);
            } else if (approvedPartial.durationType === "HOURLY") {
              partialLeaveMinutes = (approvedPartial.durationValue || 0) * 60;
            }
          }
          const effectiveTarget = Math.max(expectedPresenceMinutes - partialLeaveMinutes - graceMinutes, 0);

          if (totalMinutes >= effectiveTarget) {
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
          } else if (d.isWeekend) {
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
        } else if (d.isWeekend) {
          status = "WEEKEND";
        } else if (isFuture) {
          status = "UNRECORDED";
        } else {
          status = "ABSENT";
        }

        // Lightweight cell representation (NO eager session detail array per user instruction)
        const cell: AttendanceReportDayCell = {
          date: d.date,
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
        empDays[d.date] = cell;

        // Tally summaries
        const currentDaily = dailySummary[d.date];
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

      empSummary.totalPresentDays = Number((empSummary.present + empSummary.partial * 0.5).toFixed(1));
      empSummary.attendancePercentage = totalWorkingDays > 0
        ? Math.min(100, Math.round((empSummary.totalPresentDays / totalWorkingDays) * 100))
        : 100;

      totalPresentSum += empSummary.totalPresentDays;
      totalWorkingDaysSum += totalWorkingDays;

      rows.push({
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        displayName: emp.displayName || `${emp.firstName} ${emp.lastName}`.trim(),
        email: emp.user?.email || "N/A",
        department: emp.department?.name || "N/A",
        designation: emp.designation?.name || "N/A",
        team: emp.team?.name || "N/A",
        summary: empSummary,
        days: empDays,
      });
    }

    const avgAttendancePercentage = totalWorkingDaysSum > 0
      ? Math.min(100, Math.round((totalPresentSum / totalWorkingDaysSum) * 100))
      : 100;

    return {
      reportType: "ATTENDANCE",
      companyName: company.name,
      periodLabel,
      dateRangeLabel,
      startDate: formatDateUTC(rangeStart),
      endDate: formatDateUTC(rangeEnd),
      departmentLabel: departments?.name || "All Departments",
      teamLabel: teams?.name || "All Teams",
      generatedAt: new Date().toISOString(),
      totalDays: daysHeader.length,
      daysHeader,
      totalEmployees: rows.length,
      companySummary: {
        totalEmployees: rows.length,
        totalWorkingDays,
        avgAttendancePercentage,
      },
      dailySummary,
      data: rows,
    };
  }

  // =================== ATTENDANCE EXCEL & CSV GENERATORS ===================

  async generateAttendanceExcel(report: AttendanceReportResponse): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "HRMS System";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Attendance Report", {
      views: [{ showGridLines: true }],
    });

    // Row 1: Title Banner
    const titleRow = worksheet.addRow([`${report.companyName.toUpperCase()} — ATTENDANCE REPORT`]);
    titleRow.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
    titleRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" }, // Slate 900
    };
    titleRow.alignment = { vertical: "middle", horizontal: "left" };
    titleRow.height = 32;

    // Row 2: Metadata Sub-Header
    const metaText = `Period: ${report.periodLabel} (${report.dateRangeLabel})  |  Department: ${report.departmentLabel}  |  Team: ${report.teamLabel}  |  Generated: ${report.generatedAt.slice(0, 10)}`;
    const metaRow = worksheet.addRow([metaText]);
    metaRow.font = { name: "Arial", size: 10, italic: true, color: { argb: "FF475569" } };
    metaRow.height = 20;

    // Row 3: Empty spacing row
    worksheet.addRow([]);

    // Grouped Headers
    // Row 4: Top Group Headers
    // Row 5: Sub-headers
    const topRowValues: string[] = [
      "Employee ID",
      "Employee Name",
      "Work Email",
      "Department",
      "Designation",
      "Attendance Summary",
      "",
      "",
      "",
      "",
      "",
      "",
    ];

    const subRowValues: string[] = [
      "",
      "",
      "",
      "",
      "",
      "Working Days",
      "Present",
      "Absent",
      "Partial",
      "On Leave",
      "Holidays",
      "Attendance %",
    ];

    for (const d of report.daysHeader) {
      topRowValues.push(d.dayOfWeek);
      subRowValues.push(String(d.dayNumber));
    }

    const headerRow1 = worksheet.addRow(topRowValues);
    const headerRow2 = worksheet.addRow(subRowValues);

    headerRow1.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow1.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E293B" }, // Slate 800
    };
    headerRow1.alignment = { vertical: "middle", horizontal: "center" };

    headerRow2.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow2.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF334155" }, // Slate 700
    };
    headerRow2.alignment = { vertical: "middle", horizontal: "center" };

    const totalCols = 12 + report.daysHeader.length;
    worksheet.mergeCells(1, 1, 1, totalCols);
    worksheet.mergeCells(2, 1, 2, totalCols);

    // Merge base metadata columns across Row 4 & Row 5
    for (let c = 1; c <= 5; c++) {
      worksheet.mergeCells(4, c, 5, c);
    }

    // Merge Attendance Summary Group Header across columns 6 to 12
    worksheet.mergeCells(4, 6, 4, 12);

    // Add Data Rows
    for (const r of report.data) {
      const rowValues: any[] = [
        r.employeeCode,
        r.displayName,
        r.email,
        r.department,
        r.designation,
        r.summary.totalWorkingDays,
        r.summary.present,
        r.summary.absent,
        r.summary.partial,
        r.summary.onLeave,
        r.summary.holiday,
        `${r.summary.attendancePercentage}%`,
      ];

      for (const d of report.daysHeader) {
        const cell = r.days[d.date];
        let symbol = "-";
        if (cell) {
          switch (cell.status) {
            case "PRESENT":
              symbol = "P";
              break;
            case "ABSENT":
              symbol = "A";
              break;
            case "PARTIAL":
              symbol = cell.totalMinutes > 0 ? `${(cell.totalMinutes / 60).toFixed(1)}h` : "PART";
              break;
            case "ON_LEAVE":
            case "HALF_DAY_LEAVE":
              symbol = "L";
              break;
            case "HOLIDAY":
              symbol = "H";
              break;
            case "WEEKEND":
              symbol = "OFF";
              break;
            case "PENDING_LEAVE":
              symbol = "PL";
              break;
            case "UNRECORDED":
              symbol = "-";
              break;
          }
        }
        rowValues.push(symbol);
      }

      const row = worksheet.addRow(rowValues);
      row.alignment = { vertical: "middle" };

      // Apply subtle color coding to day cells (column 13 onwards)
      for (let i = 0; i < report.daysHeader.length; i++) {
        const d = report.daysHeader[i]!;
        const cellVal = r.days[d.date];
        const cellRef = row.getCell(13 + i);
        cellRef.alignment = { vertical: "middle", horizontal: "center" };

        if (cellVal) {
          switch (cellVal.status) {
            case "PRESENT":
              cellRef.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F4EA" } };
              cellRef.font = { color: { argb: "FF137333" }, bold: true };
              break;
            case "ABSENT":
              cellRef.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE8E6" } };
              cellRef.font = { color: { argb: "FFC5221F" }, bold: true };
              break;
            case "PARTIAL":
              cellRef.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF7E0" } };
              cellRef.font = { color: { argb: "FFB06000" }, bold: true };
              break;
            case "ON_LEAVE":
            case "HALF_DAY_LEAVE":
              cellRef.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F0FE" } };
              cellRef.font = { color: { argb: "FF1A73E8" }, bold: true };
              break;
            case "HOLIDAY":
              cellRef.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3E8FD" } };
              cellRef.font = { color: { argb: "FF7627BB" } };
              break;
            case "WEEKEND":
              cellRef.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F3F4" } };
              cellRef.font = { color: { argb: "FF5F6368" } };
              break;
          }
        }
      }
    }

    // Set Column Widths
    worksheet.getColumn(1).width = 14;
    worksheet.getColumn(2).width = 24;
    worksheet.getColumn(3).width = 28;
    worksheet.getColumn(4).width = 20;
    worksheet.getColumn(5).width = 22;

    for (let c = 6; c <= 12; c++) {
      worksheet.getColumn(c).width = 14;
    }
    for (let c = 13; c <= totalCols; c++) {
      worksheet.getColumn(c).width = 7;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  generateAttendanceCsv(report: AttendanceReportResponse): string {
    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headers = [
      "Employee ID",
      "Employee Name",
      "Work Email",
      "Department",
      "Designation",
      "Team",
      "Total Working Days",
      "Present Days",
      "Absent Days",
      "Partial Days",
      "On Leave Days",
      "Holiday Days",
      "Attendance %",
    ];


    for (const d of report.daysHeader) {
      headers.push(`${d.date} (${d.dayOfWeek})`);
    }

    const lines: string[] = [];
    lines.push(headers.map(escapeCsv).join(","));


    for (const r of report.data) {
      const row: any[] = [
        r.employeeCode,
        r.displayName,
        r.email,
        r.department,
        r.designation,
        r.team,
        r.summary.totalWorkingDays,
        r.summary.present,
        r.summary.absent,
        r.summary.partial,
        r.summary.onLeave,
        r.summary.holiday,
        `${r.summary.attendancePercentage}%`,
      ];

      for (const d of report.daysHeader) {
        const cell = r.days[d.date];
        let symbol = "-";
        if (cell) {
          switch (cell.status) {
            case "PRESENT":
              symbol = "P";
              break;
            case "ABSENT":
              symbol = "A";
              break;
            case "PARTIAL":
              symbol = cell.totalMinutes > 0 ? `PARTIAL (${(cell.totalMinutes / 60).toFixed(1)}h)` : "PARTIAL";
              break;
            case "ON_LEAVE":
            case "HALF_DAY_LEAVE":
              symbol = `LEAVE (${cell.leaveType || "L"})`;
              break;
            case "HOLIDAY":
              symbol = `HOLIDAY (${d.holidayName || "H"})`;
              break;
            case "WEEKEND":
              symbol = "WEEKEND";
              break;
            case "PENDING_LEAVE":
              symbol = "PENDING";
              break;
            case "UNRECORDED":
              symbol = "-";
              break;
          }
        }
        row.push(symbol);
      }

      lines.push(row.map(escapeCsv).join(","));
    }

    return lines.join("\r\n");
  }
}

export const reportService = new ReportService();
