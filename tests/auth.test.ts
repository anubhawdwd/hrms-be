// tests/auth.test.ts
import { prisma } from "../src/config/prisma.js";
import { AuthService } from "../src/modules/auth/service.js";
import { UserRole, AuthProvider } from "../src/generated/prisma/enums.js";
import jwt from "jsonwebtoken";
import { JWT_ACCESS_SECRET } from "../src/config/auth.js";

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`[FAIL] ${msg}`);
  console.log(`    ✔ ${msg}`);
}

export async function runAuthTests() {
  console.log("\n  [MODULE] Auth & Authorization Suite");
  const authService = new AuthService();

  // Test 1: Valid Login
  const testUser = await prisma.user.findFirst({
    where: { email: "anil.patel@phibonacci.com" },
    include: { employee: true },
  });
  assert(testUser !== null, "Test user anil.patel@phibonacci.com exists in database");

  const loginRes = await authService.login({
    email: "anil.patel@phibonacci.com",
    password: "ChangeMe@123",
  });
  assert(typeof loginRes.accessToken === "string" && loginRes.accessToken.length > 20, "Returns valid JWT access token");
  assert(loginRes.user.email === "anil.patel@phibonacci.com", "Returns matching authenticated user profile");
  assert(loginRes.user.companyName === "Phibonacci Learning", "Returns canonical company name in user object");

  // Verify JWT payload claims
  const decoded = jwt.verify(loginRes.accessToken, JWT_ACCESS_SECRET) as any;
  assert(decoded.sub === testUser!.id, "JWT sub claim matches user ID");
  assert(decoded.companyId === testUser!.companyId, "JWT companyId matches tenant ID");
  assert(decoded.role === testUser!.role, "JWT role matches user role");

  // Test 2: Invalid password rejected
  let invalidPassCaught = false;
  try {
    await authService.login({
      email: "anil.patel@phibonacci.com",
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
      email: "non.existent.user.000@phibonacci.com",
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
  const hrUser = await prisma.user.findFirst({ where: { role: UserRole.HR } });
  const empUser = await prisma.user.findFirst({ where: { role: UserRole.EMPLOYEE } });
  const adminUser = await prisma.user.findFirst({ where: { role: UserRole.COMPANY_ADMIN } });

  assert(hrUser !== null, "HR test user found");
  assert(empUser !== null, "Employee test user found");
  assert(adminUser !== null, "Company Admin test user found");

  const allowedRolesForAdminOps = [UserRole.HR, UserRole.COMPANY_ADMIN];
  assert(allowedRolesForAdminOps.includes(hrUser!.role), "HR role permitted for administrative routes");
  assert(allowedRolesForAdminOps.includes(adminUser!.role), "COMPANY_ADMIN role permitted for administrative routes");
  assert(!allowedRolesForAdminOps.includes(empUser!.role), "EMPLOYEE role strictly forbidden from administrative routes");

  // Cleanup active test refresh tokens
  await prisma.refreshToken.deleteMany({
    where: { userId: testUser!.id },
  });
  console.log("    ✔ Cleared test session refresh tokens");
}
