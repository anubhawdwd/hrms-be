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
- [~] Manager hierarchy reassignment (`PATCH /api/employees/:id/manager` implemented; dedicated UI modal pending)
- [~] Employee self-profile update (`PUT /api/employees/me/profile` implemented; frontend modal pending)
- [~] Admin employee profile update (`PUT /api/employees/:id/admin` implemented; frontend modal pending)
- [~] Employee deactivation (`DELETE /api/employees/:id` implemented; frontend action button pending)
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

- [~] Department management CRUD (backend implemented; API client created; **frontend page NOT available — confirmed bug, HR cannot create departments at all right now**)
- [~] Team management CRUD (backend implemented; API client created; frontend page pending)
- [~] Designation management CRUD (backend implemented; API client created; frontend page pending)
- [~] Designation attendance policy configuration (backend implemented; frontend page pending)

> **Blocking note:** CSV import (Phase 2) requires resolving departments/designations by name. Since department creation has no frontend UI yet, any department in the HR's CSV that doesn't already exist in the DB (e.g. "Simulation Development Team", "K 6-12", "Product Managament Team") will fail import until either (a) `AdminOrganization.tsx` is built first, or (b) the CSV importer is allowed to auto-create missing departments/designations inline (needs a product decision — see Phase 2A).

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
- [ ] **Department creation has no frontend UI at all** — backend + API client exist, but HR/Admin cannot create a department through the app today. This blocks CSV import for any department not already seeded.
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

## Phase 2 — CSV Bulk Employee Import (Partial Import Strategy)

### Decision made
Rather than blocking import on fields the CSV doesn't reliably have, import 
only the clearly usable columns now. Everything else is left blank and 
marked as an incomplete profile, to be filled in later by HR or the 
employee (if HR enables self-completion).

**Import now (from CSV):**
- Employee ID (store as an external reference / employee code, not the DB id)
- First Name, Last Name
- Designation
- Department
- Employment Type
- Email address

**Deferred — filled in later via profile completion, not at import time:**
- Reporting Manager / Secondary Reporting Manager (name-only in CSV, 
  ambiguous — do not attempt to auto-resolve at import)
- Joining date, Date of birth, Team (not present in CSV at all)
- "Current Experience" column is dropped entirely — not used to derive 
  joining date

### ⚠️ Still must resolve before building
- [ ] Confirm which of the deferred fields are truly optional/nullable in 
  the current Prisma `Employee` schema. If any are required (e.g. 
  joiningDate NOT NULL), either relax the constraint or pick a safe 
  placeholder value + flag the record as incomplete.
- [ ] Decide default `role` (`EMPLOYEE`) and `authProvider` (`LOCAL`) for 
  imported users, plus how they get their first password (temp password 
  emailed, invite link, or admin sets manually — pick one for now).
- [ ] Departments in this file that likely don't exist yet in DB: 
  "Simulation Development Team", "K 6-12", "Product Managament Team" 
  (note the typo — decide normalize vs import as-is).
- [ ] **Department creation has no frontend page yet** (Phase 3 fixes this) 
  — decide whether Phase 2 waits for Phase 3, or the importer auto-creates 
  missing departments/designations inline with a warning in the result report.
- [ ] Add an `isProfileComplete` (or similar) flag to the Employee model so 
  incomplete imported records are visibly flagged in the UI until HR/employee 
  fills in the rest.

### Chunk 2A — Backend (`hrms-be`)
- [ ] Inspect actual required/optional fields on `Employee` and `User` Prisma 
  models — confirm which deferred fields can be nullable
- [ ] Add `isProfileComplete` flag (or equivalent) if not already derivable
- [ ] Build `POST /api/employees/bulk-import` (multipart CSV upload) using 
  ONLY the 6 confirmed-usable columns
- [ ] Row-level validation + per-row error reporting (not all-or-nothing)
- [ ] Reuse existing employee creation service where possible; skip leave 
  balance bootstrap dependency on joining date if that's currently required 
  — confirm and adjust
- [ ] Decide on auto-create-missing-department/designation behavior
- [ ] `requireRole(HR, COMPANY_ADMIN)` guard
- [ ] Document endpoint + final column spec in `API_Consumption_Guide.md`

### Chunk 2B — Frontend (`hrms-fe`)
- [ ] `AdminBulkImportEmployees.tsx`: file upload, downloadable template 
  matching the 6-column spec, row preview, submit
