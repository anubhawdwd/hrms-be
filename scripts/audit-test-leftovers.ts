// scripts/audit-test-leftovers.ts
/**
 * Standalone Diagnostic Sweep / Audit Script
 * 
 * Inspects the database for leftover test entities, anomalous orphaned users,
 * and companies outside the real tenant allowlist.
 * 
 * READ-ONLY: Performs ZERO deletions or mutations.
 */
import { prisma } from "../src/config/prisma.js";

// Hardcoded allowlist of known production/real tenant companies
export const REAL_COMPANY_ALLOWLIST: string[] = [
  "Phibonacci Learnings Pvt Ltd",
];

async function runAudit() {
  console.log("================================================================================");
  console.log("             HRMS DATABASE AUDIT & TEST LEFTOVER DIAGNOSTIC SWEEP               ");
  console.log("================================================================================\n");

  let anomaliesFound = 0;

  // 1. Audit Companies with ZZTEST_ prefix
  const zzTestCompanies = await prisma.company.findMany({
    where: {
      name: { startsWith: "ZZTEST_" },
    },
    include: {
      _count: {
        select: {
          employees: true,
          users: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`[1] Companies Matching 'ZZTEST_' Convention: ${zzTestCompanies.length} found`);
  if (zzTestCompanies.length > 0) {
    anomaliesFound += zzTestCompanies.length;
    console.table(
      zzTestCompanies.map((c) => ({
        "Company ID": c.id,
        "Name": c.name,
        "Employees": c._count.employees,
        "Users": c._count.users,
        "Created At": c.createdAt.toISOString(),
      }))
    );
  } else {
    console.log("    ✔ No ZZTEST_ prefixed companies detected.\n");
  }

  // 2. Audit Users with @zztest.internal domain
  const zzTestUsers = await prisma.user.findMany({
    where: {
      email: { endsWith: "@zztest.internal" },
    },
    include: {
      roles: {
        select: { role: true },
      },
      company: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`[2] Users Matching '@zztest.internal' Convention: ${zzTestUsers.length} found`);
  if (zzTestUsers.length > 0) {
    anomaliesFound += zzTestUsers.length;
    console.table(
      zzTestUsers.map((u) => ({
        "User ID": u.id,
        "Email": u.email,
        "Roles": u.roles.map((r) => r.role).join(", "),
        "Company": u.company?.name ?? "N/A (System)",
        "Created At": u.createdAt.toISOString(),
      }))
    );
  } else {
    console.log("    ✔ No @zztest.internal users detected.\n");
  }

  // 3. Audit Non-Allowlisted Companies (including legacy test orgs)
  const allCompanies = await prisma.company.findMany({
    include: {
      _count: {
        select: {
          employees: true,
          users: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const nonAllowlistedCompanies = allCompanies.filter(
    (c) => !REAL_COMPANY_ALLOWLIST.includes(c.name)
  );

  console.log(`[3] Non-Allowlisted Companies (Unknown/Test Orgs): ${nonAllowlistedCompanies.length} found`);
  if (nonAllowlistedCompanies.length > 0) {
    anomaliesFound += nonAllowlistedCompanies.length;
    console.table(
      nonAllowlistedCompanies.map((c) => ({
        "Company ID": c.id,
        "Name": c.name,
        "Employees": c._count.employees,
        "Users": c._count.users,
        "Created At": c.createdAt.toISOString(),
      }))
    );
  } else {
    console.log(`    ✔ All ${allCompanies.length} companies belong to the configured allowlist.\n`);
  }

  // 4. Audit Orphaned Users (User with no EmployeeProfile and not having SUPER_ADMIN role)
  const orphanedUsers = await prisma.user.findMany({
    where: {
      roles: {
        none: { role: "SUPER_ADMIN" },
      },
      employee: null,
    },
    include: {
      roles: {
        select: { role: true },
      },
      company: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`[4] Orphaned Users (No EmployeeProfile & Role != SUPER_ADMIN): ${orphanedUsers.length} found`);
  if (orphanedUsers.length > 0) {
    anomaliesFound += orphanedUsers.length;
    console.table(
      orphanedUsers.map((u) => ({
        "User ID": u.id,
        "Email": u.email,
        "Roles": u.roles.map((r) => r.role).join(", "),
        "Company": u.company?.name ?? "N/A (Unassigned)",
        "Created At": u.createdAt.toISOString(),
      }))
    );
  } else {
    console.log("    ✔ No orphaned users detected.\n");
  }

  console.log("--------------------------------------------------------------------------------");
  if (anomaliesFound === 0) {
    console.log("STATUS: CLEAN. No test leftovers or orphaned records found.");
  } else {
    console.log(`STATUS: ATTENTION. Found ${anomaliesFound} potential leftover/anomalous items.`);
  }
  console.log("--------------------------------------------------------------------------------\n");
}

runAudit()
  .catch((err) => {
    console.error("Audit sweep encountered an error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
