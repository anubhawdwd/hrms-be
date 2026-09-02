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
            role: true,
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
        role: emp.user?.role || "EMPLOYEE",
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
      status: LeaveRequestStatus.PENDING,
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
        select: { date: true },
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

    // Holiday dates set
    const holidaysSet = new Set<string>();
    for (const h of companyHolidays) {
      holidaysSet.add(formatDateUTC(h.date));
    }

    // Attendance records map: `${empId}:${YYYY-MM-DD}` -> AttendanceDay
    const attendanceMap = new Map<string, (typeof attendanceDays)[0]>();
    for (const att of attendanceDays) {
      const dStr = formatDateUTC(att.date);
      attendanceMap.set(`${att.employeeId}:${dStr}`, att);
    }

    // Absent dates set by employee (employeeId -> Set<YYYY-MM-DD>)
    const absentDatesByEmp = new Map<string, Set<string>>();
    const workWeekDays = company.workWeekDays ?? 5;

    for (const att of attendanceDays) {
      const empId = att.employeeId;
      const dStr = att.date.toISOString().slice(0, 10);
      const dayOfWeek = att.date.getUTCDay();
      const isWeekend =
        workWeekDays === 6
          ? dayOfWeek === 0
          : dayOfWeek === 0 || dayOfWeek === 6;

      if (att.status === "ABSENT") {
        if (isWeekend) continue;
        if (holidaysSet.has(dStr)) continue;

        const empApprovedLeaves = approvedLeaveDatesByEmp.get(empId);
        if (empApprovedLeaves && empApprovedLeaves.has(dStr)) continue;

        if (att.totalMinutes > 0 || (att.events && att.events.length > 0)) continue;

        if (!absentDatesByEmp.has(empId)) {
          absentDatesByEmp.set(empId, new Set());
        }
        absentDatesByEmp.get(empId)!.add(dStr);
      }
    }

    // Generate Rows (all employees included)
    const rows: LeaveReportEmployeeRow[] = employees.map((emp) => {
      const empBalances = balanceMap.get(emp.id);
      const empUsage = leaveUsageMap.get(emp.id);

      const leaveTypeMetrics: Record<string, { booked: number; balance: number }> = {};

      for (const lt of leaveTypes) {
        const bal = empBalances?.get(lt.id);
        const booked = bal ? bal.used : (empUsage?.byType.get(lt.id) || 0);
        const balance = bal ? bal.remaining : 0;

        leaveTypeMetrics[lt.id] = {
          booked: Number(booked.toFixed(2)),
          balance: Number(balance.toFixed(2)),
        };
      }

      // Paid Leaves Total: SUM of Booked values for all PAID leave types
      let paidLeavesTotal = 0;
      for (const lt of leaveTypes) {
        if (lt.isPaid && lt.code !== "LWP") {
          paidLeavesTotal += leaveTypeMetrics[lt.id]?.booked || 0;
        }
      }

      // LWP Total: SUM of approved Leave Without Pay / Unpaid leave booked
      const unpaidBooked = leaveTypes
        .filter((lt) => !lt.isPaid || lt.code === "LWP")
        .reduce((sum, lt) => sum + (leaveTypeMetrics[lt.id]?.booked || 0), 0);
      const lwpTotal = Math.max(empUsage?.lwpTotal || 0, unpaidBooked);

      return {
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        displayName: emp.displayName,
        email: emp.user?.email || "N/A",
        department: emp.department?.name || "N/A",
        designation: emp.designation?.name || "N/A",
        team: emp.team?.name || "N/A",
        leaveTypeMetrics,
        paidLeavesTotal: Number(paidLeavesTotal.toFixed(2)),
        lwpTotal: Number(lwpTotal.toFixed(2)),
        absentDays: absentDatesByEmp.get(emp.id)?.size || 0,
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
        `NOTE: There are ${report.pendingCount} pending leave requests (${report.pendingTotalDays} days). Pending leaves are EXCLUDED from Booked/Used totals until approved.`,
      ]);
      worksheet.getRow(3).font = { bold: true, color: { argb: "FFB45309" }, italic: true };
    } else {
      worksheet.addRow([]);
    }

    worksheet.getRow(1).font = { bold: true, size: 14, color: { argb: "FF1E293B" } };
    worksheet.getRow(2).font = { italic: true, size: 10, color: { argb: "FF64748B" } };

    // Two-Level Grouped Header Construction
    // Row 4: Top headers (Leave Types merged across Booked & Balance)
    // Row 5: Sub-headers ("Booked", "Balance", etc.)
    const topRowValues: string[] = ["Employee ID", "Employee Name", "Work Email", "Department", "Designation"];
    const subRowValues: string[] = ["", "", "", "", ""];

    let colIndex = 6; // 1-based index in Excel where dynamic leave types start

    for (const lt of report.leaveTypes) {
      topRowValues.push(lt.name, ""); // Spans 2 columns
      subRowValues.push("Booked", "Balance");
      colIndex += 2;
    }

    // Special aggregate columns
    topRowValues.push("Paid Leaves Total", "LWP Total", "Absent Days");
    subRowValues.push("Total Days", "Total Days", "Days");

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
        const m = r.leaveTypeMetrics[lt.id] || { booked: 0, balance: 0 };
        rowValues.push(m.booked, m.balance);
      }

      rowValues.push(r.paidLeavesTotal, r.lwpTotal, r.absentDays);

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
      headers.push(`${lt.name} - Booked`);
      headers.push(`${lt.name} - Balance`);
    }

    headers.push("Paid Leaves Total", "LWP Total", "Absent Days");

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
        const m = r.leaveTypeMetrics[lt.id] || { booked: 0, balance: 0 };
        row.push(m.booked);
        row.push(m.balance);
      }

      row.push(r.paidLeavesTotal);
      row.push(r.lwpTotal);
      row.push(r.absentDays);

      lines.push(row.map(escapeCsv).join(","));
    }

    return lines.join("\r\n");
  }
}

export const reportService = new ReportService();
