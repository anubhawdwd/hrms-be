# HRMS Platform — Full Codebase Audit & Roadmap

> Audited: 2026-08-25 | Audit covers `hrms-be` (backend) and `hrms-fe` (frontend) as they exist on disk.

---

## 📋 Project Summary

The HRMS platform is a multi-tenant HR system built on Node.js/Express/Prisma (backend) and React 19/Vite/MUI v7 (frontend). The backend is substantially complete — all seven modules (auth, company, user, employee, organization, attendance, leave) are wired into `routes/index.ts` with real service and repository layers. The Leave and Attendance modules are the most polished, with full business logic including geo-fencing, sandwich rule, and pro-rated balance bootstrapping. The frontend is **partially complete**: the employee self-service dashboard (`EmployeeDashboard.tsx`) is entirely commented-out/dead code; admin flows for employee onboarding, attendance management, org management, encashments, and leave overrides have no frontend pages at all. Several security gaps exist — notably `GET /api/employees/` has no `requireRole` guard and `EmployeeDashboard.tsx` contains large blocks of commented-out UI code awaiting re-activation.

---

## ✅ Module Status Checklist

### 🔐 Auth

| Status | Feature | Notes |
|--------|---------|-------|
| [x] | Email/password login | Schema ✅ · Service ✅ · Frontend (Login.tsx) ✅ |
| [x] | JWT refresh (token rotation) | Schema (RefreshToken model) ✅ · Service ✅ · Frontend (AuthBootstrap.tsx) ✅ |
| [x] | Logout | Backend ✅ · Frontend (AppShell logout button) ✅ |
| [x] | `/me` endpoint | Backend ✅ · Frontend ✅ |
| [ ] | Google OAuth login | Backend ✅ (verifyGoogleToken via tokeninfo API) · **No frontend Google button** |
| [ ] | Microsoft OAuth login | Backend service has comment "placeholder" — uses Graph API correctly but **no frontend** |
| [ ] | Logout all devices | `logoutAllDevices()` in service ✅ · **No route exposed, no frontend** |
| [ ] | Session management UI | Backend supports multiple refresh tokens · **No frontend page** |

---

### 🏢 Company

| Status | Feature | Notes |
|--------|---------|-------|
| [x] | List companies (Super Admin) | Backend ✅ · Frontend (SuperAdminDashboard.tsx) ✅ |
| [x] | Create company (Super Admin) | Backend ✅ · Frontend ✅ |
| [ ] | Get/Update company | Backend ✅ (GET /:companyId, PATCH /:companyId) · **No frontend page** |
| [ ] | Toggle company active/inactive | Backend field exists (`isActive`) · **No frontend toggle** |

---

### 👤 User

| Status | Feature | Notes |
|--------|---------|-------|
| [ ] | Create user | Backend ✅ · **No frontend UI** (employee onboarding form not built) |
| [ ] | List users | Backend ✅ · **No frontend page** |
| [ ] | Update user (role, email, authProvider) | Backend ✅ · **No frontend UI** |
| [ ] | Deactivate user | Backend ✅ (soft-delete via `isActive`) · **No frontend button** |

---

### 👩‍💼 Employee

| Status | Feature | Notes |
|--------|---------|-------|
| [x] | List employees (admin view) | Backend ✅ · Frontend (AdminEmployeeList.tsx) ✅ |
| [x] | View single employee profile (admin) | Backend ✅ · Frontend (AdminEmployeeProfile.tsx) ✅ — shows profile + hierarchy |
| [x] | View own employee profile (`/me`) | Backend ✅ · Frontend hook `useMyProfile` exists, but **EmployeeDashboard.tsx is entirely commented out** |
| [ ] | Create employee (onboarding) | Backend ✅ (with leave balance bootstrap) · **No frontend form** |
| [ ] | Update own profile (`PUT /me/profile`) | Backend ✅ · **No frontend form** |
| [ ] | Admin update employee (`PUT /:id/admin`) | Backend ✅ · **No frontend UI** |
| [ ] | Deactivate employee | Backend ✅ · **No frontend button** |
| [ ] | Change manager | Backend ✅ (PATCH `/:id/manager`) · **No frontend UI** |
| [ ] | Birthday list | **No backend endpoint, no frontend** |

