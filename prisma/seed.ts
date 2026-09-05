import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  AuthProvider,
  UserRole,
} from "../src/generated/prisma/client.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL not set");
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

export async function seedSuperAdmin() {
  const superAdminEmail = process.env.SUPERADMIN_EMAIL || "admin@hrms.com";
  const superAdminPassword = process.env.SUPERADMIN_PASSWORD || "admin@123";
  const passwordHash = await bcrypt.hash(superAdminPassword, 12);

  const existing = await prisma.user.findFirst({
    where: {
      email: superAdminEmail,
    },
  });

  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: UserRole.SUPER_ADMIN,
        passwordHash,
        authProvider: AuthProvider.LOCAL,
        isActive: true,
        mustChangePassword: false,
        companyId: null,
      },
    });
    console.log(`[SEED] SuperAdmin password reset/updated successfully (${superAdminEmail} / admin@123).`);
    return updated;
  }

  const superAdmin = await prisma.user.create({
    data: {
      email: superAdminEmail,
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      authProvider: AuthProvider.LOCAL,
      isActive: true,
      mustChangePassword: false,
      companyId: null,
    },
  });

  console.log(`[SEED] SuperAdmin successfully created (${superAdminEmail} / admin@123).`);
  return superAdmin;
}

// Allow direct execution
if (
  process.argv[1]?.endsWith("seed.ts") ||
  process.argv[1]?.endsWith("seed.js") ||
  process.argv[1]?.endsWith("seed-superadmin.ts") ||
  process.argv[1]?.endsWith("seed-superadmin.js")
) {
  seedSuperAdmin()
    .catch((err) => {
      console.error("[SEED ERROR] Failed to seed SuperAdmin:", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
