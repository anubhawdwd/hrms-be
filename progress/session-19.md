# Session 19: Atomic Onboarding, Master Data Parity, Email Editing Safeguards & Data Sweep Tool

## Objectives Completed

1. **Atomic Employee Onboarding & Master Data Parity (`EMP-03`, `EMP-04`, `EMP-05`)**:
   - **Schema & Migrations**: Added `phone` (`String?`), `gender` (`Gender?` enum: `MALE`, `FEMALE`, `OTHER`), and `secondaryManagerId` (`String?`) to `EmployeeProfile`; added `personalEmail` (`String?`) to `User`.
   - **Atomic Transaction (`POST /api/employees/onboard`)**: Built single-transaction endpoint creating `User` + `EmployeeProfile` + initial `LeaveBalance` allocations atomically. Fails fast with zero orphaned records on duplicate email or explicit employee code collision (409 Conflict).
   - **Tenant Isolation**: Pre-validation rejects primary/secondary managers belonging to external organizations or self-referential assignments.
   - **Backward Compatibility**: Pre-migration employee profiles load with null fields without error.
   - **Frontend UI Parity**: Updated `AdminCreateEmployee.tsx` and `AdminEmployeeQuickEditModal.tsx` to collect and edit phone, gender, secondary manager, personal email, and role.

2. **Company Email Editing & Scoped Security (`PATCH /api/users/:userId/email`)**:
   - **Dedicated Endpoint**: Created focused `PATCH /api/users/:userId/email` endpoint scoped strictly to `COMPANY_ADMIN` and `HR` (excluding `SUPER_ADMIN` per platform-vs-tenant boundaries).
   - **SSO Safeguards**: Rejects email modifications for Google / Microsoft SSO accounts.
   - **Global Conflict Guard**: Validates system-wide uniqueness across companies (409 Conflict).
   - **Token Invalidation**: Automatically revokes all active refresh tokens for the modified user.
   - **Audit Logging**: Persists `USER_EMAIL_UPDATE` audit log with tenant `companyId`, `actorId`, `oldEmail`, and `newEmail`.

3. **Frontend Navigation & Attendance Dashboard Corrections**:
   - `AdminEmployeeList.tsx`: Changed employee Name cell click to navigate to `/admin/employees/:employeeId` ([AdminEmployeeProfile.tsx](file:///Users/anubhaw/Developer/hrms/hrms-fe/src/pages/AdminEmployeeProfile.tsx)).
   - `AdminAttendanceDashboard.tsx` & `getAttendanceDashboard`: Fixed PARTIAL status calculations and matrix cell formatting.

4. **Testing Hygiene & Standalone Diagnostic Sweeper**:
   - **Cleanup**: Cleaned up leftover test organizations and verified zero-mutation on real tenant data (`Phibonacci Learnings Pvt Ltd`).
   - **Diagnostic Sweep Script**: Created [scripts/audit-test-leftovers.ts](file:///Users/anubhaw/Developer/hrms/hrms-be/scripts/audit-test-leftovers.ts) (`npm run audit:leftovers`) providing read-only inspection for `ZZTEST_` companies, `@zztest.internal` users, unknown orgs, and orphaned users.
   - **Documentation**: Adopted and documented testing rules and naming conventions in [README.md](file:///Users/anubhaw/Developer/hrms/hrms-be/README.md) and [.agents/rules/hrms-rule.md](file:///Users/anubhaw/Developer/hrms/hrms-be/.agents/rules/hrms-rule.md).

## Verification

- **Automated Tests**: All 16 test suites in `tests/run-all.ts` passed (`14.00s`) with 0 real records modified, added, or deleted.
- **Type Checking**: Both `npx tsc --noEmit` (`hrms-be`) and `npx --prefix ../hrms-fe tsc --noEmit` (`hrms-fe`) compiled with 0 errors.
- **Diagnostic Sweep**: `npm run audit:leftovers` executed successfully and confirmed 0 leftover test companies.

## Known Issues

- `REP-02`: Leave report LWP and Absent Days columns show no data (live defect).
- `LEV-13`: Leave balance mismatch investigation pending.

## Next Steps

- `REP-02`: Fix LWP and Absent Days rendering in Leave Report.
- `UI-01`: Remove "Total Allocated" from all leave balance UI displays.
- `AUTH-04` / `TD-03`: Multi-role support (`UserRole` join table and permission rewrite).
- `LEV-03`: 2-step approval workflow (Manager → HR).
