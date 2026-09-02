# HRMS Roadmap

> **Purpose:** Short, machine-readable project state for the next LLM/agent.
>
> `PRD.md` = what HRMS should do.
>
> `roadmap.md` = what is done, what is broken, and what to do next.
>
> Do not infer product rules from implementation. If a business rule is marked **OPEN**, stop and clarify it before coding.

---

# 0. Current State

**Stage:** Pre-UAT / business-rule stabilization.

The application has substantial working functionality across authentication, employees, attendance, leave, organization, dashboards, and deployment.

Automated tests have recently been isolated into temporary test-company sandboxes and reported as passing. Future tests must never mutate existing company data.

The next priority is **not new feature development**. First finalize and correct the business rules, especially Leave Management.

---

# 1. Hard Rules for Agents

- Never modify real/existing company data from automated tests.
- Tests may modify only records created by that test.
- Every test must clean up its own data, including on failure.
- Never use `findFirst()` to obtain an arbitrary real company/user for tests.
- Do not create permanent debug/verification scripts unless explicitly requested.
- Do not silently change business rules.
- Before destructive DB cleanup, identify exact records and dependencies.
- Prefer small scoped changes over broad refactors.
- Run TypeScript/build/tests after relevant changes.
- Preserve tenant isolation.
- Backend authorization is mandatory; frontend-only protection is insufficient.
- Do not mark a roadmap item `[x]` based only on code existing. Mark it complete only after verification.

---

# 2. Status Legend

- `[x]` Implemented + verified
- `[~]` Implemented but incomplete / needs verification
- `[ ]` Not implemented
- `[!]` Known bug / must fix
- `[?]` Business decision required

---

# 3. Completed Foundation

- [x] Multi-tenant `companyId` architecture
- [x] Prisma/PostgreSQL migrations
- [x] Baseline database seed
- [x] Real employee seed/backfill process
- [x] Swagger/OpenAPI
- [x] Dynamic CORS
- [x] LAN deployment configuration
- [x] Docker Compose PostgreSQL/Adminer
- [x] Production frontend build

---

# 4. Authentication & Authorization

- [x] Email/password login
- [x] JWT access tokens
- [x] Refresh-token cookie/session rotation
- [x] Logout
- [x] Forced first-login password change
- [x] Role-based guards
- [x] Google SSO frontend/backend
- [x] Microsoft SSO frontend/backend
- [x] Admin-assisted password reset
- [x] Login "Forgot password?" contact-HR flow
- [~] Logout all devices — backend exists; route/UI incomplete

## Security Bugs

- `[!]` Add `requireRole(HR, COMPANY_ADMIN)` to `GET /api/employees/`

---

# 5. Employee Management

- [x] Employee directory
- [x] Employee profile
- [x] Employee self-profile backend
- [x] Employee onboarding
- [x] Leave balance bootstrapping
- [x] Manager assignment/reassignment
- [x] Admin profile editing
- [x] Employee active/inactive management
- [x] Employee search + filters
- [x] Quick-edit modal
- [ ] Employee self-profile frontend modal
- [ ] Admin user account directory

**Decision:** CSV bulk-import UI/API is not currently required.

---

# 6. Attendance

- [x] Check-in
- [x] Check-out
- [x] Multi-session daily attendance
- [x] Daily attendance calculation
- [x] Attendance history/calendar
- [x] Leave-aware attendance
- [x] Partial-day target adjustment
- [x] Designation attendance policy
- [x] Employee attendance override
- [x] Geo-fence violation logging
- [x] HR attendance correction
- [x] HR manual punch creation
- [x] Attendance administration page
- [x] Attendance dashboard
- [x] Company working-hours configuration
- [x] Lunch/break/grace configuration
- [x] Forgotten checkout at day boundary
- [x] Geo-fencing OFF behavior
- [x] Geo-fencing ON behavior

### Future Improvements

- [ ] Better forgotten-checkout workflow
- [ ] Flag system-generated checkout
- [ ] HR review of auto-closed attendance

---

# 7. Leave Management — CURRENT TOP PRIORITY

## 7.1 Business Rules

- `[?]` Finalize complete leave-type catalog
- `[?]` Finalize leave-policy structure
- `[?]` Finalize HR allocation/grant rules
- `[?]` Decide whether HR can subtract/revoke allocated leave
- `[?]` Finalize carry-forward rules
- `[?]` Finalize partial-day rules
- `[?]` Finalize cancellation rules
- `[?]` Finalize day-level approval/rejection rules
- `[?]` Finalize sandwich rules
- `[?]` Finalize restricted-holiday rules

## 7.2 Balance Accounting

