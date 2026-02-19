// // src/modules/leave/controller.ts
// import type { Request, Response } from "express";
// import { LeaveService } from "./service.js";
// import {
//   LeaveDurationType,
//   GenderRestriction,
// } from "../../generated/prisma/enums.js";

// const service = new LeaveService();

// // =================== LEAVE TYPES ===================

// export async function createLeaveType(req: Request, res: Response) {
//   try {
//     const { name, code, isPaid } = req.body;

//     if (
//       typeof name !== "string" ||
//       typeof code !== "string" ||
//       typeof isPaid !== "boolean"
//     ) {
//       return res.status(400).json({ message: "Invalid input" });
//     }

//     const result = await service.createLeaveType({
//       companyId: req.companyId!,
//       name,
//       code,
//       isPaid,
//     });

//     res.status(201).json(result);
//   } catch (err: any) {
//     res.status(400).json({ message: err.message });
//   }
// }

// export async function updateLeaveType(req: Request, res: Response) {
//   try {
//     const { leaveTypeId } = req.params;
//     const { name, isPaid, isActive } = req.body;

//     if (!leaveTypeId || Array.isArray(leaveTypeId)) {
//       return res.status(400).json({ message: "Invalid leaveTypeId" });
//     }

//     const result = await service.updateLeaveType({
//       leaveTypeId,
//       ...(typeof name === "string" && { name }),
//       ...(typeof isPaid === "boolean" && { isPaid }),
//       ...(typeof isActive === "boolean" && { isActive }),
//     });

//     res.json(result);
//   } catch (err: any) {
//     res.status(400).json({ message: err.message });
//   }
// }

// export async function listLeaveTypes(req: Request, res: Response) {
//   try {
//     res.json(await service.listLeaveTypes(req.companyId!));
//   } catch (err: any) {
//     res.status(400).json({ message: err.message });
//   }
// }

// // =================== LEAVE POLICY ===================

// export async function upsertLeavePolicy(req: Request, res: Response) {
//   try {
//     const {
//       leaveTypeId,
//       year,
//       yearlyAllocation,
//       allowCarryForward,
//       maxCarryForward,
//       allowEncashment,
//       probationAllowed,
//       genderRestriction,
//       monthlyAccrual,
//       sandwichRule,
//     } = req.body;

//     if (
//       !leaveTypeId ||
//       typeof year !== "number" ||
//       typeof yearlyAllocation !== "number" ||
//       typeof allowCarryForward !== "boolean" ||
//       typeof allowEncashment !== "boolean" ||
//       typeof probationAllowed !== "boolean" ||
//       typeof monthlyAccrual !== "boolean" ||
//       typeof sandwichRule !== "boolean"
//     ) {
//       return res.status(400).json({ message: "Invalid input" });
//     }

//     const result = await service.upsertLeavePolicy({
//       companyId: req.companyId!,
//       leaveTypeId,
//       year,
//       yearlyAllocation,
//       allowCarryForward,
//       maxCarryForward:
//         typeof maxCarryForward === "number" ? maxCarryForward : null,
//       allowEncashment,
//       probationAllowed,
//       genderRestriction:
//         genderRestriction !== undefined
//           ? (genderRestriction as GenderRestriction)
//           : null,
//       monthlyAccrual,
//       sandwichRule,
//     });

//     res.json(result);
//   } catch (err: any) {
//     res.status(400).json({ message: err.message });
//   }
// }

// export async function listLeavePolicies(req: Request, res: Response) {
//   try {
//     const { year } = req.query;

//     if (typeof year !== "string") {
//       return res.status(400).json({ message: "year query param required" });
//     }

//     res.json(await service.listLeavePolicies(req.companyId!, Number(year)));
//   } catch (err: any) {
//     res.status(400).json({ message: err.message });
//   }
// }

// // =================== LEAVE REQUEST ===================

// export async function applyLeave(req: Request, res: Response) {
//   try {
//     const {
//       leaveTypeId,
//       fromDate,
//       toDate,
//       durationType,
//       durationValue,
//       reason,
//     } = req.body;

//     if (
//       !leaveTypeId ||
//       typeof fromDate !== "string" ||
//       typeof toDate !== "string" ||
//       !Object.values(LeaveDurationType).includes(durationType) ||
//       typeof durationValue !== "number"
//     ) {
//       return res.status(400).json({ message: "Invalid input" });
//     }

