# HRMS Product Requirements Document (PRD)

## 1. Purpose

HRMS is a multi-tenant employee-management system for companies to manage:

- Employees and organizational hierarchy
- Authentication and role-based access
- Attendance and working hours
- Leave types, policies, balances and approvals
- Holidays and restricted holidays
- Employee lifecycle / offboarding
- HR/Admin operations
- Manager → reportee workflows
- Super Admin → company onboarding

This document defines **what the product should do**. Implementation tasks and bugs belong in `roadmap.md`.

---

# 2. Tenant & Company Model

## 2.1 Multi-tenancy

- Every company is isolated by `companyId`.
- Company data must never be accessible across tenants.
- All company-scoped APIs must enforce tenant isolation.

## 2.2 Company onboarding

Target onboarding flow:

```text
Super Admin
    ↓
Create Company
    ↓
Create Company Admin
    ↓
Company Admin configures organization
    ↓
Create / import employees
    ↓
Configure leave + attendance
    ↓
Assign managers
    ↓
Employees start using HRMS
```

---

# 3. Roles & Responsibilities

## Super Admin

System-level role.

- Create/manage companies.
- Create initial company administrator.
- Access company-management dashboard.
- Must not require company-level HR permissions for system administration.

## Company Admin

Company-level administrator.

- Manage organization.
- Manage employees.
- Configure attendance.
- Configure leave.
- Manage holidays.
- Manage HR operations.
- Manage company users/accounts.

## HR

Operational HR role.

- Manage employees.
- Manage attendance.
- Manage leave.
- Approve/reject leave according to company workflow.
- Manage employee leave allocation according to policy.
- Manage restricted-holiday eligibility/allocation.
- Perform employee offboarding/reactivation.

## Manager

Manager of assigned reportees.

- View direct reportees.
- Approve/reject leave requests of reportees.
- Must not approve/manage unrelated employees' leave.

## Employee

- Login.
- Maintain own profile where allowed.
- Check in/out.
- View attendance.
- Apply for leave.
- Cancel eligible own leave requests.
- View own leave balances and requests.

---

# 4. Authentication

- Email/password login.
- Short-lived access JWT.
- HTTP-only refresh-token sessions.
- Logout.
- Forced first-login password change for temporary passwords.
- Role-based authorization.
- Google SSO.
- Microsoft SSO.
- Admin-assisted password reset.
- Future optional self-service email password reset.

Inactive users must not be able to authenticate.

---

# 5. Employee Management

- Employee directory.
- Employee profile.
- Employee self-profile.
- Employee onboarding.
- Employee/user account creation.
- Department assignment.
- Designation assignment.
- Team assignment where applicable.
- Reporting-manager assignment.
- Employee activation/deactivation.
- Employee/User status must remain consistent through lifecycle operations.
- Historical employee data must be preserved after offboarding.

CSV bulk import is **not currently part of the application scope**; controlled seed/backfill scripts may be used for bulk data operations.

---

# 6. Organization Management

Company administrators/HR can manage:

- Departments
- Teams
- Designations
- Reporting hierarchy
- Designation attendance policies
- Employee-specific attendance overrides

Attendance precedence:

```text
Employee Override
       ↓
Designation Policy
       ↓
Company/System Default
```

---

# 7. Attendance

## Employee attendance

- Browser/GPS check-in.
- Check-out.
- Multiple attendance sessions per day.
- Accurate cumulative worked time.
- Open-session/live timer.
- Same-calendar-day attendance boundary.
- Forgotten checkout handling.
- Attendance history/calendar.

## Leave interaction

- Full-day approved leave blocks attendance.
- Partial leave adjusts required working time.
- Attendance calculation uses company working-hour configuration.

## Geo-fencing

Company-level configuration:

- Enabled/disabled.
- Office latitude/longitude.
- Radius.

When disabled:

- Browser location permission must not be requested.
- Attendance must not require location.

## HR attendance

HR/Admin can:

- View employee attendance by date.
- Create attendance records.
- Correct attendance.
- Add punch events.
- Review geo-fence violations.
- View attendance dashboard.

## Working hours

Company-level configurable:

- Scheduled work duration.
- Lunch duration.
- Break duration.
- Grace period.

Configuration changes affect future calculations and do not rewrite historical attendance.

---

# 8. Leave Management — BUSINESS RULES TO BE FINALIZED

Leave management is currently undergoing a **business-rule redesign** before the next clean deployment.

The final model must define:

- Leave types.
- Leave policies.
- Annual allocation.
- Leave balance.
- Carry-forward.
- Approval/rejection.
- Cancellation.
- Day-level approval/rejection.
- HR allocation/grant permissions.
- Sandwich policy.
- Restricted holidays.
- Leave encashment.

## Important design question

HR currently has the ability to **add/grant leave**, but the product rule for whether HR can subtract/revoke allocated leave is not yet finalized.

This must be explicitly decided before implementation is considered final.

## Balance invariant

The intended accounting model must always keep:

