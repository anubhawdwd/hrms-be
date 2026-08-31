import "dotenv/config";
import bcrypt from "bcrypt";
import { prisma } from "../src/config/prisma.js";
import { AuthProvider, UserRole } from "../src/generated/prisma/enums.js";

export interface RawEmployeeInput {
  employeeId: string | number;
  email: string;
  firstName: string;
  lastName: string;
  designation: string;
  department: string;
  employmentType: string; // "Permanent" | "Probation"
}

/**
 * =========================================================================
 * ⚠️ PASTE EMPLOYEE DATA ARRAY BELOW
 * Expected Shape per row:
 * {
 *   employeeId: 1, // numeric ID or numeric string (e.g. 57, "57", "EMP057")
 *   email: "employee@phibonacci.com",
 *   firstName: "First",
 *   lastName: "Last",
 *   designation: "Software Engineer",
 *   department: "Engineering",
 *   employmentType: "Permanent" // or "Probation"
 * }
 * =========================================================================
 */
const employees: RawEmployeeInput[] = [
  // ***********
  // replace it with your data
    {
    "employeeId": "49",
    "email": "account@xyz.com",
    "firstName": "Abc",
    "lastName": "Pqr",
    "designation": "Accounts Head",
    "department": "Accounts",
    "employmentType": "Permanent",
    // add more field as per schema,
    },
  // add more employees as per your requirement
];

const SHARED_TEMP_PASSWORD = "ChangeMe@123";
const BCRYPT_SALT_ROUNDS = 12;
const COMPANY_NAME = "Phibonacci Learning";
const COMPANY_ID_FALLBACK = "f1522b59-4278-440c-8452-c7654ce08dd9";

function parseEmployeeCode(rawId: string | number, fallbackIndex: number): number {
  if (typeof rawId === "number" && !isNaN(rawId)) {
    return rawId;
  }
  const digitsOnly = String(rawId).replace(/\D/g, "");
  const parsed = parseInt(digitsOnly, 10);
  return isNaN(parsed) ? fallbackIndex : parsed;
}

function resolveRole(designation: string): UserRole {
  const norm = designation.trim().toLowerCase();
  if (norm === "hr manager" || norm === "hr" || norm === "human resources manager") {
    return UserRole.HR;
  }
  return UserRole.EMPLOYEE;
}

function resolveIsProbation(employmentType: string): boolean {
  const norm = (employmentType || "").trim().toLowerCase();
  if (norm === "permanent" || norm === "full-time" || norm === "confirmed") {
    return false;
  }
  return true; // Defaults to probation
}

