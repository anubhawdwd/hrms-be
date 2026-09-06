// tests/user-email-update.test.ts
import { prisma } from "../src/config/prisma.js";
import { UserService } from "../src/modules/user/service.js";
import { EmployeeService } from "../src/modules/employee/service.js";
import { AuthProvider, UserRole } from "../src/generated/prisma/enums.js";
import { createIsolatedTestCompany } from "./helpers/isolated-test-context.js";

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`[FAIL] ${msg}`);
  console.log(`    ✔ ${msg}`);
}

export async function runUserEmailUpdateTests() {
  console.log("\n  [MODULE] User Email Update, SSO Safeguards, Invalidation & Audit Logging (Isolated)");
  const userService = new UserService();
  const employeeService = new EmployeeService();

  const ctxA = await createIsolatedTestCompany({ setupStandardLeaveTypes: false });
  const ctxB = await createIsolatedTestCompany({ setupStandardLeaveTypes: false });

  try {
    const companyAId = ctxA.company.id;
    const companyBId = ctxB.company.id;

    // 1. Create Acting Admin
    const adminUser = await prisma.user.create({
      data: {
        companyId: companyAId,
        email: `acting.admin.${Date.now()}@isolatedtest.local`,
        passwordHash: "$2b$10$abcdef",
        roles: {
          create: [{ role: UserRole.COMPANY_ADMIN }],
        },
        authProvider: AuthProvider.LOCAL,
        isActive: true,
      },
    });

    // 2. Create Target Local Employee in Company A
    const localUser = await prisma.user.create({
      data: {
        companyId: companyAId,
        email: `local.emp.original.${Date.now()}@isolatedtest.local`,
        passwordHash: "$2b$10$abcdef",
        roles: {
          create: [{ role: UserRole.EMPLOYEE }],
        },
        authProvider: AuthProvider.LOCAL,
        mustChangePassword: true,
        isActive: true,
      },
    });

    const localEmp = await employeeService.createEmployee({
      userId: localUser.id,
      companyId: companyAId,
      designationId: ctxA.designation.id,
      firstName: "Local",
      lastName: "User",
      joiningDate: "2026-01-01",
      isProbation: false,
      initialLeaveGrant: null,
    });

    // Seed an active refresh token for localUser
    const oldRefreshToken = await prisma.refreshToken.create({
      data: {
        userId: localUser.id,
        token: `mock-refresh-token-${Date.now()}`,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    // 3. Create Existing User in Company B (for global uniqueness collision test)
    const collisionEmail = `existing.b.${Date.now()}@isolatedtest.local`;
    const collisionUser = await prisma.user.create({
      data: {
        companyId: companyBId,
        email: collisionEmail,
        passwordHash: "$2b$10$abcdef",
        roles: {
          create: [{ role: UserRole.EMPLOYEE }],
        },
        authProvider: AuthProvider.LOCAL,
        isActive: true,
      },
    });

    // 4. Create SSO User in Company A
    const ssoUser = await prisma.user.create({
      data: {
        companyId: companyAId,
        email: `google.sso.${Date.now()}@isolatedtest.local`,
        authProvider: AuthProvider.GOOGLE,
        roles: {
          create: [{ role: UserRole.EMPLOYEE }],
        },
        isActive: true,
      },
    });

    // --- TEST 1: Reject SSO email update ---
    console.log("    --- 1. Testing SSO Email Safeguards ---");
    let ssoErrorCaught = false;
    try {
      await userService.updateUserEmail({
        userId: ssoUser.id,
        companyId: companyAId,
        actorUserId: adminUser.id,
        email: "new.sso.email@isolatedtest.local",
      });
    } catch (err: any) {
      ssoErrorCaught = true;
      assert(
        err.message.includes("SSO provider"),
        `SSO account rejection returned expected message: "${err.message}"`
      );
    }
    assert(ssoErrorCaught, "Attempt to update SSO user email threw error");

    // --- TEST 2: Reject Duplicate Email (Global Cross-Company Collision) ---
    console.log("    --- 2. Testing Global Uniqueness & 409 Conflict ---");
    let collisionErrorCaught = false;
    try {
      await userService.updateUserEmail({
        userId: localUser.id,
        companyId: companyAId,
        actorUserId: adminUser.id,
        email: collisionEmail,
      });
    } catch (err: any) {
      collisionErrorCaught = true;
      assert(err.statusCode === 409, `Duplicate email error has 409 status code`);
      assert(
        err.message.includes("already exists"),
        `Duplicate email error has clear message: "${err.message}"`
      );
    }
    assert(collisionErrorCaught, "Attempt to set existing email across companies was rejected with 409");

    // --- TEST 3: Successful Local Email Change & Token Revocation ---
    console.log("    --- 3. Testing Local Email Change, Token Revocation & Audit Logging ---");
    const newTargetEmail = `local.emp.updated.${Date.now()}@isolatedtest.local`;
    const updateRes = await userService.updateUserEmail({
      userId: localUser.id,
      companyId: companyAId,
      actorUserId: adminUser.id,
      email: newTargetEmail,
    });
    assert(updateRes.message.includes("successfully"), "updateUserEmail returned success message");

    // Verify User record was updated in database
    const updatedUserInDb = await prisma.user.findUnique({
      where: { id: localUser.id },
    });
    assert(updatedUserInDb?.email === newTargetEmail, "User.email in database was updated to new email");
    assert(
      updatedUserInDb?.mustChangePassword === true,
      "mustChangePassword remained unchanged (preserved as true)"
    );

    // Verify Refresh Tokens were revoked
    const remainingTokens = await prisma.refreshToken.findMany({
      where: { userId: localUser.id },
    });
    assert(remainingTokens.length === 0, "All prior refresh tokens were revoked upon email change");

    // Verify AuditLog record was created
    const auditRecord = await prisma.auditLog.findFirst({
      where: {
        action: "USER_EMAIL_UPDATE",
        targetId: localUser.id,
      },
      orderBy: { createdAt: "desc" },
    });
    assert(auditRecord !== null, "AuditLog record was persisted in database");
    assert(auditRecord?.actorId === adminUser.id, `AuditLog actorId matches acting admin (${adminUser.id})`);
    assert(auditRecord?.companyId === companyAId, `AuditLog companyId matches tenant organization (${companyAId})`);
    const details = auditRecord?.details as any;
    assert(details?.oldEmail === localUser.email, `AuditLog details.oldEmail recorded correctly (${localUser.email})`);
    assert(details?.newEmail === newTargetEmail, `AuditLog details.newEmail recorded correctly (${newTargetEmail})`);

    // --- TEST 4: Same-email idempotency ---
    console.log("    --- 4. Testing No-Op / Same Email Handling ---");
    const noOpRes = await userService.updateUserEmail({
      userId: localUser.id,
      companyId: companyAId,
      actorUserId: adminUser.id,
      email: newTargetEmail,
    });
    assert(noOpRes.message.includes("already up to date"), "Same-email update is a clean no-op");

    // --- TEST 5: Role Guard Scope Verification (SUPER_ADMIN Excluded) ---
    console.log("    --- 5. Testing Role Guard Excludes SUPER_ADMIN (403 Forbidden) ---");
    const { requireRole } = await import("../src/middlewares/requireRole.js");
    const emailUpdateGuard = requireRole(UserRole.COMPANY_ADMIN, UserRole.HR);

    let superAdminStatus: number | null = null;
    let superAdminMsg = "";
    const mockSuperAdminReq: any = {
      user: { id: "super-admin-id", roles: [UserRole.SUPER_ADMIN], role: UserRole.SUPER_ADMIN, companyId: null },
    };
    const mockRes: any = {
      status(code: number) {
        superAdminStatus = code;
        return this;
      },
      json(body: any) {
        superAdminMsg = body.message;
        return this;
      },
    };
    let nextCalled = false;
    const mockNext = () => { nextCalled = true; };

    emailUpdateGuard(mockSuperAdminReq, mockRes, mockNext);
    assert(superAdminStatus === 403, "SUPER_ADMIN role calling email update guard returns 403 Forbidden");
    assert(!nextCalled, "next() was not called for SUPER_ADMIN");

    // Test HR allowed
    nextCalled = false;
    const mockHrReq: any = {
      user: { id: "hr-id", roles: [UserRole.HR], role: UserRole.HR, companyId: companyAId },
    };
    emailUpdateGuard(mockHrReq, mockRes, mockNext);
    assert(nextCalled, "next() was called successfully for HR");

    // Test COMPANY_ADMIN allowed
    nextCalled = false;
    const mockAdminReq: any = {
      user: { id: "admin-id", roles: [UserRole.COMPANY_ADMIN], role: UserRole.COMPANY_ADMIN, companyId: companyAId },
    };
    emailUpdateGuard(mockAdminReq, mockRes, mockNext);
    assert(nextCalled, "next() was called successfully for COMPANY_ADMIN");
  } finally {
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { companyId: ctxA.company.id },
          { companyId: ctxB.company.id },
        ],
      },
    });
    await ctxA.cleanup();
    await ctxB.cleanup();
  }
}
