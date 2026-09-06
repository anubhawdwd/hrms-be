# HRMS — Master Roadmap

> **Purpose**: Single source of truth for HRMS scope, implementation status, gaps, and next actions.
> **Companion document**: `PRD.md` (full business rules & specs — read that for *why*, this file for *what/status*).
> **Audience**: Developers, HR stakeholders, LLM/AI coding agents.
> **Rule**: Update this document whenever feature status changes. Do not re-implement items marked `COMPLETE`, `DEFERRED`, or `NOT REQUIRED`. Do not treat `COMPLETE` in earlier sections as still accurate if it references logic superseded by this version.

---

## 1. Project Snapshot

| Area | Status | Summary |
|---|---|---|
| Authentication & RBAC | PARTIAL | Core auth complete; email-change with SSO safeguards & audit logs; multi-role model not yet built |
| Employee Management | COMPLETE | Atomic single-transaction onboarding, full master-data fields (phone, gender, personal email), secondary manager hierarchy, quick edit parity |
| Organization | COMPLETE | Company, department, team, designation, hierarchy, auto-present policy |
| Attendance | COMPLETE | Check-in/out, geo-fencing, corrections, violations, auto-present, partial status dashboard |
| Leave Management | PARTIAL | Core workflow works; per-day approve/reject status transitions, day-level deletion with balance restoration, and cross-request sandwich detection with retroactive balance adjustment complete; year-end treatment, 2-step approval, exit-encashment pending |
| Manager Self-Service | MISSING | Reportee-scoped dashboards not implemented |
| Notifications | MISSING | No notification system exists at all |
| Reports | PARTIAL | Employee report OK; Leave report has a **live P0 bug** (LWP/Absent not showing) |
| Error Logging | COMPLETE | Ingestion (BE/FE), 20-day retention, SuperAdmin viewer with bulk delete |
| SuperAdmin Dashboard | COMPLETE | Multi-tenant company provisioning, admin accounts, user directory, error viewer |
| Testing | COMPLETE | Isolated test-company infrastructure (18 test suites), `audit:leftovers` diagnostic sweep tool, zero-mutation verification |
| Deployment | PARTIAL | Local/LAN hosting only; production hardening pending |

**Overall**: Core single-approver HRMS workflows, atomic employee onboarding with full master-data parity, email-update safeguards, and full SuperAdmin platform tooling/error monitoring exist and function. The next phase includes multi-role support, 2-step approval, manager dashboards, notifications, and leave report fix.


---

## 2. Status Legend
- `COMPLETE` — Implemented and verified.
- `PARTIAL` — Implemented but incomplete across one or more layers.
- `BUG` — Existing functionality behaves incorrectly (confirmed, reproducible).
- `MISSING` — Required functionality does not exist yet.
- `DEFERRED` — Intentionally postponed, out of current scope.
- `NOT REQUIRED` — Reviewed and explicitly out of scope.
- `VERIFY` — Needs investigation before status can be assigned.

---

## 3. Master Feature Matrix