//     const result = await service.applyLeave({
//       userId: req.user!.userId,
//       companyId: req.companyId!,
//       leaveTypeId,
//       fromDate,
//       toDate,
//       durationType,
//       durationValue,
//       reason,
//     });

//     res.status(201).json(result);
//   } catch (err: any) {
//     res.status(400).json({ message: err.message });
//   }
// }

// export async function listMyLeaveRequests(req: Request, res: Response) {
//   try {
//     res.json(
//       await service.listMyLeaveRequests(req.user!.userId, req.companyId!)
//     );
//   } catch (err: any) {
//     res.status(400).json({ message: err.message });
//   }
// }

// export async function cancelLeaveRequest(req: Request, res: Response) {
//   try {
//     const { requestId } = req.params;
//     if (!requestId || Array.isArray(requestId)) {
//       return res.status(400).json({ message: "Invalid requestId" });
//     }

//     res.json(
//       await service.cancelLeaveRequest(
//         requestId,
//         req.user!.userId,
//         req.companyId!
//       )
//     );
//   } catch (err: any) {
//     res.status(400).json({ message: err.message });
//   }
// }

// // =================== LEAVE APPROVAL ===================

// export async function approveLeave(req: Request, res: Response) {
//   try {
//     const { requestId } = req.params;
//     if (!requestId || Array.isArray(requestId)) {
//       return res.status(400).json({ message: "Invalid request" });
//     }

//     // approvedById is derived from JWT, not body
//     res.json(
//       await service.approveLeave({
//         requestId,
//          userId: req.user!.userId,
//         companyId: req.companyId!,
//       })
//     );
//   } catch (err: any) {
//     res.status(400).json({ message: err.message });
//   }
// }

// export async function rejectLeave(req: Request, res: Response) {
//   try {
//     const { requestId } = req.params;
//     if (!requestId || Array.isArray(requestId)) {
//       return res.status(400).json({ message: "Invalid request" });
//     }

//     res.json(
//       await service.rejectLeave({
//         requestId,
//          userId: req.user!.userId,
//         companyId: req.companyId!,
//       })
//     );
//   } catch (err: any) {
//     res.status(400).json({ message: err.message });
//   }
// }

// export async function hrCancelApprovedLeave(req: Request, res: Response) {
//   try {
//     const { requestId } = req.params;
//     const { reason } = req.body;

//     if (!requestId || Array.isArray(requestId)) {
//       return res.status(400).json({ message: "Invalid requestId" });
//     }

//     res.json(
//       await service.hrCancelApprovedLeave({
//         requestId,
//         reason: typeof reason === "string" ? reason : null,
//       })
//     );
//   } catch (err: any) {
//     res.status(400).json({ message: err.message });
//   }
// }

// // =================== LEAVE BALANCE ===================

// export async function getMyLeaveBalances(req: Request, res: Response) {
//   try {
//     const { year } = req.query;

//     if (typeof year !== "string") {
//       return res.status(400).json({ message: "year query param required" });
//     }

//     res.json(
//       await service.getMyLeaveBalances(
//         req.user!.userId,
//         req.companyId!,
//         Number(year)
//       )
//     );
//   } catch (err: any) {
//     res.status(400).json({ message: err.message });
//   }
// }

// // =================== TODAY LEAVES ===================

// export async function listTodayLeaves(req: Request, res: Response) {
//   try {
//     const scope = req.query.scope as "team" | "hierarchy" | "company";

//     if (!scope || !["team", "hierarchy", "company"].includes(scope)) {
//       return res.status(400).json({ message: "Invalid scope" });
//     }

//     const result = await service.getTodayLeaves({
//       userId: req.user!.userId,
//       companyId: req.companyId!,
//       scope,
//       date: new Date(),
//     });

//     res.json(result);
//   } catch (err: any) {
//     res.status(400).json({ message: err.message });
//   }
// }

// // =================== LEAVE ENCASHMENT ===================

// export async function requestLeaveEncashment(req: Request, res: Response) {
//   try {
//     const { leaveTypeId, year, days } = req.body;

//     if (
//       !leaveTypeId ||
//       typeof year !== "number" ||
//       typeof days !== "number"
//     ) {
//       return res.status(400).json({ message: "Invalid input" });
//     }

