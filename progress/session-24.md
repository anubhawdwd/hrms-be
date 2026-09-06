# Session 24: Year-End Leave Rollover Engine (LEV-12), Leave Policies UI Simplification & Dashboard Card Layout

## Objectives Completed

1. **Year-End Leave Rollover Engine (`LEV-12`)**:
   - **Backend Engine & Endpoints** (`POST /api/leave/rollover/preview`, `POST /api/leave/rollover`):
     - Implemented `computeYearEndRolloverPlan` in `src/modules/leave/service.ts` supporting dry-run previews without writing to the database.
     - Fixed rollover balance calculation formula: `toYear remaining = toYear allocated + carriedForward - toYear used` (where `carriedForward = min(fromYear remaining, policy.maxCarryForwardDays)`).
     - Driven by `toYear` Leave Policies: policies configured for the target year dictate allocations, carry-forward permissions, and carry-forward caps (with `999` treated as unlimited).
     - Excludes unallocated leave types (e.g. `LWP`) and automatically identifies and reports unconfigured leave types in the preview.
     - Batched entire company execution inside a single atomic `prisma.$transaction`.
     - Preserves full audit trail in `AuditLog` table with action `YEAR_END_ROLLOVER` and detailed JSON payload (`fromYear`, `toYear`, `forceOverwrite`, `summary`, `employeePlans`).
     - Enforced strict idempotency protection: detects existing `carriedForward > 0` balances in `toYear`, flags `alreadyRolledOver: true` in preview, and blocks re-runs unless `forceOverwrite: true` is supplied.
     - Enforced elevated security & validation: `forceOverwrite: true` is restricted to `COMPANY_ADMIN` role only (`403 Forbidden` for `HR`) and requires a mandatory `reason` string (`400 Bad Request` if empty).
   - **Frontend Rollover Wizard (`AdminYearEndRolloverDialog.tsx`)**:
     - 3-step interactive dialog: Step 1 (Configure from/to year), Step 2 (Preview metrics, unconfigured type warnings, searchable employee preview table, typed "OVERWRITE" confirmation + mandatory reason when re-running), Step 3 (Success summary report).
     - Role-aware UX: displays warning banner and disables overwrite submission if an HR user attempts to overwrite an existing rollover.
   - **Automated Tests (`tests/leave-rollover.test.ts`)**:
     - 10 comprehensive test scenarios covering clean rollovers, capped vs uncapped carry forwards, mid-year rollovers with existing `used` days, unconfigured type skips, idempotency protection, `COMPANY_ADMIN` vs `HR` authorization guards, mandatory reason validation, and `AuditLog` verification.

2. **Leave Policies UI Simplification (`AdminOrganization.tsx`)**:
   - Filtered out `LWP` and unpaid types from the Leave Policies configuration table (unallocated/unlimited by design).
   - Removed dead/unused `Encashment` and `Probation Allowed` toggle columns from the UI table.
   - Fixed default allocation value display: inputs are left blank with numeric placeholders (`e.g. 12`), accompanied by an amber `"Not configured"` badge for unconfigured policies.

3. **Leave Dashboard Card Height Alignment (`AdminLeaveDashboard.tsx`)**:
   - Fixed unbounded height growth across the 3-column summary cards ("On Leave Today", "Pending Approvals", "Recently Approved").
   - Applied consistent fixed max-height (`maxHeight: 340px`) and internal vertical scrollbar (`overflowY: 'auto'`), keeping all 3 cards visually aligned regardless of list length.

## Verification

- **Automated Backend Tests**: Ran full test suite via `npm test` (`tests/run-all.ts`): all 23 test suites passed cleanly (`16.59s`).
- **Frontend Build**: Ran `npm --prefix ../hrms-fe run build` (`tsc -b && vite build`): compiled cleanly with 0 errors in `3.54s`.
- **Database Self-Audit (`npm run audit:leftovers`)**:
  - `ZZTEST_` Companies: `0`
  - `@zztest.internal` Users: `0`
  - Created: `0` | Deleted: `0` | Remaining: `0`

## Known Issues

- None.

## Next Steps

- `NOTIF-01 through 05`: Real-time in-app notification system (WebSocket) for leave approval workflows.
- `EMP-07`: Exit-based encashment logging tied to offboarding flow.
- `DATA-01`: Scheduled 6-month hard-delete job for terminal-status leave requests.
- `DEV-02`: Production hardening (HTTPS, production secrets, backups, migration validation).