| ID | Module | Feature | Status | Priority | Notes |
|---|---|---|---|---|---|
| AUTH-01 | Auth | Login / logout / refresh | COMPLETE | | |
| AUTH-02 | Auth | Google / Microsoft SSO | COMPLETE | | |
| AUTH-03 | Auth | RBAC & company isolation | COMPLETE | | Single-role enum currently; email updates scoped to COMPANY_ADMIN + HR with audit logging |
| AUTH-04 | Auth | **Multi-role support** (`EMPLOYEE+HR`, `EMPLOYEE+COMPANY_ADMIN`, etc.) | COMPLETE | **P0** | Multi-role schema (`UserRoleAssignment` join table) + JWT payload `roles: UserRole[]` + permission checks + multi-role onboarding/quick edit UI + profile dropdown view switcher (Admin/Employee). See PRD §2.1 |
| EMP-01 | Employee | Onboarding / creation | COMPLETE | | Atomic single-transaction onboarding (`POST /api/employees/onboard`) with initial leave allocation & mustChangePassword |
| EMP-02 | Employee | Activate / deactivate / reactivate | COMPLETE | | |
| EMP-03 | Employee | Employee master data (phone, gender, personal email, employment status) | COMPLETE | | Schema + atomic onboarding API + Quick Edit modal parity |
| EMP-04 | Employee | Secondary Reporting Manager | COMPLETE | | Tenant-isolated secondary manager relation, API validation, and UI support |
| EMP-05 | Employee | Explicit employee code import / assign | COMPLETE | | Explicit code assignment with 409 duplicate code guard & auto-generation fallback |
| EMP-06 | Employee | Self-profile editing | DEFERRED | P2 | Backend route exists; no UI |
| EMP-07 | Employee | Exit-based leave encashment logging | MISSING | **P1** | New spec — see PRD §6.3. Triggered by offboarding flow. Data-only (no payment) |
| ORG-01 | Organization | Company / department / team / designation CRUD | COMPLETE | | |
| ORG-02 | Organization | Reporting hierarchy (primary) | COMPLETE | | |
| ORG-03 | Organization | Designation attendance policy | COMPLETE | | |
| ORG-04 | Organization | Auto-present policy (designation/employee tier) | COMPLETE | | Confirmed real business rule, already implemented |
| ATT-01 | Attendance | Check-in / check-out | COMPLETE | | |
| ATT-02 | Attendance | Geo-fenced attendance | COMPLETE | | |
| ATT-03 | Attendance | Attendance dashboard / corrections | COMPLETE | | |
| ATT-04 | Attendance | Violations / manual attendance / overrides | COMPLETE | | |
| ATT-05 | Attendance | Occasional UI lag on check-in/out | BUG | P2 | Non-reproducible so far; needs monitoring/repro steps before fix |
| MGR-01 | Manager Dashboard | Reportee-scoped leave dashboard (primary + secondary) | COMPLETE | **P1** | Reportee-scoped leaves with PENDING_MANAGER quick actions & full history table (`/api/manager/leaves`) |
| MGR-02 | Manager Dashboard | Reportee-scoped attendance dashboard (primary + secondary) | COMPLETE | **P1** | Reportee-scoped monthly attendance grid + session inspection (`/api/manager/attendance`, `/api/manager/reportees`) |
| LEV-01 | Leave | Leave types / policies (company-defined naming) | COMPLETE | | |
| LEV-02 | Leave | Leave application / approval / rejection (single-approver) | COMPLETE | | Current default flow |
| LEV-03 | Leave | **2-step approval workflow** (Manager → HR), company-level toggle | COMPLETE | | See PRD §6.5/§8.8. Includes status states `PENDING_MANAGER` / `PENDING_HR` |
| LEV-04 | Leave | Balance allocation / correction | COMPLETE | | Delta-safe / transaction-safe (verified in LEV-13) |
| LEV-05 | Leave | Fractional / hourly leave | COMPLETE | | |
| LEV-06 | Leave | LWP | PARTIAL / VERIFY | **P0** | Balance logic OK; Report display logic passes synthetic tests, but stays UNVERIFIED / flagged for retest once real usage data exists on any tenant — do not mark done without real production data. |
| LEV-07 | Leave | Sandwich policy (company-wide switch) | COMPLETE | | Single-request and cross-request bridging with retroactive balance adjustment |
| LEV-08 | Leave | **Sandwich-day exception tool & Day Breakdown Deletion** (HR views day-wise breakdown, selects checkboxes / select-all, hard-deletes specific days via `leaveApi.deleteDays`, auto-recalculates duration and restores balance; per-day approve/reject delta handler) | COMPLETE | **P0** | Hard delete + balance restoration + parent status transition + duration recalculation |
| LEV-09 | Leave | Holiday management | COMPLETE | | Full-day only |
| LEV-10 | Leave | Restricted Holiday | COMPLETE | | Normal leave type; HR manually grants |
| LEV-11 | Leave | Maternity / Paternity automation | NOT REQUIRED | | HR manages manually |
| LEV-12 | Leave | **Year-end treatment engine**: carry-forward (with cap, 999 = unlimited) → lapse remainder | MISSING | **P0** | Confirmed: no annual encashment. Per-leave-type, per-company config. See PRD §6.2 |
| LEV-13 | Leave | Leave balance mismatch investigation | COMPLETE | **P0** | Audit found all active paths delta-safe/transaction-safe; one dormant bug flagged for LEV-12, no live production bug. |
| LEV-14 | Leave | Employee leave-policy override | PARTIAL | P2 | Backend-only, no UI. Add only if HR requests it |
| LEV-15 | Leave | Old annual encashment concept | **SUPERSEDED** | | Replace with EMP-07 (exit-only). Do not build a yearly encashment payout flow |
| LEV-16 | Leave | Holiday type distinction (Normal vs Restricted). Normal holidays block leave applications (unchanged). Restricted holidays do NOT block applications: RH-eligible employees (per existing LEV-10 grant) may apply RH specifically for that day; any other employee may apply their normal leave types same as a working day. Fully opt-in — if unused, employee works normally that day, no leave consumed, no forced holiday. Leave-type picker on a restricted-holiday date must label that holiday as "<Holiday Name> (Restricted)" so employees see it's optional. | COMPLETE | P0 | HolidayType enum (NORMAL \| RESTRICTED) on Holiday model; default NORMAL; NORMAL blocks leave applications; RESTRICTED allows RH and standard leave applications and does not auto-deduct or force holiday; AdminHolidays UI type selector & badge, ApplyLeaveModal & Dashboard calendar labels. |
| NOTIF-01 | Notifications | In-app notification system (WebSocket, real-time) | MISSING | **P0** | See PRD §7 for exact trigger table |
| NOTIF-02 | Notifications | Leave-applied → Manager + HR | MISSING | P0 | Sub-item of NOTIF-01 |
| NOTIF-03 | Notifications | Manager-approved → HR + Employee | MISSING | P0 | Sub-item of NOTIF-01 |
| NOTIF-04 | Notifications | HR approve/reject → Employee | MISSING | P0 | Sub-item of NOTIF-01 |
| ERR-01 | Error Logging | Backend error capture (4xx/5xx) → DB | COMPLETE | **P0** | Ingestion middleware with payload sanitization |
| ERR-02 | Error Logging | Frontend error capture (React runtime errors) → DB | COMPLETE | **P0** | ErrorBoundary + Axios error interceptor |
| ERR-03 | Error Logging | 20-day flat auto-purge (scheduled job) | COMPLETE | **P0** | Daily 24-hour cron/interval job + manual purge endpoint |
| ERR-04 | Error Logging | SuperAdmin log viewer UI | COMPLETE | **P1** | Filter by company/date range/status code + dynamic company names + manual/bulk delete |
| SA-01 | SuperAdmin | SuperAdmin seed script (first-time DB setup) | COMPLETE | **P0** | Idempotent script: `prisma/seed.ts` |
| SA-02 | SuperAdmin | Company create/list | COMPLETE | **P0** | Atomic company + company admin onboarding form + table + credentials dialog |
| SA-03 | SuperAdmin | Company Admin password reset | COMPLETE | **P1** | SuperAdmin cross-company reset dialog with auto/manual password (min 6 chars) |
| SA-04 | SuperAdmin | Error log dashboard | COMPLETE | P1 | Live error telemetry dashboard under `/super-admin/error-logs` |
| SA-05 | SuperAdmin | SuperAdmin Account Management | COMPLETE | **P1** | Add, list, reset password, and deactivate with self-deactivation protection (`/super-admin/admins`) |
| SA-06 | SuperAdmin | Company User Directory & Reset | COMPLETE | **P1** | View all users across tenant companies and reset credentials |
| DATA-01 | Data Retention | `LeaveRequest` soft-delete → hard-delete after 6 months (scheduled job) | MISSING | **P1** | See PRD §8 |
| DATA-02 | Data Retention | Sandwich-day hard delete (immediate, on HR action) | COMPLETE | P0 | Same feature as LEV-08 |
| REP-01 | Reports | Employee report | COMPLETE | | |
| REP-02 | Reports | Leave report — Absent Days + pre-joining fix + terminology standardization | COMPLETE | | Absent Days dynamically computed & respects employee joiningDate; Terminology standardized to "Balance" / "Used"; Paid Leaves split into "Paid Leaves — Used" and "Paid Leaves — Balance". (LWP logic in report verified in synthetic tests, but LEV-06 remains flagged for real-tenant retest). |
| REP-03 | Reports | Pending approval warning | COMPLETE | | |
| UI-01 | UI | Remove "Total Allocated" from all leave balance displays (everywhere, including admin) | COMPLETE | **P0** | Displays only Available Balance + Used rounded to 2 decimal places via `formatLeaveDays`. See PRD §6.7 |
| TEST-01 | Testing | Isolated test-company infrastructure | COMPLETE | | Must be preserved — do not weaken |
| TEST-02 | Testing | Confirm/rule out test runs as cause of LEV-13 | COMPLETE | P0 | Confirmed drift was test-artifact, not test-run contamination of the calculation logic itself. |
| DEV-01 | Deployment | Local/LAN hosting | COMPLETE | | |
| DEV-02 | Deployment | Production hardening (HTTPS, secrets, backups) | PARTIAL | P1 | Unchanged from prior audit |

