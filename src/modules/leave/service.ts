import { prisma } from "../../config/prisma.js";
import { LeaveRepository } from "./repository.js";
import {
  LeaveDurationType,
  LeaveRequestStatus,
  LeaveEncashmentStatus,
  GenderRestriction,
} from "../../generated/prisma/enums.js";

const repo = new LeaveRepository();

export function parseDateToUTC(dateInput: string | Date): Date {
  if (dateInput instanceof Date) {
    return new Date(Date.UTC(dateInput.getUTCFullYear(), dateInput.getUTCMonth(), dateInput.getUTCDate()));
  }
  const str = String(dateInput).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match && match[1] && match[2] && match[3]) {
    return new Date(Date.UTC(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10)));
  }
  const d = new Date(str);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export class LeaveService {
  // =================== LEAVE TYPES ===================

  async createLeaveType(params: {
    companyId: string;
    name: string;
    code: string;
    isPaid?: boolean;
    autoGrantOnOnboarding?: boolean;
    isActive?: boolean;
  }) {
    const existing = await prisma.leaveType.findFirst({
      where: {
        companyId: params.companyId,
        code: params.code.toUpperCase().trim(),
      },
    });
    if (existing) {
      throw new Error(`Leave type with code '${params.code}' already exists`);
    }

    return repo.createLeaveType({
      companyId: params.companyId,
      name: params.name.trim(),
      code: params.code.toUpperCase().trim(),
      isPaid: params.isPaid !== undefined ? params.isPaid : true,
      autoGrantOnOnboarding: params.autoGrantOnOnboarding ?? false,
      isActive: params.isActive ?? true,
    });
  }

  async updateLeaveType(params: {
    leaveTypeId: string;
    name?: string;
    code?: string;
    isPaid?: boolean;
    isActive?: boolean;
    autoGrantOnOnboarding?: boolean;
  }) {
    return repo.updateLeaveType(params);
  }

  async listLeaveTypes(companyId: string) {
    return repo.listLeaveTypes(companyId);
  }

  // =================== LEAVE POLICY ===================

  async upsertLeavePolicy(params: {
    companyId: string;
    leaveTypeId: string;
    year: number;
    yearlyAllocation: number;
    allowCarryForward: boolean;
    maxCarryForward?: number | null;
    allowEncashment: boolean;
    probationAllowed: boolean;
    genderRestriction?: GenderRestriction | null;
    monthlyAccrual: boolean;
  }) {
    if (params.allowCarryForward && params.maxCarryForward != null && params.maxCarryForward < 0) {
      throw new Error("maxCarryForward must be greater than or equal to 0");
    }

    return repo.upsertLeavePolicy({
      ...params,
      maxCarryForward: params.allowCarryForward ? params.maxCarryForward ?? null : null,
    });
  }

  async listLeavePolicies(companyId: string, year: number) {
    return repo.listLeavePolicies(companyId, year);
  }

  // =================== APPLY LEAVE ===================

  async applyLeave(params: {
    userId: string;
    companyId: string;
    leaveTypeId: string;
    fromDate: string;
    toDate: string;
    durationType: LeaveDurationType;
    slot?: string;
    startTime?: string;
    endTime?: string;
    reason?: string;
  }) {
    const employee = await this.resolveEmployee(params.userId, params.companyId);

    const from = parseDateToUTC(params.fromDate);
    const to = parseDateToUTC(params.toDate);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new Error("Invalid date");
    }
    if (from > to) throw new Error("fromDate cannot be after toDate");
    if (from.getUTCFullYear() !== to.getUTCFullYear()) {
      throw new Error("Leave cannot span across multiple years");
    }

    const holidaysInRange = await repo.getHolidaysForRange({
      companyId: params.companyId,
      from,
      to,
    });
    if (holidaysInRange.length > 0) {
      throw new Error("Leave cannot be applied on a company holiday.");
    }

    const durationValue = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const leaveType = await prisma.leaveType.findFirst({
      where: { id: params.leaveTypeId, companyId: params.companyId },
    });
    if (!leaveType) throw new Error("Leave type not found");

    const year = from.getFullYear();
    const isUnpaid = !leaveType.isPaid || leaveType.code === "LWP";

    const balance = isUnpaid
      ? null
      : await repo.getLeaveBalance(employee.id, params.leaveTypeId, year);

    if (!isUnpaid && (!balance || balance.remaining <= 0)) {
      throw new Error("Insufficient leave balance for this leave type");
    }

    const overlapping = await prisma.leaveRequest.findMany({
      where: {
        employeeId: employee.id,
        status: { in: [LeaveRequestStatus.PENDING, LeaveRequestStatus.APPROVED] },
        fromDate: { lte: to },
        toDate: { gte: from },
      },
    });
    if (overlapping.length > 0) {
      throw new Error("Employee already has a leave request overlapping these dates");
    }

    const spanResult = await this.buildLeaveDaysAndEffectiveSpan({
      companyId: params.companyId,
      employeeId: employee.id,
      leaveTypeId: params.leaveTypeId,
      fromDate: from,
      toDate: to,
      durationType: params.durationType,
      durationValue,
      initialStatus: LeaveRequestStatus.PENDING,
    });

    const finalDurationValue = spanResult.effectiveDeductionDays;
    const totalRetroactiveDays = (spanResult.retroactiveAdjustments || []).reduce(
      (sum, adj) => sum + adj.bridgeDays.reduce((bSum, d) => bSum + d.deductDays, 0),
      0
    );
    const totalRequired = finalDurationValue + totalRetroactiveDays;

    if (!isUnpaid && balance && balance.remaining < totalRequired) {
      throw new Error(
        `Insufficient leave balance. Required: ${totalRequired} days (including ${totalRetroactiveDays} bridge days), Available: ${balance.remaining} days`
      );
    }

    return prisma.$transaction(async (tx) => {
      // 1. Process retroactive adjustments on earlier requests
      if (spanResult.retroactiveAdjustments && spanResult.retroactiveAdjustments.length > 0) {
        for (const adj of spanResult.retroactiveAdjustments) {
          const existingDays = await tx.leaveRequestDay.findMany({
            where: { leaveRequestId: adj.requestId },
          });
          const existingDayStrs = new Set(existingDays.map((d) => d.date.toISOString().slice(0, 10)));
          const newDaysToInsert = adj.bridgeDays.filter(
            (d) => !existingDayStrs.has(d.date.toISOString().slice(0, 10))
          );

          if (newDaysToInsert.length > 0) {
            await tx.leaveRequestDay.createMany({
              data: newDaysToInsert.map((d) => ({
                leaveRequestId: adj.requestId,
                date: d.date,
                isSandwichDay: true,
                deductDays: d.deductDays,
                status: d.status,
              })),
            });

            const prevReq = await tx.leaveRequest.findUnique({
              where: { id: adj.requestId },
              include: { leaveType: true },
            });

            if (prevReq) {
              const addedDeduct = newDaysToInsert.reduce((sum, d) => sum + d.deductDays, 0);
              const allDays = [...existingDays, ...newDaysToInsert].sort(
                (a, b) => a.date.getTime() - b.date.getTime()
              );
              await tx.leaveRequest.update({
                where: { id: adj.requestId },
                data: {
                  durationValue: { increment: addedDeduct },
                  toDate: allDays[allDays.length - 1]!.date,
                },
              });

              const isPrevPaid = prevReq.leaveType.isPaid && prevReq.leaveType.code !== "LWP";
              if (prevReq.status === LeaveRequestStatus.APPROVED && isPrevPaid && addedDeduct > 0) {
                const reqYear = prevReq.fromDate.getFullYear();
                const prevBalance = await tx.leaveBalance.findUnique({
                  where: {
                    employeeId_leaveTypeId_year: {
                      employeeId: prevReq.employeeId,
                      leaveTypeId: prevReq.leaveTypeId,
                      year: reqYear,
                    },
                  },
                });
                if (prevBalance) {
                  await tx.leaveBalance.update({
                    where: { id: prevBalance.id },
                    data: {
                      used: { increment: addedDeduct },
                      remaining: { decrement: addedDeduct },
                    },
                  });
                }
              }
            }
          }
        }
      }

      const leaveRequest = await tx.leaveRequest.create({
        data: {
          employeeId: employee.id,
          leaveTypeId: params.leaveTypeId,
          fromDate: from,
          toDate: to,
          durationType: params.durationType,
          durationValue: finalDurationValue,
          startTime: params.startTime || null,
          endTime: params.endTime || null,
          reason: params.reason?.trim() || null,
          status: LeaveRequestStatus.PENDING,
        },
        include: {
          leaveType: true,
          employee: true,
        },
      });

      if (spanResult.dayRecords.length > 0) {
        await tx.leaveRequestDay.createMany({
          data: spanResult.dayRecords.map((d) => ({
            leaveRequestId: leaveRequest.id,
            date: d.date,
            isSandwichDay: d.isSandwichDay,
            deductDays: d.deductDays,
            status: LeaveRequestStatus.PENDING,
          })),
        });
      }

      return leaveRequest;
    });
  }

  // =================== MARK LEAVE BY ADMIN ===================

  async markLeaveByAdmin(params: {
    employeeId: string;
    adminUserId: string;
    companyId: string;
    leaveTypeId: string;
    fromDate: string;
    toDate: string;
    durationType: LeaveDurationType;
    slot?: string;
    startTime?: string;
    endTime?: string;
    reason?: string;
  }) {
    const employee = await prisma.employeeProfile.findFirst({
      where: { id: params.employeeId, companyId: params.companyId },
    });
    if (!employee) throw new Error("Employee not found");

    const admin = await prisma.user.findFirst({
      where: { id: params.adminUserId, companyId: params.companyId },
      include: { employee: true },
    });
    const adminProfile = admin?.employee || (await prisma.employeeProfile.findFirst({ where: { id: params.adminUserId } }));
    const adminName = adminProfile?.displayName || admin?.email || "HR";
    const approverProfileId = adminProfile?.id || null;

    const from = parseDateToUTC(params.fromDate);
    const to = parseDateToUTC(params.toDate);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new Error("Invalid date");
    }
    if (from > to) throw new Error("fromDate cannot be after toDate");
    if (from.getUTCFullYear() !== to.getUTCFullYear()) {
      throw new Error("Leave cannot span across multiple years");
    }

    const holidaysInRange = await repo.getHolidaysForRange({
      companyId: params.companyId,
      from,
      to,
    });
    if (holidaysInRange.length > 0) {
      throw new Error("Leave cannot be applied on a company holiday.");
    }

    const durationValue = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const leaveType = await prisma.leaveType.findFirst({
      where: { id: params.leaveTypeId, companyId: params.companyId },
    });
    if (!leaveType) throw new Error("Leave type not found");

    const year = from.getFullYear();
    const isUnpaid = !leaveType.isPaid || leaveType.code === "LWP";

    const balance = isUnpaid
      ? null
      : await repo.getLeaveBalance(employee.id, params.leaveTypeId, year);

    const overlapping = await prisma.leaveRequest.findMany({
      where: {
        employeeId: employee.id,
        status: { in: [LeaveRequestStatus.PENDING, LeaveRequestStatus.APPROVED] },
        fromDate: { lte: to },
        toDate: { gte: from },
      },
    });
    if (overlapping.length > 0) {
      throw new Error("Employee already has a leave request overlapping these dates");
    }

    const spanResult = await this.buildLeaveDaysAndEffectiveSpan({
      companyId: params.companyId,
      employeeId: employee.id,
      leaveTypeId: params.leaveTypeId,
      fromDate: from,
      toDate: to,
      durationType: params.durationType,
      durationValue,
      initialStatus: LeaveRequestStatus.APPROVED,
    });

    const finalDurationValue = spanResult.effectiveDeductionDays;
    const totalRetroactiveDays = (spanResult.retroactiveAdjustments || []).reduce(
      (sum, adj) => sum + adj.bridgeDays.reduce((bSum, d) => bSum + d.deductDays, 0),
      0
    );
    const totalRequired = finalDurationValue + totalRetroactiveDays;

    if (!isUnpaid && balance && balance.remaining < totalRequired) {
      throw new Error(
        `Insufficient leave balance. Required: ${totalRequired} days (including ${totalRetroactiveDays} bridge days), Available: ${balance.remaining} days`
      );
    }

    const auditReason = params.reason?.trim()
      ? `[Marked by HR: ${adminName}] ${params.reason.trim()}`
      : `[Marked by HR: ${adminName}]`;

    return prisma.$transaction(async (tx) => {
      // Process retroactive adjustments on earlier requests
      if (spanResult.retroactiveAdjustments && spanResult.retroactiveAdjustments.length > 0) {
        for (const adj of spanResult.retroactiveAdjustments) {
          const existingDays = await tx.leaveRequestDay.findMany({
            where: { leaveRequestId: adj.requestId },
          });
          const existingDayStrs = new Set(existingDays.map((d) => d.date.toISOString().slice(0, 10)));
          const newDaysToInsert = adj.bridgeDays.filter(
            (d) => !existingDayStrs.has(d.date.toISOString().slice(0, 10))
          );

          if (newDaysToInsert.length > 0) {
            await tx.leaveRequestDay.createMany({
              data: newDaysToInsert.map((d) => ({
                leaveRequestId: adj.requestId,
                date: d.date,
                isSandwichDay: true,
                deductDays: d.deductDays,
                status: d.status,
              })),
            });

            const prevReq = await tx.leaveRequest.findUnique({
              where: { id: adj.requestId },
              include: { leaveType: true },
            });

            if (prevReq) {
              const addedDeduct = newDaysToInsert.reduce((sum, d) => sum + d.deductDays, 0);
              const allDays = [...existingDays, ...newDaysToInsert].sort(
                (a, b) => a.date.getTime() - b.date.getTime()
              );
              await tx.leaveRequest.update({
                where: { id: adj.requestId },
                data: {
                  durationValue: { increment: addedDeduct },
                  toDate: allDays[allDays.length - 1]!.date,
                },
              });

              const isPrevPaid = prevReq.leaveType.isPaid && prevReq.leaveType.code !== "LWP";
              if (prevReq.status === LeaveRequestStatus.APPROVED && isPrevPaid && addedDeduct > 0) {
                const reqYear = prevReq.fromDate.getFullYear();
                const prevBalance = await tx.leaveBalance.findUnique({
                  where: {
                    employeeId_leaveTypeId_year: {
                      employeeId: prevReq.employeeId,
                      leaveTypeId: prevReq.leaveTypeId,
                      year: reqYear,
                    },
                  },
                });
                if (prevBalance) {
                  await tx.leaveBalance.update({
                    where: { id: prevBalance.id },
                    data: {
                      used: { increment: addedDeduct },
                      remaining: { decrement: addedDeduct },
                    },
                  });
                }
              }
            }
          }
        }
      }

      const leaveRequest = await tx.leaveRequest.create({
        data: {
          employeeId: employee.id,
          leaveTypeId: params.leaveTypeId,
          fromDate: from,
          toDate: to,
          durationType: params.durationType,
          durationValue: finalDurationValue,
          startTime: params.startTime || null,
          endTime: params.endTime || null,
          reason: auditReason,
          status: LeaveRequestStatus.APPROVED,
          ...(approverProfileId ? { approvedById: approverProfileId } : {}),
        },
        include: {
          leaveType: true,
          employee: true,
        },
      });

      if (spanResult.dayRecords.length > 0) {
        await tx.leaveRequestDay.createMany({
          data: spanResult.dayRecords.map((d) => ({
            leaveRequestId: leaveRequest.id,
            date: d.date,
            isSandwichDay: d.isSandwichDay,
            deductDays: d.deductDays,
            status: LeaveRequestStatus.APPROVED,
          })),
        });
      }

      if (!isUnpaid && balance) {
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: {
            used: { increment: finalDurationValue },
            remaining: { decrement: finalDurationValue },
          },
        });
      }

      return leaveRequest;
    });
  }

  // =================== APPROVE / REJECT LEAVE ===================

  async approveLeave(params: {
    requestId: string;
    userId?: string;
    approverUserId?: string;
    companyId?: string;
  }) {
    const approverParam = params.approverUserId || params.userId;
    const approver = approverParam
      ? await prisma.employeeProfile.findFirst({
          where: { OR: [{ id: approverParam }, { userId: approverParam }] },
        })
      : null;
    const approverProfileId = approver?.id || null;
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: params.requestId },
      include: { leaveType: true, employee: true, days: true },
    });
    if (!leaveRequest) throw new Error("Leave request not found");
    if (leaveRequest.status !== LeaveRequestStatus.PENDING) {
      throw new Error(`Cannot approve leave in '${leaveRequest.status}' status`);
    }

    const year = leaveRequest.fromDate.getFullYear();
    const isUnpaid = !leaveRequest.leaveType.isPaid || leaveRequest.leaveType.code === "LWP";

    const balance = isUnpaid
      ? null
      : await repo.getLeaveBalance(leaveRequest.employeeId, leaveRequest.leaveTypeId, year);

    if (!isUnpaid && balance && balance.remaining < leaveRequest.durationValue) {
      throw new Error("Insufficient leave balance to approve this request");
    }

    return prisma.$transaction(async (tx) => {
      const updatedRequest = await tx.leaveRequest.update({
        where: { id: params.requestId },
        data: {
          status: LeaveRequestStatus.APPROVED,
          ...(approverProfileId ? { approvedById: approverProfileId } : {}),
        },
      });

      await tx.leaveRequestDay.updateMany({
        where: { leaveRequestId: params.requestId, status: LeaveRequestStatus.PENDING },
        data: { status: LeaveRequestStatus.APPROVED },
      });

      if (!isUnpaid && balance) {
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: {
            used: { increment: leaveRequest.durationValue },
            remaining: { decrement: leaveRequest.durationValue },
          },
        });
      }

      return updatedRequest;
    });
  }

  async rejectLeave(params: {
    requestId: string;
    userId?: string;
    approverUserId?: string;
    companyId?: string;
    reason?: string;
  }) {
    const approverParam = params.approverUserId || params.userId;
    const approver = approverParam
      ? await prisma.employeeProfile.findFirst({
          where: { OR: [{ id: approverParam }, { userId: approverParam }] },
        })
      : null;
    const approverProfileId = approver?.id || null;

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: params.requestId },
    });
    if (!leaveRequest) throw new Error("Leave request not found");
    if (leaveRequest.status !== LeaveRequestStatus.PENDING) {
      throw new Error(`Cannot reject leave in '${leaveRequest.status}' status`);
    }

    const reasonPrefix = params.reason ? `[Rejected by HR] ${params.reason}` : "[Rejected by HR]";

    return prisma.$transaction(async (tx) => {
      const updated = await tx.leaveRequest.update({
        where: { id: params.requestId },
        data: {
          status: LeaveRequestStatus.REJECTED,
          approvedById: approverProfileId,
          reason: leaveRequest.reason ? `${leaveRequest.reason} | ${reasonPrefix}` : reasonPrefix,
        },
      });

      await tx.leaveRequestDay.updateMany({
        where: { leaveRequestId: params.requestId },
        data: { status: LeaveRequestStatus.REJECTED },
      });

      return updated;
    });
  }

  async cancelLeaveRequest(
    requestIdOrParams: string | { requestId: string; userId: string; companyId: string; reason?: string },
    userId?: string,
    companyId?: string
  ) {
    const reqId = typeof requestIdOrParams === "string" ? requestIdOrParams : requestIdOrParams.requestId;
    const uId = typeof requestIdOrParams === "string" ? userId! : requestIdOrParams.userId;
    const cId = typeof requestIdOrParams === "string" ? companyId! : requestIdOrParams.companyId;
    const reason = typeof requestIdOrParams === "string" ? undefined : requestIdOrParams.reason;

    const employee = await this.resolveEmployee(uId, cId);
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: reqId },
      include: { days: true },
    });
    if (!leaveRequest) throw new Error("Leave request not found");
    if (leaveRequest.employeeId !== employee.id) {
      throw new Error("Unauthorized: cannot cancel another employee's request");
    }
    if (leaveRequest.status !== LeaveRequestStatus.PENDING) {
      throw new Error("Only PENDING leave requests can be cancelled by employee");
    }

    const cancelReason = reason ? `[Cancelled] ${reason}` : "[Cancelled by employee]";

    return prisma.$transaction(async (tx) => {
      const updated = await tx.leaveRequest.update({
        where: { id: reqId },
        data: {
          status: LeaveRequestStatus.CANCELLED,
          reason: leaveRequest.reason ? `${leaveRequest.reason} | ${cancelReason}` : cancelReason,
        },
      });

      await tx.leaveRequestDay.updateMany({
        where: { leaveRequestId: reqId },
        data: { status: LeaveRequestStatus.CANCELLED },
      });

      return updated;
    });
  }

  async hrCancelApprovedLeave(params: {
    requestId: string;
    adminUserId?: string;
    companyId?: string;
    reason?: string | null;
  }) {
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: params.requestId },
      include: { leaveType: true, employee: true, days: true },
    });
    if (!leaveRequest) throw new Error("Leave request not found");
    if (leaveRequest.status !== LeaveRequestStatus.APPROVED) {
      throw new Error("Only APPROVED leave requests can be cancelled via HR cancellation flow");
    }

    const isUnpaid = !leaveRequest.leaveType.isPaid || leaveRequest.leaveType.code === "LWP";
    const year = leaveRequest.fromDate.getFullYear();
    const balance = isUnpaid ? null : await repo.getLeaveBalance(leaveRequest.employeeId, leaveRequest.leaveTypeId, year);

    const hrCancelReason = params.reason ? `[Cancelled by HR] ${params.reason}` : "[Cancelled by HR]";

    return prisma.$transaction(async (tx) => {
      const updated = await tx.leaveRequest.update({
        where: { id: params.requestId },
        data: {
          status: LeaveRequestStatus.CANCELLED,
          reason: leaveRequest.reason ? `${leaveRequest.reason} | ${hrCancelReason}` : hrCancelReason,
        },
      });

      await tx.leaveRequestDay.updateMany({
        where: { leaveRequestId: params.requestId },
        data: { status: LeaveRequestStatus.CANCELLED },
      });

      if (!isUnpaid && balance) {
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: {
            used: { decrement: leaveRequest.durationValue },
            remaining: { increment: leaveRequest.durationValue },
          },
        });
      }

      return updated;
    });
  }

  async deleteLeaveRequest(params: {
    requestId: string;
    adminUserId: string;
    companyId: string;
  }) {
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: params.requestId },
      include: { leaveType: true, employee: true, days: true },
    });
    if (!leaveRequest) throw new Error("Leave request not found");

    const isApproved = leaveRequest.status === LeaveRequestStatus.APPROVED;
    const isUnpaid = !leaveRequest.leaveType.isPaid || leaveRequest.leaveType.code === "LWP";
    const year = leaveRequest.fromDate.getFullYear();

    let daysToRestore = 0;
    if (isApproved && !isUnpaid) {
      if (leaveRequest.days && leaveRequest.days.length > 0) {
        daysToRestore = leaveRequest.days
          .filter((d) => d.status === LeaveRequestStatus.APPROVED)
          .reduce((acc, d) => acc + d.deductDays, 0);
      } else {
        daysToRestore = leaveRequest.durationValue;
      }
    }

    return prisma.$transaction(async (tx) => {
      if (daysToRestore > 0) {
        const balance = await tx.leaveBalance.findUnique({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: leaveRequest.employeeId,
              leaveTypeId: leaveRequest.leaveTypeId,
              year,
            },
          },
        });

        if (balance) {
          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: {
              used: { decrement: daysToRestore },
              remaining: { increment: daysToRestore },
            },
          });
        }
      }

      await tx.leaveRequestDay.deleteMany({
        where: { leaveRequestId: params.requestId },
      });

      return tx.leaveRequest.delete({
        where: { id: params.requestId },
      });
    });
  }

  async deleteLeaveRequestDays(params: {
    requestId: string;
    dayIds: string[];
    adminUserId: string;
    companyId: string;
  }) {
    if (!params.dayIds || !Array.isArray(params.dayIds) || params.dayIds.length === 0) {
      throw new Error("No days specified for deletion");
    }

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: params.requestId },
      include: { leaveType: true, days: { orderBy: { date: "asc" } } },
    });
    if (!leaveRequest) throw new Error("Leave request not found");

    const daysToDelete = leaveRequest.days.filter((d) => params.dayIds.includes(d.id));
    if (daysToDelete.length === 0) {
      throw new Error("Specified days not found in this leave request");
    }

    const isPaid = leaveRequest.leaveType.isPaid && leaveRequest.leaveType.code !== "LWP";
    const year = leaveRequest.fromDate.getFullYear();

    let daysToRestore = 0;
    if (isPaid) {
      daysToRestore = daysToDelete
        .filter((d) => d.status === LeaveRequestStatus.APPROVED)
        .reduce((sum, d) => sum + d.deductDays, 0);
    }

    const remainingDays = leaveRequest.days.filter((d) => !params.dayIds.includes(d.id));

    return prisma.$transaction(async (tx) => {
      if (daysToRestore > 0) {
        const balance = await tx.leaveBalance.findUnique({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: leaveRequest.employeeId,
              leaveTypeId: leaveRequest.leaveTypeId,
              year,
            },
          },
        });

        if (balance) {
          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: {
              used: { decrement: daysToRestore },
              remaining: { increment: daysToRestore },
            },
          });
        }
      }

      await tx.leaveRequestDay.deleteMany({
        where: {
          id: { in: params.dayIds },
          leaveRequestId: params.requestId,
        },
      });

      if (remainingDays.length === 0) {
        await tx.leaveRequest.delete({
          where: { id: params.requestId },
        });
        return { deletedRequestId: params.requestId, remainingDaysCount: 0, revertedDays: daysToRestore };
      }

      const newDurationValue = remainingDays
        .filter((d) => d.status !== LeaveRequestStatus.REJECTED && d.status !== LeaveRequestStatus.CANCELLED)
        .reduce((sum, d) => sum + d.deductDays, 0);
      const newFromDate = remainingDays[0]!.date;
      const newToDate = remainingDays[remainingDays.length - 1]!.date;

      let newParentStatus = leaveRequest.status;
      const allResolved = remainingDays.every(
        (d) =>
          d.status === LeaveRequestStatus.APPROVED ||
          d.status === LeaveRequestStatus.REJECTED ||
          d.status === LeaveRequestStatus.CANCELLED
      );
      if (allResolved) {
        const hasApproved = remainingDays.some((d) => d.status === LeaveRequestStatus.APPROVED);
        newParentStatus = hasApproved ? LeaveRequestStatus.APPROVED : LeaveRequestStatus.REJECTED;
      }

      const updated = await tx.leaveRequest.update({
        where: { id: params.requestId },
        data: {
          durationValue: newDurationValue,
          fromDate: newFromDate,
          toDate: newToDate,
          status: newParentStatus,
        },
        include: { days: { orderBy: { date: "asc" } }, leaveType: true, employee: true },
      });

      return { ...updated, revertedDays: daysToRestore };
    });
  }

  // =================== ZOHO-STYLE BALANCE CORRECTION ===================

  async adjustLeaveAllocation(params: {
    employeeId: string;
    adminUserId: string;
    companyId: string;
    leaveTypeId: string;
    newBalance?: number;
    allocated?: number;
    year?: number;
    reason?: string;
  }) {
    if (params.newBalance !== undefined && (isNaN(params.newBalance) || params.newBalance < 0)) {
      throw new Error("New balance must be greater than or equal to 0");
    }
    if (params.allocated !== undefined && (isNaN(params.allocated) || params.allocated < 0)) {
      throw new Error("Allocated days must be greater than or equal to 0");
    }

    const employee = await prisma.employeeProfile.findFirst({
      where: { id: params.employeeId, companyId: params.companyId },
      include: { user: true },
    });
    if (!employee) throw new Error("Employee not found");

    const admin = await prisma.user.findFirst({
      where: { id: params.adminUserId, companyId: params.companyId },
      include: { employee: true },
    });
    const adminProfile = admin?.employee || (await prisma.employeeProfile.findFirst({ where: { id: params.adminUserId } }));
    const adminName = adminProfile?.displayName || admin?.email || "HR";
    const approverProfileId = adminProfile?.id || null;
    const targetYear = params.year || new Date().getFullYear();

    const existingBalance = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: params.employeeId,
          leaveTypeId: params.leaveTypeId,
          year: targetYear,
        },
      },
      include: { leaveType: true },
    });

    return prisma.$transaction(async (tx) => {
      let balance;
      let auditReason: string;

      if (params.newBalance !== undefined) {
        const targetRemaining = Number(params.newBalance);
        if (existingBalance) {
          const used = existingBalance.used;
          const carriedForward = existingBalance.carriedForward;
          // Calculate underlying allocation so remaining = targetRemaining
          // remaining = allocated + carriedForward - used => allocated = remaining + used - carriedForward
          const calculatedAllocated = targetRemaining + used - carriedForward;

          balance = await tx.leaveBalance.update({
            where: { id: existingBalance.id },
            data: {
              allocated: calculatedAllocated,
              remaining: targetRemaining,
            },
            include: { leaveType: true },
          });

          auditReason = params.reason?.trim()
            ? `[Allocated by HR: ${adminName}] Balance corrected from ${existingBalance.remaining} to ${targetRemaining}: ${params.reason.trim()}`
            : `[Allocated by HR: ${adminName}] Balance corrected from ${existingBalance.remaining} to ${targetRemaining}`;
        } else {
          const calculatedAllocated = targetRemaining;
          balance = await tx.leaveBalance.create({
            data: {
              employeeId: params.employeeId,
              leaveTypeId: params.leaveTypeId,
              year: targetYear,
              allocated: calculatedAllocated,
              used: 0,
              carriedForward: 0,
              remaining: targetRemaining,
            },
            include: { leaveType: true },
          });

          auditReason = params.reason?.trim()
            ? `[Allocated by HR: ${adminName}] Balance granted ${targetRemaining} days: ${params.reason.trim()}`
            : `[Allocated by HR: ${adminName}] Balance granted ${targetRemaining} days`;
        }
      } else if (params.allocated !== undefined) {
        if (existingBalance) {
          const newRemaining = Number(params.allocated) - existingBalance.used + existingBalance.carriedForward;
          if (newRemaining < 0) {
            throw new Error(`Allocated days (${params.allocated}) cannot be less than already used days (${existingBalance.used})`);
          }

          balance = await tx.leaveBalance.update({
            where: { id: existingBalance.id },
            data: {
              allocated: Number(params.allocated),
              remaining: newRemaining,
            },
            include: { leaveType: true },
          });
        } else {
          balance = await tx.leaveBalance.create({
            data: {
              employeeId: params.employeeId,
              leaveTypeId: params.leaveTypeId,
              year: targetYear,
              allocated: Number(params.allocated),
              used: 0,
              carriedForward: 0,
              remaining: Number(params.allocated),
            },
            include: { leaveType: true },
          });
        }

        auditReason = params.reason?.trim()
          ? `[Allocated by HR: ${adminName}] ${params.reason.trim()}`
          : `[Allocated by HR: ${adminName}]`;
      } else {
        balance = existingBalance;
        auditReason = `[Allocated by HR: ${adminName}]`;
      }

      await tx.employeeLeaveOverride.upsert({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: params.employeeId,
            leaveTypeId: params.leaveTypeId,
            year: targetYear,
          },
        },
        update: {
          reason: auditReason,
          extraAllocation: balance ? balance.allocated : 0,
        },
        create: {
          employeeId: params.employeeId,
          leaveTypeId: params.leaveTypeId,
          year: targetYear,
          extraAllocation: balance ? balance.allocated : 0,
          reason: auditReason,
        },
      });

      return balance;
    });
  }

  // =================== BULK ALLOCATE ===================

  async bulkAllocateLeaves(params: {
    companyId: string;
    adminUserId: string;
    leaveTypeId: string;
    year: number;
    allocated: number;
    scope: "ALL_ACTIVE" | "BY_EMPLOYMENT_TYPE" | "SPECIFIC_EMPLOYEES";
    isProbation?: boolean;
    employeeIds?: string[];
    reason?: string;
  }) {
    if (!params.leaveTypeId) throw new Error("leaveTypeId is required");
    if (!params.year || params.year < 2000) throw new Error("Valid year is required");
    if (params.allocated === undefined || params.allocated < 0) {
      throw new Error("Allocated days must be greater than or equal to 0");
    }

    const admin = await prisma.user.findFirst({
      where: { id: params.adminUserId, companyId: params.companyId },
      include: { employee: true },
    });
    const adminProfile = admin?.employee || (await prisma.employeeProfile.findFirst({ where: { id: params.adminUserId } }));
    const adminName = adminProfile?.displayName || admin?.email || "HR";
    const approverProfileId = adminProfile?.id || null;

    const whereClause: any = { companyId: params.companyId, isActive: true };
    if (params.scope === "BY_EMPLOYMENT_TYPE") {
      if (params.isProbation === undefined) throw new Error("isProbation is required when scope is BY_EMPLOYMENT_TYPE");
      whereClause.isProbation = Boolean(params.isProbation);
    } else if (params.scope === "SPECIFIC_EMPLOYEES") {
      if (!params.employeeIds || params.employeeIds.length === 0) throw new Error("employeeIds array is required");
      whereClause.id = { in: params.employeeIds };
    }

    const matchedEmployees = await prisma.employeeProfile.findMany({
      where: whereClause,
      select: { id: true, displayName: true, employeeCode: true },
    });

    if (matchedEmployees.length === 0) {
      return { successCount: 0, skippedCount: 0, totalMatched: 0, errors: [] };
    }

    const auditReason = params.reason?.trim()
      ? `[Bulk Allocated by HR: ${adminName}] ${params.reason.trim()}`
      : `[Bulk Allocated by HR: ${adminName}]`;

    let successCount = 0;
    let skippedCount = 0;
    const errors: { employeeId: string; reason: string }[] = [];

    for (const emp of matchedEmployees) {
      try {
        const existing = await prisma.leaveBalance.findUnique({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: emp.id,
              leaveTypeId: params.leaveTypeId,
              year: params.year,
            },
          },
        });

        if (existing) {
          const newRemaining = params.allocated - existing.used + existing.carriedForward;
          if (newRemaining < 0) {
            skippedCount++;
            errors.push({ employeeId: emp.id, reason: `Allocation (${params.allocated}) less than used (${existing.used})` });
            continue;
          }

          await prisma.leaveBalance.update({
            where: { id: existing.id },
            data: { allocated: params.allocated, remaining: newRemaining },
          });
        } else {
          await prisma.leaveBalance.create({
            data: {
              employeeId: emp.id,
              leaveTypeId: params.leaveTypeId,
              year: params.year,
              allocated: params.allocated,
              used: 0,
              carriedForward: 0,
              remaining: params.allocated,
            },
          });
        }

        await prisma.employeeLeaveOverride.upsert({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: emp.id,
              leaveTypeId: params.leaveTypeId,
              year: params.year,
            },
          },
          update: { reason: auditReason, extraAllocation: params.allocated },
          create: {
            employeeId: emp.id,
            leaveTypeId: params.leaveTypeId,
            year: params.year,
            extraAllocation: params.allocated,
            reason: auditReason,
          },
        });

        successCount++;
      } catch (err: any) {
        skippedCount++;
        errors.push({ employeeId: emp.id, reason: err.message });
      }
    }

    return { successCount, skippedCount, totalMatched: matchedEmployees.length, errors };
  }

  // =================== YEAR-END ROLLOVER ===================

  async runYearEndRollover(params: {
    companyId: string;
    adminUserId: string;
    fromYear: number;
    toYear: number;
    reason?: string;
  }) {
    const { companyId, fromYear, toYear, reason } = params;
    if (toYear <= fromYear) throw new Error("toYear must be greater than fromYear");

    const admin = await prisma.user.findFirst({
      where: { id: params.adminUserId, companyId },
      include: { employee: true },
    });
    const adminName = admin?.employee?.displayName || admin?.email || "HR";

    const policies = await prisma.leavePolicy.findMany({
      where: { companyId, year: fromYear },
    });
    const policyMap = new Map<string, (typeof policies)[0]>();
    for (const p of policies) policyMap.set(p.leaveTypeId, p);

    const fromBalances = await prisma.leaveBalance.findMany({
      where: { employee: { companyId, isActive: true }, year: fromYear },
    });

    const auditReason = reason?.trim()
      ? `[Rollover by HR: ${adminName}] ${reason.trim()}`
      : `[Rollover by HR: ${adminName}] Year-End Rollover ${fromYear} -> ${toYear}`;

    let processedCount = 0;

    for (const b of fromBalances) {
      const policy = policyMap.get(b.leaveTypeId);
      let carryForwardDays = 0;

      if (policy && policy.allowCarryForward && b.remaining > 0) {
        carryForwardDays = b.remaining;
        if (policy.maxCarryForward != null && policy.maxCarryForward >= 0) {
          carryForwardDays = Math.min(carryForwardDays, policy.maxCarryForward);
        }
      }

      await prisma.leaveBalance.upsert({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: b.employeeId,
            leaveTypeId: b.leaveTypeId,
            year: toYear,
          },
        },
        update: {
          carriedForward: carryForwardDays,
          remaining: carryForwardDays,
        },
        create: {
          employeeId: b.employeeId,
          leaveTypeId: b.leaveTypeId,
          year: toYear,
          allocated: 0,
          used: 0,
          carriedForward: carryForwardDays,
          remaining: carryForwardDays,
        },
      });

      await prisma.employeeLeaveOverride.upsert({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: b.employeeId,
            leaveTypeId: b.leaveTypeId,
            year: toYear,
          },
        },
        update: { reason: auditReason },
        create: {
          employeeId: b.employeeId,
          leaveTypeId: b.leaveTypeId,
          year: toYear,
          extraAllocation: 0,
          reason: auditReason,
        },
      });

      processedCount++;
    }

    return { success: true, successCount: processedCount, processedCount, fromYear, toYear };
  }

  // =================== LWP REPORT ===================

  async getLwpReport(params: {
    companyId: string;
    year: number;
    month?: number;
    departmentId?: string;
  }) {
    const { companyId, year, month, departmentId } = params;

    let dateFilter: any = {};
    if (month) {
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
      dateFilter = { gte: start, lte: end };
    } else {
      const start = new Date(Date.UTC(year, 0, 1));
      const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
      dateFilter = { gte: start, lte: end };
    }

    const employeeWhere: any = { companyId, isActive: true };
    if (departmentId) employeeWhere.departmentId = departmentId;

    const employees = await prisma.employeeProfile.findMany({
      where: employeeWhere,
      include: {
        department: true,
        designation: true,
        leaveRequests: {
          where: {
            status: LeaveRequestStatus.APPROVED,
            leaveType: { OR: [{ isPaid: false }, { code: "LWP" }] },
            fromDate: dateFilter,
          },
          include: { leaveType: true, days: true },
        },
      },
      orderBy: { displayName: "asc" },
    });

    const report = employees.map((emp) => {
      let totalLwpDays = 0;
      for (const req of emp.leaveRequests) {
        if (req.days && req.days.length > 0) {
          totalLwpDays += req.days
            .filter((d) => d.status === LeaveRequestStatus.APPROVED)
            .reduce((acc, d) => acc + d.deductDays, 0);
        } else {
          totalLwpDays += req.durationValue;
        }
      }

      return {
        employeeId: emp.id,
        displayName: emp.displayName,
        employeeCode: emp.employeeCode,
        department: emp.department?.name || "N/A",
        designation: emp.designation?.name || "N/A",
        lwpDays: totalLwpDays,
        requestsCount: emp.leaveRequests.length,
      };
    });

    return { year, month: month || null, totalEmployees: report.length, data: report };
  }

  // =================== DAY BREAKDOWN & EXEMPTIONS ===================

  async toggleSandwichBridgeDayExemption(params: {
    requestId?: string;
    dayId?: string;
    leaveRequestDayId?: string;
    adminUserId?: string;
    userId?: string;
    companyId?: string;
    isExempted?: boolean;
    reason?: string;
  }) {
    const dayId = params.leaveRequestDayId || params.dayId;
    if (!dayId) throw new Error("Day ID is required");

    const day = await prisma.leaveRequestDay.findUnique({
      where: { id: dayId },
      include: { leaveRequest: { include: { leaveType: true, employee: true } } },
    });
    if (!day) throw new Error("Leave request day not found");

    const leaveRequest = day.leaveRequest;
    const isPaid = leaveRequest.leaveType.isPaid && leaveRequest.leaveType.code !== "LWP";
    const year = day.date.getFullYear();

    const isExempt = params.isExempted ?? true;
    const previousDeduct = day.deductDays;
    const newDeduct = isExempt ? 0 : 1;
    const diff = newDeduct - previousDeduct;

    return prisma.$transaction(async (tx) => {
      const updatedDay = await tx.leaveRequestDay.update({
        where: { id: dayId },
        data: {
          deductDays: newDeduct,
          status: isExempt ? LeaveRequestStatus.CANCELLED : LeaveRequestStatus.APPROVED,
        },
      });

      if (diff !== 0 && isPaid && leaveRequest.status === LeaveRequestStatus.APPROVED) {
        const balance = await tx.leaveBalance.findUnique({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: leaveRequest.employeeId,
              leaveTypeId: leaveRequest.leaveTypeId,
              year,
            },
          },
        });

        if (balance) {
          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: {
              used: { increment: diff },
              remaining: { decrement: diff },
            },
          });
        }
      }

      return updatedDay;
    });
  }

  async updateLeaveRequestDayStatus(params: {
    requestId?: string;
    dayId?: string;
    leaveRequestDayId?: string;
    adminUserId?: string;
    userId?: string;
    companyId?: string;
    status: LeaveRequestStatus;
    reason?: string;
  }) {
    const dayId = params.leaveRequestDayId || params.dayId;
    if (!dayId) throw new Error("Day ID is required");

    const day = await prisma.leaveRequestDay.findUnique({
      where: { id: dayId },
      include: {
        leaveRequest: {
          include: {
            leaveType: true,
            employee: true,
            days: true,
          },
        },
      },
    });
    if (!day) throw new Error("Leave request day not found");

    const leaveRequest = day.leaveRequest;
    const oldStatus = day.status;
    const newStatus = params.status;

    if (oldStatus === newStatus) {
      return prisma.leaveRequest.findUnique({
        where: { id: leaveRequest.id },
        include: { days: { orderBy: { date: "asc" } }, leaveType: true, employee: true },
      });
    }

    const isPaid = leaveRequest.leaveType.isPaid && leaveRequest.leaveType.code !== "LWP";
    const year = day.date.getFullYear();

    let balanceDelta = 0;
    if (isPaid) {
      if (newStatus === LeaveRequestStatus.APPROVED && oldStatus !== LeaveRequestStatus.APPROVED) {
        balanceDelta = day.deductDays;
      } else if (oldStatus === LeaveRequestStatus.APPROVED && newStatus !== LeaveRequestStatus.APPROVED) {
        balanceDelta = -day.deductDays;
      }
    }

    const approverParam = params.adminUserId || params.userId;
    const approver = approverParam
      ? await prisma.employeeProfile.findFirst({
          where: { OR: [{ id: approverParam }, { userId: approverParam }] },
        })
      : null;
    const approverProfileId = approver?.id || null;

    return prisma.$transaction(async (tx) => {
      await tx.leaveRequestDay.update({
        where: { id: dayId },
        data: { status: newStatus },
      });

      if (balanceDelta !== 0) {
        const balance = await tx.leaveBalance.findUnique({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: leaveRequest.employeeId,
              leaveTypeId: leaveRequest.leaveTypeId,
              year,
            },
          },
        });

        if (balance) {
          if (balanceDelta > 0 && balance.remaining < balanceDelta) {
            throw new Error("Insufficient leave balance to approve this day");
          }
          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: {
              used: { increment: balanceDelta },
              remaining: { decrement: balanceDelta },
            },
          });
        }
      }

      const allDays = await tx.leaveRequestDay.findMany({
        where: { leaveRequestId: leaveRequest.id },
        orderBy: { date: "asc" },
      });

      const approvedDays = allDays.filter((d) => d.status === LeaveRequestStatus.APPROVED);
      const pendingDays = allDays.filter((d) => d.status === LeaveRequestStatus.PENDING);

      let parentStatus: LeaveRequestStatus = LeaveRequestStatus.PENDING;
      if (pendingDays.length === 0) {
        if (approvedDays.length > 0) {
          parentStatus = LeaveRequestStatus.APPROVED;
        } else {
          parentStatus = LeaveRequestStatus.REJECTED;
        }
      } else {
        parentStatus = LeaveRequestStatus.PENDING;
      }

      const activeDays = allDays.filter(
        (d) => d.status !== LeaveRequestStatus.REJECTED && d.status !== LeaveRequestStatus.CANCELLED
      );
      const newDurationValue = activeDays.reduce((sum, d) => sum + d.deductDays, 0);

      const updatedRequest = await tx.leaveRequest.update({
        where: { id: leaveRequest.id },
        data: {
          status: parentStatus,
          durationValue: newDurationValue,
          ...(approverProfileId && parentStatus === LeaveRequestStatus.APPROVED ? { approvedById: approverProfileId } : {}),
        },
        include: { days: { orderBy: { date: "asc" } }, leaveType: true, employee: true },
      });

      return updatedRequest;
    });
  }

  // =================== BALANCES & LISTINGS ===================

  async getLeaveBalancesByEmployeeId(employeeId: string, companyId: string, year: number) {
    return repo.getLeaveBalances(employeeId, year);
  }

  async getMyLeaveBalances(userId: string, companyId: string, year: number) {
    const employee = await this.resolveEmployee(userId, companyId);
    return repo.getLeaveBalances(employee.id, year);
  }

  async listEmployeeLeaveRequests(employeeId: string, companyId: string) {
    return repo.listLeaveRequestsForEmployee(employeeId);
  }

  async listMyLeaveRequests(userId: string, companyId: string) {
    const employee = await this.resolveEmployee(userId, companyId);
    return repo.listLeaveRequestsForEmployee(employee.id);
  }

  async listPendingLeaveRequests(companyId: string) {
    return repo.listPendingLeaveRequests(companyId);
  }

  async listRecentLeaveRequests(params: {
    companyId: string;
    status?: LeaveRequestStatus | string;
    sinceDate?: Date;
    days?: number;
  }) {
    const statusEnum = (params.status as LeaveRequestStatus) || LeaveRequestStatus.APPROVED;
    const sinceDate = params.sinceDate || new Date(Date.now() - (params.days || 7) * 24 * 60 * 60 * 1000);
    return repo.listRecentLeaveRequests(params.companyId, statusEnum, sinceDate);
  }

  async upsertEmployeeLeaveOverride(params: {
    companyId: string;
    employeeId: string;
    leaveTypeId: string;
    year: number;
    extraAllocation?: number | null;
    allowEncashment?: boolean | null;
    reason?: string | null;
  }) {
    return repo.upsertEmployeeLeaveOverride(params);
  }

  // =================== HOLIDAYS ===================

  async createHoliday(params: {
    companyId: string;
    name: string;
    date: Date;
  }) {
    return repo.createHoliday(params);
  }

  async listHolidays(companyId: string) {
    return repo.listHolidays(companyId);
  }

  async deleteHoliday(holidayId: string) {
    return repo.deleteHoliday(holidayId);
  }

  // =================== TODAY LEAVES ===================

  async getTodayLeaves(params: {
    userId: string;
    companyId: string;
    scope: "team" | "hierarchy" | "company";
    date: Date;
  }) {
    const employee = await repo.getEmployeeByUserId(params.userId);
    if (!employee) throw new Error("Employee not found");

    let employeeIds: string[] = [];

    switch (params.scope) {
      case "team":
        if (!employee.teamId) {
          return { date: params.date, scope: "team", employees: [] };
        }
        employeeIds = (
          await repo.getTeamEmployeeIds(employee.teamId)
        ).map((e) => e.id);
        break;
      case "hierarchy":
        employeeIds = (
          await repo.getHierarchyEmployeeIds(employee.id)
        ).map((e) => e.id);
        break;
      case "company":
        employeeIds = (
          await repo.getCompanyEmployeeIds(params.companyId)
        ).map((e) => e.id);
        break;
    }

    const leaves = await repo.findApprovedLeavesForEmployees({
      employeeIds,
      date: params.date,
    });

    return {
      date: params.date.toISOString().slice(0, 10),
      scope: params.scope,
      employees: leaves.map((l) => ({
        employeeId: l.employee.id,
        displayName: l.employee.displayName,
        designation: l.employee.designation.name,
        team: l.employee.team?.name ?? null,
        leaveType: l.leaveType.name,
        durationType: l.durationType,
        startTime: (l as any).startTime ?? null,
        endTime: (l as any).endTime ?? null,
      })),
    };
  }

  // =================== ENCASHMENTS ===================

  async requestLeaveEncashment(params: {
    userId: string;
    companyId: string;
    leaveTypeId: string;
    year: number;
    days: number;
    reason?: string;
  }) {
    const employee = await this.resolveEmployee(params.userId, params.companyId);
    return repo.createLeaveEncashment({
      employeeId: employee.id,
      leaveTypeId: params.leaveTypeId,
      year: params.year,
      days: params.days,
    });
  }

  async approveLeaveEncashment(paramsOrId: string | { encashmentId: string; approverUserId?: string; companyId?: string }) {
    const encId = typeof paramsOrId === "string" ? paramsOrId : paramsOrId.encashmentId;
    return prisma.$transaction(async (tx) => {
      return repo.updateLeaveEncashmentStatus(
        tx,
        encId,
        LeaveEncashmentStatus.APPROVED
      );
    });
  }

  async rejectLeaveEncashment(paramsOrId: string | { encashmentId: string; approverUserId?: string; companyId?: string; reason?: string }) {
    const encId = typeof paramsOrId === "string" ? paramsOrId : paramsOrId.encashmentId;
    return prisma.$transaction(async (tx) => {
      return repo.updateLeaveEncashmentStatus(
        tx,
        encId,
        LeaveEncashmentStatus.REJECTED
      );
    });
  }

  // =================== SANDWICH & DAY CALCULATION ===================

  async buildLeaveDaysAndEffectiveSpan(params: {
    companyId: string;
    employeeId: string;
    leaveTypeId: string;
    fromDate: Date;
    toDate: Date;
    durationType: LeaveDurationType;
    durationValue: number;
    initialStatus: LeaveRequestStatus;
  }): Promise<{
    dayRecords: Array<{
      date: Date;
      isSandwichDay: boolean;
      deductDays: number;
      status: LeaveRequestStatus;
    }>;
    effectiveDeductionDays: number;
    sandwichBridgeApplied: boolean;
    retroactiveAdjustments: Array<{
      requestId: string;
      bridgeDays: Array<{
        date: Date;
        isSandwichDay: boolean;
        deductDays: number;
        status: LeaveRequestStatus;
      }>;
    }>;
  }> {
    const {
      companyId,
      employeeId,
      fromDate,
      toDate,
      durationType,
      durationValue,
      initialStatus,
    } = params;

    if (durationType !== LeaveDurationType.FULL_DAY) {
      return {
        dayRecords: [
          {
            date: new Date(fromDate),
            isSandwichDay: false,
            deductDays: durationValue,
            status: initialStatus,
          },
        ],
        effectiveDeductionDays: durationValue,
        sandwichBridgeApplied: false,
        retroactiveAdjustments: [],
      };
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { workWeekDays: true, sandwichRuleEnabled: true },
    });

    const workWeekDays = company?.workWeekDays ?? 5;
    const isSandwichPolicyOn = company?.sandwichRuleEnabled ?? false;

    const isWeekendDay = (d: Date) => {
      const day = d.getUTCDay();
      return workWeekDays === 6 ? day === 0 : day === 0 || day === 6;
    };

    const scanWindowStart = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate()));
    scanWindowStart.setUTCDate(scanWindowStart.getUTCDate() - 15);
    const scanWindowEnd = new Date(Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), toDate.getUTCDate()));
    scanWindowEnd.setUTCDate(scanWindowEnd.getUTCDate() + 15);

    const [holidays, existingLeaves, attendanceDays] = await Promise.all([
      repo.getHolidaysForRange({
        companyId,
        from: scanWindowStart,
        to: scanWindowEnd,
      }),
      prisma.leaveRequest.findMany({
        where: {
          employeeId,
          status: { in: [LeaveRequestStatus.PENDING, LeaveRequestStatus.APPROVED] },
          fromDate: { lte: scanWindowEnd },
          toDate: { gte: scanWindowStart },
        },
        include: { days: true },
      }),
      prisma.attendanceDay.findMany({
        where: {
          employeeId,
          date: { gte: scanWindowStart, lte: scanWindowEnd },
        },
      }),
    ]);

    const holidaySet = new Set(holidays.map((h) => h.date.toISOString().slice(0, 10)));
    const isHolidayDay = (d: Date) => holidaySet.has(d.toISOString().slice(0, 10));
    const isNonWorkingDay = (d: Date) => isWeekendDay(d) || isHolidayDay(d);

    const attendanceMap = new Map<string, { totalMinutes: number; status: string }>();
    for (const att of attendanceDays) {
      attendanceMap.set(att.date.toISOString().slice(0, 10), {
        totalMinutes: att.totalMinutes,
        status: att.status,
      });
    }

    const hasWorkingTimeOnDate = (d: Date) => {
      const dStr = d.toISOString().slice(0, 10);
      const att = attendanceMap.get(dStr);
      if (att && (att.totalMinutes > 0 || att.status === "PRESENT" || att.status === "PARTIAL")) {
        return true;
      }
      return false;
    };

    const existingLeaveDates = new Set<string>();
    for (const req of existingLeaves) {
      if (req.days && req.days.length > 0) {
        req.days.forEach((d) => {
          if (d.status !== LeaveRequestStatus.REJECTED && d.status !== LeaveRequestStatus.CANCELLED) {
            existingLeaveDates.add(d.date.toISOString().slice(0, 10));
          }
        });
      } else {
        const cur = new Date(Date.UTC(req.fromDate.getUTCFullYear(), req.fromDate.getUTCMonth(), req.fromDate.getUTCDate()));
        const end = new Date(Date.UTC(req.toDate.getUTCFullYear(), req.toDate.getUTCMonth(), req.toDate.getUTCDate()));
        while (cur <= end) {
          existingLeaveDates.add(cur.toISOString().slice(0, 10));
          cur.setUTCDate(cur.getUTCDate() + 1);
        }
      }
    }

    const dayRecords: Array<{
      date: Date;
      isSandwichDay: boolean;
      deductDays: number;
      status: LeaveRequestStatus;
    }> = [];

    const cur = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate()));
    const rangeEnd = new Date(Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), toDate.getUTCDate()));

    if (!isSandwichPolicyOn) {
      while (cur <= rangeEnd) {
        if (!isNonWorkingDay(cur)) {
          dayRecords.push({
            date: new Date(cur),
            isSandwichDay: false,
            deductDays: 1,
            status: initialStatus,
          });
        }
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
      return {
        dayRecords,
        effectiveDeductionDays: dayRecords.length,
        sandwichBridgeApplied: false,
        retroactiveAdjustments: [],
      };
    }

    while (cur <= rangeEnd) {
      const isSandwich = isNonWorkingDay(cur);
      dayRecords.push({
        date: new Date(cur),
        isSandwichDay: isSandwich,
        deductDays: 1,
        status: initialStatus,
      });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    let sandwichBridgeApplied = false;
    const retroactiveAdjustments: Array<{
      requestId: string;
      bridgeDays: typeof dayRecords;
    }> = [];

    // Backward Scan
    const backCursor = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate()));
    backCursor.setUTCDate(backCursor.getUTCDate() - 1);
    const backwardBridgeDays: typeof dayRecords = [];
    let backwardBrokenByWork = false;

    while (isNonWorkingDay(backCursor)) {
      if (hasWorkingTimeOnDate(backCursor)) {
        backwardBrokenByWork = true;
        break;
      }
      backwardBridgeDays.unshift({
        date: new Date(backCursor),
        isSandwichDay: true,
        deductDays: 1,
        status: initialStatus,
      });
      backCursor.setUTCDate(backCursor.getUTCDate() - 1);
    }

    const backDateStr = backCursor.toISOString().slice(0, 10);
    if (!backwardBrokenByWork && backwardBridgeDays.length > 0 && existingLeaveDates.has(backDateStr)) {
      const prevRequest = existingLeaves.find((req) => {
        if (req.days && req.days.length > 0) {
          return req.days.some(
            (d) =>
              d.date.toISOString().slice(0, 10) === backDateStr &&
              d.status !== LeaveRequestStatus.REJECTED &&
              d.status !== LeaveRequestStatus.CANCELLED
          );
        }
        const fStr = req.fromDate.toISOString().slice(0, 10);
        const tStr = req.toDate.toISOString().slice(0, 10);
        return backDateStr >= fStr && backDateStr <= tStr;
      });

      if (prevRequest) {
        retroactiveAdjustments.push({
          requestId: prevRequest.id,
          bridgeDays: backwardBridgeDays.map((d) => ({
            ...d,
            status: prevRequest.status,
          })),
        });
        sandwichBridgeApplied = true;
      } else {
        dayRecords.unshift(...backwardBridgeDays);
        sandwichBridgeApplied = true;
      }
    }

    // Forward Scan
    const forwardCursor = new Date(Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), toDate.getUTCDate()));
    forwardCursor.setUTCDate(forwardCursor.getUTCDate() + 1);
    const forwardBridgeDays: typeof dayRecords = [];
    let forwardBrokenByWork = false;

    while (isNonWorkingDay(forwardCursor)) {
      if (hasWorkingTimeOnDate(forwardCursor)) {
        forwardBrokenByWork = true;
        break;
      }
      forwardBridgeDays.push({
        date: new Date(forwardCursor),
        isSandwichDay: true,
        deductDays: 1,
        status: initialStatus,
      });
      forwardCursor.setUTCDate(forwardCursor.getUTCDate() + 1);
    }

    const forwardDateStr = forwardCursor.toISOString().slice(0, 10);
    if (!forwardBrokenByWork && forwardBridgeDays.length > 0 && existingLeaveDates.has(forwardDateStr)) {
      dayRecords.push(...forwardBridgeDays);
      sandwichBridgeApplied = true;
    }

    return {
      dayRecords,
      effectiveDeductionDays: dayRecords.length,
      sandwichBridgeApplied,
      retroactiveAdjustments,
    };
  }

  // =================== PRIVATE HELPERS ===================

  private async resolveEmployee(userId: string, companyId: string) {
    const employee = await repo.getEmployeeByUserId(userId);
    if (!employee) throw new Error("Employee profile not found");
    if (employee.companyId !== companyId) {
      throw new Error("Employee does not belong to this company");
    }
    return employee;
  }
}

export const leaveService = new LeaveService();
