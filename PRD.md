# HRMS — Product Requirements Document (PRD)

> **Product**: Multi-tenant HRMS for small companies (Zoho-People-style), excluding Payroll (future phase).
> **Audience**: Developers, HR/business stakeholders, LLM coding agents.
> **Companion document**: `MASTER_ROADMAP.md` (implementation status, tracked by feature ID).
> **Last updated**: 2026-09-06

---

## 1. Product Scope

### 1.1 In Scope (current phase)
- Multi-tenant company management (SuperAdmin onboarding)
- Authentication (password + Google/Microsoft SSO), RBAC with multi-role support
- Organization structure (departments, teams, designations, hierarchy)
- Attendance (geo-fenced check-in/out, auto-present policies, corrections)
- Leave management (types, per-company policies, approval workflow, balances, sandwich rule, LWP, holidays, exit-based encashment)
- Manager self-service (reportee-scoped leave & attendance visibility)
- Real-time in-app notifications
- Reports (Employee, Leave — Excel/CSV export)
- Error logging & retention system
- SuperAdmin dashboard

### 1.2 Explicitly Out of Scope (this phase)
- **Payroll** (salary computation, payslips, tax, statutory compliance) — future phase. Leave encashment in this phase only *records* payable data; it does not process payment.
- **CSV/bulk import via UI** — not currently part of application scope. Bulk data operations (e.g. historical employee migration) go through controlled seed/backfill scripts, not an end-user import feature.
- Email/SMS/push notifications (in-app + websocket only, for now)
- Automatic maternity/paternity leave assignment (HR manages manually)
- Religion-based restricted holiday auto-eligibility
- Fractional (half-day) holidays
- Self-service email-based password reset for end users (admin-assisted reset only, for now — self-service may be added later)

---

## 2. Tenant & Company Model

### 2.1 Multi-Tenancy
- Every company is isolated by `companyId`.
- Company data must never be accessible across tenants.
- **All company-scoped APIs must enforce tenant isolation at the backend** — this is authoritative, not a frontend convenience (see §16, Security).

### 2.2 Company Onboarding Flow (target end-to-end)
```
Super Admin
    ↓
Create Company
    ↓
Create Company Admin
    ↓
Company Admin configures organization (departments/teams/designations)
    ↓
Create / import employees
    ↓
Configure leave + attendance policies
    ↓
Assign managers (primary + optional secondary)
    ↓
Employees start using HRMS
```

---

## 3. Roles & Permission Model

### 3.1 Multi-Role Support *(implemented — AUTH-04)*
A single **User** can hold **multiple roles simultaneously**. Confirmed real-world combinations:
- `EMPLOYEE + HR` — an HR person who also logs their own attendance and applies for their own leave.
- `EMPLOYEE + COMPANY_ADMIN` — e.g. a director who wants both administrative access and a personal employee profile.
- `COMPANY_ADMIN` may or may not also hold `EMPLOYEE` — not every admin needs a personal profile.

**Implementation**: `User.role` (single enum) was replaced with a many-to-many `UserRoleAssignment` join table (`userId`, `role`, unique per pair). Every permission check evaluates "does this user hold role X" (array membership) rather than equality. A user must always hold at least one role — the last role cannot be removed.

**Dashboard access for multi-role users**: users with roles spanning more than one dashboard context (e.g. `EMPLOYEE + COMPANY_ADMIN`) land on a default dashboard by role priority (`SUPER_ADMIN` > `COMPANY_ADMIN`/`HR` > `EMPLOYEE`) and can switch context via a "Switch to Employee/Admin View" option in the profile dropdown menu — same interaction pattern already used elsewhere in the app, not a new UI paradigm. Each dashboard's nav/content remains unchanged from its single-role appearance; switching only changes which one is active.

### 3.2 Role Definitions & Responsibilities

**Super Admin** — system-level, not tied to any company.
- Create/manage companies; create each company's initial Company Admin.
- Access the platform-level company-management dashboard and error log dashboard.
- Must not require any company-level HR permission to perform system administration.