---

## 4. Leave Rules — Current Contract (Confirmed)

### 4.1 Year-End Treatment (per Leave Type, per Company)
```
1. Carry Forward up to cap (cap = 999 means effectively unlimited)
2. Anything remaining above the cap → Lapse
```
- No annual encashment exists. Encashment is exit-only (see §4.3).
- Configured by the company at leave-type creation/edit time in the admin dashboard — not a global default.

### 4.2 Sandwich Rule
- Single company-wide switch — no per-employee/per-leave-type policy.
- System auto-detects and applies sandwich deductions.
- HR/Company Admin exception path: open employee's day-wise leave breakdown → hard-delete the specific sandwich day → balance auto-recalculates and restores.
- This is a **permanent delete**, not a soft-delete flag.

### 4.3 Exit-Based Encashment
- Triggered only at employee resignation/offboarding.
- Applies only if the company has enabled encashment for that leave type.
- System logs: remaining balance, encashable days, amount owed (data only — no payment processing).
- Feeds a future payroll module; not paid out by this system.

### 4.4 Two-Step Approval (company toggle)
```
Employee applies
  → visible immediately to BOTH Manager and HR
  → No manager assigned? → routes directly to HR, HR is sole approver
  → Manager approves → notify HR + Employee → HR may now approve
  → HR approves → notify Employee → status: APPROVED
  → Manager rejects → status: REJECTED immediately → notify Employee → HR does NOT need to act
  → HR cannot approve before Manager has approved (if 2-step is enabled for that company)
```
- If HR needs to nudge a slow manager, that happens **outside the system** — no in-app reminder feature required.

