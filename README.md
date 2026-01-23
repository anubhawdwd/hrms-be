# 📁 Project Folder Structure
hrms-be/
├─ prisma/
│  ├─ migrations/
│  ├─ schema.prisma
│  ├─ seed.ts
│
├─ src/
│  ├─ app.ts                 # express app setup
│  ├─ server.ts              # server bootstrap
│
│  ├─ config/
│  │  ├─ env.ts              # env validation (zod later)
│  │  ├─ prisma.ts           # PrismaClient singleton
│  │  └─ auth.ts             # JWT / OAuth config (Phase 2)
│
│  ├─ modules/               # DOMAIN-DRIVEN CORE
│  │  ├─ auth/               # Phase 2
│  │  ├─ company/            # Company domain
│  │  ├─ organization/       # Phase 1 (Departments, Teams)
│  │  │  ├─ controller.ts
│  │  │  ├─ service.ts
│  │  │  ├─ repository.ts
│  │  │  ├─ routes.ts
│  │  │  └─ types.ts
│  │  ├─ employee/           # Users + hierarchy
│  │  ├─ attendance/         # Phase 2+
│  │  ├─ leave/              # Phase 3
│  │  └─ audit/              # Phase 4
│
│  ├─ common/
│  │  ├─ constants/
│  │  ├─ enums/
│  │  ├─ errors/
│  │  └─ types/
│
│  ├─ middlewares/
│  │  ├─ auth.middleware.ts
│  │  ├─ company.middleware.ts
│  │  └─ error.middleware.ts
│
│  ├─ routes/
│  │  └─ index.ts            # route registration only
│
│  ├─ utils/
│  │  ├─ logger.ts
│  │  └─ date.ts
│
│  └─ generated/
│     └─ prisma/      # prisma generated (unchanged)
│
├─ .env
├─ docker-compose.yml
├─ prisma.config.ts
├─ tsconfig.json
├─ package.json
└─ README.md



src/modules/organization/
├─ routes.ts        ← api endpoints for organization
├─ controller.ts    ← parses HTTP
├─ service.ts       ← has business logic - validates & applies rules
├─ repository.ts    ← Talks to DB via prisma
├─ types.ts         ← DTOs
