// src/modules/leave/controller.ts
import type { Request, Response } from "express";
import { LeaveService } from "./service.js";
import {
  LeaveDurationType,
  GenderRestriction,
} from "../../generated/prisma/enums.js";

const service = new LeaveService();

// =================== LEAVE TYPES ===================

export async function createLeaveType(req: Request, res: Response) {
  try {
    const { name, code, isPaid, autoGrantOnOnboarding, isActive } = req.body;

    if (typeof name !== "string" || typeof code !== "string") {
      return res.status(400).json({ message: "name and code are required strings" });
    }

    const result = await service.createLeaveType({
      companyId: req.companyId!,
      name,
      code,
      isPaid: typeof isPaid === "boolean" ? isPaid : true,
      autoGrantOnOnboarding: typeof autoGrantOnOnboarding === "boolean" ? autoGrantOnOnboarding : false,
      isActive: typeof isActive === "boolean" ? isActive : true,
    });

    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function updateLeaveType(req: Request, res: Response) {
  try {
    const { leaveTypeId } = req.params;
    const { name, code, isPaid, autoGrantOnOnboarding, isActive } = req.body;

    if (!leaveTypeId || Array.isArray(leaveTypeId)) {
      return res.status(400).json({ message: "Invalid leaveTypeId" });
    }

    const result = await service.updateLeaveType({
      leaveTypeId,
      ...(typeof name === "string" && { name }),
      ...(typeof code === "string" && { code }),
      ...(typeof isPaid === "boolean" && { isPaid }),
      ...(typeof autoGrantOnOnboarding === "boolean" && { autoGrantOnOnboarding }),
      ...(typeof isActive === "boolean" && { isActive }),
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function listLeaveTypes(req: Request, res: Response) {
  try {
    res.json(await service.listLeaveTypes(req.companyId!));
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

// =================== LEAVE POLICY ===================

export async function upsertLeavePolicy(req: Request, res: Response) {
  try {
    const {
      leaveTypeId,
      year,
      yearlyAllocation,
      allowCarryForward,
      maxCarryForward,
      allowEncashment,
      probationAllowed,
      genderRestriction,
      monthlyAccrual,
    } = req.body;

    if (
      !leaveTypeId ||
      typeof year !== "number" ||
      typeof yearlyAllocation !== "number" ||
      typeof allowCarryForward !== "boolean" ||
      typeof allowEncashment !== "boolean" ||
      typeof probationAllowed !== "boolean" ||
      typeof monthlyAccrual !== "boolean"
    ) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const result = await service.upsertLeavePolicy({
      companyId: req.companyId!,
      leaveTypeId,
      year,
      yearlyAllocation,
      allowCarryForward,
      maxCarryForward:
        typeof maxCarryForward === "number" ? maxCarryForward : null,
      allowEncashment,
      probationAllowed,
      genderRestriction:
        genderRestriction !== undefined
          ? (genderRestriction as GenderRestriction)
          : null,
      monthlyAccrual,
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function listLeavePolicies(req: Request, res: Response) {
  try {
    const { year } = req.query;

    if (typeof year !== "string") {
      return res.status(400).json({ message: "year query param required" });
    }

    res.json(await service.listLeavePolicies(req.companyId!, Number(year)));
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

// =================== LEAVE REQUEST ===================

export async function applyLeave(req: Request, res: Response) {
  try {
    const {
      leaveTypeId,
      fromDate,
      toDate,
      durationType,
      slot,
      startTime,
      endTime,
      reason,
    } = req.body;

    if (
      !leaveTypeId ||
      typeof fromDate !== "string" ||
      typeof toDate !== "string" ||
      !Object.values(LeaveDurationType).includes(durationType)
    ) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const result = await service.applyLeave({
      userId: req.user!.userId,
      companyId: req.companyId!,
      leaveTypeId,
      fromDate,
      toDate,
      durationType,
      ...(typeof slot === "string" ? {slot} : {}),
      ...(typeof startTime === "string" ? {startTime} : {}),
      ...(typeof endTime === "string" ? {endTime} : {}),
      ...(typeof reason === "string" ? {reason} : {}),
    });

    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function listMyLeaveRequests(req: Request, res: Response) {
  try {
    res.json(
      await service.listMyLeaveRequests(req.user!.userId, req.companyId!)
    );
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function cancelLeaveRequest(req: Request, res: Response) {
  try {
    const { requestId } = req.params;
    if (!requestId || Array.isArray(requestId)) {
      return res.status(400).json({ message: "Invalid requestId" });
    }

    res.json(
      await service.cancelLeaveRequest(
        requestId,
        req.user!.userId,
        req.companyId!
      )
    );
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

// =================== LEAVE APPROVAL ===================

export async function approveLeave(req: Request, res: Response) {
  try {
    const { requestId } = req.params;
    if (!requestId || Array.isArray(requestId)) {
      return res.status(400).json({ message: "Invalid request" });
    }

    res.json(
      await service.approveLeave({
        requestId,
        userId: req.user!.userId,
        companyId: req.companyId!,
      })
    );
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function rejectLeave(req: Request, res: Response) {
  try {
    const { requestId } = req.params;
    const { reason } = req.body || {};
    if (!requestId || Array.isArray(requestId)) {
      return res.status(400).json({ message: "Invalid request" });
    }

    res.json(
      await service.rejectLeave({
        requestId,
        userId: req.user!.userId,
        companyId: req.companyId!,
        reason,
      })
    );
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function hrCancelApprovedLeave(req: Request, res: Response) {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;

    if (!requestId || Array.isArray(requestId)) {
      return res.status(400).json({ message: "Invalid requestId" });
    }

    res.json(
      await service.hrCancelApprovedLeave({
        requestId,
        reason: typeof reason === "string" ? reason : null,
      })
    );
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function updateLeaveRequestDayStatus(req: Request, res: Response) {
  try {
    const { requestId, dayId } = req.params;
    const { status } = req.body;

    if (!requestId || !dayId || !status) {
      return res.status(400).json({ message: "requestId, dayId, and status are required" });
    }

    res.json(
      await service.updateLeaveRequestDayStatus({
        requestId: String(requestId),
        dayId: String(dayId),
        status: status as any,
        userId: req.user!.userId,
        companyId: req.companyId!,
      })
    );
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

// =================== LEAVE BALANCE ===================

export async function getMyLeaveBalances(req: Request, res: Response) {
  try {
    const { year } = req.query;

    if (typeof year !== "string") {
      return res.status(400).json({ message: "year query param required" });
    }

    res.json(
      await service.getMyLeaveBalances(
        req.user!.userId,
        req.companyId!,
        Number(year)
      )
    );
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

// =================== TODAY LEAVES ===================

export async function listTodayLeaves(req: Request, res: Response) {
  try {
    const scope = req.query.scope as "team" | "hierarchy" | "company";

    if (!scope || !["team", "hierarchy", "company"].includes(scope)) {
      return res.status(400).json({ message: "Invalid scope" });
    }

    const result = await service.getTodayLeaves({
      userId: req.user!.userId,
      companyId: req.companyId!,
      scope,
      date: new Date(),
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

// =================== LEAVE ENCASHMENT ===================

export async function requestLeaveEncashment(req: Request, res: Response) {
  try {
    const { leaveTypeId, year, days } = req.body;

    if (
      !leaveTypeId ||
      typeof year !== "number" ||
      typeof days !== "number"
    ) {
      return res.status(400).json({ message: "Invalid input" });
    }

    res.status(201).json(
      await service.requestLeaveEncashment({
        userId: req.user!.userId,
        companyId: req.companyId!,
        leaveTypeId,
        year,
        days,
      })
    );
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function approveLeaveEncashment(req: Request, res: Response) {
  try {
    const { encashmentId } = req.params;
    if (!encashmentId || Array.isArray(encashmentId)) {
      return res.status(400).json({ message: "Invalid request" });
    }
    res.json(await service.approveLeaveEncashment(encashmentId));
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function rejectLeaveEncashment(req: Request, res: Response) {
  try {
    const { encashmentId } = req.params;
    if (!encashmentId || Array.isArray(encashmentId)) {
      return res.status(400).json({ message: "Invalid request" });
    }
    res.json(await service.rejectLeaveEncashment(encashmentId));
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

// =================== HR OVERRIDE ===================

export async function upsertEmployeeLeaveOverride(
  req: Request,
  res: Response
) {
  try {
    const {
      employeeId,
      leaveTypeId,
      year,
      allowEncashment,
      extraAllocation,
      reason,
    } = req.body;

    if (!employeeId || !leaveTypeId || typeof year !== "number") {
      return res.status(400).json({ message: "Invalid input" });
    }

    res.json(
      await service.upsertEmployeeLeaveOverride({
        companyId: req.companyId!,
        employeeId,
        leaveTypeId,
        year,

        allowEncashment:
          typeof allowEncashment === "boolean" ? allowEncashment : null,
        extraAllocation:
          typeof extraAllocation === "number" ? extraAllocation : null,
        reason: typeof reason === "string" ? reason : null,
      })
    );
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

// =================== PendingLeavesRequest ===================
export async function listPendingLeaveRequests(req: Request, res: Response) {
  try {
    res.json(await service.listPendingLeaveRequests(req.companyId!));
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

// =================== RecentLeaveRequests ===================
export async function listRecentLeaveRequests(req: Request, res: Response) {
  try {
    const { status, days } = req.query;

    const result = await service.listRecentLeaveRequests({
      companyId: req.companyId!,
      ...(typeof status === "string" ? { status } : {}),
      ...(typeof days === "string" && !Number.isNaN(Number(days))
        ? { days: Number(days) }
        : {}),
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

// =================== HOLIDAYS ===================

export async function createHoliday(req: Request, res: Response) {
  try {
    const { name, date } = req.body;

    if (!name || !date) {
      return res.status(400).json({ message: "Invalid input" });
    }

    res.status(201).json(
      await service.createHoliday({
        companyId: req.companyId!,
        name,
        date: new Date(date),
      })
    );
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function listHolidays(req: Request, res: Response) {
  try {
    res.json(await service.listHolidays(req.companyId!));
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function deleteHoliday(req: Request, res: Response) {
  try {
    const { holidayId } = req.params;
    if (!holidayId || Array.isArray(holidayId)) {
      return res.status(400).json({ message: "Invalid request" });
    }
    res.json(await service.deleteHoliday(holidayId));
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}
export async function runYearEndRollover(req: Request, res: Response) {
  try {
    const { fromYear, toYear } = req.body;
    if (!fromYear || !toYear) {
      return res.status(400).json({ message: "fromYear and toYear are required" });
    }

    const result = await service.runYearEndRollover({
      companyId: req.companyId!,
      adminUserId: req.user!.userId,
      fromYear: Number(fromYear),
      toYear: Number(toYear),
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function bulkAllocateLeaveBalances(req: Request, res: Response) {
  try {
    const { leaveTypeId, year, allocated, scope, isProbation, employeeIds, reason } = req.body;

    if (!leaveTypeId) {
      return res.status(400).json({ message: "leaveTypeId is required" });
    }
    if (!year) {
      return res.status(400).json({ message: "year is required" });
    }
    if (allocated === undefined || Number(allocated) < 0) {
      return res.status(400).json({ message: "allocated amount must be >= 0" });
    }
    if (!scope || !["ALL_ACTIVE", "BY_EMPLOYMENT_TYPE", "SPECIFIC_EMPLOYEES"].includes(scope)) {
      return res.status(400).json({ message: "Valid scope is required (ALL_ACTIVE | BY_EMPLOYMENT_TYPE | SPECIFIC_EMPLOYEES)" });
    }

    const result = await service.bulkAllocateLeaves({
      companyId: req.companyId!,
      adminUserId: req.user!.userId,
      leaveTypeId,
      year: Number(year),
      allocated: Number(allocated),
      scope,
      ...(isProbation !== undefined ? { isProbation: Boolean(isProbation) } : {}),
      ...(employeeIds ? { employeeIds: Array.isArray(employeeIds) ? employeeIds : [employeeIds] } : {}),
      ...(reason ? { reason: String(reason) } : {}),
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function updateEmployeeLeaveAllocation(req: Request, res: Response) {
  try {
    const { employeeId } = req.params;
    if (!employeeId || Array.isArray(employeeId)) {
      return res.status(400).json({ message: "Employee ID is required" });
    }

    const { leaveTypeId, newBalance, targetBalance, allocated, year, reason } = req.body;
    if (!leaveTypeId) {
      return res.status(400).json({ message: "leaveTypeId is required" });
    }

    const resolvedNewBalance =
      newBalance !== undefined
        ? Number(newBalance)
        : targetBalance !== undefined
        ? Number(targetBalance)
        : undefined;

    const result = await service.adjustLeaveAllocation({
      employeeId,
      adminUserId: req.user!.userId,
      companyId: req.companyId!,
      leaveTypeId,
      ...(resolvedNewBalance !== undefined ? { newBalance: resolvedNewBalance } : {}),
      ...(allocated !== undefined && resolvedNewBalance === undefined ? { allocated: Number(allocated) } : {}),
      ...(year ? { year: Number(year) } : {}),
      ...(reason ? { reason: String(reason) } : {}),
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function getEmployeeLeaveBalancesAdmin(req: Request, res: Response) {
  try {
    const { employeeId } = req.params;
    if (!employeeId || Array.isArray(employeeId)) {
      return res.status(400).json({ message: "Employee ID is required" });
    }
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const balances = await service.getLeaveBalancesByEmployeeId(
      employeeId,
      req.companyId!,
      year
    );
    res.json(balances);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function markLeaveByAdmin(req: Request, res: Response) {
  try {
    const { employeeId } = req.body;
    if (!employeeId) {
      return res.status(400).json({ message: "Employee ID is required" });
    }
    const result = await service.markLeaveByAdmin({
      ...req.body,
      adminUserId: req.user!.userId,
      companyId: req.companyId!,
    });
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function listEmployeeLeaveRequests(req: Request, res: Response) {
  try {
    const { employeeId } = req.params;
    if (!employeeId || Array.isArray(employeeId)) {
      return res.status(400).json({ message: "Employee ID is required" });
    }
    const requests = await service.listEmployeeLeaveRequests(
      employeeId,
      req.companyId!
    );
    res.json(requests);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

// =================== HR SANDWICH BRIDGE DAY EXCEPTION CONTROLLER ===================

export async function toggleSandwichBridgeDayExemption(req: Request, res: Response) {
  try {
    const requestId = req.params.requestId as string;
    const dayId = req.params.dayId as string;
    const { exempt } = req.body;
    const result = await service.toggleSandwichBridgeDayExemption({
      requestId,
      dayId,
      adminUserId: req.user!.userId,
      companyId: req.companyId!,
      isExempted: typeof exempt === "boolean" ? exempt : true,
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function deleteLeaveRequest(req: Request, res: Response) {
  try {
    const requestId = req.params.requestId as string;
    if (!requestId) {
      return res.status(400).json({ message: "requestId is required" });
    }
    const result = await service.deleteLeaveRequest({
      requestId,
      adminUserId: req.user!.userId,
      companyId: req.companyId!,
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function deleteLeaveRequestDays(req: Request, res: Response) {
  try {
    const { requestId } = req.params;
    const { dayIds } = req.body || {};

    if (!requestId || Array.isArray(requestId)) {
      return res.status(400).json({ message: "Invalid requestId" });
    }

    if (!dayIds || !Array.isArray(dayIds) || dayIds.length === 0) {
      return res.status(400).json({ message: "dayIds must be a non-empty array of strings" });
    }

    const result = await service.deleteLeaveRequestDays({
      requestId,
      dayIds,
      adminUserId: req.user!.userId,
      companyId: req.companyId!,
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}


export async function getLwpReport(req: Request, res: Response) {
  try {
    const year = req.query.year ? parseInt(req.query.year as string, 10) : new Date().getFullYear();
    const month = req.query.month ? parseInt(req.query.month as string, 10) : new Date().getMonth() + 1;
    const result = await service.getLwpReport({
      companyId: req.companyId!,
      year,
      month,
    });
    res.status(200).json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}