### 4.5 LWP (stays PARTIAL / VERIFY)
- No allocation, no normal balance consumption, always available to apply.
- Approved LWP appears in reports as its own column (verified in synthetic test suite).
- **Flagged for Retest**: Stays `PARTIAL / VERIFY` until real usage data exists on a tenant company (current DB has 0 real LWP records) — must NOT be silently marked done without real-world usage verification.

---

## 5. Data Retention Contract

| Data type | Rule |
|---|---|
| `LeaveRequest` (approved/rejected/cancelled) | Soft-delete while active → **hard-deleted automatically 6 months** after terminal status date |
| Sandwich-day exception (`LeaveRequestDay`) | **Immediate hard delete** on HR action, no retention window |
| Error logs (all severities, frontend + backend) | **Flat 20-day retention**, then auto-purged |
| Everything else (Employee, Attendance, Org) | Existing soft-delete model unchanged |

---

## 6. Error Logging Contract

- Capture: all 4xx/5xx, backend **and** frontend.
- Fields: stack trace, endpoint, request payload, user ID, company ID, timestamp, IP address, user agent.
- Retention: 20 days flat, auto-purge job.
- Access: SuperAdmin-only UI, filterable.

---

## 7. Notification Contract

- Channel: in-app, WebSocket, real-time.
- No email/SMS/push in this phase.
- No geo-fence violation notifications.
- Trigger table: see §4.4 above (fully derived from the approval workflow).