- `[!]` Critical Audit Completed: Discovered child `LeaveRequestDay` records remain `APPROVED` when parent is cancelled via `hrCancelApprovedLeave`.
- `[!]` Absence of reconciliation routine allows historical 1-day phantom balance drift to persist.
- [x] Update `hrCancelApprovedLeave` to synchronize child `LeaveRequestDay.status = CANCELLED` and `deductDays = 0`.
- [x] Delete leave request HR action with exact deducted balance restoration (`DELETE /api/leave/requests/:requestId`).
- [ ] Implement atomic `reconcileEmployeeLeaveBalance(employeeId, leaveTypeId, year)` routine:
  ```text
  used = sum(deductDays of active APPROVED leave request days)
  remaining = allocated + carriedForward - used
  ```
- [x] Prevent double deduction when parent request and child days are both processed.

## 7.3 Leave UI / Operations

- [x] Employee leave application
- [x] Employee leave balance display
- [x] Employee leave request list
- [x] HR pending leave list
- [x] HR approve/reject
- [x] HR cancel approved leave — synchronized child days
- [x] HR delete leave request (pending, approved with exact restoration, rejected, cancelled)
- [x] Multi-day day-breakdown modal
- [x] Local draft day status changes (Edit + Save workflow)
- [x] Approve Remaining (selectively operates on draft PENDING days)
- [x] Reject Remaining (selectively operates on draft PENDING days)
- [x] Cancel without persistence
- [x] Save Changes (persists modified day statuses sequentially with progress handling)
- [x] Day-level state transitions and draft chips
- [x] Employee-centric leave management redesign in Leave Dashboard (Employee search + profile modal)
- [x] Hide zero-entitlement leave types (`allocated=0 && used=0 && carriedForward=0 && remaining=0`) from employee view
- [x] Sandwich leave prominent badge (`SANDWICH LEAVE`)
- [ ] Leave type admin configuration page
- [ ] Leave policy admin configuration page
- [ ] Leave encashment frontend
- [ ] Employee-specific policy override frontend — likely requires reconsideration after policy redesign

---

# 8. Sandwich Policy

**Final direction: company-wide only.**

- [x] Company-level `sandwichRuleEnabled`
- [x] Company-level API update
- [x] Weekend/holiday sandwich calculation exists
- [x] HR exemption of individual sandwich bridge days
- [ ] Remove/retire leave-wise sandwich configuration
- [ ] Audit obsolete `EmployeeLeaveOverride.allowSandwich` if no longer required
- [x] Verify separate Friday + Monday requests (isolated tests)
- [x] Verify continuous Friday → Monday request (isolated tests)
- [x] Verify cross-leave-type weekend bridging (isolated tests)
- [ ] Verify cancellation and balance reversal with sandwich bridge days
- `[!]` Ensure sandwich deductions use actual day-level deductions during reversal

---

# 9. Leave Types / Policies

- [x] Leave type retrieval
- [x] Baseline leave types exist
- [x] Carry-forward configuration exists
- [ ] Finalize leave policy model
- [ ] Finalize leave allocation UX
- [ ] Finalize HR grant/revoke permissions
- [ ] Verify PL carry-forward
- [ ] Verify SL no carry-forward
- [ ] Verify CLP no carry-forward
- [ ] Verify Marriage no carry-forward
- [ ] Verify Maternity no carry-forward
- [ ] Verify Paternity no carry-forward
- [ ] Verify LWP no carry-forward
- [ ] Verify RH behavior
- `[?]` Finalize Comp Off behavior

---

# 10. Restricted Holidays

**Design direction:** eligibility/allocation based, not hard-coded religion logic.

- `[?]` Finalize data model
- `[?]` Finalize HR allocation UX
- `[ ]` Create restricted-holiday catalog
- `[ ]` Assign RH eligibility to employees
- `[ ]` Show only eligible RH to employee
- `[ ]` Apply/approve RH through normal leave workflow
- `[ ]` Verify common holidays remain separate

---

# 11. Manager / Reportee Workflow

- [x] Manager assignment
- [~] Manager hierarchy exists in employee profile
- [ ] Manager dashboard/view for reportees
- [ ] Manager sees reportee leave requests
- [ ] Manager approves reportee leave
- [ ] Manager rejects reportee leave
- [ ] Manager cannot approve unrelated employees
- [ ] Verify HR/Admin override behavior

---

# 12. Employee Lifecycle

- [x] Basic active/inactive state
- [x] Canonical offboarding service route consolidation
- [ ] Full offboarding workflow verification
- [ ] Employee/User status synchronized
- [ ] Inactive user login blocked

---

# 13. Reports Module & Dashboard

