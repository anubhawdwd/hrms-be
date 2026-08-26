# Session 03

## Done
- **Geo-fencing Default & Permission Fix**:
  - Changed `geoFencingEnabled` default in `prisma/schema.prisma` from `true` to `false` and applied migration `20260826071603_default_geo_fencing_false`.
  - Updated `prisma/seed.ts` to set `geoFencingEnabled: false` explicitly and synced existing DB rows to `false`.
  - Updated `src/modules/attendance/controller.ts` and `service.ts` so `location` is optional when `geoFencingEnabled` is disabled.
  - Included `geoFencingEnabled` in `/api/auth/me` and `/api/auth/login` responses.
  - Updated `hrms-fe` (`useAttendance.tsx`) to conditionally invoke `getCurrentLocation()` only when `user?.geoFencingEnabled === true`, skipping browser location prompts entirely when disabled.
- **Temporary Password & First-Login Password Change**:
  - Added `mustChangePassword Boolean @default(false)` to `User` model in `prisma/schema.prisma` and applied migration `20260826082428_add_must_change_password`.
  - Added `mustChangePassword` to `/api/auth/login` and `/api/auth/me` responses in `AuthService`.
  - Implemented `POST /api/auth/change-password` endpoint with current password validation, length/different checks, and bcrypt hashing (12 rounds).
  - Configured OAuth logins (`/api/auth/google`, `/api/auth/microsoft`) to automatically clear `mustChangePassword` upon successful login.
  - Added `ChangePasswordModal.tsx` in `hrms-fe` mounted inside `AppShell.tsx`, providing a non-dismissible modal blocking user interaction until password change is completed.

## Verified
- Automated test script executed for geo-fencing: verified both `geoFencingEnabled: false` (no prompt, no location payload) and `geoFencingEnabled: true` (enforces location and radius checks).
- Automated test script executed for temporary password flow: verified login `mustChangePassword: true`, rejection of invalid/short/same current password, password update, old password rejection, and new password login `mustChangePassword: false`.
- Backend TypeScript compilation (`npx tsc --noEmit`) passing with 0 errors.
- Frontend TypeScript compilation (`npx tsc -b`) and production build (`npm run build`) passing with 0 errors.

## Known Issues
- `GET /api/employees/` route in `src/modules/employee/routes.ts` lacks a `requireRole` middleware guard.
- Department creation has no frontend page (`AdminOrganization.tsx` pending).
- Bulk employee CSV import schema mismatches with HR export need resolution before importer implementation.

## Next
- Execute seed script for imported employees with `mustChangePassword: true`.
- Build `AdminOrganization.tsx` (Departments, Teams, Designations CRUD).
- Implement Phase 2 Bulk Employee CSV Importer.