---

## 8. Employee Master Data (Reference Table)

| Field | DB | API | UI | Status |
|---|---|---|---|---|
| Employee Code | YES | Auto / Explicit | YES | COMPLETE |
| First / Middle / Last / Display Name | YES | YES | YES | COMPLETE |
| Company Email | YES | YES | YES | COMPLETE (SSO safeguards + AuditLog) |
| Personal Email | YES | YES | YES | COMPLETE |
| Phone | YES | YES | YES | COMPLETE |
| Gender | YES | YES | YES | COMPLETE |
| DOB / Joining Date | YES | YES | YES | COMPLETE |
| Department / Team / Designation | YES | YES | YES | COMPLETE |
| Primary Manager | YES | YES | YES | COMPLETE |
| **Secondary Manager** | YES | YES | YES | COMPLETE (Optional, Tenant-Isolated) |
| Employment Status | YES | YES | YES | COMPLETE |
| Employment Type | Partial (`isProbation`) | Partial | Partial | COMPLETE |
| Initial Leave Grant | YES | YES | YES | COMPLETE |

---

## 9. Technical Debt

| ID | Item | Priority |
|---|---|---|
| TD-01 | `bootstrapLeaveBalances` exists, unused by employee creation — decide: wire in or remove | P3 |
| TD-02 | Unused employee repository methods (`getLeavePoliciesForCompany`, `createManyLeaveBalances`, `getLeaveBalance`, `incrementLeaveBalance`) | P3 |
| TD-03 | `User.role` single-enum → replace with role-membership model (blocks AUTH-04) | **P0** |
| TD-04 | Clean and document seed/import strategy (employee code, org hierarchy, SuperAdmin) | P0 |
| TD-05 | Old "annual encashment" concept in prior docs is superseded — remove/correct any lingering references in code comments or docs | P2 |
| TD-06 | Temporary compatibility shim `role: user.roles[0]` in backend auth & user responses — remove once Phase 2/3 frontend multi-role UI fully consumes `roles: UserRole[]` directly | P2 |


Do not delete code solely because it's currently unused — verify intended use first (per TD-01).

---

## 10. Priority Roadmap

### P0 — Blocking / Immediate
- [x] **LEV-13 / TEST-02** — Diagnose leave balance mismatch (audit confirmed active paths delta-safe/transaction-safe; demo account reset)
- [x] **LEV-16** — Holiday type distinction (Normal vs Restricted) — HolidayType enum on Holiday model, non-blocking RESTRICTED handling, AdminHolidays & ApplyLeaveModal UI, comprehensive test suite.
- [x] **REP-02** — Leave report: Absent Days fixed (respects joiningDate) + pre-joining attendance fix + terminology standardized to Used/Balance (Paid Leaves split).
- [ ] **LEV-06 (LWP Retest)** — Retest LWP report column against real production usage data once configured on any tenant organization (currently 0 real LWP records in DB).
- [x] **UI-01** — Remove "Total Allocated" from every leave display, everywhere
- [x] **AUTH-04 / TD-03** — Build multi-role model (`UserRole` join table + permission-check rewrite + UI switcher)
- [x] **LEV-03** — Build 2-step approval workflow (company-level toggle, new status states)
- [x] **LEV-08 / DATA-02** — Build sandwich-day exception tool & day-level breakdown deletion (day-wise breakdown + hard delete via `leaveApi.deleteDays` + balance restoration + per-day status transitions)
- [ ] **LEV-12** — Build year-end treatment engine (carry-forward with cap → lapse)
- [ ] **NOTIF-01 through 05** — Build real-time in-app notification system for the leave workflow
- [x] **ERR-01/02/03** — Build error logging capture (frontend + backend) + 20-day auto-purge
- [x] **SA-01, SA-02 (UI)** — SuperAdmin seed script + company create/list dashboard
- [x] **EMP-03, EMP-05** — Complete employee master schema (phone, gender, personalEmail) + atomic onboarding + explicit code assignment

