docker compose up -d
npm run dev
to close docker container -
docker compose down
backend : localhost:4000/    
swagger: localhost:4000/api-doc
adminer- view at localhost:8080

for seeding npx prisma db seed

# HRMS Platform — Complete LLM Context Document

## 1. Project Overview

Full-stack HRMS (Human Resource Management System) platform with:
- **Geo-fenced attendance** (check-in/check-out from office premises)
- **Leave management** (apply, approve, reject, cancel, encash)
- **Employee hierarchy** (manager → reportees → peers)
- **Role-based dashboards** (Employee, HR/Admin, Super Admin)
- **Multi-company support** (tenant isolation via companyId)

### Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express, TypeScript |
| ORM | Prisma (PostgreSQL) |
| Frontend | React 19, TypeScript, Vite |
| State | Redux Toolkit (auth only) |
| UI | Material UI v7 |
| Auth | JWT access (15m) + refresh cookie (30d) |
| DB | PostgreSQL 15 (Docker) |
| Geo | Haversine distance, browser Geolocation API |

### Running the Project

```bash
# Backend (localhost:4000)
cd hrms-be
docker compose up -d
npm run dev

# Frontend (localhost:5173)
cd hrms-fe
npm run dev

# DB viewer
# Adminer at localhost:8080
```

---

## 2. Backend Architecture

### Folder Structure

```
hrms-be/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── src/
│   ├── server.ts
│   ├── app.ts
│   ├── config/
│   │   ├── prisma.ts          # PrismaClient singleton
│   │   └── auth.ts            # JWT secrets, cookie name
│   ├── middlewares/
│   │   ├── auth.middleware.ts  # JWT verification, sets req.user
│   │   ├── requireRole.ts     # Role-based access control
│   │   └── validateCompany.ts # x-company-id vs JWT validation, sets req.companyId
│   ├── modules/
│   │   ├── auth/              # login, refresh, logout, me, google, microsoft
│   │   ├── company/           # CRUD (SUPER_ADMIN only)
│   │   ├── organization/      # departments, teams, designations, office location
│   │   ├── user/              # user CRUD (email, role, auth provider)
│   │   ├── employee/          # employee profiles, hierarchy, leave bootstrap
│   │   ├── attendance/        # check-in/out, geo-fence, violations, HR overrides
│   │   └── leave/             # types, policies, requests, approvals, holidays, encashment
│   ├── routes/
│   │   └── index.ts           # mounts all module routes under /api
│   ├── utils/
│   │   ├── date.ts            # todayDateUTC, parseDateUTC (all dates UTC)
│   │   └── geo.ts             # haversineDistanceMeters
│   └── generated/prisma/      # Prisma generated client
├── .env
├── docker-compose.yml
└── package.json
```

### Module Pattern (Every Module)

```
modules/{name}/
├── routes.ts       # Express routes, middleware chains
├── controller.ts   # Parse HTTP request/response ONLY
├── service.ts      # Business logic, validation, transactions
├── repository.ts   # Prisma queries ONLY
└── types.ts        # DTOs and interfaces
```

### Key Backend Rules

1. **Controllers** never touch Prisma directly
2. **Services** contain all business logic and validation
3. **Repositories** contain only Prisma queries, no business logic
4. **All dates** use UTC via `todayDateUTC()` and `parseDateUTC()` from `utils/date.ts`
5. **`req.user`** is set by `authenticateJWT` middleware (userId, companyId, role)
6. **`req.companyId`** is set by `validateCompanyHeader` middleware (validated against JWT)
7. **Employee identity** is always derived from `req.user.userId` for self-service routes — never from request body
8. **Transactions** used for operations that modify multiple tables (leave approval + balance deduction)

### Middleware Chain

```
authenticateJWT → validateCompanyHeader → requireRole(...) → controller
```

- `authenticateJWT`: Verifies JWT, sets `req.user = { userId, companyId, role }`
- `validateCompanyHeader`: Reads `x-company-id` header, validates against `req.user.companyId` (SUPER_ADMIN bypasses), sets `req.companyId`
- `requireRole`: Checks `req.user.role` against allowed roles

### Database Schema (Key Models)