- [x] Company-scoped Employee Report (`/api/reports/employee`)
- [x] All company employees included as rows (LEFT JOIN semantic)
- [x] Human-readable primary manager name resolution
- [x] Company-scoped Leave Report (`/api/reports/leave`)
- [x] Dynamic leave type column detection (`<Leave Type> -> Booked`, `<Leave Type> -> Balance`)
- [x] Leave aggregate columns: Paid Leaves Total, LWP Total, Absent Days
- [x] Pending leave approval warning check & confirmation workflow (`confirmPending=true`)
- [x] Pending leave strictly excluded from Booked/Used totals
- [x] Decimal and fractional leave balance preservation (`3.5`, `6.25`, etc.)
- [x] Multi-level grouped header Excel export (`.xlsx`) via ExcelJS
- [x] RFC-4180 compliant flattened CSV export (`.csv`)
- [x] Frontend Reports Dashboard page (`/admin/reports`) with preview table & export triggers
- [x] 100% company-isolated automated test suite with zero real data mutations
- [ ] Sessions invalidated
- [ ] Open attendance session closed
- [ ] Future approved leave auto-cancelled
- [ ] Pending leave auto-rejected
- [ ] Historical data preserved
- [ ] Reactivation
- [ ] Reactivated employee can login
- [ ] Lifecycle automated tests

**By design:** manager reassignment on offboarding remains manual.

**Out of scope:** payroll/final leave settlement.

---

# 13. Organization Management

- [x] Departments CRUD
- [x] Teams CRUD
- [x] Designations CRUD
- [x] Attendance policy configuration
- [x] Employee attendance overrides
- [x] Employee → Designation → System precedence

---

# 14. HR/Admin Dashboards

- [x] Admin dashboard
- [x] Attendance dashboard
- [x] Leave dashboard
- [x] Employee directory
- [x] Holiday management
- [x] Geo-fencing settings
- [x] Organization management
- [x] Super Admin company dashboard
- [ ] Admin user directory

---

# 15. Navigation / UX

- [x] Navigation overhaul
- [x] Shared page header/back button
- [x] Clickable HRMS logo
- [x] Role-aware home navigation
- [x] Responsive navigation
- [ ] Final role-routing verification
- [ ] Final full navigation audit after current feature changes

---

# 16. Testing

## Test infrastructure

- [x] Automated tests audited for unsafe real-data access
- [x] Isolated test-company fixture created (`createIsolatedTestCompany`)
- [x] Tests use test-created users/employees only
- [x] Bulk operations isolated from live company
- [x] Rollover tests isolated from live company
- [x] Deterministic `finally` cleanup implemented across all suites
- [x] Cryptographic zero-mutation safety check added to test runner
- [x] All 10 test suites passing cleanly & isolated (`npm test`)

## Hard requirement

```text
TEST CREATES RECORD
        ↓
TEST USES RECORD
        ↓
TEST FINISHES
        ↓
TEST DELETES RECORD
```

Tests must never touch existing UAT/company data.

## Next test coverage

- [ ] Leave balance transition matrix
- [ ] Day-level approval/rejection
- [ ] Cancellation after partial approval
- [ ] Sandwich + day-level changes
- [ ] Manager/reportee authorization
- [ ] Restricted holiday eligibility
- [ ] Full onboarding lifecycle

---

# 17. Database / Cleanup

- [ ] Audit obsolete leave/sandwich fields after final business rules
- [x] Remove obsolete test-only records (`DWL2652`, *PerDay Emp_8543*, *DayWise Tester*, leftover test company)
- [x] Remove obsolete debug/verification scratch scripts
- [ ] Review old `EmployeeLeaveOverride` usage
- [ ] Do not delete schema fields until all references/migrations are audited

---

# 18. Fresh Deployment / UAT

Do this **only after leave rules are finalized**.

- [ ] Backup current DB/reference data
- [ ] Prepare clean seed from Excel source
- [ ] Clean/reset test/UAT database
- [ ] Seed baseline company/master data
- [ ] Seed required employees/data
- [ ] Create Super Admin
- [ ] Super Admin creates company
- [ ] Company Admin onboarding
- [ ] Organization setup
- [ ] Employee onboarding
- [ ] Manager/reportee setup
- [ ] Leave policy setup
- [ ] Leave allocation
- [ ] Holiday setup
- [ ] Restricted holiday setup
- [ ] Attendance setup
- [ ] Employee workflow
- [ ] Manager approval workflow
- [ ] HR/Admin workflow
- [ ] Full end-to-end UAT

---

# 19. Immediate Execution Order

## Step 1 — Leave Management redesign

Do not code yet.

Finalize:

1. Leave Types
2. Leave Policies
3. Allocation
4. HR grant/revoke
5. Balance calculation
6. Approval/rejection
7. Cancellation
8. Day-level changes
9. Sandwich
10. Restricted Holidays

## Step 2 — Implement corrected leave rules

## Step 3 — Verify with isolated automated tests

## Step 4 — Clean obsolete schema/data

## Step 5 — Prepare Excel-driven fresh seed

## Step 6 — Fresh company onboarding test

## Step 7 — Manager/reportee workflow

## Step 8 — Restricted holidays

## Step 9 — Full UAT

---

# 20. Current Stop Point

**Do not start the fresh deployment yet.**

The project is currently blocked by **Leave Management business-rule finalization and accounting correctness**.

Once that is stable, the next major milestone is:

> **Fresh Super Admin → Company → Admin → Employee → Manager → Reportee end-to-end onboarding/UAT.**
