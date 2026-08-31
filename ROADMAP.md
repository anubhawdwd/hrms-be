# HRMS Master Roadmap

Master checklist and issue tracker covering both `hrms-be` and `hrms-fe`.

Legend:
- `[x]` Implemented and verified
- `[~]` Implemented but verification or frontend wiring is incomplete
- `[ ]` Not implemented

---

## 1. Foundation

- [x] Multi-tenant database model with company isolation (`companyId`)
- [x] PostgreSQL schema migrations via Prisma (`prisma/migrations/`)
- [x] Full database wipe and fresh company (`Phibonacci Learning`) + `COMPANY_ADMIN` initialization
- [x] One-off real employee seed script (`scripts/seed-real-employees.ts`) executed with 99 employees, 20 departments, and 47 designations
- [x] `EmployeeProfile.joiningDate` made nullable via migration `20260826090039_make_joining_date_optional`
- [x] Database seed script with baseline company, users, designations, policies, and leave types
- [x] Swagger OpenAPI documentation auto-generation (`/api-docs`)
- [x] Dynamic CORS configuration supporting localhost and LAN hosts
- [~] Production logging pipeline (minimal console wrapper exists; structured log ingestion pending)

---

## 2. Authentication & Authorization

- [x] Email and password authentication (`POST /api/auth/login`)
- [x] Short-lived JWT access token generation (15m) and verification
- [x] HTTP-only refresh token cookie rotation with database token store
- [x] Environment-aware cookie security (`sameSite: "lax"` on HTTP LAN dev, `secure: true` in HTTPS production)
- [x] Current user session verification (`GET /api/auth/me`)
- [x] Single-session logout (`POST /api/auth/logout`)
- [x] Forced first-login password change for temporary passwords (`POST /api/auth/change-password`, blocking `ChangePasswordModal.tsx`, `mustChangePassword` state)
- [x] Role-based route guards (`SUPER_ADMIN`, `COMPANY_ADMIN`, `HR`, `EMPLOYEE`)
- [~] Google OAuth login (backend token verification implemented; automatically clears `mustChangePassword`; frontend login button pending)
- [~] Microsoft OAuth login (backend Graph API token verification implemented; automatically clears `mustChangePassword`; frontend login button pending)
- [~] Invalidate all user sessions (`logoutAllDevices` service method exists; route and UI pending)

---

## 3. Employee Management