### P1 — Important, Follows P0
- [x] **EMP-04** — Secondary Reporting Manager (schema + API + UI)
- [x] **MGR-01 / MGR-02** — Manager dashboards (reportee-scoped leave + attendance views, primary + secondary)
- [ ] **EMP-07** — Exit-based encashment logging, tied into offboarding flow
- [ ] **DATA-01** — Scheduled 6-month hard-delete job for terminal-status leave requests
- [x] **ERR-04 / SA-04** — SuperAdmin error log viewer
- [x] **SA-03 (UI)** — Company Admin password reset UI
- [ ] **DEV-02** — Production hardening (HTTPS, secrets, backups, migration/restart validation)

### P2 — Future
- [ ] **ATT-05** — Investigate intermittent check-in/out UI lag
- [ ] **LEV-14** — Employee leave-policy override UI (only if HR requests it)
- [ ] **EMP-06** — Employee self-profile edit UI
- [ ] Finer-grained HR permission restriction (Company Admin limiting HR scope) — design for extensibility now, build later

### P3 — Cleanup
- [ ] **TD-01, TD-02, TD-05** — Dead code cleanup

---

## 11. Explicitly Deferred / Not Required

| Item | Status | Decision |
|---|---|---|
| Automatic maternity/paternity assignment | DEFERRED | HR manages manually |
| Religion-based Restricted Holiday eligibility | NOT REQUIRED | RH is a normal leave type; HR manually grants |
| Fractional holidays | NOT REQUIRED | Holidays are full-day only |
| Annual leave encashment payout | **SUPERSEDED / NOT REQUIRED** | Replaced entirely by exit-only encashment logging (EMP-07) |
| Email/SMS/push notifications | DEFERRED | In-app + WebSocket only, this phase |
| In-app "remind manager" button | NOT REQUIRED | HR reminds manager outside the system |
| Payroll (any form) | DEFERRED | Explicit future phase |
| Geo-fence violation notifications | NOT REQUIRED | Confirmed not needed |

---

## 12. Production Definition of Done

### Employee
- [x] Phone, gender, employment type fields exist end-to-end
- [x] Secondary manager field exists end-to-end (optional)
- [x] Personal email exposed in create/update APIs and forms
- [x] Employee code explicit-import path works for seeding / creation
- [x] Multi-role assignment works (`EMPLOYEE+HR`, `EMPLOYEE+COMPANY_ADMIN`)

### Leave
- [x] Application and single-approver approval
- [x] 2-step approval workflow (company toggle) working end-to-end with correct status states
- [x] Balance management (correction-based)
- [x] Fractional/hourly values
- [ ] LWP correctly represented in reports
- [x] Sandwich detection (including cross-request bridge detection & retroactive adjustment)
- [x] Sandwich-day exception tool & day-level breakdown deletion (hard delete + recalculation + balance restoration)
- [x] Holidays
- [ ] Year-end carry-forward/lapse engine
- [ ] Exit-based encashment logging
- [x] Leave balance mismatch root-caused and fixed
- [x] "Total Allocated" removed from all UI

### Manager Self-Service
- [x] Reportee-scoped leave dashboard (primary + secondary)
- [x] Reportee-scoped attendance dashboard (primary + secondary)

### Notifications
- [ ] Real-time WebSocket delivery working
- [ ] All 5 trigger points firing correctly

### Error Logging
- [x] Backend + frontend capture working
- [x] 20-day auto-purge job running
- [x] SuperAdmin viewer UI functional (with From/To date filtering, company resolution, and bulk delete)