- [ ] Result screen: success/failure counts, per-row error table, 
  downloadable failed-rows CSV
- [ ] Visual indicator (badge/chip) on `AdminEmployeeList.tsx` for employees 
  with incomplete profiles
- [ ] Route `/admin/employees/bulk-import` + link from `AdminEmployeeList.tsx`
- [ ] Test with the actual HR-provided file end-to-end

### Chunk 2C — Profile Completion (follow-up, not blocking Phase 2 launch)
- [ ] Admin-side profile completion form (reuses existing 
  `PUT /api/employees/:id/admin` — just needs frontend modal, already 
  tracked in section 3 as pending)
- [ ] Optional: HR-toggleable setting to let employees self-complete missing 
  fields (manager, joining date, DOB, team) via 
  `PUT /api/employees/me/profile` — needs a per-company or per-employee flag 
  to enable/disable this, does not exist yet

---

## Phase 3 — Organization Management Frontend (prerequisite for clean Phase 2)
- [ ] Build `AdminOrganization.tsx` with tabs: Departments / Teams / Designations / Office Location
- [ ] Wire existing `organizationApi.*` CRUD calls (already implemented, unused)
- [ ] Add route `/admin/organization` + card in `AdminDashboard.tsx`
- [ ] This directly fixes the "department creation not available" bug

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

### Chunk 5A — Backend
- [ ] `GET /api/attendance/dashboard?month=YYYY-MM` — employee × date matrix + daily summary counts
- [ ] Efficient batched queries (no N+1)
- [ ] Final status enum (e.g. `PRESENT, ABSENT, ON_LEAVE, HALF_DAY_LEAVE, PENDING_LEAVE, HOLIDAY, WEEKEND`) documented for frontend color mapping
- [ ] `requireRole(HR, COMPANY_ADMIN)` guard

### Chunk 5B — Frontend
- [ ] `AdminAttendanceDashboard.tsx`: month selector, sticky-header color-coded grid, per-day summary chips (Present/Absent/On Leave/Pending)
- [ ] Cell tooltip with detail (check-in/out time, leave type)
- [ ] Route `/admin/attendance-dashboard` + dashboard card
- [ ] Performance-test with 30+ employees × 30 days

---

## Phase 6 — HR Leave Dashboard
- [ ] Confirm/add `GET /api/leave/requests/recent?status=APPROVED&days=7` if not already present
- [ ] `AdminLeaveDashboard.tsx`: "On Leave Today", "Pending Approvals" (inline approve/reject), "Recently Approved" — simple cards, not a dense table
- [ ] Route `/admin/leave-dashboard` + dashboard card
- [ ] Add pending HR-cancel button to `AdminLeaveApprovals.tsx` if still not done (verify current status first)

---

## Phase 7 — Employee Search + Quick Edit Modal
- [ ] Search input on `AdminEmployeeList.tsx` (by name/email)
- [ ] Click employee → modal with Attendance tab (reuse `AdminAttendance.tsx` edit logic, scoped to employee) and Leave tab (reuse `AdminLeaveApprovals.tsx` logic)
- [ ] Extract shared hooks/components rather than duplicating logic
- [ ] Modal edits refresh underlying dashboard data without full reload

---

## Phase 8 — Google SSO Frontend
- [ ] Google Identity Services integration in `Login.tsx`
- [ ] `POST /api/auth/google` wiring via new `auth.api.ts` function
- [ ] Same session/redirect handling as email login
- [ ] Requires user-created OAuth Client ID in Google Cloud Console — flag exact `.env` slot needed

---

## Phase 9 — Cleanup & Hardening
- [ ] Add `requireRole(HR, COMPANY_ADMIN)` guard to `GET /api/employees/`
- [ ] Build `AdminUserList.tsx` (user account directory)
- [ ] Automated test suite (Vitest/Jest/Supertest) — at minimum for auth, attendance, and leave modules

---

## Next Immediate Priority
1. **Phase 2 mismatch resolution** — decide manager-resolution strategy and default role/auth for CSV import (blocking; needs your product decision, not just code)
2. **Phase 3** — build `AdminOrganization.tsx` (unblocks department creation bug + cleanly unblocks Phase 2 import)
3. **Phase 2A/2B** — build the importer once Phase 3 exists and mismatches are resolved