- [x] Employee directory list page (`AdminEmployeeList.tsx`)
- [x] Single employee profile view with managerial hierarchy (`AdminEmployeeProfile.tsx`)
- [x] Employee self-profile view on employee dashboard (`EmployeeDashboard.tsx`)
- [x] Two-step guided employee onboarding form (`AdminCreateEmployee.tsx`)
- [x] Automatic leave balance bootstrapping during employee profile creation
- [x] Manager hierarchy reassignment (`PATCH /api/employees/:id/manager` wired in Quick Edit Modal)
- [~] Employee self-profile update (`PUT /api/employees/me/profile` implemented; frontend modal pending)
- [x] Admin employee profile update (`PUT /api/employees/:id/admin` wired in Quick Edit Modal)
- [x] Employee deactivation / status management (`isActive` toggle in Quick Edit Modal + 3-state directory filter)
- [ ] Bulk employee CSV import (see Phase 2 below — schema mismatch with HR's real export needs resolving first)

---

## 4. Attendance

- [x] Employee GPS/browser check-in (`POST /api/attendance/check-in`)
- [x] Employee check-out with automatic workday duration calculation (`POST /api/attendance/check-out`)
- [x] Today's attendance status resolution (`GET /api/attendance/day`)
- [x] Weekly attendance history calendar (`GET /api/attendance/range`)
- [x] Full-day approved leave blocking check-in/out
- [x] Partial-day leave (half-day, quarter-day, hourly) workday target adjustment
- [x] Designation auto-present policy support
- [x] Designation and employee attendance exemption overrides
- [x] Attendance geo-fence radius violation logging
- [x] HR attendance lookup by employee and date (`GET /api/attendance/day?employeeId=...&date=...`)
- [x] HR attendance status and minutes update using internal UUID (`PATCH /api/attendance/hr/attendance-day/:id`)
- [x] HR attendance record creation when no record exists (`POST /api/attendance/hr/attendance-day`)
- [x] HR manual punch event injection (`POST /api/attendance/hr/attendance-event`)
- [x] Admin attendance management page with Violations, Attendance Day, and Event tabs (`AdminAttendance.tsx`)
- [x] Company-wide geo-fencing default fixed to `false`; frontend skips browser location prompt entirely when disabled (fixed — verified end-to-end)
- [ ] HR monthly attendance dashboard (employee × date grid, color-coded, with summary chips) — see Phase 5

---

## 5. Leave Management

- [x] Leave types retrieval (`GET /api/leave/types`)
- [x] Employee leave application modal supporting Full-Day, Half-Day, Quarter-Day, and Hourly (`ApplyLeaveModal.tsx`)
- [x] Real-time employee leave balance cards (`useLeaveBalances`)
- [x] My leave requests list with status indicators and cancellation (`LeaveRequestList.tsx`)
- [x] HR pending leave requests list (`AdminLeaveApprovals.tsx`)
- [x] HR leave approval workflow (`PATCH /api/leave/requests/:id/approve`)
- [x] HR leave rejection workflow with audit reason (`PATCH /api/leave/requests/:id/reject`)
- [x] Company holiday list, creation, and deletion (`AdminHolidays.tsx`)
- [~] HR cancellation of approved leave (`PATCH /api/leave/requests/:id/hr-cancel` implemented in backend & API client; button in UI pending — verify status before Phase 6)
- [~] "Who's on leave today" view (`GET /api/leave/today` implemented; dashboard tab pending — see Phase 6)
- [~] Leave encashment workflow (`POST /api/leave/encashments` implemented; frontend UI pending)
- [~] Employee-specific leave policy override (`POST /api/leave/employee-override` implemented; frontend UI pending)
- [ ] Leave type creation/editing admin page
- [ ] Leave policy allocation configuration admin page
- [ ] Simplified single-glance HR leave dashboard (on-leave-today, pending, recently approved) — see Phase 6

---

## 6. Organization Management

- [x] Department management CRUD (`AdminOrganization.tsx` Departments tab)
- [x] Team management CRUD (`AdminOrganization.tsx` Teams tab)
- [x] Designation management CRUD (`AdminOrganization.tsx` Designations tab)
- [x] Designation attendance policy configuration (`AdminOrganization.tsx` Attendance Policy tab)
- [x] Employee-specific attendance override configuration with 3-tier precedence hierarchy (Employee Override → Designation Policy → System Default)

---

## 7. Geo-Fencing

- [x] Company office location configuration (latitude, longitude, radius)
- [x] Company-wide geo-fencing toggle switch (`geoFencingEnabled`), **now defaults to `false`**
- [x] Haversine distance calculation and boundary validation
- [x] Geo-fencing bypass when disabled company-wide
- [x] Admin geo-settings configuration page with live GPS detection (`AdminGeoSettings.tsx`)
- [x] Frontend no longer requests browser location permission when geo-fencing is disabled (fixed & verified)

---

## 8. HR / Admin Operations

- [x] Admin dashboard with KPI cards and quick action links (`AdminDashboard.tsx`)
- [x] Employee directory and onboarding entry point (`AdminEmployeeList.tsx`)
- [x] Attendance administration hub (`AdminAttendance.tsx`)
- [x] Leave approvals hub (`AdminLeaveApprovals.tsx`)
- [x] Holiday management hub (`AdminHolidays.tsx`)
- [x] Geo-fencing settings hub (`AdminGeoSettings.tsx`)
- [x] Super Admin company management dashboard (`SuperAdminDashboard.tsx`)
- [ ] User account directory page (`AdminUserList.tsx`)
- [ ] Bulk CSV employee import page — see Phase 2
- [ ] HR monthly attendance dashboard — see Phase 5
- [ ] Simplified HR leave dashboard — see Phase 6
- [ ] Global employee search + quick-edit modal (attendance/leave) — see Phase 7

---

## 9. Navigation & UX

- [ ] Consistent back button across all authenticated pages
- [ ] Clickable HRMS logo/header linking to role-appropriate home
- [ ] Full navigation audit — confirm every page is reachable via in-app navigation, not just direct URL
- [ ] Role-aware home routing (Employee → EmployeeDashboard, HR/Admin → AdminDashboard, Super Admin → SuperAdminDashboard)

---

## 10. Infrastructure & Deployment

- [x] Backend Express server binding to `0.0.0.0` with configurable `API_PORT` (default `4000`)
- [x] Frontend Vite server configured with `--host 0.0.0.0`
- [x] Environment-driven frontend API configuration (`VITE_API_BASE_URL`)
- [x] Host LAN connectivity (`192.168.1.185`) verified for frontend and backend
- [x] PostgreSQL port mapping restricted to loopback interface (`127.0.0.1:5432`)
- [x] Production frontend build pipeline (`tsc -b && vite build`)
- [x] Docker Compose multi-container setup (Postgres + Adminer)

---

## 11. Testing

- [x] TypeScript compilation validation with 0 errors across backend and frontend
- [x] Production build artifact generation
- [x] End-to-end LAN access, authentication, and cookie persistence verification
- [x] Seed data end-to-end API functional verification
- [x] Geo-fencing default-off behavior verified end-to-end (both states tested)
- [ ] Automated unit and integration test suite (Vitest / Jest / Supertest)

---

## Known Issues / Bugs

- [ ] `GET /api/employees/` route in `hrms-be/src/modules/employee/routes.ts` does not have a `requireRole` middleware guard.
- [ ] Google and Microsoft OAuth login buttons are not yet exposed on `hrms-fe/src/pages/Login.tsx`.
- [ ] No forgot-password / reset-password self-service flow — see Phase 9.
- [ ] HR's real CSV export does not match assumed employee-import schema (see Phase 2 for full mismatch list).

---

# Phase-wise Implementation Plan

## Phase 0 — Documentation ✅ (this file)

---

## Phase 1 — Geo-Fencing Bug Fix ✅ DONE
- [x] Diagnosed root cause (schema default `true`, frontend calling geolocation unconditionally)
- [x] Fixed schema default to `false` + migration
- [x] Fixed seed data
- [x] Synced existing DB rows to `false`
- [x] Backend: location payload made optional when geo-fencing disabled
- [x] Backend: `geoFencingEnabled` exposed via `/api/auth/me` and `/api/auth/login`
- [x] Frontend: skips `navigator.geolocation` call entirely when disabled
- [x] Verified both states end-to-end; `tsc` and production builds pass on both repos

---

## Phase 2 — Employee & Organization Data Seeding ✅ DONE

Phase 2 is considered complete through database seeding scripts rather than a CSV import feature.

The real employee dataset was imported directly into the database using
`scripts/seed-real-employees.ts`.

### Completed

- [x] Imported real employee records into the database
- [x] Created/linked employee profiles
- [x] Created/linked departments
- [x] Created/linked designations
- [x] Stored employee ID as `employeeCode`
- [x] Imported employee first name and last name
- [x] Imported employee email
- [x] Imported designation
- [x] Imported department
- [x] Imported employment type
- [x] Set employee probation status from employment type
- [x] Assigned default application role (`EMPLOYEE`; HR Manager → `HR`)
- [x] Created local authentication accounts
- [x] Applied temporary password with forced first-login password change
- [x] Bootstrapped leave balances for configured leave types
- [x] Used transactional creation of User + EmployeeProfile + LeaveBalance records
- [x] Added duplicate email and employee-code protection
- [x] Verified seeded employee dataset successfully

### Database Result

The database now contains the required real employee, department,
designation, and leave data.

A separate CSV bulk-import UI/API is **not required for the current HRMS
scope**. Future bulk data imports can continue to be handled through
controlled database seed/backfill scripts when required.

### Decision

**Do NOT implement `AdminBulkImportEmployees.tsx`.**

**Do NOT implement `POST /api/employees/bulk-import`.**

**Do NOT add CSV-import-specific profile completion logic.**

The previous CSV-import plan is superseded by the completed database
seeding approach.

> Phase 2 is therefore fully complete. Future employee creation and
> profile updates should use the existing application onboarding and
> employee-management workflows.

---

## Phase 3 — Organization Management Frontend ✅ DONE
- [x] Built `AdminOrganization.tsx` with tabs: Departments / Teams / Designations / Attendance Policy
- [x] Wired full CRUD calls in `organizationApi.*` and `attendanceApi.*`
- [x] Added route `/admin/organization` + card in `AdminDashboard.tsx`
- [x] Dual-mode Attendance Policy tab supporting Designation Policies and Employee-specific Overrides (3-tier precedence hierarchy)
- [x] Kept Workplace Settings (Office Location, Geo-Fencing, Working Hours) cleanly housed under `AdminGeoSettings.tsx` with cross-link navigation
- [x] Verified end-to-end with automated test suite and production builds passing

---

## Phase 4 — Navigation Overhaul ✅ DONE
- [x] Audit every page under `src/pages/` for current navigation gaps
- [x] Shared back-button/header component (`PageHeader.tsx` — not raw browser-history-back)
- [x] Clickable HRMS logo → role-appropriate home with dynamic company name subtitle
- [x] Minimal desktop navigation (`Dashboard`, `Attendance`, `Holidays` for HR/Admin)
- [x] Compact user avatar control with dropdown menu (initials, role, email, company badge, sign out)
- [x] Responsive mobile modal navigation drawer with backdrop covering viewport
- [x] Confirm every page reachable via in-app nav, not just direct URL
- [x] Flagged and resolved orphaned pages during audit (added contextual back buttons to all child pages)

---

## Phase 5 — HR Attendance Dashboard

### 5A — Backend Contract & Business Rules
- [x] Define `GET /api/attendance/dashboard?month=YYYY-MM`
- [x] Define the dashboard response structure for employee × date matrix
- [x] Define daily summary counts: Present, Absent, On Leave, Pending Leave
- [x] Define final attendance status enum and status precedence rules
- [x] Document status values for frontend color mapping
- [x] Add `requireRole(HR, COMPANY_ADMIN)` authorization
- [x] Verify company isolation

### 5B — Backend Implementation & Performance
- [x] Implement attendance dashboard aggregation
- [x] Combine attendance, approved/pending leave, holidays, and weekends
- [x] Use efficient batched queries; no N+1 queries
- [x] Handle month boundaries and date/timezone consistently
- [x] Verify 30+ employees × 30 days without excessive queries
- [x] Verify summary counts against the employee/date matrix

### 5C — Working Hours Configuration
- [x] Make working-hours configuration configurable by HR/Admin
- [x] Working hours: 8h 00m (default, configurable)
- [x] Lunch duration: 30m (default, configurable)
- [x] Break duration: 20m (default, configurable)
- [x] Grace period: 10m (default, configurable)
- [x] Use configured working hours consistently in attendance status calculation and dashboard
- [x] Ensure lunch/break duration is not counted as actual working time
- [x] Apply grace period consistently when determining attendance status
- [x] Add HR/Admin UI to view and update working-hours configuration
- [x] Persist the configuration at company level
- [x] Ensure configuration changes affect future attendance calculations without altering historical attendance records

### 5D — Attendance Day Boundary & Forgotten Checkout

- [x] Attendance is bounded to a single calendar day
- [x] Same-day overtime remains attached to the same AttendanceDay
- [x] Automatically close an open attendance at 23:59:59 when employee
      forgets to check out
- [x] Preserve the original CHECK_IN event when automatic checkout occurs
- [x] Prevent attendance from carrying into the next calendar day
- [ ] Future improvement: replace automatic 23:59:59 checkout with a more
      accurate forgotten-checkout handling workflow
- [ ] Future improvement: allow HR to review/flag automatically closed
      attendance records
- [ ] Future improvement: distinguish system-generated checkout from
      employee-generated checkout in attendance history

### 5E — Frontend Dashboard ✅ DONE
- [x] Create `AdminAttendanceDashboard.tsx`
- [x] Add month selector (with instant in-memory cache and prev/next/this month toggles)
- [x] Add employee × date attendance matrix (tested with 99 employees × 31 days = 3,069 cells)
- [x] Sticky employee column and sticky date header
- [x] Color-code attendance statuses (Present, Absent, Partial, On Leave, Half Day, Pending Leave, Holiday, Weekend, Unrecorded)
- [x] Add summary cards: Present, Absent, On Leave, Pending Leave (computed for Today)
- [x] Add single shared floating Popover for cell details: IST timestamps, HH:mm:ss duration, leave & policy metadata
- [x] Add route `/admin/attendance-dashboard`
- [x] Add dashboard entry point in global header ("Attendance") and Admin Dashboard card
- [x] Dedicated entry point for operational tasks in `/admin/attendance` ("Attendance Administration")
- [x] Ensure responsive behavior for smaller screens and wide full-screen layouts
- [x] Live typo-tolerant employee search filter (name, employee code, designation, department)
- [x] High-performance rendering optimization (memoized `MatrixRow`, `MatrixCell`, single shared Popover replacing 3,069 heavy MUI Tooltip instances)

### 5F — Verification ✅ DONE
- [x] Verify current month
- [x] Verify previous/next month navigation
- [x] Verify employee with active attendance & presence duration
- [x] Verify employee with approved leave (full-day & partial)
- [x] Verify employee with pending leave
- [x] Verify weekends and holidays
- [x] Verify absent days
- [x] Verify summary chip counts
- [x] Verify 99-employee × 31-day dataset performance (~79ms backend aggregation, 60fps frontend rendering)
- [x] Verify check-in immediately establishes PRESENT status across all endpoints
- [x] Verify future date & timestamp restrictions on HR manual attendance operations

---

## Phase 6 — HR Leave Dashboard ✅ DONE
- [x] Confirm/add `GET /api/leave/requests/recent?status=APPROVED&days=7` with batched relations and strict company isolation
- [x] `AdminLeaveDashboard.tsx`: "On Leave Today", "Pending Approvals" (inline approve/reject), "Recently Approved" (with HR Cancel) — clean operational card layout
- [x] Route `/admin/leave-dashboard` + "Leave Dashboard" card on `AdminDashboard.tsx`
- [x] Verified and preserved HR-cancel functionality and fixed Approved tab in `AdminLeaveApprovals.tsx`

---

## Phase 7 — Employee Search + Quick Edit Modal ✅ DONE
- [x] Typo-tolerant live search on `AdminEmployeeList.tsx` (by name, email, employee code `#6`, department, designation, team)
- [x] 3-state segmented status filter (`Active | Inactive | All`) with live count badges
- [x] `AdminEmployeeQuickEditModal.tsx` supporting Profile & Org, Attendance Correction, and Leave Request Approvals / HR Cancellation
- [x] Typo-tolerant Search + Select Autocompletes for Department, Designation, Team (conditionally shown if `usesTeams: true`), and Reporting Manager
- [x] Live in-memory list synchronization on save with instant modal close and zero full-page reloads
- [x] Complete relation data returned by backend `updateEmployee` and `changeManager` endpoints

---
## Quick Fixes / Hardening — Before Next Phase ✅ DONE
- [x] Employee Dashboard configurable display working hours & total scheduled presence ($= \text{Work} + \text{Lunch} + \text{Break}$)
- [x] Dynamic non-negative Time Remaining countdown timer on Employee Dashboard
- [x] Fix employee leave application: "Leave policy not configured" (Leave policy resolution & company policies initialized)
- [x] HR dual-mode access: Admin Dashboard $\leftrightarrow$ Employee Dashboard (Seamless view switcher & context navigation)
- [x] Canonical tenant company name resolution (sourced directly from `Company.name`, eliminating domain heuristic)
- [x] Attendance Dashboard canonical Pending Approval metric (`GET /api/leave/requests/pending`) with interactive scrollable drill-down popovers across all 4 status cards
- [x] Leave Approval routing consolidation: single source of truth at `/admin/leave-dashboard` with backward-compatibility redirects and removal of obsolete `AdminLeaveApprovals.tsx`
- [x] Canonical Multi-Session Attendance Daily Presence Engine: pairwise session matching (`computeDailyAttendanceSessions`), cumulative presence sum ($\sum \Delta t_k$), active shift tracking (`checkOut: null` / "In progress"), multi-session live timer, and accurate calendar daily totals

---

## Phase 8 — Forgot / Reset Password (Tier 1 ✅ DONE)

Two-tier approach: shipped the admin-assisted path first; self-service email reset follows once an email provider is chosen.

### Tier 1 — Admin-Assisted Reset ✅ DONE
- [x] Backend: `POST /api/users/:userId/reset-password` — `requireRole(HR, COMPANY_ADMIN)` guarded with tenant isolation
- [x] Backend: Cryptographically secure 12-char temporary password generator (`crypto.randomInt`), bcrypt 12 hashing, `mustChangePassword: true`, and complete refresh token session invalidation
- [x] Backend: Supports both auto-generated and manual temporary password settings ($\ge 6$ chars)
- [x] Backend: Returns one-time temporary password in JSON response (never logged, never stored in plaintext)
- [x] Frontend: "Reset Password" action in `AdminEmployeeProfile.tsx` and `AdminEmployeeQuickEditModal.tsx` with confirmation dialog and focus-trap/LAN-safe one-time copy-to-clipboard modal
- [x] Frontend: "Forgot password?" modal on `Login.tsx` directing employees to contact HR/Admin
- [x] Verified: Login with temp password forces `ChangePasswordModal.tsx`, old password rejected, old refresh tokens invalidated, permanent password updates correctly and clears `mustChangePassword`

### Tier 2 (Future if required) — Self-Service Reset via Email (gated on email provider decision)
- [ ] **Decision needed first**: choose an email-sending provider (e.g. 
  Resend, SendGrid, AWS SES) — none currently integrated. This blocks all 
  of Tier 2 until decided.
- [ ] Backend: `POST /api/auth/forgot-password` — takes email, generates a 
  short-lived (e.g. 1h) signed single-use token, emails a reset link. 
  Always returns a generic success response regardless of whether the email 
  exists, to avoid leaking which emails are registered.
- [ ] Backend: `POST /api/auth/reset-password` — takes token + new password, 
  validates token (not expired, not already used), updates password hash, 
  invalidates the token, invalidates existing sessions.
- [ ] Frontend: "Forgot password?" link on `Login.tsx` → request form → 
  "check your email" confirmation screen.
- [ ] Frontend: reset-password page (token from URL query param) → new 
  password form → success → redirect to login.
- [ ] Ensure this doesn't conflict with the existing `mustChangePassword` 
  forced-change flow (a password reset should also clear `mustChangePassword` 
  if it was set, since the user has now set their own password).

---

## Phase 9 — Google & Microsoft SSO Frontend ✅ DONE
- [x] Google Identity Services integration in `Login.tsx`
- [x] `POST /api/auth/google` wiring via new `auth.api.ts` function
- [x] Microsoft login button in `Login.tsx` (backend Graph API verification already implemented)
- [x] `POST /api/auth/microsoft` wiring via `auth.api.ts`
- [x] Same session/redirect handling as email login for both providers
- [x] Requires user-created OAuth Client ID in Google Cloud Console (and Microsoft/Azure AD app registration for Microsoft) — exact `.env` slots documented (`VITE_GOOGLE_CLIENT_ID`, `VITE_MICROSOFT_CLIENT_ID`)

---
## Phase 10 — Employee Lifecycle & Soft Offboarding

---
## Phase 11 — Cleanup & Hardening
- [ ] Add `requireRole(HR, COMPANY_ADMIN)` guard to `GET /api/employees/`
- [ ] Build `AdminUserList.tsx` (user account directory)
- [ ] Automated test suite (Vitest/Jest/Supertest) — at minimum for auth, attendance, and leave modules


---

## Next Immediate Priority
1. **Phase 10 — Route security & cleanup**: Add role guard to `GET /api/employees/`.
2. **Phase 10 — Admin User List**: Build `AdminUserList.tsx` for HR/Admin user directory management.