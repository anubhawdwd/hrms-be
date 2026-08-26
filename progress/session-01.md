# Session 01

## Done
- Implemented company-wide geo-fencing toggle (`geoFencingEnabled`) across schema, migration, backend service, and `AdminGeoSettings.tsx`.
- Built `AdminAttendance.tsx` with violations log, manual attendance record edit/create, and manual event logging.
- Upgraded attendance administration to select employee + date, keeping internal record UUIDs completely hidden from HR users.
- Built two-step employee onboarding form (`AdminCreateEmployee.tsx`) with automatic leave balance bootstrapping.
- Configured and verified LAN access (`0.0.0.0`, port `4000`, `VITE_API_BASE_URL=http://192.168.1.185:4000`, CORS origins) while keeping PostgreSQL strictly bound to localhost (`127.0.0.1:5432`).
- Completed Phase 1 code cleanup for both `hrms-be` and `hrms-fe`, eliminating ~1,000 lines of dead and duplicate commented code.
- Authored master `README.md` and unified `ROADMAP.md` covering both frontend and backend.

## Verified
- Backend TypeScript compilation (`npx tsc --noEmit`) passing with 0 errors.
- Frontend TypeScript compilation (`npx tsc -b`) passing with 0 errors.
- Frontend production build (`npm run build`) completed successfully.
- LAN accessibility verified for frontend (`http://192.168.1.185:5173`, `http://192.168.1.185:5174`) and backend (`http://192.168.1.185:4000`).
- Login, HTTP-only refresh cookie exchange, and authenticated API requests functioning over LAN.

## Known Issues
- `GET /api/employees/` route currently lacks a `requireRole` guard.
- OAuth (Google / Microsoft) login triggers are not yet added to the login page.

## Next
- Add `requireRole(UserRole.HR, UserRole.COMPANY_ADMIN)` guard to `GET /api/employees/`.
- Build `AdminOrganization.tsx` for Department, Team, and Designation management.
- Add HR Cancel button to `AdminLeaveApprovals.tsx`.
