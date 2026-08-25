# HRMS Platform – Quick Start Guide

## Prerequisites
- **Docker & Docker Compose** – for PostgreSQL and Adminer containers.
- **Node.js (>=20)** and **npm** – to run the backend and frontend.
- **Git** – to clone the repository.

## Clone the repository
```bash
git clone https://github.com/your-org/hrms-platform.git
cd hrms-platform
```

## Backend (hrms-be) Setup
1. **Create `.env`** (copy the example if it exists or create manually):
   ```env
   DATABASE_URL="postgresql://SecretExampleUser:ThisOneisSecretExample@localhost:5432/SecretDatabaseName"
   DB_NAME=SecretDatabaseName
   DB_USER=SecretExampleUser
   DB_PASSWORD=ThisOneisSecretExample
   DB_PORT=5432
   API_PORT=4000   # <‑‑ Keep this in sync with the frontend
   JWT_ACCESS_SECRET=soemthingSecret
   JWT_REFRESH_SECRET=somthingSecret
   ```
2. **Start the database containers** (PostgreSQL + Adminer):
   ```bash
   cd hrms-be
   docker compose up -d
   ```
   - Backend API will be reachable at **`http://localhost:4000`**.
   - Adminer UI (DB explorer) is at **`http://localhost:8080`**.
3. **Run Prisma migrations** – this creates all tables:
   ```bash
   npx prisma migrate deploy
   ```
4. **Seed initial data** (companies, users, leave types, etc.):
   ```bash
   npx prisma db seed
   ```
5. **Install dependencies and start the server**:
   ```bash
   npm install
   npm run dev
   ```
   The server will log something like `🚀 Server running on http://localhost:4000`.

## Frontend (hrms-fe) Setup
1. **Copy the frontend env file** (if an example exists) and set the API base URL:
   ```env
   VITE_API_BASE_URL=http://localhost:4000
   ```
2. **Install and run**:
   ```bash
   cd ../hrms-fe
   npm install
   npm run dev
   ```
   The app will be available at **`http://localhost:5173`**.

## Quick One‑Liner Setup (for a fresh laptop)
```bash
# Backend
cd hrms-be && cp .env.example .env && docker compose up -d && npx prisma migrate deploy && npx prisma db seed && npm install && npm run dev &
# Frontend
cd ../hrms-fe && cp .env.example .env && npm install && npm run dev
```
*The `&` runs the backend in the background while the script continues to the frontend.*

## Useful URLs
- **API base**: `http://localhost:4000`
- **Swagger UI**: `http://localhost:4000/api-doc`
- **Adminer (DB UI)**: `http://localhost:8080`
- **Frontend**: `http://localhost:5173`

## Troubleshooting
- **Port conflicts** – Ensure `API_PORT` in `hrms-be/.env` matches the frontend `VITE_API_BASE_URL`.
- **Database connection refused** – Verify Docker containers are up (`docker compose ps`).
- **Missing migrations** – Run `npx prisma migrate deploy` again.
- **Seed errors** – Make sure the migrations have been applied before seeding.

---

### Project Overview (excerpt)
```text
Full‑stack HRMS (Human Resource Management System) platform with:
- Geo‑fenced attendance
- Leave management (apply, approve, reject, cancel, encash)
- Employee hierarchy (manager → reportees → peers)
- Role‑based dashboards (Employee, HR/Admin, Super Admin)
- Multi‑company support (tenant isolation via companyId)
```

### Tech Stack
| Layer   | Technology |
|---------|------------|
| Backend | Node.js, Express, TypeScript |
| ORM     | Prisma (PostgreSQL) |
| Frontend| React 19, TypeScript, Vite |
| State   | Redux Toolkit (auth only) |
| UI      | Material UI v7 |

---

*Happy coding!*

## Folder Structure

```text
hrms-be/
├── prisma/
│   ├── migrations/
│   │   ├── 20260206111940_init/
│   │   │   └── migration.sql
│   │   ├── 20260211111757_ip_and_user_agent_store/
│   │   │   └── migration.sql
│   │   ├── 20260216094539_add_date_of_birth/
│   │   │   └── migration.sql
│   │   ├── 20260218122605_add_leave_time_fields/
│   │   │   └── migration.sql
│   │   └── migration_lock.toml
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── config/
│   │   ├── auth.ts
│   │   └── prisma.ts
│   ├── generated/
│   │   └── prisma/
│   │       ├── internal/
│   │       ├── models/
│   │       ├── browser.ts
│   │       ├── client.ts
│   │       ├── commonInputTypes.ts
│   │       ├── enums.ts
│   │       └── models.ts
│   ├── middlewares/
│   │   ├── auth.middleware.ts
│   │   ├── requireRole.ts
│   │   ├── requireSelfUser.ts
│   │   └── validateCompany.ts
│   ├── modules/
│   │   ├── attendance/
│   │   │   ├── controller.ts
│   │   │   ├── repository.ts
│   │   │   ├── routes.ts
│   │   │   ├── service.ts
│   │   │   └── types.ts
│   │   ├── auth/
│   │   │   ├── controller.ts
│   │   │   ├── repository.ts
│   │   │   ├── routes.ts
│   │   │   ├── service.ts
│   │   │   └── types.ts
│   │   ├── company/
│   │   │   ├── controller.ts
│   │   │   ├── repository.ts
│   │   │   ├── routes.ts
│   │   │   ├── service.ts
│   │   │   └── types.ts
│   │   ├── employee/
│   │   │   ├── controller.ts
│   │   │   ├── repository.ts
│   │   │   ├── routes.ts
│   │   │   ├── service.ts
│   │   │   └── types.ts
│   │   ├── leave/
│   │   │   ├── controller.ts
│   │   │   ├── repository.ts
│   │   │   ├── routes.ts
│   │   │   ├── service.ts
│   │   │   └── types.ts
│   │   ├── organization/
│   │   │   ├── controller.ts
│   │   │   ├── repository.ts
│   │   │   ├── routes.ts
│   │   │   ├── service.ts
│   │   │   └── types.ts
│   │   └── user/
│   │       ├── controller.ts
│   │       ├── repository.ts
│   │       ├── routes.ts
│   │       ├── service.ts
│   │       └── types.ts
│   ├── routes/
│   │   └── index.ts
│   ├── utils/
│   │   ├── date.ts
│   │   ├── geo.ts
│   │   └── logger.ts
│   ├── app.ts
│   ├── server.ts
│   └── test-prisma.ts
├── .env
├── .env.example
├── .gitignore
├── API_Consumption_Guide.md
├── docker-compose.yml
├── package.json
├── package-lock.json
├── prisma.config.ts
├── README.md
├── swagger.ts
├── swagger-output.json
└── tsconfig.json
```