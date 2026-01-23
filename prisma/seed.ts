import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, AuthProvider } from "../src/generated/prisma/client.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL not set");
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function seed() {
  const companyName = "Company-1";

  const adminEmails = [
    "anubhaw@gmail.com",
  ];

  const defaultPassword = "ChangeMe@123"; // force reset later
  const passwordHash = await bcrypt.hash(defaultPassword, 12);

  // 1. Upsert Company
  const company = await prisma.company.upsert({
    where: { name: companyName },
    update: {},
    create: {
      name: companyName,
    },
  });

  console.log("Company ensured:", company.name);

  // 2. Upsert Admin Users
  for (const email of adminEmails) {
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash,
        authProvider: AuthProvider.LOCAL,
        companyId: company.id,
      },
    });

    console.log("Admin user ensured:", email);
  }
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