```
Company
  └── User (email, role, authProvider, passwordHash)
       └── EmployeeProfile (employeeCode, names, designation, team, manager, dateOfBirth)
            ├── AttendanceDay → AttendanceEvent[]
            ├── LeaveBalance (per leaveType per year)
            ├── LeaveRequest (fromDate, toDate, durationType, durationValue, status)
            └── LeaveEncashment

Organization:
  Company → Department → Team
  Company → Designation → DesignationAttendancePolicy
  Company → OfficeLocation (lat, lng, radiusM)

Leave Config:
  Company → LeaveType (CL, SL, etc.)
  Company → LeavePolicy (per leaveType per year)
  Employee → EmployeeLeaveOverride (per leaveType per year)

Attendance:
  Employee → AttendanceDay → AttendanceEvent (CHECK_IN/CHECK_OUT)
  Employee → EmployeeAttendanceOverride (autoPresent, attendanceExempt)
  Company → AttendanceViolation (geo-fence violations log)

Holiday:
  Company → Holiday (name, date)
```

### Enums

```typescript
UserRole: SUPER_ADMIN | COMPANY_ADMIN | HR | EMPLOYEE
AuthProvider: LOCAL | GOOGLE | MICROSOFT
AttendanceStatus: PRESENT | ABSENT | PARTIAL | LEAVE
AttendanceEventType: CHECK_IN | CHECK_OUT
AttendanceSource: WEB | PWA
LeaveDurationType: FULL_DAY | HALF_DAY | QUARTER_DAY | HOURLY
LeaveRequestStatus: PENDING | APPROVED | REJECTED | CANCELLED
LeaveEncashmentStatus: REQUESTED | APPROVED | REJECTED
GenderRestriction: MALE | FEMALE | OTHER
```

### Role Capability Matrix

| Area | SUPER_ADMIN | COMPANY_ADMIN | HR | EMPLOYEE |
|---|---|---|---|---|
| Company CRUD | ✅ | ❌ | ❌ | ❌ |
| Organization (dept/team/designation) | ✅ | ✅ | ✅ | ❌ |
| User CRUD | ✅ | ✅ | ✅ | ❌ |
| Employee CRUD | ✅ | ✅ | ✅ | ❌ |
| Leave config (types/policy/holiday) | ✅ | ✅ | ✅ | ❌ |
| Leave apply | ✅ | ✅ | ✅ | ✅ |
| Leave approve/reject | ✅ | ✅ | ✅ | ❌ |
| Attendance check-in/out | ✅ | ✅ | ✅ | ✅ |
| Attendance HR overrides | ✅ | ✅ | ✅ | ❌ |
| View own profile | ✅ | ✅ | ✅ | ✅ |

### API Endpoints Summary

```
Auth:
  POST   /api/auth/login
  POST   /api/auth/google
  POST   /api/auth/microsoft
  POST   /api/auth/refresh
  POST   /api/auth/logout
  GET    /api/auth/me

Company:
  POST   /api/company/
  GET    /api/company/
  GET    /api/company/:companyId
  PATCH  /api/company/:companyId

Users:
  POST   /api/users/
  GET    /api/users/
  PATCH  /api/users/:userId
  DELETE /api/users/:userId

Employees:
  POST   /api/employees/
  GET    /api/employees/
  GET    /api/employees/me
  GET    /api/employees/:employeeId
  PUT    /api/employees/me/profile
  PUT    /api/employees/:employeeId/admin
  DELETE /api/employees/:employeeId
  PATCH  /api/employees/:employeeId/manager

Organization:
  POST|GET|PATCH|DELETE /api/organization/departments
  POST|GET|PATCH|DELETE /api/organization/teams
  POST|GET|PATCH|DELETE /api/organization/designations
  POST|PUT|GET          /api/organization/office-location
  POST|GET              /api/organization/designation-attendance-policy
  GET                   /api/organization/designation-attendance-policy/:designationId

Attendance:
  POST   /api/attendance/check-in
  POST   /api/attendance/check-out
  GET    /api/attendance/day?date=YYYY-MM-DD
  GET    /api/attendance/range?from=YYYY-MM-DD&to=YYYY-MM-DD
  GET    /api/attendance/violations
  POST   /api/attendance/employee-override
  POST   /api/attendance/hr/attendance-day
  POST   /api/attendance/hr/attendance-event
  PATCH  /api/attendance/hr/attendance-day/:attendanceDayId

Leave:
  GET    /api/leave/types
  POST   /api/leave/types
  PATCH  /api/leave/types/:leaveTypeId
  POST   /api/leave/policies
  GET    /api/leave/policies?year=YYYY
  POST   /api/leave/requests
  GET    /api/leave/requests/my
  GET    /api/leave/requests/pending
  PATCH  /api/leave/requests/:requestId/cancel
  PATCH  /api/leave/requests/:requestId/approve
  PATCH  /api/leave/requests/:requestId/reject
  PATCH  /api/leave/requests/:requestId/hr-cancel
  GET    /api/leave/balances/my?year=YYYY
  GET    /api/leave/today?scope=team|hierarchy|company
  POST   /api/leave/encashments
  PATCH  /api/leave/encashments/:encashmentId/approve
  PATCH  /api/leave/encashments/:encashmentId/reject
  POST   /api/leave/employee-override
  POST   /api/leave/holidays
  GET    /api/leave/holidays
  DELETE /api/leave/holidays/:holidayId
```

