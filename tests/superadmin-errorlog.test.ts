// tests/superadmin-errorlog.test.ts
import { prisma } from "../src/config/prisma.js";
import { AuthService } from "../src/modules/auth/service.js";
import { CompanyService } from "../src/modules/company/service.js";
import { UserService } from "../src/modules/user/service.js";
import { ErrorLogService } from "../src/modules/error-log/service.js";
import { UserRole, AuthProvider } from "../src/generated/prisma/enums.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { JWT_ACCESS_SECRET } from "../src/config/auth.js";

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`[FAIL] ${msg}`);
  console.log(`    ✔ ${msg}`);
}

export async function runSuperAdminAndErrorLogTests() {
  console.log("\n  [MODULE] SuperAdmin & Centralized Error Logging Suite (Isolated)");
  const authService = new AuthService();
  const companyService = new CompanyService();
  const userService = new UserService();
  const errorLogService = new ErrorLogService();

  const createdCompanyIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdErrorLogIds: string[] = [];

  try {
    // 1. SuperAdmin User Creation & Login
    const superAdminEmail = `test.superadmin.${Date.now()}@platform.local`;
    const superAdminPassword = "SuperAdminPassword@123";
    const passwordHash = await bcrypt.hash(superAdminPassword, 10);

    const superAdminUser = await prisma.user.create({
      data: {
        email: superAdminEmail,
        passwordHash,
        role: UserRole.SUPER_ADMIN,
        authProvider: AuthProvider.LOCAL,
        companyId: null,
        isActive: true,
      },
    });
    createdUserIds.push(superAdminUser.id);

    // Login as SuperAdmin
    const saLoginRes = await authService.login({
      email: superAdminEmail,
      password: superAdminPassword,
    });
    assert(typeof saLoginRes.accessToken === "string", "SuperAdmin logs in and receives JWT access token");
    assert(saLoginRes.user.role === UserRole.SUPER_ADMIN, "User role is SUPER_ADMIN");
    assert(saLoginRes.user.companyId === null, "SuperAdmin companyId is null");

    const decodedSaJwt = jwt.verify(saLoginRes.accessToken, JWT_ACCESS_SECRET) as any;
    assert(decodedSaJwt.sub === superAdminUser.id, "JWT sub matches SuperAdmin user ID");
    assert(decodedSaJwt.companyId === null, "JWT companyId is null for SuperAdmin");
    assert(decodedSaJwt.role === UserRole.SUPER_ADMIN, "JWT role is SUPER_ADMIN");

    // 2. Company Onboarding with Initial Company Admin
    const tenantCompanyName = `Tenant Corp ${Date.now()}`;
    const initialAdminEmail = `admin.${Date.now()}@tenantcorp.local`;
    const initialAdminPassword = "TenantAdminPassword@123";

    const newCompany = await companyService.createCompany({
      name: tenantCompanyName,
      adminEmail: initialAdminEmail,
      adminPassword: initialAdminPassword,
    });
    createdCompanyIds.push(newCompany.id);

    assert(newCompany.name === tenantCompanyName, "Company created with correct name");
    assert(Array.isArray(newCompany.admins) && newCompany.admins.length === 1, "Initial company admin created atomically");
    const createdAdmin = newCompany.admins![0];
    createdUserIds.push(createdAdmin.id);
    assert(createdAdmin.email === initialAdminEmail, "Admin user has correct email");
    assert(createdAdmin.role === UserRole.COMPANY_ADMIN, "Admin user has role COMPANY_ADMIN");
    assert(createdAdmin.companyId === newCompany.id, "Admin user is scoped to the created company");

    // 3. List Companies includes Admin details
    const companies = await companyService.listCompanies();
    const foundCompany = companies.find((c) => c.id === newCompany.id);
    assert(Boolean(foundCompany), "Company is listed in listCompanies");
    assert(foundCompany?.admins?.[0]?.email === initialAdminEmail, "Company list includes primary admin email");

    // 4. Admin Login with initial password
    const adminLoginRes = await authService.login({
      email: initialAdminEmail,
      password: initialAdminPassword,
    });
    assert(adminLoginRes.user.companyId === newCompany.id, "Company admin logs in with initial password");

    // 5. SuperAdmin Resets Company Admin Password
    const resetResult = await userService.resetPassword({
      userId: createdAdmin.id,
      manualPassword: "NewManualPassword@456",
    });
    assert(resetResult.temporaryPassword === "NewManualPassword@456", "Password successfully reset with manual password");

    // 6. Login with new password succeeds
    const adminLoginAfterReset = await authService.login({
      email: initialAdminEmail,
      password: "NewManualPassword@456",
    });
    assert(adminLoginAfterReset.user.email === initialAdminEmail, "Admin can log in with new password after reset");

    // 7. Auto-generated temporary password reset
    const autoResetResult = await userService.resetPassword({
      userId: createdAdmin.id,
    });
    assert(typeof autoResetResult.temporaryPassword === "string" && autoResetResult.temporaryPassword.length >= 12, "Auto-generates 12+ character temporary password when omitted");

    const adminLoginAfterAutoReset = await authService.login({
      email: initialAdminEmail,
      password: autoResetResult.temporaryPassword,
    });
    assert(adminLoginAfterAutoReset.user.email === initialAdminEmail, "Admin can log in with auto-generated temporary password");

    // 8. Error Logging — Backend Error Ingestion & Sanitization
    const sensitivePayload = {
      email: "user@test.com",
      password: "SecretPassword123!",
      secret: "super-secret-key",
      normalField: "visible data",
    };

    const backendLog = await errorLogService.logBackendError({
      source: "BACKEND",
      statusCode: 500,
      message: "Test Database Query Failure",
      stackTrace: "Error: Test Database Query Failure\n    at test (/app/test.ts:12:34)",
      method: "POST",
      endpoint: "/api/test/fail",
      companyId: newCompany.id,
      userId: createdAdmin.id,
      requestBody: sensitivePayload,
      ipAddress: "127.0.0.1",
      userAgent: "TestRunner/1.0",
    });
    assert(backendLog !== null, "Backend error log created successfully");
    createdErrorLogIds.push(backendLog!.id);

    assert(backendLog!.source === "BACKEND", "Backend error log created with BACKEND source");
    assert(backendLog!.statusCode === 500, "Backend error log has status code 500");
    const sanitizedData = backendLog!.requestBody as Record<string, any>;
    assert(sanitizedData.password === "[REDACTED]", "Sensitive field 'password' is sanitized/redacted");
    assert(sanitizedData.secret === "[REDACTED]", "Sensitive field 'secret' is sanitized/redacted");
    assert(sanitizedData.normalField === "visible data", "Non-sensitive fields are preserved intact");

    // 9. Error Logging — Frontend Error Ingestion
    const frontendLog = await errorLogService.logFrontendError(
      {
        message: "[React Render Error] Cannot read properties of undefined",
        stackTrace: "TypeError: Cannot read properties of undefined\n    at Component (App.tsx:45)",
        endpoint: "/admin/employees",
        companyId: newCompany.id,
        userId: createdAdmin.id,
      },
      "127.0.0.1",
      "Mozilla/5.0"
    );
    assert(frontendLog !== null, "Frontend error log created successfully");
    createdErrorLogIds.push(frontendLog!.id);

    assert(frontendLog!.source === "FRONTEND", "Frontend error log created with FRONTEND source");
    assert(frontendLog!.method === "FRONTEND_EVENT", "Frontend error log marked with FRONTEND_EVENT method");

    // 10. Error Logging — Filtering & Pagination
    const listBackendLogs = await errorLogService.listErrorLogs({
      source: "BACKEND",
      statusCode: 500,
      companyId: newCompany.id,
    });
    assert(listBackendLogs.items.length >= 1, "Filters error logs by source, status code, and company ID");
    assert(listBackendLogs.items.some((l) => l.id === backendLog!.id), "Finds specific backend error log");

    const listFrontendLogs = await errorLogService.listErrorLogs({
      source: "FRONTEND",
      companyId: newCompany.id,
    });
    assert(listFrontendLogs.items.some((l) => l.id === frontendLog!.id), "Finds specific frontend error log");

    // 11. Error Logging — 20-Day Retention Purge Logic
    // Create an old log entry older than 21 days
    const oldLog = await prisma.errorLog.create({
      data: {
        source: "BACKEND",
        statusCode: 400,
        message: "Old Historical Error Log",
        createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), // 25 days ago
      },
    });

    const purgeResult = await errorLogService.purgeExpiredLogs(20);
    assert(purgeResult.deletedCount >= 1, "Purges logs older than 20 days");

    const checkOldLog = await prisma.errorLog.findUnique({
      where: { id: oldLog.id },
    });
    assert(checkOldLog === null, "Old log (>20 days) was permanently purged");

    const checkRecentLog = await prisma.errorLog.findUnique({
      where: { id: backendLog!.id },
    });
    assert(checkRecentLog !== null, "Recent log (<20 days) was preserved during retention purge");

  } finally {
    // Clean up created entities for zero test pollution
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
