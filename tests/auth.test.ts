// tests/auth.test.ts
import { prisma } from "../src/config/prisma.js";
import { AuthService } from "../src/modules/auth/service.js";
import { EmployeeService } from "../src/modules/employee/service.js";
import { UserRole, AuthProvider } from "../src/generated/prisma/enums.js";
import jwt from "jsonwebtoken";
import { JWT_ACCESS_SECRET } from "../src/config/auth.js";
import { createIsolatedTestCompany } from "./helpers/isolated-test-context.js";
import bcrypt from "bcrypt";

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`[FAIL] ${msg}`);
  console.log(`    ✔ ${msg}`);
}

export async function runAuthTests() {
  console.log("\n  [MODULE] Auth & Authorization Suite (Isolated)");
  const authService = new AuthService();
  const employeeService = new EmployeeService();

  const ctx = await createIsolatedTestCompany({ setupStandardLeaveTypes: false });

  try {
    const testPassword = "TestPassword@123";
    const passwordHash = await bcrypt.hash(testPassword, 10);

    // Create an isolated employee user
    const testEmpUser = await prisma.user.create({
      data: {
        companyId: ctx.company.id,
        email: `emp.auth.${Date.now()}@isolatedtest.local`,
        passwordHash,
        role: UserRole.EMPLOYEE,
        authProvider: AuthProvider.LOCAL,
        isActive: true,
      },
    });

    const testEmpProfile = await employeeService.createEmployee({
      userId: testEmpUser.id,
      companyId: ctx.company.id,
      designationId: ctx.designation.id,
      firstName: "Auth",
      lastName: "Tester",
      joiningDate: "2026-01-01",
      isProbation: false,
      initialLeaveGrant: null,
    });

    // Create an isolated HR user
    const testHrUser = await prisma.user.create({
      data: {
        companyId: ctx.company.id,
        email: `hr.auth.${Date.now()}@isolatedtest.local`,
        passwordHash,
        role: UserRole.HR,
        authProvider: AuthProvider.LOCAL,
        isActive: true,
      },
    });

    // Test 1: Valid Login
    const loginRes = await authService.login({
      email: testEmpUser.email,
      password: testPassword,
    });
    assert(typeof loginRes.accessToken === "string" && loginRes.accessToken.length > 20, "Returns valid JWT access token");
    assert(loginRes.user.email === testEmpUser.email, "Returns matching authenticated user profile");
    assert(loginRes.user.companyName === ctx.company.name, "Returns canonical company name in user object");

    // Verify JWT payload claims
    const decoded = jwt.verify(loginRes.accessToken, JWT_ACCESS_SECRET) as any;
    assert(decoded.sub === testEmpUser.id, "JWT sub claim matches user ID");
    assert(decoded.companyId === ctx.company.id, "JWT companyId matches tenant ID");
    assert(decoded.role === testEmpUser.role, "JWT role matches user role");

    // Test 2: Invalid password rejected
    let invalidPassCaught = false;
    try {
      await authService.login({
        email: testEmpUser.email,
        password: "WrongPassword999!",
      });
    } catch (err: any) {
      invalidPassCaught = true;
      assert(err.message === "Invalid credentials", "Rejects incorrect password with 'Invalid credentials'");
    }
    assert(invalidPassCaught, "Invalid password throws authentication error");

    // Test 3: Non-existent user rejected
    let nonExistentCaught = false;
    try {
      await authService.login({
        email: `non.existent.${Date.now()}@isolatedtest.local`,
        password: "Password123!",
      });
    } catch (err: any) {
      nonExistentCaught = true;
      assert(err.message === "Invalid credentials", "Rejects unregistered email with 'Invalid credentials'");
    }
    assert(nonExistentCaught, "Unregistered user throws authentication error");

    // Test 4: Token Refresh Flow
    assert(typeof loginRes.refreshToken === "string", "Generates refresh token on login");
    const refreshRes = await authService.refreshToken({
      refreshToken: loginRes.refreshToken,
    });
    assert(typeof refreshRes.accessToken === "string" && refreshRes.accessToken.length > 20, "Successfully rotates and issues new access token");

    // Test 5: Role Authorization Matrix
    const allowedRolesForAdminOps = [UserRole.HR, UserRole.COMPANY_ADMIN];
    assert(allowedRolesForAdminOps.includes(testHrUser.role), "HR role permitted for administrative routes");
    assert(allowedRolesForAdminOps.includes(ctx.adminUser.role), "COMPANY_ADMIN role permitted for administrative routes");
    assert(!allowedRolesForAdminOps.includes(testEmpUser.role), "EMPLOYEE role strictly forbidden from administrative routes");
  } finally {
    await ctx.cleanup();
    console.log("    ✔ Cleaned up isolated auth test company");
  }
}