async function main() {
  console.log("=================================================");
  console.log("🌱 REAL EMPLOYEE SEED SCRIPT");
  console.log("=================================================\n");

  if (employees.length === 0) {
    console.log("⚠️ No employee data found in the `employees` array placeholder.");
    console.log("Please paste your employee array into `scripts/seed-real-employees.ts` and run again.\n");
    return;
  }

  // 1. Resolve Company
  let company = await prisma.company.findFirst({
    where: { name: { equals: COMPANY_NAME, mode: "insensitive" } },
  });

  if (!company) {
    company = await prisma.company.findUnique({
      where: { id: COMPANY_ID_FALLBACK },
    });
  }

  if (!company) {
    throw new Error(`Company "${COMPANY_NAME}" (ID: ${COMPANY_ID_FALLBACK}) not found in database.`);
  }

  console.log(`Target Company: "${company.name}" (ID: ${company.id})`);
  console.log(`Total records to process: ${employees.length}\n`);

  // 2. Pre-hash the shared temporary password
  console.log(`Hashing shared temporary password ("${SHARED_TEMP_PASSWORD}") with bcrypt (${BCRYPT_SALT_ROUNDS} rounds)...`);
  const passwordHash = await bcrypt.hash(SHARED_TEMP_PASSWORD, BCRYPT_SALT_ROUNDS);
  console.log("Password hash generated.\n");

  // 3. Cache departments & designations to reduce DB roundtrips
  const departmentCache = new Map<string, string>(); // name -> id
  const designationCache = new Map<string, string>(); // name -> id

  const existingDepts = await prisma.department.findMany({ where: { companyId: company.id } });
  existingDepts.forEach((d) => departmentCache.set(d.name.trim().toLowerCase(), d.id));

  const existingDesignations = await prisma.designation.findMany({ where: { companyId: company.id } });
  existingDesignations.forEach((d) => designationCache.set(d.name.trim().toLowerCase(), d.id));

  // 4. Fetch available leave types for company (if configured)
  const leaveTypes = await prisma.leaveType.findMany({
    where: { companyId: company.id, isActive: true },
    include: { policies: true },
  });

  let successCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < employees.length; i++) {
    const row = employees[i];
    const rowIndex = i + 1;
    const cleanEmail = (row.email || "").trim().toLowerCase();

    if (!cleanEmail) {
      console.warn(`[ROW ${rowIndex}] ❌ Skipped: Email is missing or empty.`);
      skippedCount++;
      continue;
    }

    const firstName = (row.firstName || "").trim();
    const lastName = (row.lastName || "").trim();
    const displayName = `${firstName} ${lastName}`.trim() || cleanEmail;
    const deptName = (row.department || "General").trim();
    const desigName = (row.designation || "Staff").trim();
    const role = resolveRole(desigName);
    const isProbation = resolveIsProbation(row.employmentType);
    const employeeCode = parseEmployeeCode(row.employeeId, 1000 + rowIndex);

    try {
      // Check if User already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: cleanEmail },
      });

      if (existingUser) {
        console.warn(`[ROW ${rowIndex}] ⚠️ Skipped: User with email "${cleanEmail}" already exists (User ID: ${existingUser.id}).`);
        skippedCount++;
        continue;
      }

      // Check if employeeCode is already in use for this company
      const existingCode = await prisma.employeeProfile.findUnique({
        where: {
          companyId_employeeCode: {
            companyId: company.id,
            employeeCode,
          },
        },
      });

      let finalEmployeeCode = employeeCode;
      if (existingCode) {
        // Fallback to offset code to prevent collision
        finalEmployeeCode = 90000 + rowIndex;
      }

      // Resolve / Create Department
      const deptKey = deptName.toLowerCase();
      let departmentId = departmentCache.get(deptKey);
      if (!departmentId) {
        const createdDept = await prisma.department.upsert({
          where: { companyId_name: { companyId: company.id, name: deptName } },
          update: {},
          create: { name: deptName, companyId: company.id },
        });
        departmentId = createdDept.id;
        departmentCache.set(deptKey, departmentId);
      }

      // Resolve / Create Designation
      const desigKey = desigName.toLowerCase();
      let designationId = designationCache.get(desigKey);
      if (!designationId) {
        const createdDesig = await prisma.designation.upsert({
          where: { companyId_name: { companyId: company.id, name: desigName } },
          update: {},
          create: { name: desigName, companyId: company.id },
        });
        designationId = createdDesig.id;
        designationCache.set(desigKey, designationId);
      }

      // Create User and Employee Profile in a transaction
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: cleanEmail,
            passwordHash,
            mustChangePassword: true,
            authProvider: AuthProvider.LOCAL,
            role,
            companyId: company!.id,
            isActive: true,
          },
        });

        const employeeProfile = await tx.employeeProfile.create({
          data: {
            employeeCode: finalEmployeeCode,
            userId: user.id,
            companyId: company!.id,
            designationId: designationId!,
            departmentId: departmentId!,
            firstName,
            lastName,
            displayName,
            isProbation,
            isActive: true,
            joiningDate: null,
            dateOfBirth: null,
            managerId: null,
            teamId: null,
          },
        });

        // Bootstrap Leave Balances if leave types are configured for this company
        if (leaveTypes.length > 0) {
          const currentYear = new Date().getFullYear();
          for (const lt of leaveTypes) {
            const policy = lt.policies.find((p) => p.year === currentYear) || lt.policies[0];
            const allocation = policy?.yearlyAllocation ?? 0;
            await tx.leaveBalance.create({
              data: {
                employeeId: employeeProfile.id,
                leaveTypeId: lt.id,
                year: currentYear,
                allocated: allocation,
                used: 0,
                carriedForward: 0,
                remaining: allocation,
              },
            });
          }
        }
      });

      console.log(
        `[ROW ${rowIndex}] ✅ Created: ${displayName} (${cleanEmail}) | Code: ${finalEmployeeCode} | Role: ${role} | Desig: "${desigName}" | Dept: "${deptName}" | Probation: ${isProbation}`
      );
      successCount++;
    } catch (err: any) {
      console.error(`[ROW ${rowIndex}] ❌ Error importing "${cleanEmail}":`, err.message);
      errorCount++;
    }
  }

  console.log("\n=================================================");
  console.log("📊 IMPORT SUMMARY");
  console.log("=================================================");
  console.log(`- Successfully created: ${successCount}`);
  console.log(`- Skipped (Duplicates/Invalid): ${skippedCount}`);
  console.log(`- Errors: ${errorCount}`);
  console.log("=================================================\n");

  console.log("🔑 LOGIN REMINDER FOR ALL SEEDED EMPLOYEES:");
  console.log("-------------------------------------------------");
  console.log(`- Default Password: "${SHARED_TEMP_PASSWORD}"`);
  console.log("- Every user has `mustChangePassword: true` and will be required to set a new password on their first login.");
  console.log("- HR Manager user has role `HR` with full employee profile (attendance & leave) + HR administrative capabilities.");
  console.log("=================================================\n");
}

main()
  .catch((err) => {
    console.error("Fatal seed error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