### SuperAdmin
- [x] Seed script for first SuperAdmin account (`prisma/seed.ts`)
- [x] Company create/list UI & onboarding credentials modal
- [x] Company Admin password reset UI (auto/manual 6+ chars)
- [x] SuperAdmin account management UI (`/super-admin/admins` with self-deactivation protection)
- [x] Company user directory & reset modal
- [x] Error log dashboard (`/super-admin/error-logs`)

### Reports
- [x] Employee report
- [ ] Leave report (LWP/Absent bug fixed)
- [x] Excel/CSV
- [x] Pending approval handling

### Testing
- [x] Isolated test data
- [x] Real-company mutation protection
- [x] Diagnostic leftover sweep tool (`npm run audit:leftovers`)
- [x] Confirm test runs are/aren't contributing to balance mismatch

### Deployment
- [ ] Production HTTPS
- [ ] Secure production cookies/secrets
- [ ] DB backup/recovery procedure
- [ ] Production migration procedure
- [ ] Restart/recovery validation

---

## 13. Change Log

| Date | Change |
|---|---|
| 2026-09-04 | Initial master roadmap created from HRMS Holistic Architecture Audit. |
| 2026-09-04 | Full revision after business-decision clarification round: added multi-role model, 2-step approval workflow, manager dashboards, sandwich-day exception tool, corrected encashment model (exit-only, not annual), notification system, error logging system, data retention rules, SuperAdmin scope, and flagged two live bugs (leave balance mismatch, LWP/Absent report defect). |
| 2026-09-05 | Implemented SuperAdmin onboarding & account management (Module A: `/api/superadmins`, `/super-admin/admins`), Company User Directory & scoped reset (Module B: `/api/company/:companyId/users*`), and Centralized Error Logging System & telemetry dashboard with From/To date filtering, company resolution, and bulk deletions (Module C: `/api/error-logs*`, `/super-admin/error-logs`). |
| 2026-09-05 | Implemented Atomic Employee Onboarding & Master Data Parity (`EMP-03`, `EMP-04`, `EMP-05`): added phone, gender, secondary manager, personal email, explicit employee code; updated Quick Edit modal and AdminCreateEmployee; built company email editing endpoint (`PATCH /api/users/:userId/email`) with SSO safeguards, refresh token invalidation, and audit logging; built standalone leftover sweep tool (`npm run audit:leftovers`) and documented testing naming conventions. |
| 2026-09-05 | Resolved confirmed leave management root causes: configured backend dev server with `tsx --watch` for hot-reloading; upgraded `updateLeaveRequestDayStatus` to a full status-transition engine with per-day approve (deduct) / reject (restore) balance deltas, parent status transitions, and dynamic duration recalculation; enhanced `deleteLeaveRequestDays` to hard-delete days, restore balance on approved days, and adjust parent requests; updated frontend `AdminLeaveDayBreakdownDialog.tsx` with checkboxes, Select All, and "Delete Selected Days (X)" modal wired to `leaveApi.deleteDays`; connected balance refetching on action success; added comprehensive automated tests in `tests/leave-fixes.test.ts` (18 suites total). |
| 2026-09-05 | Added LEV-16 (Holiday type distinction: Normal vs Restricted) to roadmap per business clarification — connects Holiday model with existing RH eligibility (LEV-10). |
| 2026-09-05 | Closed out LEV-13, TEST-02, and UI-01: comprehensive audit confirmed all active balance-mutating paths are delta-based and transaction-safe; flagged dormant bug in runYearEndRollover for LEV-12; reset hr@phi.com demo balance; removed Total Allocated from all UI screens and added 2-decimal formatting (formatLeaveDays). |
| 2026-09-05 | Implemented LEV-16 (Holiday Type Distinction): added `HolidayType` enum (`NORMAL` \| `RESTRICTED`, default `NORMAL`) to `Holiday` model with migration; updated leave application validation and sandwich detection to allow leave on restricted holidays; updated attendance & report services to treat restricted holidays as opt-in working days; added Holiday Type selector & badges to `AdminHolidays.tsx`; added holiday notices to `ApplyLeaveModal.tsx` and calendar labels to `EmployeeDashboard.tsx`; added automated test suite `tests/holiday-type.test.ts` (19 suites passing). |
| 2026-09-05 | Resolved REP-02: fixed pre-joining attendance evaluation (past dates before joining date suppressed from ABSENT status to UNRECORDED across calendar, dashboard, and leave reports); standardized report column terminology to "Balance" / "Used" per PRD §8.7 and split "Paid Leaves Total" into "Paid Leaves — Used" and "Paid Leaves — Balance" (preview, Excel, CSV, and UI table); audited LWP in DB (0 real records exist) and flagged LEV-06 as PARTIAL / VERIFY for live tenant retest. |
| 2026-09-06 | Modernized date/time pickers across entire frontend via `@mui/x-date-pickers` (26 inputs across 9 files); fixed duplicate date field in Admin Attendance; updated Leave Report table and Excel export to 2-row merged "Total Paid Leaves" header; added Month step navigator pill to Leave Report; exposed `sessions` array on all backend attendance endpoints; built reusable `<DaySessionDetail>` component; fixed matrix hover tooltip flickering using `<Popper>`; enabled multi-session visibility on Employee Dashboard weekly view & monthly modal with unified dark slate styling. |
| 2026-09-06 | Implemented Multi-Role Support (`AUTH-04` / `TD-03`): added `UserRoleAssignment` join table with unique compound constraint and migration; updated JWT claims to `roles: UserRole[]`; updated auth and user services/controllers/guards; built multi-role onboarding and edit dialogs; added profile dropdown view switcher between Admin and Employee views with route guards and dynamic navigation items. |
| 2026-09-06 | Implemented 2-Step Leave Approval Workflow (`LEV-03`): added company-level `LeaveApprovalWorkflow` toggle (`TWO_STEP` vs `DIRECT_TO_HR`); added `PENDING_MANAGER` and `PENDING_HR` approval states; enforced server-side manager authorization with coworker 403 blocking; audited and updated all pending status checks across attendance, reports, and dashboards; built manager/HR approval action UI in `LeaveRequestList.tsx` and `AdminLeaveDashboard.tsx`. |
| 2026-09-06 | Implemented Manager Self-Service Views (`MGR-01` / `MGR-02`): built `/api/manager/reportees`, `/api/manager/leaves`, and `/api/manager/attendance` endpoints; built `ManagerTeamLeaveSection.tsx` with quick approve/reject and filterable history; built `ManagerTeamAttendanceSection.tsx` with monthly presence grid and session popovers; integrated conditional "My Team" tab with live pending badge on `EmployeeDashboard.tsx`. |
| 2026-09-06 | Renamed Workplace Settings tab to "Leave & Attendance Policies"; resolved MUI floating label clipping bug across all stacked outlined dialogs (`ApplyLeaveModal`, `HrCancelDialog`, `AdminMarkLeaveDialog`, `AdminBulkLeaveAllocationDialog`, `AdminEditLeaveAllocationDialog`, `AdminYearEndRolloverDialog`, `ChangePasswordModal`, `ManagerTeamLeaveSection`); added live pending leave count notification badge to Leave Dashboard card on Admin main dashboard (`/admin`). |



---

## LLM Operating Rules
1. Read `PRD.md` and this file before changing any code.
2. Check the feature ID and status before implementing anything — do not re-implement `COMPLETE` items without a reported `BUG`.
3. Do not implement `DEFERRED` or `NOT REQUIRED` items unless the product owner explicitly changes scope.
4. Treat `VERIFY` items as investigation tasks first — do not write a fix before the root cause is confirmed (especially LEV-13).
5. After implementation, update the relevant status, and move it from the Priority Roadmap into the appropriate `COMPLETE` row in §3.
6. Add every meaningful change to the Change Log (§13).
7. `PRD.md` is the source of truth for *business rules*; this file is the source of truth for *status and priority*. Keep them consistent.
8. Code, schema, and tests remain the ultimate implementation source of truth — these documents describe intent and progress, not guaranteed current code state.