---

### 🏛️ Organization

| Status | Feature | Notes |
|--------|---------|-------|
| [ ] | Departments CRUD | Backend ✅ (all 4 ops) · `organizationApi.listDepartments` & `createDepartment` in frontend API · **No frontend page/form** |
| [ ] | Teams CRUD | Backend ✅ · `organizationApi.listTeams` & `createTeam` in frontend API · **No frontend page** |
| [ ] | Designations CRUD | Backend ✅ · `organizationApi.listDesignations` & `createDesignation` in frontend API · **No frontend page** |
| [ ] | Office location set/get | Backend ✅ · `organizationApi.getOfficeLocation` in frontend API · **No frontend management page** |
| [ ] | Designation attendance policy | Backend ✅ (upsert + list + get by designation) · **No frontend page** |

---

### 🏖️ Leave

| Status | Feature | Notes |
|--------|---------|-------|
| [x] | View leave types | Backend ✅ · Frontend hook `useLeaveTypes` ✅ |
| [ ] | Create/update leave types | Backend ✅ · **No frontend admin form** |
| [ ] | Create leave policy | Backend ✅ · **No frontend admin form** |
| [ ] | List leave policies | Backend ✅ · **No frontend page** |
| [x] | Apply for leave (self) | Backend ✅ · Frontend (ApplyLeaveModal.tsx + hook) ✅ — but dashboard UI is commented out |
| [x] | Cancel own leave request | Backend ✅ · Frontend (LeaveRequestList.tsx) ✅ — but dashboard UI is commented out |
| [x] | View own leave requests | Backend ✅ · Frontend hook `useMyLeaveRequests` ✅ — but dashboard UI commented out |
| [x] | HR: list pending requests | Backend ✅ (`GET /requests/pending`) · Frontend (AdminLeaveApprovals.tsx) ✅ |
| [x] | HR: approve leave | Backend ✅ · Frontend (AdminLeaveApprovals.tsx) ✅ |
| [x] | HR: reject leave | Backend ✅ · Frontend (AdminLeaveApprovals.tsx) ✅ |
| [ ] | HR: cancel approved leave | Backend ✅ (`/hr-cancel`) · `leaveApi.hrCancel` in frontend · **No frontend UI calls it** |
| [x] | View own leave balances | Backend ✅ · Frontend hook `useLeaveBalances` ✅ — dashboard UI commented out |
| [x] | Holidays: list | Backend ✅ · Frontend (AdminHolidays.tsx + useHolidays hook) ✅ |
| [x] | Holidays: create (admin) | Backend ✅ · Frontend (AdminHolidays.tsx) ✅ |
| [x] | Holidays: delete (admin) | Backend ✅ · Frontend (AdminHolidays.tsx) ✅ |
| [ ] | "Who's on leave today" | Backend ✅ · `leaveApi.getToday` & `useTodayLeaves` hook exist · **No frontend page renders it** |
| [ ] | Leave encashment: request | Backend ✅ · **No frontend UI** |
| [ ] | Leave encashment: approve/reject (HR) | Backend ✅ · **No frontend page** |
| [ ] | Employee leave override (HR) | Backend ✅ · **No frontend page** |

---

### 📅 Attendance

| Status | Feature | Notes |
|--------|---------|-------|
| [x] | Check in | Backend ✅ · Frontend hook `useCheckIn` ✅ — **but EmployeeDashboard.tsx is commented out** |
| [x] | Check out | Backend ✅ · Frontend hook `useCheckOut` ✅ — **but EmployeeDashboard.tsx is commented out** |
| [x] | Get attendance for a day | Backend ✅ · Frontend hook `useTodayAttendance` ✅ — dashboard commented out |
| [x] | Get attendance range (weekly calendar) | Backend ✅ · Frontend hook `useWeeklyAttendance` ✅ — dashboard commented out |
| [x] | HR: view violations | Backend ✅ (`GET /violations`) · Frontend (AdminAttendance.tsx) ✅ |
| [ ] | HR: employee attendance override | Backend ✅ · **No frontend page** |
| [x] | HR: manual attendance-day upsert | Backend ✅ · Frontend (AdminAttendance.tsx) ✅ |
| [x] | HR: manual attendance-event add | Backend ✅ · Frontend (AdminAttendance.tsx) ✅ |
| [x] | HR: update attendance-day status | Backend ✅ · Frontend (AdminAttendance.tsx) ✅ |
| [x] | Geo-fencing settings management | Backend ✅ · Frontend (AdminGeoSettings.tsx) ✅ |

