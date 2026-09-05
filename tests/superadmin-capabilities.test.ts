// tests/superadmin-capabilities.test.ts
import { prisma } from "../src/config/prisma.js";
import { SuperAdminService } from "../src/modules/superadmin/service.js";
import { CompanyService } from "../src/modules/company/service.js";
import { ErrorLogService } from "../src/modules/error-log/service.js";
import { UserRole, AuthProvider } from "../src/generated/prisma/enums.js";

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`[FAIL] ${msg}`);
  console.log(`    ✔ ${msg}`);
}

export async function runSuperAdminCapabilitiesTests() {
  console.log("\n  [MODULE] SuperAdmin Advanced Capabilities & Amendments Suite (Isolated)");
  const superAdminService = new SuperAdminService();
  const companyService = new CompanyService();
  const errorLogService = new ErrorLogService();

  const createdCompanyIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdErrorLogIds: string[] = [];

  try {
    // ==========================================
    // MODULE A: SuperAdmin Account Management
    // ==========================================
    console.log("    --- Testing Module A: SuperAdmin Account Management ---");
    
    // 1. Password validation: Reject < 6 characters (Amendment 2)
    let passwordTooShortError = false;
    try {
      await superAdminService.createSuperAdmin({
        email: `short.pass.${Date.now()}@platform.local`,
        password: "12345",
      });
    } catch (err: any) {
      passwordTooShortError = true;
      assert(err.message.includes("at least 6 characters"), "createSuperAdmin rejects password with < 6 characters");
    }
    assert(passwordTooShortError, "Password validation caught in createSuperAdmin");

    // 2. Create SuperAdmin 1 with auto-generated temporary password
    const saEmail1 = `sa.auto.${Date.now()}@platform.local`;
    const createdSa1 = await superAdminService.createSuperAdmin({
      email: saEmail1,
    });
    createdUserIds.push(createdSa1.user.id);

    assert(createdSa1.user.email === saEmail1, "SuperAdmin 1 created with correct email");
    assert(createdSa1.user.role === UserRole.SUPER_ADMIN, "SuperAdmin 1 has SUPER_ADMIN role");
    assert(createdSa1.user.companyId === null, "SuperAdmin 1 has null companyId");
    assert(createdSa1.user.mustChangePassword === true, "SuperAdmin 1 has mustChangePassword: true");
    assert(
      typeof createdSa1.temporaryPassword === "string" && createdSa1.temporaryPassword.length >= 12,
      "SuperAdmin 1 received 12+ character auto-generated password"
    );

    // 3. Create SuperAdmin 2 with manual password (>= 6 chars)
    const saEmail2 = `sa.manual.${Date.now()}@platform.local`;
    const createdSa2 = await superAdminService.createSuperAdmin({
      email: saEmail2,
      password: "StrongPassword@999",
    });
    createdUserIds.push(createdSa2.user.id);
    assert(createdSa2.user.email === saEmail2, "SuperAdmin 2 created with manual password");

    // 4. Duplicate email rejection
    let duplicateError = false;
    try {
      await superAdminService.createSuperAdmin({ email: saEmail1 });
    } catch (err: any) {
      duplicateError = true;
      assert(err.message.includes("already exists"), "Rejects duplicate SuperAdmin email");
    }
    assert(duplicateError, "Duplicate email rejection verified");

    // 5. List SuperAdmins
    const superAdminsList = await superAdminService.listSuperAdmins();
    assert(superAdminsList.some((u) => u.id === createdSa1.user.id), "SuperAdmin 1 present in listSuperAdmins");
    assert(superAdminsList.some((u) => u.id === createdSa2.user.id), "SuperAdmin 2 present in listSuperAdmins");

    // 6. Reset Password validation: Reject < 6 characters
    let resetTooShortError = false;
    try {
      await superAdminService.resetSuperAdminPassword(
        createdSa1.user.id,
        "abc"
      );
    } catch (err: any) {
      resetTooShortError = true;
      assert(err.message.includes("at least 6 characters"), "resetSuperAdminPassword rejects password < 6 characters");
    }
    assert(resetTooShortError, "Password validation caught in resetSuperAdminPassword");

    // 7. Reset SuperAdmin Password with manual password
    const resetSa1 = await superAdminService.resetSuperAdminPassword(
      createdSa1.user.id,
      "NewSuperPassword@777"
    );
    assert(resetSa1.temporaryPassword === "NewSuperPassword@777", "SuperAdmin 1 password reset with manual password");


    // 8. Deactivate SuperAdmin 1
    const deactRes = await superAdminService.deactivateSuperAdmin(createdSa1.user.id);
    assert(typeof deactRes.message === "string" && deactRes.message.includes("deactivated"), "SuperAdmin 1 deactivated successfully");

    const deactivatedUser = await prisma.user.findUnique({ where: { id: createdSa1.user.id } });
    assert(deactivatedUser?.isActive === false, "SuperAdmin 1 marked isActive: false in database");


    // ==========================================
    // MODULE B: Company Users Directory & Reset
    // ==========================================
    console.log("    --- Testing Module B: Company Users Directory & Reset ---");

    // 1. Create a tenant company with primary admin
    const compName = `Test Org ${Date.now()}`;
    const compAdminEmail = `org.admin.${Date.now()}@testorg.local`;
    const comp = await companyService.createCompany({
      name: compName,
      adminEmail: compAdminEmail,
      adminPassword: "OrgAdminPass@123",
    });
    createdCompanyIds.push(comp.id);
    if (comp.admins?.[0]) {
      createdUserIds.push(comp.admins[0].id);
    }

    // Create an employee user inside this company
    const empUserEmail = `employee.${Date.now()}@testorg.local`;
    const empUser = await prisma.user.create({
      data: {
        companyId: comp.id,
        email: empUserEmail,
        passwordHash: "$2b$12$DummyHashForTestUserExecution0000000000000000000000000",
        role: UserRole.EMPLOYEE,
        authProvider: AuthProvider.LOCAL,
        isActive: true,
      },
    });
    createdUserIds.push(empUser.id);

    // 2. Get Company Users
    const orgUsers = await companyService.getCompanyUsers(comp.id);
    assert(orgUsers.length >= 2, "getCompanyUsers returns all users scoped to company");
    assert(orgUsers.some((u) => u.email === compAdminEmail), "getCompanyUsers contains company admin");
    assert(orgUsers.some((u) => u.email === empUserEmail), "getCompanyUsers contains employee");

    // 3. Reset password of company user via company service
    const resetUserRes = await companyService.resetCompanyUserPassword(
      comp.id,
      empUser.id,
      "NewEmpPassword@123"
    );
    assert(resetUserRes.temporaryPassword === "NewEmpPassword@123", "Company user password reset successfully");

    // 4. Verification that cross-company reset is rejected
    let crossCompanyError = false;
    try {
      await companyService.resetCompanyUserPassword(
        "00000000-0000-0000-0000-000000000000",
        empUser.id
      );
    } catch (err: any) {
      crossCompanyError = true;
      assert(err.message.includes("not found"), "Cross-company user reset rejected");
    }
    assert(crossCompanyError, "Cross-company reset guard verified");

    // ==========================================
    // MODULE C: Error Log Enhancements
    // ==========================================
    console.log("    --- Testing Module C: Error Log Enhancements ---");

    // 1. Ingest log for tenant company
    const log1 = await errorLogService.logBackendError({
      source: "BACKEND",
      statusCode: 500,
      message: `Tenant specific error ${Date.now()}`,
      companyId: comp.id,
    });
    assert(log1 !== null, "Tenant error log created");
    createdErrorLogIds.push(log1!.id);

    // 2. Ingest system-level error (companyId: null)
    const log2 = await errorLogService.logBackendError({
      source: "BACKEND",
      statusCode: 401,
      message: `System unauthenticated error ${Date.now()}`,
      companyId: null,
    });
    assert(log2 !== null, "System error log created");
    createdErrorLogIds.push(log2!.id);

    // 3. List error logs with company resolution
    const logsList = await errorLogService.listErrorLogs({
      search: "Tenant specific error",
    });
    const foundLog1 = logsList.items.find((l) => l.id === log1!.id);
    assert(Boolean(foundLog1), "Found tenant error log");
    assert(foundLog1?.companyName === compName, "Error log dynamically resolved company name");

    // 4. Sentinel "SYSTEM" filtering (Amendment 1)
    const systemLogs = await errorLogService.listErrorLogs({
      companyId: "SYSTEM",
      search: "System unauthenticated error",
    });
    assert(systemLogs.items.some((l) => l.id === log2!.id), "companyId='SYSTEM' sentinel filters null companyId logs");
    assert(systemLogs.items.find((l) => l.id === log2!.id)?.companyName === "System / Unauthenticated", "System logs resolved as 'System / Unauthenticated'");

    // 5. Delete specific error logs by IDs
    const deleteSelectedRes = await errorLogService.deleteLogsByIds([log1!.id]);
    assert(deleteSelectedRes.deletedCount === 1, "deleteLogsByIds deleted 1 selected log");

    const checkLog1 = await prisma.errorLog.findUnique({ where: { id: log1!.id } });
    assert(checkLog1 === null, "Selected log was permanently removed");

    // 6. Delete error logs by filter (Bulk Delete)
    const deleteBulkRes = await errorLogService.deleteLogsByFilter({
      companyId: "SYSTEM",
      search: "System unauthenticated error",
    });
    assert(deleteBulkRes.deletedCount >= 1, "deleteLogsByFilter bulk deleted matching system logs");

    const checkLog2 = await prisma.errorLog.findUnique({ where: { id: log2!.id } });
    assert(checkLog2 === null, "Bulk filtered log was permanently removed");

  } finally {
    // Mandatory Test Data Cleanup (Rule 3)
    if (createdErrorLogIds.length > 0) {
      await prisma.errorLog.deleteMany({
        where: { id: { in: createdErrorLogIds } },
      });
    }
    if (createdUserIds.length > 0) {
      await prisma.refreshToken.deleteMany({
        where: { userId: { in: createdUserIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }
    if (createdCompanyIds.length > 0) {
      await prisma.company.deleteMany({
        where: { id: { in: createdCompanyIds } },
      });
    }
  }
}
