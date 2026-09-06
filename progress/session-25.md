# Session 25: Real-Time Persistent Notifications, Live Dashboard Sync (NOTIF-01-06) & NotificationBell Redesign

## Objectives Completed

1. **Real-Time Persistent Notifications Engine (`NOTIF-01-05`)**:
   - **Database & Prisma Schema**: Added `NotificationType` enum (`LEAVE_SUBMITTED`, `LEAVE_STAGE_APPROVED`, `LEAVE_APPROVED`, `LEAVE_REJECTED`, `HOLIDAY_ADDED`, `MANAGER_NUDGE`) and `Notification` model with indexes on `[userId, isRead, createdAt]`, `[companyId, createdAt]`, and `[createdAt]`.
   - **90-Day Retention Auto-Purge**: Built `NotificationCleanupJob` running a daily 24-hour retention cleanup job to hard-delete notifications older than 90 days.
   - **REST Notification API**: `GET /api/notifications` (paginated, unread-first), `GET /api/notifications/unread-count`, `PATCH /api/notifications/:id/read`, `POST /api/notifications/mark-all-read`, `DELETE /api/notifications/:id`, and `DELETE /api/notifications/all` (bulk user-scoped delete).
   - **6 Trigger Points Wired**:
     - `createHoliday`: Broadcasts `HOLIDAY_ADDED` notification with dynamic holiday name title and bold date (`**[Date]**`) to all company users.
     - `applyLeave`: Dispatches `LEAVE_SUBMITTED` notification to Reporting Manager (Two-Step workflow) and HR/Company Admins.
     - `approveLeave` (Stage 1 / Manager): Dispatches `LEAVE_STAGE_APPROVED` notification to Employee and forwards to HR.
     - `approveLeave` (Stage 2 / HR Final): Dispatches `LEAVE_APPROVED` notification to Employee.
     - `rejectLeave` (Manager or HR): Dispatches `LEAVE_REJECTED` notification with mandatory rejection reason to Employee.
     - `nudgeManager` (`POST /api/leave/requests/:id/nudge`): Allows HR to dispatch a `MANAGER_NUDGE` reminder to the reporting manager for pending Stage 1 requests.

2. **Live WebSocket Dashboard & Badge Sync (`NOTIF-06`)**:
   - **Socket.IO Infrastructure (`src/socket/index.ts`)**: Built WebSocket server with JWT cookie/handshake authentication and tenant-isolated room subscriptions (`user:<userId>`, `company:<companyId>`, `company:<companyId>:admins`, `manager:<managerProfileId>`).
   - **Live Zero-DB Refetch Signals**: Emits `dashboard:sync` events with topic payloads (`leave`, `attendance`, `badges`, `holiday`).
   - **Frontend React Context & Hooks (`SocketContext.tsx`)**:
     - Auto-dismissing real-time toast alerts (`3000ms`) on notification receipt.
     - Reconnect reconciliation: triggers active data refetch automatically upon socket reconnection.
     - `useSocketSync` hook integrated into 4 dashboards:
       - `AdminDashboard.tsx`: Live updates for pending leave count badges.
       - `AdminLeaveDashboard.tsx`: Live refetching of on-leave today, pending requests, and recently approved leaves.
       - `AdminAttendanceDashboard.tsx`: Live refetching of monthly attendance matrix and approval badges.
       - `EmployeeDashboard.tsx`: Live refetching of employee's own leave requests, leave balances, and manager pending counts.

3. **Notification UI & Bell Panel Polish (`NotificationBell.tsx`)**:
   - **Header Redesign**: Clean single-line header with compact, themed icon buttons and tooltips:
     - Primary-tinted `Mark all as read` (`DoneAllIcon`).
     - Destructive-tinted `Delete all notifications` (`DeleteSweepIcon`).
   - **Strict Unread Tab Filtering**: `displayedNotifications` strictly filters to `isRead: false` on the Unread tab with dedicated empty-state feedback.
   - **Delete All Confirmation Modal**: MUI `<Dialog>` confirmation prompt before executing irreversible bulk deletion.
   - **Read Item Hover Contrast**: Refined hover background styling (`alpha(theme.palette.primary.main, 0.04)`) to ensure high text contrast and readability on read notification rows.

4. **"Nudge Manager" Button in HR Dashboard (`AdminLeaveDashboard.tsx`)**:
   - Added prominent full-width amber action button (`Nudge Reporting Manager`) with bell icon and loading state on `PENDING_MANAGER` request cards in Section B.

5. **Automated Test Suite & WebSocket Tenant-Isolation Verification**:
   - Added `tests/notifications.test.ts` (9 test cases covering all 6 triggers, CRUD API, 90-day retention purge, dynamic holiday formatting, and WebSocket tenant isolation).
   - Test 9 connects 2 real authenticated socket clients across 2 isolated test companies, asserts events arrive at Company A socket, and verifies **EXACTLY ZERO** event leakage to Company B.
   - Updated `tests/run-all.ts` with notification count sanity checks.

## Verification

- **Automated Backend Tests**: Ran full test suite via `npx tsx tests/run-all.ts`: all 24 test suites passed cleanly (`19.59s`).
- **Frontend Build**: Ran `npm --prefix ../hrms-fe run build` (`tsc -b && vite build`): compiled cleanly with 0 errors in `3.92s`.
- **Database Self-Audit (`npx tsx scripts/audit-test-leftovers.ts`)**:
  - `ZZTEST_` Companies: `0`
  - `@zztest.internal` Users: `0`
  - Created: `0` | Deleted: `0` | Remaining: `0`

## Known Issues

- None.

## Next Steps

- `EMP-07`: Exit-based encashment logging tied into employee offboarding flow.
- `DATA-01`: Scheduled 6-month hard-delete job for terminal-status leave requests.
- Manual verification: human confirmation of WebSocket tenant isolation across two real browser windows.
- `DEV-02`: Production hardening (HTTPS, production secrets, backups, migration validation).
