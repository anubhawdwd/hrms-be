# 📁 Project Folder Structure
hrms-be/
├─ prisma/
│  ├─ migrations/
│  ├─ schema.prisma
│  ├─ seed.ts
│
├─ src/
│  ├─ app.ts                 # express app setup
│  ├─ server.ts              
│
│  ├─ config/
│  │  ├─ env.ts              # env validation (zod Not Implemented Yet)
│  │  ├─ prisma.ts           # PrismaClient singleton
│  │  └─ auth.ts             # JWT / OAuth config (Not Implemented yet)
│
│  ├─ modules/               
│  │  ├─ auth/               
│  │  ├─ company/   
│  │  │  ├─ controller.ts
│  │  │  ├─ service.ts
│  │  │  ├─ repository.ts
│  │  │  ├─ routes.ts
│  │  │  └─ types.ts         
│  │  ├─ organization/       
│  │  │  ├─ controller.ts
│  │  │  ├─ service.ts
│  │  │  ├─ repository.ts
│  │  │  ├─ routes.ts
│  │  │  └─ types.ts
│  │  ├─ employee/           
│  │  │  ├─ controller.ts
│  │  │  ├─ service.ts
│  │  │  ├─ repository.ts
│  │  │  ├─ routes.ts
│  │  │  └─ types.ts
│  │  ├─ attendance/         
│  │  │  ├─ controller.ts
│  │  │  ├─ service.ts
│  │  │  ├─ repository.ts
│  │  │  ├─ routes.ts
│  │  │  └─ types.ts
│  │  ├─ user/ 
│  │  │  ├─ controller.ts
│  │  │  ├─ service.ts
│  │  │  ├─ repository.ts
│  │  │  ├─ routes.ts
│  │  │  └─ types.ts                 
│  │  ├─ leave/              
│  │  │  ├─ controller.ts
│  │  │  ├─ service.ts
│  │  │  ├─ repository.ts
│  │  │  ├─ routes.ts
│  │  │  └─ types.ts
│  │  └─ audit/              #(Not Implemented yet)
│  │       
│  ├─ routes/
│  │  └─ index.ts            # (mounts module routes only)
│
│  ├─ utils/
│  │  ├─ logger.ts          #(unused for now)
│  │  ├─ geo.ts
│  │  └─ date.ts            #(unused for now)
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


ROUTING STYLE (FIXED)
---------------------------------------

routes/index.ts mounts modules like:

router.use("/company", companyRoutes);
router.use("/organization", organizationRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/users", userRoutes);
router.use("/employees", employeeRoutes);
router.use("/leave", leaveRoutes);

Controllers:
- Only parse HTTP request / response
- NO Prisma calls

Services:
- Business rules
- Validation
- Transactions

Repositories:
- Prisma only
- No business logic

---------------------------------------
CURRENT STATE
---------------------------------------

Completed modules:
- company
- organization
- employee
- attendance
- user

Leave module:
- Schema is finalized
- Basic leave APIs already exist
- No authentication / role middleware yet
- HR vs Employee distinction is logical only (not enforced by middleware)

---------------------------------------
MISSING LEAVE FEATURES (TO IMPLEMENT)
---------------------------------------

1. Employee cancel leave request
   - Allowed only if status = PENDING

2. HR cancel APPROVED leave (force cancel)
   - Must revert leave balance
   - Must store cancel reason

3. Leave encashment approval & rejection (HR)

4. Holiday calendar APIs (company-wise)
   - Create holiday
   - List holidays
   - Delete holiday