### Critical Business Logic

**Attendance Check-in Flow:**
1. Resolve employee from JWT userId
2. Check attendance policy (employee override → designation policy)
3. If exempt → skip
4. If auto-present → mark present without geo
5. Check if on approved leave → mark LEAVE
6. Validate geo-fence (WEB source — log only; PWA — enforce)
7. Create/find AttendanceDay → add CHECK_IN event → update status

**Leave Apply Flow:**
1. Resolve employee from JWT userId
2. Validate dates (no cross-year, hourly must be same day)
3. Check for overlapping leave requests
4. Fetch leave balance for year
5. Fetch policy + employee override
6. Calculate effective days using `toDays(durationType, durationValue)`
7. Apply sandwich rule if enabled (count weekends/holidays between leave days)
8. Check balance sufficiency
9. Create leave request (status: PENDING)

**Leave Approval Flow:**
1. Verify request is PENDING
2. Resolve approver's employee ID from JWT userId
3. Convert `durationValue` to days via `toDays()`
4. Transaction: deduct balance + update status to APPROVED + set approvedById

**Duration to Days Conversion:**
```
FULL_DAY    → durationValue × 1
HALF_DAY    → durationValue × 0.5
QUARTER_DAY → durationValue × 0.25
HOURLY      → durationValue / 8
```

**Employee Creation:**
1. Auto-generate next employeeCode
2. Create profile
3. Bootstrap leave balances based on active policies (pro-rated by joining month)

### Seed Data (Default)

```
Company: Phibonacci Solutions
Users: admin@, hr@, ravi@, ram@, anubhaw@, sanket@ (all password: ChangeMe@123)
Departments: Engineering, Human Resources, Management
Teams: Platform Team
Designations: CTO, Cloud Architect, Software Engineer I, Tester, HR Manager, Company Administrator
Leave Types: Casual Leave (CL, 12/yr), Sick Leave (SL, 6/yr)
Office Location: 23.052228, 72.493801, radius 200m (may need to be increased for desktop testing)
```

---

## 3. Frontend Architecture

### Folder Structure

```
hrms-fe/
├── src/
│   ├── main.tsx
│   ├── app/
│   │   ├── App.tsx              # Provider tree (Redux, Router, Theme, Toaster)
│   │   ├── AuthBootstrap.tsx    # Silent refresh on app load
│   │   └── routes.tsx           # All route definitions
│   ├── api/
│   │   ├── client.ts            # apiClient (with interceptors) + authClient (without)
│   │   ├── auth.api.ts          # login, me, refresh, logout
│   │   ├── employee.api.ts      # getMe, getById, list
│   │   ├── attendance.api.ts    # checkIn, checkOut, getDay, getRange
│   │   ├── leave.api.ts         # types, balances, requests, approvals, holidays
│   │   └── organization.api.ts  # departments, teams, designations, office location
│   ├── store/
│   │   ├── store.ts             # Redux store (auth reducer only)
│   │   └── auth.slice.ts        # Auth state: user, status (idle|loading|authenticated|unauthenticated)
│   ├── hooks/
│   │   ├── useAuth.ts           # useAuth, useUser, useAuthStatus
│   │   ├── useEmployee.ts       # useMyProfile, useEmployeeList, useEmployeeById
│   │   ├── useAttendance.ts     # useCheckIn, useCheckOut, useTodayAttendance, useWeeklyAttendance
│   │   ├── useLeave.ts          # useLeaveBalances, useMyLeaveRequests, useLeaveTypes, useHolidays, useTodayLeaves
│   │   └── usePermission.ts     # useHasPermission
│   ├── guards/
│   │   ├── RequireAuth.tsx      # Redirects to / if unauthenticated
│   │   └── RequirePermission.tsx # Permission-based route guard
│   ├── pages/
│   │   ├── AuthGate.tsx         # Landing: loading → login → redirect by role
│   │   ├── Login.tsx            # Email/password login form
│   │   ├── EmployeeDashboard.tsx # Profile, attendance, leave, hierarchy, calendar
│   │   ├── AdminDashboard.tsx   # Hub with cards linking to admin sub-pages
│   │   ├── AdminEmployeeList.tsx # Employee table with active/inactive toggle
│   │   ├── AdminEmployeeProfile.tsx # Single employee view (profile + hierarchy)
│   │   ├── AdminLeaveApprovals.tsx  # Pending leave requests with approve/reject
│   │   ├── AdminHolidays.tsx    # Holiday CRUD
│   │   ├── SuperAdminDashboard.tsx # Company list + create
│   │   └── NotFound.tsx         # 404
│   ├── components/
│   │   ├── AppShell.tsx         # Header + logout + Outlet
│   │   ├── DataTable.tsx        # Generic table component
│   │   ├── LoadingState.tsx     # Spinner + message
│   │   ├── EmptyState.tsx       # No data message
│   │   ├── ErrorState.tsx       # Error message + retry button
│   │   ├── ApplyLeaveModal.tsx  # Leave application form dialog
│   │   └── LeaveRequestList.tsx # Leave requests with status chips + cancel
│   ├── types/
│   │   ├── auth.types.ts
│   │   ├── employee.types.ts
│   │   ├── attendance.types.ts
│   │   ├── leave.types.ts
│   │   ├── organization.types.ts
│   │   └── company.types.ts
│   ├── utils/
│   │   ├── permissions.ts       # ROLE_PERMISSION_MAP, hasPermission()
│   │   ├── geo.ts               # getCurrentLocation (browser API wrapper)
│   │   ├── geoPolicy.ts         # mapGeoErrorToAppError
│   │   ├── responsive.ts        # useIsMobile, useIsTablet, useIsDesktop
│   │   └── dashboard.ts         # getDashboardRoute(role)
│   └── styles/
│       ├── theme.ts             # MUI theme (colors, typography, breakpoints)
│       ├── style-vars.css       # CSS variables (spacing, radius, shadows, motion)
│       └── globals.css          # Reset + base styles
├── .env                         # VITE_API_BASE_URL=http://localhost:4000
├── package.json
└── vite.config.ts
```