```text
Remaining =
Allocated + Carried Forward - Actual Deducted Leave
```

Actual deductions must reflect the final approved/deducted leave days, including day-level changes and sandwich days.

Parent leave duration must not blindly be used for reversal after individual days have changed.

## Multi-day leave

The system must support:

- Full request approval/rejection.
- Day-level approval/rejection by authorized roles.
- Local draft changes before saving.
- Bulk approve/reject of only currently pending days.
- Already-approved/rejected days remain unchanged during "remaining" actions.
- Balance changes must be delta-based and idempotent.

## Sandwich policy

Final intended model:

- Company-wide ON/OFF setting.
- No leave-type-specific sandwich configuration.
- When OFF, no sandwich deduction.
- When ON, applicable weekend/public-holiday bridge days are treated according to the company rule.

Examples must support:

```text
Friday leave + Monday leave
→ Friday + Saturday + Sunday + Monday deduction when applicable
```

The final detailed rule should be documented before implementation is frozen.

---

# 9. Leave Types & Policies

The company must be able to define/configure leave types and policies.

Each policy should explicitly define applicable rules such as:

- Allocation.
- Paid/unpaid behavior.
- Carry-forward.
- Carry-forward limit.
- Reset period.
- Approval requirements.
- Manual allocation/grant rules.
- Partial-day support.
- Restricted-holiday eligibility where applicable.

Current expected carry-forward:

| Leave | Carry Forward |
|---|---|
| PL | Yes |
| SL | No |
| CLP | No |
| Marriage ML | No |
| Maternity MATL | No |
| Paternity PATL | No |
| LWP | No |
| RH | No |
| COMP_OFF | To be explicitly finalized |

Zero-entitlement leave types should not clutter the employee leave-selection/balance UI when:

```text
allocated = 0
used = 0
carriedForward = 0
remaining = 0
```

HR should still be able to grant/add entitlement where company policy permits.

---

# 10. Restricted Holidays

Restricted holidays are **not hard-coded by religion**.

The system should model:

```text
Restricted Holiday
       ↓
HR determines eligible employees
       ↓
Eligible employee sees/uses assigned RH
```

Common company/public holidays remain available according to the normal holiday policy.

HR should be able to assign eligible restricted holidays to individual employees according to company policy.

The exact data model and UX are still to be finalized.

---

# 11. Holiday Management

HR/Admin can:

- Create holidays.
- Delete holidays.
- View company holiday list.

Holidays must participate correctly in:

- Attendance.
- Leave calculation.
- Sandwich policy.
- Restricted holiday handling where applicable.

---

# 12. Manager / Reportee Workflow

Manager hierarchy must drive approval visibility.

Example:

```text
Manager A
 ├── Employee 1
 ├── Employee 2
 └── Employee 3
```

Manager A can approve/reject leave for Employees 1–3.

Manager A must not approve leave for employees outside their reportee scope unless explicitly granted an appropriate HR/Admin role.

---

# 13. HR/Admin Leave Operations

HR/Admin should have operational visibility for:

- Pending leave.
- Approved leave.
- Rejected leave.
- Cancelled leave.
- Who is on leave today.
- Recently approved leave.
- Leave balance.
- Day-level leave breakdown.

HR/Admin may manage employee leave according to the final allocation/correction rules.

---

# 14. Employee Lifecycle

Offboarding is immediate after confirmation.

Expected behavior:

- Employee becomes inactive.
- User becomes inactive.
- Inactive user cannot login.
- Existing sessions are invalidated.
- Historical data is preserved.
- Future approved leave is auto-cancelled with audit reason.
- Pending leave is auto-rejected with audit reason.
- Open attendance session is closed at the current timestamp.
- Manager reassignment is currently manual.
- Leave/payroll final settlement is out of scope.

Reactivation:

- Reuse existing employee record.
- Restore active user status.
- Restore login.
- Preserve historical attendance and leave.

---

# 15. Dashboards

## Super Admin

- Company management.
- Company onboarding.

## Admin/HR

- Operational KPI dashboard.
- Attendance dashboard.
- Leave dashboard.
- Employee directory.
- Organization management.
- Holiday management.
- Geo-fencing settings.

## Employee

- Attendance.
- Leave balance.
- Leave requests.
- Profile.
- Daily/weekly attendance information.

---

# 16. Security & Authorization

Backend authorization is authoritative.

Every sensitive endpoint must enforce:

- Authentication.
- Role authorization.
- Company/tenant isolation.
- Resource ownership/reportee scope where applicable.

Frontend hiding alone is insufficient.

---

# 17. Non-Functional Requirements

- TypeScript compilation must pass.
- Production builds must pass.
- Database migrations must be reproducible.
- APIs must be documented through OpenAPI/Swagger.
- Test suites must use isolated test data.
- Automated tests must never modify real application/test-UAT company data.
- Every test must clean up records it creates.
- Historical HR data must not be casually hard-deleted.

---

# 18. Current Product Principle

Before the first real company onboarding:

```text
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