//     res.status(201).json(
//       await service.requestLeaveEncashment({
//         userId: req.user!.userId,
//         companyId: req.companyId!,
//         leaveTypeId,
//         year,
//         days,
//       })
//     );
//   } catch (err: any) {
//     res.status(400).json({ message: err.message });
//   }
// }

// export async function approveLeaveEncashment(req: Request, res: Response) {
//   try {
//     const { encashmentId } = req.params;
//     if (!encashmentId || Array.isArray(encashmentId)) {
//       return res.status(400).json({ message: "Invalid request" });
//     }
//     res.json(await service.approveLeaveEncashment(encashmentId));
//   } catch (err: any) {
//     res.status(400).json({ message: err.message });
//   }
// }

// export async function rejectLeaveEncashment(req: Request, res: Response) {
//   try {
//     const { encashmentId } = req.params;
//     if (!encashmentId || Array.isArray(encashmentId)) {
//       return res.status(400).json({ message: "Invalid request" });
//     }
//     res.json(await service.rejectLeaveEncashment(encashmentId));
//   } catch (err: any) {
//     res.status(400).json({ message: err.message });
//   }
// }

// // =================== HR OVERRIDE ===================

// export async function upsertEmployeeLeaveOverride(
//   req: Request,
//   res: Response
// ) {
//   try {
//     const {
//       employeeId,
//       leaveTypeId,
//       year,
//       allowSandwich,
//       allowEncashment,
//       extraAllocation,
//       reason,
//     } = req.body;

//     if (!employeeId || !leaveTypeId || typeof year !== "number") {
//       return res.status(400).json({ message: "Invalid input" });
//     }

//     res.json(
//       await service.upsertEmployeeLeaveOverride({
//         employeeId,
//         leaveTypeId,
//         year,
//         allowSandwich:
//           typeof allowSandwich === "boolean" ? allowSandwich : null,
//         allowEncashment:
//           typeof allowEncashment === "boolean" ? allowEncashment : null,
//         extraAllocation:
//           typeof extraAllocation === "number" ? extraAllocation : null,
//         reason: typeof reason === "string" ? reason : null,
//       })
//     );
//   } catch (err: any) {
//     res.status(400).json({ message: err.message });
//   }
// }
// // =================== PendingLeavesRequest ===================
// export async function listPendingLeaveRequests(req: Request, res: Response) {
//   try {
//     res.json(await service.listPendingLeaveRequests(req.companyId!));
//   } catch (err: any) {
//     res.status(400).json({ message: err.message });
//   }
// }
// // =================== HOLIDAYS ===================

// export async function createHoliday(req: Request, res: Response) {
//   try {
//     const { name, date } = req.body;

//     if (!name || !date) {
//       return res.status(400).json({ message: "Invalid input" });
//     }

//     res.status(201).json(
//       await service.createHoliday({
//         companyId: req.companyId!,
//         name,
//         date: new Date(date),
//       })
//     );
//   } catch (err: any) {
//     res.status(400).json({ message: err.message });
//   }
// }

// export async function listHolidays(req: Request, res: Response) {
//   try {
//     res.json(await service.listHolidays(req.companyId!));
//   } catch (err: any) {
//     res.status(400).json({ message: err.message });
//   }
// }

// export async function deleteHoliday(req: Request, res: Response) {
//   try {
//     const { holidayId } = req.params;
//     if (!holidayId || Array.isArray(holidayId)) {
//       return res.status(400).json({ message: "Invalid request" });
//     }
//     res.json(await service.deleteHoliday(holidayId));
//   } catch (err: any) {
//     res.status(400).json({ message: err.message });
//   }
// }

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
    const { name, code, isPaid } = req.body;

    if (
      typeof name !== "string" ||
      typeof code !== "string" ||
      typeof isPaid !== "boolean"
    ) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const result = await service.createLeaveType({
      companyId: req.companyId!,
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
      sandwichRule,
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
    if (!requestId || Array.isArray(requestId)) {
      return res.status(400).json({ message: "Invalid request" });
    }

    res.json(
      await service.rejectLeave({
        requestId,
        userId: req.user!.userId,
        companyId: req.companyId!,
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
      allowSandwich,
      allowEncashment,
      extraAllocation,
      reason,
    } = req.body;

    if (!employeeId || !leaveTypeId || typeof year !== "number") {
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

// =================== PendingLeavesRequest ===================
export async function listPendingLeaveRequests(req: Request, res: Response) {
  try {
    res.json(await service.listPendingLeaveRequests(req.companyId!));
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