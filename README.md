# HRMS Platform

## Project Overview

HRMS (Human Resource Management System) is an internal company platform designed to manage employee lifecycle, attendance tracking, leave requests, organizational hierarchies, and administrative HR operations.

The system enforces multi-tenant isolation by company (`companyId`), role-based access control (`SUPER_ADMIN`, `COMPANY_ADMIN`, `HR`, `EMPLOYEE`), and location-aware attendance tracking via configurable geo-fencing.

---

## Architecture

The project consists of two applications:

* **`hrms-fe`**: Frontend Single Page Application (SPA) built with React 19, TypeScript, Material UI v7, Redux Toolkit (auth state), and Vite. Handles user interaction, responsive dashboards, and client-side route guards.
* **`hrms-be`**: Backend REST API built with Node.js, TypeScript, Express, Prisma ORM, and PostgreSQL. Handles business logic, authentication, geo-location calculations, leave quotas, and database transactions.

### Request Flow
```
Browser / Mobile Client
       │
       ▼
   hrms-fe (Vite / React SPA)
       │ HTTP / REST
       ▼
   hrms-be (Express + Middleware + Auth Guards)
       │ SQL (via Prisma ORM & pg adapter)
       ▼
   PostgreSQL (Local / Container Database)
```

---

## Repository Structure

The platform is structured into two main workspaces:

```text
hrms_main/
├── hrms-be/                    # Backend API project
│   ├── prisma/                 # Database schema, migrations, and seed script
│   │   ├── migrations/         # Canonical Prisma SQL migrations
│   │   ├── schema.prisma       # Prisma data model definition
│   │   └── seed.ts             # Initial database seed script
│   ├── src/                    # Backend application source code
│   │   ├── config/             # Database and auth config
│   │   ├── middlewares/        # JWT auth, role validation, company header guards
│   │   ├── modules/            # Domain modules (auth, employee, attendance, leave, etc.)
│   │   ├── routes/             # Centralized Express router registration
│   │   ├── utils/              # Date, geo distance, and logger utilities
│   │   ├── app.ts              # Express application configuration & CORS
│   │   └── server.ts           # HTTP server startup & port binding
│   ├── progress/               # Session progress tracking documents
│   ├── docker-compose.yml      # PostgreSQL & Adminer container configuration
│   ├── README.md               # Quick start and architecture guide
│   └── ROADMAP.md              # Master feature checklist & issue tracker
└── hrms-fe/                    # Frontend React SPA
    ├── src/
    │   ├── api/                # Axios API clients & interceptors
    │   ├── app/                # Root component, routing, and auth bootstrap
    │   ├── components/         # Shared UI components & layouts (AppShell, modals, tables)
    │   ├── guards/             # Permission and route protection components
    │   ├── hooks/              # Custom React hooks for data fetching & actions
    │   ├── pages/              # Role-specific dashboard & admin pages
    │   ├── store/              # Redux auth slice & store
    │   ├── styles/             # Global theme & typography configuration
    │   ├── types/              # Frontend TypeScript interfaces & DTOs
    │   └── utils/              # Permissions, geo-fencing, and responsive utilities
    ├── index.html              # Frontend HTML entry point
    └── vite.config.ts          # Vite configuration & PWA setup
```

---

## Main Features

* **Authentication & Security**: Email/password authentication, JWT access tokens with automatic rotation via HTTP-only refresh cookies, and multi-tier role permissions.
* **Employee Management**: Employee directory, profile viewing, managerial hierarchy mapping, and two-step guided onboarding with automatic leave balance bootstrapping.
* **Attendance Tracking**: Real-time employee check-in and check-out, geo-fence radius verification, today's attendance calculation, and weekly attendance calendar.
* **Leave Management**: Leave policies (annual quotas, carry-forward, sandwich rules), leave applications (full-day, half-day, quarter-day, hourly), balance deduction, and HR approval/rejection workflows.
* **Organization Management & Policy Hierarchy**: Unified administration hub (`AdminOrganization.tsx`) for departments, teams, designations, and 3-tier attendance policy assignment (Employee Override → Designation Policy → System Default) supporting auto-present and attendance exemption.
* **Workplace & Geo-Fencing Settings**: Company-level office location setup (latitude, longitude, radius) with an instant toggle switch, plus company-wide working hours (8h), scheduled lunch (30m), break (20m), and grace period (10m) configurations.
* **Attendance Dashboard & Day Boundaries**: Batched monthly employee × date matrix endpoint (`GET /api/attendance/dashboard?month=YYYY-MM`) with zero N+1 queries, sticky matrix grid, live search filter, strict calendar-day boundaries, same-day overtime accumulation, and automatic end-of-day checkout at 23:59:59 IST.
* **HR Leave Dashboard & Approvals**: Card-based operational overview showing employees on leave today, actionable pending approvals (inline approve/reject), recently approved requests (`GET /api/leave/requests/recent`), and transactional HR cancellation with quota restoration.
* **HR / Admin Operations**: Dedicated admin dashboards, attendance violation logs, manual attendance adjustments (by employee and date without UUID exposure), punch event additions, and holiday management.