### Key Frontend Patterns

**Two Axios Instances:**
```
apiClient  — Has auth header interceptor + 401 refresh retry
authClient — No interceptors (used for login, refresh, logout to prevent loops)
```

**Auth Flow:**
```
App load → AuthBootstrap:
  1. authApi.refresh() via authClient (no interceptors)
  2. If success → authApi.me() → dispatch(setUser()) → status: 'authenticated'
  3. If fail → dispatch(clearAuth()) → status: 'unauthenticated'

Login:
  1. authApi.login() via authClient → sets token + companyId in memory
  2. authApi.me() via apiClient → dispatch(setUser())
  3. navigate(getDashboardRoute(role))

Token storage:
  - Access token: in-memory variable (never localStorage)
  - Refresh token: httpOnly cookie (set by backend)
  - CompanyId: in-memory variable (set on login/me)
```

**In-Memory Token + CompanyId:**
```typescript
// client.ts exports:
setToken(token)     // called by auth.api on login/refresh
setCompanyId(id)    // called by auth.api on login/me
// Request interceptor reads these and sets headers automatically
```

**Permission System:**
```typescript
// Temporary role → permission adapter (until backend RBAC)
ROLE_PERMISSION_MAP: Record<UserRole, Permission[]>

// Permissions used:
'admin.access' | 'employee.view' | 'employee.edit' |
'employee.role.change' | 'leave.view' | 'leave.approve' |
'attendance.view' | 'attendance.override' | 'org.manage' |
'holiday.manage' | 'company.manage'

// Guard usage:
<RequirePermission permission="admin.access">
  <AppShell />
</RequirePermission>

// Hook usage:
const canApprove = useHasPermission('leave.approve')
```

**Redux Usage:**
- Redux is used ONLY for auth state (`user`, `status`)
- All other data uses local component state via hooks
- Hooks return `{ data, loading, error, reload }` pattern

**Route Structure:**
```
/                    → AuthGate (login or redirect)
/employee            → RequirePermission('employee.view') → EmployeeDashboard
/admin               → RequirePermission('admin.access') → AdminDashboard
/admin/employees     → AdminEmployeeList
/admin/employees/:id → AdminEmployeeProfile
/admin/leave-approvals → AdminLeaveApprovals
/admin/holidays      → AdminHolidays
/super-admin         → RequirePermission('company.manage') → SuperAdminDashboard
*                    → NotFound
```

**Role → Dashboard Redirect:**
```
SUPER_ADMIN   → /super-admin
COMPANY_ADMIN → /admin
HR            → /admin
EMPLOYEE      → /employee
```

### Frontend Type Contracts (Match Backend Responses)

