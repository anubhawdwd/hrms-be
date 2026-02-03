// src/modules/leave/controller.ts

import type { Request, Response } from "express";
import { LeaveService } from "./service.js";
import {
  LeaveDurationType,
  LeaveEncashmentStatus,
  GenderRestriction,
} from "../../generated/prisma/enums.js";

const service = new LeaveService();

/* =========================================================
   LEAVE TYPES (HR / ADMIN)
========================================================= */

export async function createLeaveType(req: Request, res: Response) {
  try {
    const companyId = req.header("x-company-id");
    const { name, code, isPaid } = req.body;

    if (
      !companyId ||
      typeof name !== "string" ||
      typeof code !== "string" ||
      typeof isPaid !== "boolean"
    ) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const result = await service.createLeaveType({
      companyId,
      name,
      code,
      isPaid,
    });

    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function updateLeaveType(req: Request, res: Response) {
  try {
    const { leaveTypeId } = req.params;
    const { name, isPaid, isActive } = req.body;

    if (!leaveTypeId || Array.isArray(leaveTypeId)) {
      return res.status(400).json({ message: "Invalid leaveTypeId" });
    }

    const result = await service.updateLeaveType({
      leaveTypeId,
      ...(typeof name === "string" && { name }),
      ...(typeof isPaid === "boolean" && { isPaid }),
      ...(typeof isActive === "boolean" && { isActive }),
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function listLeaveTypes(req: Request, res: Response) {
  try {
    const companyId = req.header("x-company-id");
    if (!companyId) {
      return res.status(400).json({ message: "Missing companyId" });
    }

    res.json(await service.listLeaveTypes(companyId));
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

/* =========================================================
   LEAVE POLICY (HR / ADMIN)
========================================================= */

export async function upsertLeavePolicy(req: Request, res: Response) {
  try {
    const companyId = req.header("x-company-id");
    if (!companyId) {
      return res.status(400).json({ message: "Missing companyId" });
    }

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
      sandwichRule,
    } = req.body;

    if (
      !leaveTypeId ||
      typeof year !== "number" ||
      typeof yearlyAllocation !== "number" ||
      typeof allowCarryForward !== "boolean" ||
      typeof allowEncashment !== "boolean" ||
      typeof probationAllowed !== "boolean" ||
      typeof monthlyAccrual !== "boolean" ||
      typeof sandwichRule !== "boolean"
    ) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const result = await service.upsertLeavePolicy({
      companyId,
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
      sandwichRule,
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function listLeavePolicies(req: Request, res: Response) {
  try {
    const companyId = req.header("x-company-id");
    const { year } = req.query;

    if (!companyId || typeof year !== "string") {
      return res.status(400).json({ message: "Invalid request" });
    }

    res.json(await service.listLeavePolicies(companyId, Number(year)));
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

/* =========================================================
   LEAVE REQUEST (EMPLOYEE)
========================================================= */

export async function applyLeave(req: Request, res: Response) {
  try {
    const { employeeId, leaveTypeId, fromDate, toDate, durationType, durationValue, reason } =
      req.body;

    if (
      !employeeId ||
      !leaveTypeId ||
      typeof fromDate !== "string" ||
      typeof toDate !== "string" ||
      !Object.values(LeaveDurationType).includes(durationType) ||
      typeof durationValue !== "number"
    ) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const result = await service.applyLeave({
      employeeId,
      leaveTypeId,
      fromDate,
      toDate,
      durationType,
      durationValue,
      reason,
    });

    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function listMyLeaveRequests(req: Request, res: Response) {
  try {
    const { employeeId } = req.query;

    if (typeof employeeId !== "string") {
      return res.status(400).json({ message: "Invalid employeeId" });
    }

    res.json(await service.listMyLeaveRequests(employeeId));
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

    res.json(await service.cancelLeaveRequest(requestId));
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

/* =========================================================
   LEAVE APPROVAL (MANAGER / HR)
========================================================= */

export async function approveLeave(req: Request, res: Response) {
  try {
    const { requestId } = req.params;
    const { approvedById } = req.body;

    if (!requestId || Array.isArray(requestId) || !approvedById) {
      return res.status(400).json({ message: "Invalid request" });
    }

    res.json(await service.approveLeave({ requestId, approvedById }));
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function rejectLeave(req: Request, res: Response) {
  try {
    const { requestId } = req.params;
    const { approvedById } = req.body;

    if (!requestId || Array.isArray(requestId) || !approvedById) {
      return res.status(400).json({ message: "Invalid request" });
    }

    res.json(await service.rejectLeave({ requestId, approvedById }));
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

/* =========================================================
   LEAVE BALANCE
========================================================= */

export async function getMyLeaveBalances(req: Request, res: Response) {
  try {
    const { employeeId, year } = req.query;

    if (typeof employeeId !== "string" || typeof year !== "string") {
      return res.status(400).json({ message: "Invalid query" });
    }

    res.json(await service.getMyLeaveBalances(employeeId, Number(year)));
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

/* =========================================================
   LEAVE ENCASHMENT
========================================================= */

export async function requestLeaveEncashment(req: Request, res: Response) {
  try {
    const { employeeId, leaveTypeId, year, days } = req.body;

    if (
      !employeeId ||
      !leaveTypeId ||
      typeof year !== "number" ||
      typeof days !== "number"
    ) {
      return res.status(400).json({ message: "Invalid input" });
    }

    res.status(201).json(
      await service.requestLeaveEncashment({
        employeeId,
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


/* =========================================================
   HR OVERRIDE
========================================================= */

export async function upsertEmployeeLeaveOverride(req: Request, res: Response) {
  try {
    const { employeeId, leaveTypeId, year, allowSandwich, allowEncashment, extraAllocation, reason } =
      req.body;

    if (
      !employeeId ||
      !leaveTypeId ||
      typeof year !== "number"
    ) {
      return res.status(400).json({ message: "Invalid input" });
    }

    res.json(
      await service.upsertEmployeeLeaveOverride({
        employeeId,
        leaveTypeId,
        year,
        allowSandwich:
          typeof allowSandwich === "boolean" ? allowSandwich : null,
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

// --------Holiday Calendar----------
export async function createHoliday(req: Request, res: Response) {
  try {
    const { companyId, name, date } = req.body;

    if (!companyId || !name || !date) {
      return res.status(400).json({ message: "Invalid input" });
    }

    res.status(201).json(
      await service.createHoliday({
        companyId,
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
    const { companyId } = req.params;
     if (!companyId || Array.isArray(companyId)) {
            return res.status(400).json({ message: "Invalid request" });
        }
        res.json(await service.listHolidays(companyId));
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