---

## ⚠️ Doc vs Reality Mismatches

| Issue | Detail |
|-------|--------|
| **AdminLeaveApprovals.tsx has stale TODO comment** | Line 15-18: comment says "Backend doesn't have a dedicated 'all pending' endpoint" — but `GET /api/leave/requests/pending` is **already implemented** in the backend. The frontend is already calling it correctly — comment is outdated. |
| **`API_Port` key mismatch in .env.example** | `.env.example` has `API_Port=4004` (lowercase 'ort', wrong value); server reads `process.env.API_PORT`. This caused the port-mismatch bug. Needs fixing in example file. |
| **auth.service.ts line 210 comment** | Comments Microsoft login as "placeholder" but it's actually functional — calls Graph API, verifies email, issues tokens. Comment is misleading. |
| **EmployeeDashboard.tsx** | Entire component body is commented out. The file exports a default but renders nothing. All employee self-service (attendance, leave, hierarchy) is invisible to users. |
| **`GET /api/employees/` missing `requireRole` guard** | Line 29 in employee routes: `router.get("/", listEmployees)` — no role restriction. Any authenticated employee in the company can list all employees (see Security Gaps). |
| **`organizationApi` in frontend creates/lists but no pages** | `organization.api.ts` has `createDepartment`, `listDepartments`, `createTeam`, `listTeams`, `createDesignation`, `listDesignations`, `getOfficeLocation` — none are consumed by any current page or component. |
| **`auth.api.ts` has no Google/Microsoft login functions** | Frontend auth API only implements email login, me, refresh, logout. Google/Microsoft login has no frontend trigger. |
| **No `api/company.api.ts`** | `SuperAdminDashboard.tsx` calls `apiClient.get('/api/company/')` and `apiClient.post('/api/company/')` directly instead of via a typed API module. |
| **Admin Dashboard "Attendance" card** | `AdminDashboard.tsx` has a card linking to `/admin/attendance` — this route **does not exist** in `routes.tsx`. Clicking it shows a 404 via `NotFound`. |
| **`test-prisma.ts`** | Not a test file — just a one-off debug script that lists companies. No automated test suite exists (no Jest, no Vitest, no test files). |

---

## 🔒 Security Gaps

| Severity | Location | Issue |
|----------|----------|-------|
| **Medium** | `GET /api/employees/` (employee routes, line 29) | No `requireRole` — any authenticated user in the company can list ALL employees including personal info. Should require `HR` or `COMPANY_ADMIN`. |
| **Low** | `GET /api/employees/me` (employee routes, line 31) | No explicit `requireRole` — acceptable for self-service, but no validation that the requesting user *has* an employee profile (service throws, but HTTP error message leaks existence). |
| **Low** | `POST /api/leave/requests` — no role check | Any authenticated user can apply for leave. Acceptable by design, but worth documenting. |
| **Low** | `PATCH /api/leave/requests/:id/cancel` — no role check | Any authenticated user can attempt to cancel any request ID. Service checks ownership via JWT userId, so this is safe, but the route has no explicit self-guard. |
| **Low** | `GET /api/attendance/day` and `/range` | No `requireRole` — any authenticated company member can query any employee's attendance if they know the date format. Service queries by `req.user.userId` so it's effectively self-scoped — low risk but undocumented. |
| **Info** | `.env.example` has `API_Port` (wrong casing) | Devs on a fresh machine will set port 4004 and get `ERR_CONNECTION_REFUSED` from the frontend. Already fixed in `.env`, needs fixing in `.env.example`. |
| **Info** | Microsoft login has no PKCE/state validation | OAuth flow accepts any Graph API access token. In production, the frontend should verify the `state` nonce. Currently there's no nonce check. |