---

## Running Locally

### 1. Database (Docker)
Start the PostgreSQL container from `hrms-be`:
```bash
cd hrms-be
docker compose up -d
```
* **PostgreSQL**: `127.0.0.1:5432`
* **Adminer (DB UI)**: `http://localhost:8080`

### 2. Backend Setup (`hrms-be`)
```bash
cd hrms-be
cp .env.example .env     # Configure database and JWT credentials
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev
```
* **Backend API**: `http://localhost:4000`
* **Swagger API Docs**: `http://localhost:4000/api-docs`

### 3. Frontend Setup (`hrms-fe`)
```bash
cd hrms-fe
cp .env.example .env     # Set VITE_API_BASE_URL=http://localhost:4000
npm install
npm run dev
```
* **Frontend SPA**: `http://localhost:5173`

---

## LAN / Internal Network Access

The platform supports access from multiple devices and computers across the same local network (LAN):

* **Host Machine IP**: `192.168.1.185`
* **Frontend URL**: `http://192.168.1.185:5173`
* **Backend API URL**: `http://192.168.1.185:4000`

### Network Binding & Security Rules
* **Vite (`hrms-fe`)**: Configured with `vite --host 0.0.0.0` to listen on all interfaces.
* **Express (`hrms-be`)**: Configured with `HOST=0.0.0.0` and dynamic `FRONTEND_URL` CORS origin matching.
* **PostgreSQL Isolation**: PostgreSQL port mapping in `docker-compose.yml` is bound strictly to `127.0.0.1:5432`. External LAN devices can never access the database directly.

---

## Environment Configuration

### Backend (`hrms-be/.env`)
```env
DATABASE_URL="postgresql://<user>:<password>@localhost:5432/<dbname>"
DB_NAME=phi-hrms
DB_USER=<user>
DB_PASSWORD=<password>
DB_PORT=5432
API_PORT=4000
API_HOST=0.0.0.0
FRONTEND_URL="http://localhost:5173,http://127.0.0.1:5173,http://192.168.1.185:5173,http://localhost:5174,http://127.0.0.1:5174,http://192.168.1.185:5174"
JWT_ACCESS_SECRET="<access-token-secret>"
JWT_REFRESH_SECRET="<refresh-token-secret>"
```

### Frontend (`hrms-fe/.env`)
```env
VITE_API_BASE_URL=http://192.168.1.185:4000
VITE_GOOGLE_CLIENT_ID="<google-oauth-client-id>"
VITE_MICROSOFT_CLIENT_ID="<microsoft-app-client-id>"
```

---

## Authentication & Token Lifecycle

1. **Login**: User submits credentials via `POST /api/auth/login`. On success:
   * Short-lived `accessToken` (15m) is returned in the JSON response payload.
   * Long-lived `refreshToken` (30d) is stored in the database and set as an `HttpOnly` cookie (`hrms_refresh_token`).
2. **Cookie Security**:
   * **Development / LAN (HTTP)**: `secure: false`, `sameSite: "lax"`.
   * **Production (HTTPS)**: `secure: true`, `sameSite: "none"`.
3. **Token Refresh**: When access token expires, Axios response interceptor calls `POST /api/auth/refresh` using the cookie to rotate the refresh token and obtain a new access token transparently.

---

## Documentation

* **[`ROADMAP.md`](file:///d:/Anubhaw/hrms_main/hrms-be/ROADMAP.md)**: Master implementation checklist and active issue tracker covering both backend and frontend.
* **[`progress/`](file:///d:/Anubhaw/hrms_main/hrms-be/progress/)**: Sequential session summaries recording accomplished milestones and verified workflows.