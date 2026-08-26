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
- [x] Role-based route guards (`SUPER_ADMIN`, `COMPANY_ADMIN`, `HR`, `EMPLOYEE`)
- [~] Google OAuth login (backend token verification implemented; frontend login button pending)
- [~] Microsoft OAuth login (backend Graph API token verification implemented; frontend login button pending)
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
- [~] HR cancellation of approved leave (`PATCH /api/leave/requests/:id/hr-cancel` implemented in backend & API client; button in UI pending)
- [~] "Who's on leave today" view (`GET /api/leave/today` implemented; dashboard tab pending)
- [~] Leave encashment workflow (`POST /api/leave/encashments` implemented; frontend UI pending)
- [~] Employee-specific leave policy override (`POST /api/leave/employee-override` implemented; frontend UI pending)
- [ ] Leave type creation/editing admin page
- [ ] Leave policy allocation configuration admin page

---

## 6. Organization Management

- [~] Department management CRUD (backend implemented; API client created; frontend page pending)
- [~] Team management CRUD (backend implemented; API client created; frontend page pending)
- [~] Designation management CRUD (backend implemented; API client created; frontend page pending)
- [~] Designation attendance policy configuration (backend implemented; frontend page pending)

---

## 7. Geo-Fencing

- [x] Company office location configuration (latitude, longitude, radius)
- [x] Company-wide geo-fencing toggle switch (`geoFencingEnabled`)
- [x] Haversine distance calculation and boundary validation
- [x] Geo-fencing bypass when disabled company-wide
- [x] Admin geo-settings configuration page with live GPS detection (`AdminGeoSettings.tsx`)

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

---

## 9. Infrastructure & Deployment

- [x] Backend Express server binding to `0.0.0.0` with configurable `API_PORT` (default `4000`)
- [x] Frontend Vite server configured with `--host 0.0.0.0`
- [x] Environment-driven frontend API configuration (`VITE_API_BASE_URL`)
- [x] Host LAN connectivity (`192.168.1.185`) verified for frontend and backend
- [x] PostgreSQL port mapping restricted to loopback interface (`127.0.0.1:5432`)
- [x] Production frontend build pipeline (`tsc -b && vite build`)
- [x] Docker Compose multi-container setup (Postgres + Adminer)

---

## 10. Testing

- [x] TypeScript compilation validation with 0 errors across backend and frontend
- [x] Production build artifact generation
- [x] End-to-end LAN access, authentication, and cookie persistence verification
- [x] Seed data end-to-end API functional verification
- [ ] Automated unit and integration test suite (Vitest / Jest / Supertest)

---

## Known Issues

- [ ] `GET /api/employees/` route in `hrms-be/src/modules/employee/routes.ts` does not have a `requireRole` middleware guard.
- [ ] Google and Microsoft OAuth login buttons are not yet exposed on `hrms-fe/src/pages/Login.tsx`.

---

## Next Priority

1. Add `requireRole(UserRole.HR, UserRole.COMPANY_ADMIN)` guard to `GET /api/employees/` in backend.
2. Build `AdminOrganization.tsx` to expose Department, Team, and Designation management.
3. Add HR cancellation button to `AdminLeaveApprovals.tsx`.