---

## 🗺️ Suggested Next Steps (Prioritised)

### Priority 1 — Fix the Broken Employee Dashboard (1–2 days)
The biggest visible gap. All the hooks, API clients, and backend endpoints exist. The entire `EmployeeDashboard.tsx` is commented out.

- [ ] Uncomment and re-enable `EmployeeDashboard.tsx` (profile card, attendance check-in/out, weekly calendar, leave balances, apply leave modal, my requests list, holiday list)
- [ ] Verify each section works end-to-end with the seeded data

### Priority 2 — Employee Onboarding Form (1–2 days)
Without this, HR can't add new employees via the UI. Backend is fully implemented.

- [x] Create `AdminCreateEmployee.tsx` page with a form: user email + auth provider → create user, then fill employee fields (designation, team, manager, joining date)
- [x] Add route `/admin/employees/new` in `routes.tsx`
- [x] Add "Onboard Employee" button to `AdminEmployeeList.tsx`

### Priority 3 — Fix the `/admin/attendance` broken link (30 min)
`AdminDashboard.tsx` has a card pointing to `/admin/attendance` which was a 404.

- [x] Created `AdminAttendance.tsx` with violations, manual day override, and punch event injection, mounted route and linked from dashboard.

### Priority 4 — Fix `.env.example` (5 min)
- [ ] Change `API_Port=4004` → `API_PORT=4000` in `.env.example`

### Priority 5 — Organization Management Pages (2–3 days)
API clients exist but no pages. Needed so HR can manage departments/teams/designations.

- [ ] Create `AdminOrganization.tsx` with tabs: Departments / Teams / Designations / Office Location
- [ ] Wire in existing `organizationApi.*` calls
- [ ] Add route `/admin/organization` and card in `AdminDashboard.tsx`

### Priority 6 — Attendance HR Tools (1–2 days)
- [ ] Create `AdminAttendance.tsx` — view violations, override employee attendance policy, manual attendance-day/event entry
- [ ] Wire existing backend endpoints: `GET /violations`, `POST /employee-override`, `POST /hr/attendance-day`, `POST /hr/attendance-event`

### Priority 7 — Leave Admin Tools (1 day)
- [ ] Create leave type management UI (create, toggle active)
- [ ] Create leave policy management UI (set yearly allocation per type per year)
- [ ] Add HR-cancel button to leave approvals page (backend endpoint exists, `leaveApi.hrCancel` exists in frontend)

### Priority 8 — Leave Encashment (1 day)
- [ ] Add "Request Encashment" button to employee leave balances view
- [ ] Create HR encashment approval page

### Priority 9 — User Management Page (1 day)
- [ ] Create `AdminUserList.tsx` — list users, change role, change authProvider, deactivate

### Priority 10 — Remove Stale Comments & Cleanup (0.5 day)
- [ ] Remove "placeholder" comment from `auth.service.ts` line 210 (Microsoft login is functional)
- [ ] Remove stale TODO in `AdminLeaveApprovals.tsx` lines 15-18 (endpoint already exists)
- [ ] Add `requireRole(HR, COMPANY_ADMIN)` to `GET /api/employees/` route (security gap)
- [ ] Delete `src/test-prisma.ts` or move to a `scripts/` folder with clear documentation

---

## 📦 Environment Variables Reference

| Key | Where Used | Status |
|-----|-----------|--------|
| `DATABASE_URL` | Prisma, PrismaPg adapter | Required |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_PORT` | docker-compose.yml | Required for Docker |
| `API_PORT` | `src/server.ts` | Required (default: 4000) |
| `JWT_ACCESS_SECRET` | JWT sign/verify | Required |
| `JWT_REFRESH_SECRET` | JWT sign/verify | Required |
| *(none)* | Google/Microsoft OAuth client IDs | **Missing** — Google/MS login uses public tokeninfo APIs, no client ID needed server-side in current implementation |

**Note**: `.env.example` has `API_Port=4004` (wrong key casing + wrong port). Fix to `API_PORT=4000`.