**Company Admin** — company-level administrator.
- Manage organization structure, employees, attendance config, leave config, holidays, HR operations, and company user accounts.

**HR** — operational role, full access today.
- Manage employees, attendance, and leave; approve/reject leave per the company's configured workflow; manage employee leave balance corrections; manage restricted-holiday eligibility/allocation; perform offboarding/reactivation.
- **Future**: Company Admin may restrict a given HR user's permission scope (e.g. "leave-only HR"). Not built yet — design permission checks so this can be layered in later without a rewrite.

**Manager** *(derived, not a stored role — implemented, MGR-01/02)* — any employee referenced as `managerId` or `secondaryManagerId` on another `EmployeeProfile`.
- Views only their direct + secondary reportees.
- Can approve/reject leave for reportees only.
- **Must not** approve or manage leave/attendance for employees outside their reportee scope, unless that same person also separately holds an HR/Company Admin role — enforced defensively at the backend (403), not only via frontend filtering.
- Surfaced as a "My Team" tab inside the Employee Dashboard (not a separate dashboard identity) — shown only when the user actually has 1+ reportees, hidden otherwise. Includes reportee-scoped leave approval/rejection and reportee-scoped attendance view.

**Employee** — self-service only.
- Login, maintain own profile where allowed, check in/out, view own attendance, apply for leave, cancel eligible own pending leave requests, view own balances and request history.

### 3.3 Inactive Users
- An inactive `User` must not be able to authenticate under any circumstance, regardless of role.

---

## 4. Authentication

- Email/password login.
- Short-lived access JWT + HTTP-only refresh-token session (rotation on refresh).
- Logout invalidates the session.
- **Forced password change on first login** when a temporary password was issued (e.g. by admin-assisted reset or onboarding).
- Google SSO, Microsoft SSO.
- Admin-assisted password reset (HR/Company Admin resets an employee; SuperAdmin resets a Company Admin).
- Role-based authorization on every protected route.
- *(Deferred: self-service email-based password reset for end users.)*

---

## 5. Employee Management

- Employee directory, full profile view, and self-profile (self-service editing is currently deferred at the UI layer — see Roadmap `EMP-06`).
- Onboarding creates both the `User` (login) and `EmployeeProfile` records.
- Department, designation, team (where applicable), and reporting-manager (primary + optional secondary) assignment.
- Activation / deactivation / reactivation — `EmployeeProfile.isActive` and `User.isActive` must always move together and stay consistent through every lifecycle operation.
- **Historical employee data must be preserved after offboarding** — offboarding deactivates, it never deletes.

---

## 6. Organization Management

Company Admin / HR can manage:
- Departments, Teams, Designations
- Reporting hierarchy (primary + secondary manager)
- Designation-level attendance policies
- Employee-specific attendance overrides

**Attendance policy precedence** (existing, confirmed correct):
```
Employee Override
       ↓
Designation Policy
       ↓
Company/System Default
```
This includes the **Auto-Present** rule: a designation or an individual employee can be marked auto-present (no check-in required, always counted present) — this is a confirmed, already-implemented business rule.

---

## 7. Attendance

### 7.1 Employee-Facing Behavior
- Browser/GPS check-in and check-out.
- **Multiple attendance sessions per day** are supported, with accurate cumulative worked-time calculation across sessions.
- **Open-session / live timer** — an in-progress (checked-in, not yet checked-out) session must be reflected live to the employee.
- **Same-calendar-day boundary** — a session's check-in and check-out are scoped to a single calendar day; sessions do not span midnight.
- **Forgotten checkout handling** — the system must define and apply a defined behavior when an employee never checks out (e.g. auto-close at day boundary, or flag for HR correction) rather than leaving the session open indefinitely.
- Attendance history / calendar view.

### 7.2 Leave Interaction
- A full-day **approved** leave blocks/excludes attendance expectations for that day.
- A partial-day (half/quarter/hourly) approved leave **adjusts** the required working time for that day rather than blocking it entirely.
- Attendance sufficiency is calculated against the company's configured working-hour settings (§7.4).

