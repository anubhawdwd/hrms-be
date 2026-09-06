// tests/notifications.test.ts
import http from "http";
import { io as Client, Socket as ClientSocket } from "socket.io-client";
import jwt from "jsonwebtoken";
import { prisma } from "../src/config/prisma.js";
import { JWT_ACCESS_SECRET } from "../src/config/auth.js";
import { initSocketServer } from "../src/socket/index.js";
import { LeaveService } from "../src/modules/leave/service.js";
import { EmployeeService } from "../src/modules/employee/service.js";
import { NotificationService } from "../src/modules/notification/service.js";
import { AuthProvider, UserRole, NotificationType, LeaveDurationType, LeaveApprovalWorkflow } from "../src/generated/prisma/enums.js";
import { createIsolatedTestCompany } from "./helpers/isolated-test-context.js";

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`[FAIL] ${msg}`);
  console.log(`    ✔ ${msg}`);
}

export async function runNotificationTests() {
  console.log("\n  [MODULE] NOTIF-01-06 Real-Time Persistent Notifications & Sync Suite (Isolated)");
  const leaveService = new LeaveService();
  const employeeService = new EmployeeService();
  const notifService = new NotificationService();

  const ctx = await createIsolatedTestCompany({
    setupStandardLeaveTypes: true,
  });

  try {
    const companyId = ctx.company.id;
    const plType = ctx.leaveTypes["PL"];

    // Update company to TWO_STEP leave approval workflow
    await prisma.company.update({
      where: { id: companyId },
      data: { leaveApprovalWorkflow: LeaveApprovalWorkflow.TWO_STEP },
    });

    // 1. Create Manager User + Profile
    const managerUser = await prisma.user.create({
      data: {
        companyId,
        email: `mgr.notif.${Date.now()}@zztest.internal`,
        passwordHash: "$2b$10$abcdef",
        roles: { create: [{ role: UserRole.EMPLOYEE }] },
        authProvider: AuthProvider.LOCAL,
        isActive: true,
      },
    });
    const managerEmp = await employeeService.createEmployee({
      userId: managerUser.id,
      companyId,
      designationId: ctx.designation.id,
      firstName: "Manager",
      lastName: "Tester",
      joiningDate: "2026-01-01",
      isProbation: false,
    });

    // 2. Create Employee User + Profile with Manager assigned
    const employeeUser = await prisma.user.create({
      data: {
        companyId,
        email: `emp.notif.${Date.now()}@zztest.internal`,
        passwordHash: "$2b$10$abcdef",
        roles: { create: [{ role: UserRole.EMPLOYEE }] },
        authProvider: AuthProvider.LOCAL,
        isActive: true,
      },
    });
    const testEmp = await employeeService.createEmployee({
      userId: employeeUser.id,
      companyId,
      designationId: ctx.designation.id,
      firstName: "Applicant",
      lastName: "Tester",
      joiningDate: "2026-01-01",
      isProbation: false,
      managerId: managerEmp.id,
    });

    // Seed PL Balance: 20 days
    await prisma.leaveBalance.create({
      data: {
        employeeId: testEmp.id,
        leaveTypeId: plType.id,
        year: 2026,
        allocated: 20,
        used: 0,
        carriedForward: 0,
        remaining: 20,
      },
    });

    // ==============================================================
    // TEST 1: HOLIDAY CREATION BROADCAST (DYNAMIC TITLE & BOLD DATE)
    // ==============================================================
    console.log("    --- 1. Testing Holiday Creation Notification Broadcast ---");
    const holidayDate = new Date(Date.UTC(2026, 7, 15)); // Aug 15 2026
    await leaveService.createHoliday({
      companyId,
      name: "Independence Day",
      date: holidayDate,
    });

    const holidayNotifs = await prisma.notification.findMany({
      where: {
        companyId,
        type: NotificationType.HOLIDAY_ADDED,
      },
    });
    assert(holidayNotifs.length >= 3, "Holiday broadcast notification created for all company users (Admin, Manager, Employee)");
    const empHolidayNotif = holidayNotifs.find((n) => n.userId === employeeUser.id);
    assert(Boolean(empHolidayNotif), "Employee received holiday notification");
    assert(empHolidayNotif!.title === "New Holiday: Independence Day", "Holiday notification title matches dynamic holiday name");
    assert(empHolidayNotif!.message.includes("**Aug 15, 2026**"), "Holiday notification message includes bolded date");

    // ==============================================================
    // TEST 2: APPLY LEAVE (LEAVE_SUBMITTED)
    // ==============================================================
    console.log("    --- 2. Testing Apply Leave Trigger (LEAVE_SUBMITTED) ---");
    const leaveReq = await leaveService.applyLeave({
      userId: employeeUser.id,
      companyId,
      leaveTypeId: plType.id,
      fromDate: "2026-09-10",
      toDate: "2026-09-11",
      durationType: LeaveDurationType.FULL_DAY,
      reason: "Family event",
    });
    assert(leaveReq.status === "PENDING_MANAGER", "Leave request initial status is PENDING_MANAGER (Two-Step)");

    const mgrSubmittedNotif = await prisma.notification.findFirst({
      where: {
        userId: managerUser.id,
        type: NotificationType.LEAVE_SUBMITTED,
      },
    });
    assert(Boolean(mgrSubmittedNotif), "Manager received LEAVE_SUBMITTED notification");
    assert(mgrSubmittedNotif!.title === "New Leave Request Submitted", "LEAVE_SUBMITTED notification title matches");

    // ==============================================================
    // TEST 3: NUDGE MANAGER ENDPOINT (MANAGER_NUDGE)
    // ==============================================================
    console.log("    --- 3. Testing HR Nudge Manager Endpoint (MANAGER_NUDGE) ---");
    const nudgeRes = await leaveService.nudgeManager({
      requestId: leaveReq.id,
      userRoles: [UserRole.HR],
      companyId,
      nudgedByUserId: ctx.adminUser.id,
    });
    assert(nudgeRes.success === true, "HR nudgeManager call returned success");

    const mgrNudgeNotif = await prisma.notification.findFirst({
      where: {
        userId: managerUser.id,
        type: NotificationType.MANAGER_NUDGE,
      },
    });
    assert(Boolean(mgrNudgeNotif), "Manager received MANAGER_NUDGE notification");
    assert(mgrNudgeNotif!.title === "Pending Leave Review Reminder", "Nudge notification title matches");

    // ==============================================================
    // TEST 4: MANAGER APPROVES STAGE 1 (LEAVE_STAGE_APPROVED)
    // ==============================================================
    console.log("    --- 4. Testing Manager Approval Trigger (LEAVE_STAGE_APPROVED) ---");
    await leaveService.approveLeave({
      requestId: leaveReq.id,
      userId: managerUser.id,
    });

    const empStageApprovedNotif = await prisma.notification.findFirst({
      where: {
        userId: employeeUser.id,
        type: NotificationType.LEAVE_STAGE_APPROVED,
      },
    });
    assert(Boolean(empStageApprovedNotif), "Employee received LEAVE_STAGE_APPROVED notification after manager approval");

    const hrStageApprovedNotif = await prisma.notification.findFirst({
      where: {
        userId: ctx.adminUser.id,
        type: NotificationType.LEAVE_STAGE_APPROVED,
      },
    });
    assert(Boolean(hrStageApprovedNotif), "HR received LEAVE_STAGE_APPROVED notification when request forwarded to HR");

    // ==============================================================
    // TEST 5: HR FINAL APPROVAL (LEAVE_APPROVED)
    // ==============================================================
    console.log("    --- 5. Testing HR Final Approval Trigger (LEAVE_APPROVED) ---");
    await leaveService.approveLeave({
      requestId: leaveReq.id,
      userId: ctx.adminUser.id,
    });

    const empFinalApprovedNotif = await prisma.notification.findFirst({
      where: {
        userId: employeeUser.id,
        type: NotificationType.LEAVE_APPROVED,
      },
    });
    assert(Boolean(empFinalApprovedNotif), "Employee received LEAVE_APPROVED notification after HR completion");

    // ==============================================================
    // TEST 6: REJECTION TRIGGER (LEAVE_REJECTED)
    // ==============================================================
    console.log("    --- 6. Testing Rejection Trigger (LEAVE_REJECTED) ---");
    const leaveReq2 = await leaveService.applyLeave({
      userId: employeeUser.id,
      companyId,
      leaveTypeId: plType.id,
      fromDate: "2026-10-01",
      toDate: "2026-10-02",
      durationType: LeaveDurationType.FULL_DAY,
      reason: "Trip",
    });

    await leaveService.rejectLeave({
      requestId: leaveReq2.id,
      userId: managerUser.id,
      reason: "Peak workload period",
    });

    const empRejectedNotif = await prisma.notification.findFirst({
      where: {
        userId: employeeUser.id,
        type: NotificationType.LEAVE_REJECTED,
      },
    });
    assert(Boolean(empRejectedNotif), "Employee received LEAVE_REJECTED notification");
    assert(empRejectedNotif!.message.includes("Peak workload period"), "Rejection notification includes reason");

    // ==============================================================
    // TEST 7: NOTIFICATION CRUD (LIST, UNREAD COUNT, READ, DELETE)
    // ==============================================================
    console.log("    --- 7. Testing Notification Read/Unread/Delete & List API ---");
    const unreadCountInitial = await notifService.getUnreadCount(employeeUser.id);
    assert(unreadCountInitial >= 3, `Employee unread count is >= 3 (got ${unreadCountInitial})`);

    const listRes = await notifService.listNotifications({
      userId: employeeUser.id,
      page: 1,
      limit: 10,
    });
    assert(listRes.items.length >= 3, "listNotifications returned items");
    assert(listRes.unreadCount === unreadCountInitial, "listNotifications unreadCount matches getUnreadCount");

    // Mark single notification as read
    const firstNotifId = listRes.items[0].id;
    const markReadRes = await notifService.markAsRead(firstNotifId, employeeUser.id);
    assert(markReadRes.success === true, "markAsRead succeeded");

    const unreadCountAfterSingle = await notifService.getUnreadCount(employeeUser.id);
    assert(unreadCountAfterSingle === unreadCountInitial - 1, "Unread count decremented by 1 after single markAsRead");

    // Mark all as read
    await notifService.markAllAsRead(employeeUser.id);
    const unreadCountAfterAll = await notifService.getUnreadCount(employeeUser.id);
    assert(unreadCountAfterAll === 0, "Unread count is 0 after markAllAsRead");

    // Delete single notification
    const deleteRes = await notifService.deleteNotification(firstNotifId, employeeUser.id);
    assert(deleteRes.success === true, "deleteNotification succeeded");
    const verifyDeleted = await prisma.notification.findUnique({ where: { id: firstNotifId } });
    assert(verifyDeleted === null, "Notification row was deleted from database");

    // Delete all notifications for user
    const deleteAllRes = await notifService.deleteAllNotifications(employeeUser.id);
    assert(deleteAllRes.success === true, "deleteAllNotifications succeeded");
    const remainingCount = await prisma.notification.count({ where: { userId: employeeUser.id } });
    assert(remainingCount === 0, "All notifications for user permanently deleted from database");

    // ==============================================================
    // TEST 8: 90-DAY RETENTION PURGE JOB
    // ==============================================================
    console.log("    --- 8. Testing 90-Day Retention Purge Job ---");
    const oldDate = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000);
    const expiredNotif = await prisma.notification.create({
      data: {
        companyId,
        userId: employeeUser.id,
        type: NotificationType.HOLIDAY_ADDED,
        title: "Old Expired Holiday",
        message: "Expired notification",
        createdAt: oldDate,
      },
    });

    const purgeRes = await notifService.purgeExpired(90);
    assert(purgeRes.deletedCount >= 1, "purgeExpired deleted expired notification records");

    const checkExpired = await prisma.notification.findUnique({ where: { id: expiredNotif.id } });
    assert(checkExpired === null, "Expired notification older than 90 days was purged");

    // ==============================================================
    // TEST 9: TENANT ISOLATION OF WEBSOCKET NOTIFICATIONS & SYNC
    // ==============================================================
    console.log("    --- 9. Testing Tenant Isolation of WebSocket Notifications & Live Sync ---");
    const ctxB = await createIsolatedTestCompany({ setupStandardLeaveTypes: true });

    let testHttpServer: http.Server | null = null;
    let clientA: ClientSocket | null = null;
    let clientB: ClientSocket | null = null;

    try {
      // 1. Start test HTTP server with socket.io
      testHttpServer = http.createServer();
      initSocketServer(testHttpServer, ["*"]);

      await new Promise<void>((resolve) => {
        testHttpServer!.listen(0, () => resolve());
      });

      const port = (testHttpServer.address() as any).port;
      const socketUrl = `http://localhost:${port}`;

      // 2. Generate signed JWT tokens for User A (Company A) and User B (Company B)
      const tokenA = jwt.sign(
        { sub: employeeUser.id, email: employeeUser.email, companyId: ctx.company.id, roles: [UserRole.EMPLOYEE] },
        JWT_ACCESS_SECRET,
        { expiresIn: "1h" }
      );

      const tokenB = jwt.sign(
        { sub: ctxB.adminUser.id, email: ctxB.adminUser.email, companyId: ctxB.company.id, roles: [UserRole.COMPANY_ADMIN] },
        JWT_ACCESS_SECRET,
        { expiresIn: "1h" }
      );

      // 3. Connect authenticated clients
      clientA = Client(socketUrl, {
        auth: { token: tokenA },
        transports: ["websocket"],
      });

      clientB = Client(socketUrl, {
        auth: { token: tokenB },
        transports: ["websocket"],
      });

      await Promise.all([
        new Promise<void>((resolve, reject) => {
          clientA!.on("connect", () => resolve());
          clientA!.on("connect_error", (err) => reject(err));
        }),
        new Promise<void>((resolve, reject) => {
          clientB!.on("connect", () => resolve());
          clientB!.on("connect_error", (err) => reject(err));
        }),
      ]);

      const eventsA: { notifications: any[]; syncs: any[] } = { notifications: [], syncs: [] };
      const eventsB: { notifications: any[]; syncs: any[] } = { notifications: [], syncs: [] };

      clientA.on("notification:new", (n) => eventsA.notifications.push(n));
      clientA.on("dashboard:sync", (s) => eventsA.syncs.push(s));

      clientB.on("notification:new", (n) => eventsB.notifications.push(n));
      clientB.on("dashboard:sync", (s) => eventsB.syncs.push(s));

      // 4. Trigger Company A Holiday Broadcast + Leave Application
      await leaveService.createHoliday({
        companyId: ctx.company.id,
        name: "Tenant A Celebration",
        date: new Date(Date.UTC(2026, 11, 25)),
      });

      await leaveService.applyLeave({
        userId: employeeUser.id,
        companyId: ctx.company.id,
        leaveTypeId: plType.id,
        fromDate: "2026-12-01",
        toDate: "2026-12-02",
        durationType: LeaveDurationType.FULL_DAY,
        reason: "Tenant A Vacation",
      });

      // Allow 300ms for websocket packet propagation
      await new Promise((r) => setTimeout(r, 300));

      // 5. Assertions
      assert(eventsA.notifications.length > 0, "Company A user received real-time notifications");
      assert(eventsA.syncs.length > 0, "Company A user received live dashboard sync events");
      assert(eventsB.notifications.length === 0, "Company B user received ZERO notifications from Company A");
      assert(eventsB.syncs.length === 0, "Company B user received ZERO dashboard sync events from Company A");
      console.log("    ✔ WebSocket tenant isolation verified: 0 leaked events across companies");
    } finally {
      if (clientA) clientA.disconnect();
      if (clientB) clientB.disconnect();
      if (testHttpServer) {
        await new Promise<void>((resolve) => testHttpServer!.close(() => resolve()));
      }
      await ctxB.cleanup();
      console.log("    ✔ Cleaned up isolated tenant-isolation test company B");
    }

    console.log("  ✔ All NOTIF-01-06 Notification tests passed successfully!");
  } finally {
    await ctx.cleanup();
    console.log("    ✔ Cleaned up isolated notification test company");
  }
}
