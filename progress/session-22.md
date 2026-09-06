# Session 22: Multi-Role Architecture, 2-Step Leave Approvals, Manager Views & UI Refinements

## Objectives Completed

1. **Multi-Role Support (`AUTH-04` / `TD-03`)**:
   - Added `UserRoleAssignment` join table model with migration, supporting multiple active roles per user (`EMPLOYEE`, `HR`, `COMPANY_ADMIN`, `SUPER_ADMIN`).
   - Refactored JWT payloads to issue `roles: UserRole[]` array with backward-compatible `role` shim.
   - Rewrote backend authorization middleware (`requireRole`, `validateCompany`) to check array inclusion.
   - Updated frontend onboarding and quick-edit modals to support multi-select role assignment.
   - Built context-aware view switcher in profile dropdown menu, allowing users holding both Employee and Admin/HR roles to toggle cleanly between Employee and Admin dashboard views.

2. **2-Step Leave Approval Workflow (`LEV-03`)**:
   - Added `LeaveApprovalWorkflow` toggle (`TWO_STEP` vs `DIRECT_TO_HR`) to Company settings.
   - Added `PENDING_MANAGER` and `PENDING_HR` approval states.
   - Enforced server-side authorization ensuring only assigned primary/secondary reporting managers can approve/reject during the manager approval stage (coworkers blocked with 403).
   - Audited and updated all pending status checks across attendance, reports, and dashboards.
   - Updated Admin Leave Dashboard to show stage chips (`Pending Manager Review` vs `Awaiting HR Final Approval`) and restrict actions to actionable stages.

3. **Manager Self-Service Views (`MGR-01` / `MGR-02`)**:
   - Built backend manager endpoints: `/api/manager/reportees`, `/api/manager/leaves`, and `/api/manager/attendance`.
   - Built `ManagerTeamLeaveSection.tsx` with quick approve/reject action cards, rejection reason dialog, and filterable history table (status and reportee filters).
   - Built `ManagerTeamAttendanceSection.tsx` with monthly presence matrix and `<DaySessionDetail>` popovers.
   - Added conditional "My Team" tab on `EmployeeDashboard.tsx` (shown only for users with reportees) with live pending approvals notification badge.

4. **UI Refinements & Bug Fixes**:
   - Renamed Workplace Settings tab from "Work Week & Sandwich Policy" to "Leave & Attendance Policies".
   - Resolved MUI floating label clipping bug across 8 stacked outlined modal dialogs (`ApplyLeaveModal`, `HrCancelDialog`, `AdminMarkLeaveDialog`, `AdminBulkLeaveAllocationDialog`, `AdminEditLeaveAllocationDialog`, `AdminYearEndRolloverDialog`, `ChangePasswordModal`, `ManagerTeamLeaveSection`).
   - Added live pending leave count notification badge chip to the "Leave Dashboard" card on the Admin main dashboard (`/admin`).

## Verification

- **Automated Tests**: All 22 test suites in `tests/run-all.ts` passed (`26.81s`) with 0 database mutations on real tenant data.
- **Type Checking & Build**:
  - Backend: `npx tsc --noEmit` compiled with 0 errors.
  - Frontend: `npm run build` (`tsc -b && vite build`) succeeded with 0 errors.
- **Database Self-Audit**:
  - `ZZTEST_` Companies: `0`
  - `@zztest.internal` Users: `0`
  - Created: `0` | Deleted: `0` | Remaining: `0`

## Known Issues

- `LEV-06`: LWP report column verified in synthetic tests, but flagged as `PARTIAL / VERIFY` pending retest on a real tenant company with live LWP usage.

## Next Steps

- `LEV-12`: Year-end treatment engine (carry-forward with cap → lapse remainder).
- `NOTIF-01 through 05`: Real-time in-app notification system (WebSocket) for leave approval workflows.
- `EMP-07`: Exit-based encashment logging tied to offboarding flow.
- `DATA-01`: Scheduled 6-month hard-delete job for terminal-status leave requests.
