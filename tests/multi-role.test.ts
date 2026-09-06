// tests/multi-role.test.ts
import assert from "assert";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { prisma } from "../src/config/prisma.js";
import { AuthService } from "../src/modules/auth/service.js";
import { UserService } from "../src/modules/user/service.js";
import { EmployeeService } from "../src/modules/employee/service.js";
import { JWT_ACCESS_SECRET } from "../src/config/auth.js";
import { AuthProvider, UserRole } from "../src/generated/prisma/enums.js";
import { createIsolatedTestCompany } from "./helpers/isolated-test-context.js";

export async function runMultiRoleTests() {
  console.log("▶ Running Multi-Role Support (AUTH-04 Phase 1) Test Suite...");

  const authService = new AuthService();
  const userService = new UserService();
  const employeeService = new EmployeeService();

  const ctx = await createIsolatedTestCompany({ setupStandardLeaveTypes: false });

  try {
    const companyId = ctx.company.id;
    const testPassword = "MultiRolePass@123";
    const passwordHash = await bcrypt.hash(testPassword, 10);
    const timestamp = Date.now();

    // ==============================================================
    // 1. CREATE USER WITH MULTIPLE ROLES (EMPLOYEE + COMPANY_ADMIN)
    // ==============================================================
    console.log("    --- 1. User Creation with Multiple Roles ---");
    const multiRoleEmail = `director.${timestamp}@zztest.internal`;
    const createdUser = await userService.createUser({
      companyId,
      email: multiRoleEmail,
      authProvider: AuthProvider.LOCAL,
      roles: [UserRole.EMPLOYEE, UserRole.COMPANY_ADMIN],
    });

    assert(Array.isArray(createdUser.roles), "createUser returns roles array");
    assert(createdUser.roles.length === 2, "createUser assigned exactly 2 roles");
    assert(
      createdUser.roles.includes(UserRole.EMPLOYEE) &&
        createdUser.roles.includes(UserRole.COMPANY_ADMIN),
      "createUser assigned EMPLOYEE and COMPANY_ADMIN roles"
    );
    assert(
      createdUser.role === UserRole.EMPLOYEE || createdUser.role === UserRole.COMPANY_ADMIN,
      "createUser returns backward-compatible role shim (TD-06)"
    );

    // Set password so user can log in
    await prisma.user.update({
      where: { id: createdUser.id },
      data: { passwordHash, isActive: true },
    });

    // Create employee profile for this Director
    const directorProfile = await employeeService.createEmployee({
      userId: createdUser.id,
      companyId,
      designationId: ctx.designation.id,
      firstName: "Director",
      lastName: "MultiRole",
      joiningDate: "2026-01-01",
      isProbation: false,
      initialLeaveGrant: null,
    });
    assert(directorProfile.id, "Successfully linked EmployeeProfile to multi-role user");

    // ==============================================================
    // 2. AUTH & JWT CLAIMS VERIFICATION
    // ==============================================================
    console.log("    --- 2. Auth Login & JWT Claims Verification ---");
    const loginRes = await authService.login({
      email: multiRoleEmail,
      password: testPassword,
    });

    assert(typeof loginRes.accessToken === "string", "Login returns access token");
    assert(Array.isArray(loginRes.user.roles), "Login response user object contains roles array");
    assert(loginRes.user.roles.length === 2, "Login response user object has 2 roles");

    const decoded = jwt.verify(loginRes.accessToken, JWT_ACCESS_SECRET) as any;
    assert(decoded.sub === createdUser.id, "JWT sub matches user ID");
    assert(decoded.companyId === companyId, "JWT companyId matches company ID");
    assert(Array.isArray(decoded.roles), "JWT payload contains roles array");
    assert(
      decoded.roles.includes(UserRole.EMPLOYEE) &&
        decoded.roles.includes(UserRole.COMPANY_ADMIN),
      "JWT roles array contains both EMPLOYEE and COMPANY_ADMIN"
    );
    assert(
      decoded.role === decoded.roles[0],
      "JWT payload contains backward-compatible role shim (TD-06)"
    );

    // Test me() endpoint
    const meRes = await authService.me(createdUser.id);
    assert(Array.isArray(meRes.roles), "me() returns roles array");
    assert(
      meRes.roles.includes(UserRole.EMPLOYEE) &&
        meRes.roles.includes(UserRole.COMPANY_ADMIN),
      "me() roles contains EMPLOYEE and COMPANY_ADMIN"
    );

    // ==============================================================
    // 3. ROLE DIFF & SYNC IN updateUser
    // ==============================================================
    console.log("    --- 3. Role Diff & Sync in updateUser ---");
    // Update roles from [EMPLOYEE, COMPANY_ADMIN] -> [EMPLOYEE, HR]
    await userService.updateUser({
      userId: createdUser.id,
      companyId,
      roles: [UserRole.EMPLOYEE, UserRole.HR],
    });

    const updatedUser = await userService.listUsers({ companyId });
    const foundUser = updatedUser.find((u) => u.id === createdUser.id);
    assert(foundUser, "Found updated user in listUsers");
    assert(foundUser?.roles.length === 2, "Updated user has exactly 2 roles");
    assert(foundUser?.roles.includes(UserRole.EMPLOYEE), "Updated user retained EMPLOYEE role");
    assert(foundUser?.roles.includes(UserRole.HR), "Updated user gained HR role");
    assert(!foundUser?.roles.includes(UserRole.COMPANY_ADMIN), "Updated user no longer has COMPANY_ADMIN role");

    // ==============================================================
    // 4. ZERO-ROLE SAFEGUARD
    // ==============================================================
    console.log("    --- 4. Zero-Role Safeguard Verification ---");
    let zeroRoleCaught = false;
    try {
      await userService.updateUser({
        userId: createdUser.id,
        companyId,
        roles: [],
      });
    } catch (err: any) {
      zeroRoleCaught = true;
      assert(
        err.message === "User must have at least one role",
        `Expected 'User must have at least one role', got '${err.message}'`
      );
    }
    assert(zeroRoleCaught, "Empty roles array rejected by zero-role safeguard");

    // ==============================================================
    // 5. EMPLOYEE ONBOARDING WITH MULTI-ROLE SUPPORT
    // ==============================================================
    console.log("    --- 5. Employee Onboarding with Multi-Role Support ---");
    const onboarded = await employeeService.onboardEmployee(companyId, {
      email: `hr.manager.${timestamp}@zztest.internal`,
      firstName: "HR",
      lastName: "Manager",
      designationId: ctx.designation.id,
      joiningDate: "2026-01-01",
      isProbation: false,
      roles: [UserRole.EMPLOYEE, UserRole.HR],
    });

    assert(onboarded.user, "Onboarded employee has user attached");
    assert(Array.isArray(onboarded.user.roles), "Onboarded user has roles array");
    assert(
      onboarded.user.roles.includes(UserRole.EMPLOYEE) &&
        onboarded.user.roles.includes(UserRole.HR),
      "Onboarded user has both EMPLOYEE and HR roles"
    );

    console.log("    ✔ All Multi-Role tests passed successfully!");
  } finally {
    await ctx.cleanup();
    console.log("    ✔ Cleaned up isolated multi-role test company");
  }
}