### 7.3 Geo-Fencing
Company-level configuration: enabled/disabled, office latitude/longitude, radius.
- **When disabled**: browser location permission must **not** be requested, and attendance must not require location at all.

### 7.4 Working Hours (Company-Level Config)
- Scheduled work duration, lunch duration, break duration, grace period — all configurable per company.
- **Configuration changes are forward-only**: changing these settings affects future attendance calculations and must **never rewrite or reinterpret historical** attendance records.

### 7.5 HR/Admin Attendance Operations
- View by date, create/correct attendance records, add manual punch events, review geo-fence violation logs, view the monthly attendance dashboard.

---

## 8. Leave Management

### 8.1 Leave Types & Naming
- Every company defines **its own leave type names** — no global/shared catalog. Fully company-scoped.
- **LWP (Leave Without Pay) is unlimited and available to every employee by default, in every company** — it does not require a `LeavePolicy` row, is never subject to balance checks, and is excluded from the Leave Policies configuration UI, year-end rollover, and any allocation concept. Applying for LWP never fails due to "insufficient balance."

### 8.2 Balance Accounting Model
The authoritative internal formula (used for computation; **not** what's shown in the UI — see §8.7):
```
Remaining = Allocated + Carried Forward − Actual Deducted
```
- "Actual Deducted" must reflect the **final** approved/deducted leave days, including any day-level changes (partial approvals, sandwich-day corrections) — not the originally-requested duration blindly re-applied.
- All balance mutations (apply, approve, reject, cancel, HR-delete, sandwich-day removal, bulk allocation, rollover) must be **delta-based and idempotent** — re-running the same state transition must never double-count or double-reverse a balance change.

### 8.3 Multi-Day Leave Handling
- Full-request approval/rejection, and **day-level** approval/rejection by authorized roles (Manager/HR, per the applicable workflow).
- The HR/Manager day-breakdown UI supports **local draft changes before saving** (edit multiple days, then commit in one save).
- **Bulk approve/reject** operates only on currently-**pending** days within a request — already-approved or already-rejected days are left untouched by a subsequent bulk action on the "remaining" days.

### 8.4 Leave Policy Model — Year-less ("current policy")

**Implementation decision (supersedes any earlier year-scoped design)**: `LeavePolicy` is a single, always-current row per `(companyId, leaveTypeId)` — there is no year field and no year selector in the UI. HR edits a leave type's policy (yearly allocation, carry-forward allowed, carry-forward cap) at any time; the change takes effect immediately for future leave applications and the next year-end rollover. This intentionally trades away the ability to look up "what was the policy in a past year" in exchange for removing configuration friction, since policy rarely changes year to year for a small company. `LeaveBalance`, by contrast, **remains year-scoped** (one row per employee/leave-type/year) — only the policy lost its year dimension.

Two toggles that previously existed on this UI were removed as confirmed dead (written but never read anywhere in the codebase): **Encashment** (a company genuinely wanting encashment support relies on §8.5's exit-only flow, not a per-leave-type annual toggle) and **Probation Allowed** (probation employees are hard-restricted to CL-Probation + LWP by business rule, not by this field).

### 8.4.1 Year-End Rollover *(implemented — LEV-12)*
Applied in this order, using the **current policy** in effect at the time rollover is run:
1. **Carry Forward** — up to the policy's configured cap (`null`/unset = effectively unlimited).
2. **Lapse** — any balance remaining above the cap is forfeited. Default outcome if carry-forward isn't enabled for that leave type.
3. `toYear` allocated = the current policy's yearly allocation. If no policy is configured at all for a leave type, that type is skipped from rollover with a warning (cannot occur for any leave type HR has already configured, since policy is now always-current).

There is **no annual/yearly encashment payout** — encashment is exit-only (§8.5). LWP is excluded from rollover entirely (§8.1).

**Safety mechanics** (required given the blast radius of a company-wide balance operation):
- **Dry-run preview** required before commit — shows every employee/leave-type projected change with zero database writes, including an idempotency warning if the target year already has carried-forward balances.
- **Idempotency**: re-running for a year already rolled over is blocked by default.
- **Force-overwrite** escape hatch: restricted to `COMPANY_ADMIN` (not `HR`), requires typed confirmation (not a checkbox) and a mandatory reason, logged to `AuditLog` (action `YEAR_END_ROLLOVER`) with full per-employee before/after detail.
- Entire batch runs in a single atomic transaction — full rollback on any failure, not a partial per-employee loop.

### 8.5 Leave Encashment (Exit-Only)
- Encashment applies **only when an employee resigns/exits** (tied to offboarding), and only if the company has enabled encashment for that leave type.
- On exit, the system calculates and **logs** (does not pay): remaining balance per encashable leave type, encashable days, amount owed (data only). No payment is processed — payroll is out of scope.
- This is separate from, and does not replace, the leave-cancellation behavior described in §14 (Employee Lifecycle) — the exit encashment log captures what remained *after* those cancellations/rejections are applied.

### 8.6 Sandwich Leave Rule
- Single **company-wide ON/OFF switch** — no per-employee or per-leave-type sandwich configuration.
- When OFF: no sandwich deduction ever applies.
- When ON: applicable weekend/public-holiday bridge days are deducted per the company rule. Example:
  ```
  Friday leave + Monday leave
  → Friday + Saturday + Sunday + Monday all deducted (when the bridge rule applies)
  ```
- **Exception handling**: no configurable exemption system. Instead, HR/Company Admin opens the employee's day-wise leave breakdown, identifies the specific sandwich-flagged day, and **permanently hard-deletes** that single day-entry (`LeaveRequestDay`) as a case-by-case exception. Balance is automatically recalculated and restored on deletion. This is a genuine hard delete, not a soft-delete flag.

### 8.7 UI Requirement — Leave Balance Display
- Across **all screens without exception**, leave balance cards show only **Available Balance** and **Used**.
- **`Total Allocated` must never be displayed anywhere in the UI**, even though it exists as an internal accounting term (§8.2).
- To adjust an employee's balance, HR enters a **new balance value** directly (this single mechanic covers both increases and decreases — there is no separate "grant" vs. "revoke" action).
- **Zero-entitlement leave types must not clutter the employee's leave-selection/balance UI.** A leave type is hidden from that employee's view when `allocated = 0 AND used = 0 AND carriedForward = 0 AND remaining = 0`. HR can still grant/add entitlement for that type when company policy permits, which then makes it visible again.

### 8.8 Leave Approval Workflow *(implemented — LEV-03)*
- **Company-level toggle** between:
  - **Two-step approval**: Employee applies → Manager approval **and** HR approval both required.
  - **Direct-to-HR** (current default): HR approval only.
- **No manager assigned** → routes directly to HR; HR is sole approver.
- **Visibility**: as soon as an employee applies, the request is visible to **both** Manager and HR simultaneously.
- **Sequencing** (two-step enabled):
  1. Employee applies → notify Manager + HR.
  2. Manager approves → notify HR + Employee. HR cannot approve before this.
  3. HR approves → notify Employee → status `APPROVED`.
  4. If Manager hasn't acted, HR sees it as pending-on-manager and cannot approve; HR follows up with the manager outside the system.
- **Rejection**: Manager rejects → immediately `REJECTED`, Employee notified, HR does not need to act.
- Status values must clearly distinguish stage: `PENDING_MANAGER`, `PENDING_HR`, `APPROVED`, `REJECTED`.

### 8.9 Manager & Secondary-Manager Dashboard *(implemented — MGR-01/02)*
- Primary or secondary manager gets a reportee-scoped **Leave dashboard** (pending/approved/rejected for their reportees only, with approve/reject actions on `PENDING_MANAGER` requests) and **Attendance dashboard** (reportee attendance only, with per-day session drilldown). Pure data-scoping on existing dashboards — no new stored role. Surfaced as the "My Team" tab on the Employee Dashboard, live-updating pending-count badge.

### 8.10 Manager Nudge *(implemented — reverses earlier deferral)*
Earlier draft of this PRD stated no in-app reminder feature was needed. That decision is reversed: HR can send a lightweight "nudge" notification directly to the reporting manager for a specific `PENDING_MANAGER` request, from the HR pending-approvals view. This does not change the request's status or approval logic — it is purely a notification (§13), low complexity, reusing existing notification infrastructure.

---

## 9. Restricted Holidays *(implemented — LEV-16, connects two previously-separate concepts)*

Restricted holidays are **not hard-coded by religion or any fixed calendar**, and are **not** treated as a company-wide blocking day like a normal holiday. Model, connecting the `Holiday` calendar with RH leave-type eligibility:
```
Holiday has a type: NORMAL | RESTRICTED (default NORMAL)
       ↓
NORMAL → blocks leave applications that date, exactly as before
RESTRICTED → does NOT block leave applications that date:
       ↓
   RH-eligible employee (HR-granted, per below) → may apply RH specifically for that date
   Any other employee → may apply any of their normal leave types, same as a working day
       ↓
If nobody applies anything, it's a normal working day — no forced holiday, 
no leave auto-consumed. Fully opt-in.
```
- HR determines which employees are eligible for RH (a normal leave type, like any other).
- Leave-type picker on a restricted-holiday date labels it `"<Holiday Name> (Restricted)"` so it's clear the date is optional, not blocking.
- Restricted holidays are excluded from sandwich-rule bridge detection (§8.6) and from automatic attendance/absence marking (§7) — an unused restricted holiday is a genuine working day in every calculation.
- Common company-wide/public holidays (`NORMAL` type) remain fully blocking under the normal Holiday Management rules (§10).

---

## 10. Holiday Management
- HR/Admin can create, delete, and view the company holiday list. Holidays are full-day only (no fractional holidays).
- Holidays must correctly participate in: attendance calculation, leave-day calculation, the sandwich bridge rule, and restricted-holiday handling where applicable.

---

## 11. HR/Admin Leave Operations
HR/Admin needs operational visibility into: pending, approved, rejected, and cancelled leave; who is on leave today; recently approved leave; leave balances; and the day-level leave breakdown per employee (used for both approvals and the sandwich-exception tool in §8.6).

---

## 12. Manager / Reportee Workflow
```
Manager A
 ├── Employee 1
 ├── Employee 2
 └── Employee 3
```
Manager A can approve/reject leave and view attendance only for Employees 1–3 (their reportees). Manager A must not act on employees outside this scope unless they separately hold an HR/Company Admin role.

---

## 13. Notifications & Real-Time Sync

### 13.1 Infrastructure & Delivery
- **Transport**: Socket.IO WebSocket connection with JWT cookie handshake authentication and tenant-scoped room routing:
  - `user:<userId>` — targeted user notifications.
  - `company:<companyId>` — tenant-wide broadcasts (e.g. holidays).
  - `company:<companyId>:admins` — tenant admins & HR stakeholders.
  - `manager:<managerProfileId>` — manager-specific actions.
- **Persistence**: Backed by the `Notification` table (`id`, `companyId`, `userId`, `type`, `title`, `message`, `link`, `metadata`, `isRead`, `readAt`, `createdAt`).
- **Retention**: 90-day (3-month) flat auto-purge scheduled job (`NotificationCleanupJob`).
- **UI Presentation**:
  - Top AppBar unread notification bell with count badge, popover panel with All/Unread tabs, deep links, mark-as-read, mark-all-read, and delete actions.
  - Immediate toast alerts via `react-hot-toast` with `duration: Infinity` (manual dismiss only), stacking simultaneously.

### 13.2 Trigger Points & Notification Events

| Event | Notification Type | Recipients | Message Content |
|---|---|---|---|
| Employee applies for leave | `LEAVE_SUBMITTED` | Reporting Manager (Two-Step) + HR / Company Admins | "[Employee] submitted a [Duration] [LeaveType] request" |
| Manager approves leave | `LEAVE_STAGE_APPROVED` | Employee + HR / Company Admins | "Stage 1 approved by manager, forwarded to HR" |
| HR approves leave | `LEAVE_APPROVED` | Employee | "Your [LeaveType] request was approved" |
| Manager or HR rejects leave | `LEAVE_REJECTED` | Employee | "Your [LeaveType] request was rejected: [Reason]" |
| Holiday added | `HOLIDAY_ADDED` | All Company Users | "New holiday added: [Name] on [Date]" |
| HR nudges manager | `MANAGER_NUDGE` | Reporting Manager | "Reminder: [Employee] has a pending leave request awaiting your review" |

### 13.3 Live Dashboard & Badge Synchronization
- **Transport**: Lightweight `dashboard:sync` WebSocket signal payload `{ topic: "leave" | "attendance" | "badges" | "holiday" }`.
- **Zero-DB**: Sync events carry no database state; they trigger a seamless background refetch on active frontend screens.
- **Subscribed Components**:
  - `AdminDashboard`: updates pending leave approval badges immediately.
  - `AdminLeaveDashboard`: refreshes on-leave today, pending requests, and recently approved leave lists.
  - `AdminAttendanceDashboard`: refreshes attendance matrix and pending leave badges.
  - `EmployeeDashboard`: refreshes manager team pending badge and active attendance logs.
- **Reconnect Reconciliation**: On socket reconnection after network drop, active dashboard data is automatically re-synchronized.

---

## 14. Employee Lifecycle

### 14.1 Offboarding (immediate after confirmation)
- `EmployeeProfile.isActive` and `User.isActive` → `false`.
- Inactive user cannot log in; **all existing sessions are invalidated immediately**.
- Historical attendance and leave data is preserved, never deleted.
- **Future-dated approved leave is auto-cancelled**, with an audit reason recorded.
- **Pending leave requests are auto-rejected**, with an audit reason recorded.
- **Any open (checked-in, not checked-out) attendance session is closed at the current timestamp.**
- Manager reassignment for this person's former reportees is **manual** (not automatic) — HR/Admin must reassign them.
- Exit-based leave encashment (§8.5) is calculated and logged as part of this flow.
- Final financial settlement (leave payout, dues) is **out of scope** — this system only produces the data; settlement itself is a payroll-phase concern.

### 14.2 Reactivation
- Reuses the existing `EmployeeProfile`/`User` records (never recreated).
- Restores `isActive` and login access.
- Historical attendance and leave data remains exactly as it was — nothing is regenerated or reset.

---

## 15. Dashboards

**Super Admin**: company management, company onboarding, error log dashboard.

**Admin/HR**: operational KPI dashboard, attendance dashboard, leave dashboard, employee directory, organization management, holiday management, geo-fencing settings.

**Manager** *(new)*: reportee-scoped leave dashboard, reportee-scoped attendance dashboard (§8.9).

**Employee**: attendance, leave balance (Available + Used only, §8.7), leave requests, profile.

---

## 16. Security & Authorization
- Backend authorization is **authoritative** — frontend hiding of UI elements is never sufficient on its own.
- Every sensitive endpoint must enforce: authentication, role authorization, company/tenant isolation, and resource ownership / reportee-scope checks where applicable (e.g. a Manager's leave-approval endpoint must verify the target employee is actually their reportee, not just check the Manager role).

---

## 17. Error Logging System
- **Scope**: all 4xx/5xx errors, from both backend (API) and frontend (React runtime/UI errors).
- **Per-log fields**: stack trace, endpoint/route, request payload (redact credentials), user ID, company ID, timestamp, IP address, user agent.
- **Retention**: flat 20-day retention for all logs, auto-purged via scheduled job.
- **Access**: SuperAdmin-only UI, filterable by company/date/status code/endpoint.

---

## 18. Reports
- **Employee Report**: all employees in selected company, filterable by department/team/status, preview + Excel + CSV. *(Implemented, working.)*
- **Leave Report**: dynamic per-company leave types, showing **Used** + **Balance** per type (renamed from "Booked" for platform-wide terminology consistency with §8.7), **Paid Leaves — Used** / **Paid Leaves — Balance** (split from a previously-ambiguous single total), **LWP**, **Absent Days**, decimal precision preserved, preview + Excel + CSV, pending-approval warning, month-stepper + custom date-range filters.
  - **Absent Days**: fixed — now dynamically computed against the employee's actual calendar (working days minus present/leave/holiday), correctly respects `joiningDate` (no pre-employment dates counted as absent), consistent with the Attendance Dashboard's own calculation.
  - **LWP**: logic verified correct in testing, but stays flagged `VERIFY` until a real company has actual LWP usage data to confirm against in production — do not treat as fully closed until then.
- **Attendance Report**: new tab, monthly or custom date-range, per-employee summary (present/absent/partial/on-leave/holiday counts, attendance %), department/team/employee filters, per-day session drilldown on demand (not eagerly loaded for large ranges), Excel/CSV export — same UI pattern as Leave Report.

---

## 19. Resolved — Leave Balance Mismatch Investigation (LEV-13)
- Full logic audit completed across every `LeaveBalance`-mutating code path (apply/approve/reject/cancel/delete/sandwich-delete/bulk-allocate/rollover). All active paths confirmed delta-based, transaction-safe, and idempotent per §8.2.
- The one real defect found (`runYearEndRollover` overwriting `remaining` instead of computing it from `allocated + carriedForward - used`) was dormant — never run against real data — and was fixed as part of building §8.4.1's rollover engine, not patched in isolation.
- The specific real-data discrepancy that prompted this investigation was confirmed as manual-testing residue (a demo account with leave requests deleted before balance-restoration logic existed, later manually corrected by HR), not an ongoing calculation leak. No live production bug found.

---

## 20. Non-Functional Requirements
- TypeScript compilation must pass; production builds must pass.
- Database migrations must be reproducible.
- APIs should be documented via OpenAPI/Swagger.
- Test suites must use isolated test data; automated tests must **never** modify real/UAT company data; every test must clean up records it creates.
- **Historical HR data must not be casually hard-deleted.** *(Exception, by deliberate documented policy — not "casual" deletion: terminal-status `LeaveRequest` records are automatically hard-deleted 6 months after their terminal date, and error logs are hard-deleted after 20 days — see Roadmap §5/§6 for the retention contract.)*
- UI has been observed to lag intermittently around check-in/check-out (non-reproducible so far) — flagged for investigation.

---

## 21. Current Product Principle (pre-launch sequencing)
```
Business rules finalized
        ↓
Implementation finalized
        ↓
Automated tests isolated
        ↓
Clean database
        ↓
Seed known-good master data
        ↓
Fresh company onboarding
        ↓
End-to-end UAT
```

---

## 22. Open / Deferred Items (do not build without explicit scope change)
- Automatic maternity/paternity leave assignment
- Religion-based restricted holiday eligibility
- Fractional (half-day) holidays
- Finer-grained HR permission restriction (Company Admin limiting specific HR users) — design permission checks to *allow* this later, don't build the restriction UI now
- Payroll integration (any form)
- Email/SMS/push notification channels (in-app WebSocket notifications are implemented — see §13)
- Self-service email password reset for end users
- CSV/UI-based bulk employee import
- `COMP_OFF` carry-forward rule — **VERIFY**, not yet finalized
- Exit-based leave encashment logging (EMP-07) — still **MISSING**, not yet built; §8.5 describes the intended design only
- Persistent notification history beyond 90 days / read-state analytics — out of scope, flat 90-day auto-purge is the only retention behavior (§13.1)
- LWP report column — functionally verified but flagged for retest once a real tenant has genuine LWP usage data (§18)

**Reversed from earlier draft**: the "no in-app manager reminder" decision was reversed — see §8.10, now implemented.