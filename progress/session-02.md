# Session 02

## Done
- Started PostgreSQL and Adminer containers via Docker Compose (`docker compose up -d`).
- Diagnosed and resolved CORS preflight blocking issue when Vite dev server started on fallback port `5174` (`http://192.168.1.185:5174`).
- Updated `src/app.ts`, `hrms-be/.env`, and `hrms-be/.env.example` to allow port `5174` alongside `5173` across `localhost`, `127.0.0.1`, and host LAN IP `192.168.1.185`.
- Updated CORS handler in `src/app.ts` to return `callback(null, false)` for unauthorized origins rather than throwing an unhandled Error.

## Verified
- CORS preflight (`OPTIONS /api/auth/login`) verified returning `204 No Content` with `Access-Control-Allow-Origin: http://192.168.1.185:5174` and credentials enabled.
- Login (`POST /api/auth/login`) verified returning `200 OK` from `http://192.168.1.185:5174`.
- Backend TypeScript compilation (`npx tsc --noEmit`) passing with 0 errors.
- Frontend TypeScript compilation (`npx tsc -b`) passing with 0 errors.

## Known Issues
- `GET /api/employees/` route in `src/modules/employee/routes.ts` lacks a `requireRole` middleware guard.
- OAuth (Google / Microsoft) login triggers are not yet added to `hrms-fe/src/pages/Login.tsx`.

## Next
- Add `requireRole(UserRole.HR, UserRole.COMPANY_ADMIN)` guard to `GET /api/employees/`.
- Build `AdminOrganization.tsx` for Department, Team, and Designation management.
- Add HR Cancel button to `AdminLeaveApprovals.tsx`.