```typescript
// EmployeeListItem — matches GET /api/employees/
{
  id, employeeCode, firstName, lastName, displayName,
  isActive, isProbation, joiningDate, dateOfBirth,
  userId, companyId, designationId, teamId, managerId,
  user: { email },
  team: { name } | null,
  designation: { name },
  manager: { id, displayName } | null
}

// EmployeeDetail — matches GET /api/employees/me and /:id
// extends EmployeeListItem with:
{
  subordinates: [{ id, displayName }]
}

// AttendanceDay — matches GET /api/attendance/day
{
  id, employeeId, date, status, totalMinutes,
  events: [{ id, type, timestamp, source }]
}

// LeaveBalance — matches GET /api/leave/balances/my
{
  id, employeeId, year, allocated, used, carriedForward, remaining,
  leaveType: { name, code }
}

// LeaveRequest — matches GET /api/leave/requests/my
{
  id, employeeId, fromDate, toDate, durationType, durationValue,
  reason, status, approvedById, createdAt,
  leaveType: { name, code }
}
```

### Known Quirks & Decisions

1. **Desktop geo-fencing is unreliable** (IP-based, 1-10km accuracy). Office radius may need to be large for desktop testing. Production enforcement is PWA/mobile only.
2. **All dates stored in UTC**. Backend uses `todayDateUTC()` and `parseDateUTC()` to avoid timezone-shift bugs.
3. **Leave duration conversion**: `toDays(durationType, value)` converts HOURLY to days using 8-hour workday. Balance always tracked in days.
4. **`approvedById`** references `EmployeeProfile.id`, not `User.id`. Service resolves employee from JWT userId before approval.
5. **Sandwich rule**: Weekends/holidays between leave days are counted as additional leave days (configurable per policy + employee override).
6. **Leave balance bootstrap**: When an employee is created, leave balances are auto-created based on active policies for that year, pro-rated by joining month.

---

## 4. Current Feature Status

### Fully Working (Backend + Frontend)

- ✅ Auth (login, refresh, logout, session persistence)
- ✅ Employee dashboard (profile, hierarchy, manager, peers, reportees)
- ✅ Geo check-in / check-out with live working hours counter
- ✅ Weekly attendance calendar with navigation
- ✅ Leave balances with progress bars
- ✅ Apply leave modal (full/half/quarter/hourly)
- ✅ My leave requests list with self-cancel
- ✅ Holiday list (employee view)
- ✅ Admin dashboard hub
- ✅ Admin employee list (active/inactive toggle)
- ✅ Admin employee profile view
- ✅ Admin leave approvals (approve/reject)
- ✅ Admin holiday CRUD
- ✅ Super admin company list + create
- ✅ Permission-based routing
- ✅ Logout

### Backend Done, Frontend Not Yet

- ⏳ Employee onboarding form (create user + employee)
- ⏳ Employee deactivation/exit
- ⏳ Attendance overview (HR — date range per employee)
- ⏳ Attendance overrides (HR)
- ⏳ Attendance violations view
- ⏳ Leave encashment UI
- ⏳ Leave HR override UI
- ⏳ Organization management (departments, teams, designations)
- ⏳ Office location management
- ⏳ User role management
- ⏳ Birthday list

### Not Implemented (Future)

- ❌ Notifications (in-app, email)
- ❌ Leave ledger / audit trail
- ❌ Compensatory off
- ❌ Payroll integration
- ❌ Backend RBAC (permission tables — currently enum roles with frontend permission adapter)
- ❌ Session management panel (view/revoke devices)
- ❌ PWA offline support
- ❌ Background jobs (leave accrual, year-end carry forward, comp-off expiry)

---

## 5. Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
DB_NAME=dbname
DB_USER=user
DB_PASSWORD=pass
DB_PORT=5432
API_PORT=4000
JWT_ACCESS_SECRET=secret1
JWT_REFRESH_SECRET=secret2
```

### Frontend (.env)
```
VITE_API_BASE_URL=http://localhost:4000
```

---

## 6. Seed Accounts (All password: ChangeMe@123)

| Email | Role | Employee |
|---|---|---|
| admin@phibonacci.com | COMPANY_ADMIN | PhiAdmin |
| hr@phibonacci.com | HR | Nidhi Aggarwal |
| ravi@phibonacci.com | EMPLOYEE | Ravi Kant Sharma (CTO) |
| ram@phibonacci.com | EMPLOYEE | Ram Thakkar (reports to Ravi) |
| anubhaw@phibonacci.com | EMPLOYEE | Anubhaw Dwivedi (reports to Ram) |
| sanket@phibonacci.com | EMPLOYEE | Sanket Barot (reports to Ravi) |