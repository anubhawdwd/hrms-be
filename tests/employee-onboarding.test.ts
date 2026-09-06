// tests/employee-onboarding.test.ts
import { prisma } from "../src/config/prisma.js";
import { EmployeeService } from "../src/modules/employee/service.js";
import {
  createIsolatedTestCompany,
  type IsolatedTestContext,
} from "./helpers/isolated-test-context.js";
import { Gender, UserRole, AuthProvider } from "../src/generated/prisma/enums.js";

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`[FAIL] ${msg}`);
  console.log(`    ✔ ${msg}`);
}

export async function runEmployeeOnboardingTests() {
  console.log("\n  [MODULE] Atomic Employee Onboarding & Master Data Parity (EMP-03, EMP-04, EMP-05)");
  const employeeService = new EmployeeService();

  let ctxA: IsolatedTestContext | null = null;
  let ctxB: IsolatedTestContext | null = null;

  try {
    ctxA = await createIsolatedTestCompany({ setupStandardLeaveTypes: true });
    ctxB = await createIsolatedTestCompany({ setupStandardLeaveTypes: false });

    // ==========================================
    // TEST 1: Atomic Onboarding with Full Master Data, Custom Code & Initial Leave Grant
    // ==========================================
    console.log("    --- 1. Testing Atomic Onboarding & Master Data Fields ---");
    const timestamp = Date.now();
    const email = `test.employee.${timestamp}@isolatedtest.local`;
    const personalEmail = `personal.${timestamp}@gmail.com`;

    // 1a. Create Primary & Secondary Managers in Company A
    const primaryMgr = await employeeService.onboardEmployee(ctxA.company.id, {
      email: `prim.mgr.${timestamp}@isolatedtest.local`,
      firstName: "Primary",
      lastName: "Manager",
      designationId: ctxA.designation.id,
      joiningDate: "2026-01-15",
    });
    assert(primaryMgr.id !== undefined, "Primary manager created successfully");

    const secMgr = await employeeService.onboardEmployee(ctxA.company.id, {
      email: `sec.mgr.${timestamp}@isolatedtest.local`,
      firstName: "Secondary",
      lastName: "Manager",
      designationId: ctxA.designation.id,
      joiningDate: "2026-01-15",
    });
    assert(secMgr.id !== undefined, "Secondary manager created successfully");

    // 1b. Onboard employee with all new fields, explicit employeeCode, and leave grant
    const clpType = ctxA.leaveTypes["CLP"];
    assert(clpType !== undefined, "CLP leave type exists in test context");

    const onboardResult = await employeeService.onboardEmployee(ctxA.company.id, {
      email,
      personalEmail,
      phone: "+1 555-0199",
      gender: Gender.MALE,
      firstName: "Alex",
      middleName: "Jordan",
      lastName: "Chen",
      displayName: "Alex J. Chen",
      dateOfBirth: "1994-06-15",
      designationId: ctxA.designation.id,
      departmentId: ctxA.department.id,
      managerId: primaryMgr.id,
      secondaryManagerId: secMgr.id,
      joiningDate: "2026-02-01",
      isProbation: true,
      employeeCode: 8801,
      initialLeaveGrant: {
        leaveTypeId: clpType.id,
        allocated: 6,
      },
    });

    assert(onboardResult.id !== undefined, "Employee created with ID");
    assert(onboardResult.employeeCode === 8801, "Explicit employeeCode 8801 assigned");
    assert(onboardResult.phone === "+1 555-0199", "Phone number persisted");
    assert(onboardResult.gender === Gender.MALE, "Gender MALE persisted");
    assert(onboardResult.middleName === "Jordan", "Middle name persisted");
    assert(onboardResult.displayName === "Alex J. Chen", "Display name persisted");
    assert(onboardResult.managerId === primaryMgr.id, "Primary manager linked");
    assert(onboardResult.secondaryManagerId === secMgr.id, "Secondary manager linked");
    assert(typeof onboardResult.temporaryPassword === "string", "Temporary password returned for LOCAL auth");

    // Verify User record
    const userInDb = await prisma.user.findUnique({
      where: { id: onboardResult.userId },
    });
    assert(userInDb !== null, "User record found in database");
    assert(userInDb?.email === email, "User email matches");
    assert(userInDb?.personalEmail === personalEmail, "User personalEmail matches");
    assert(userInDb?.mustChangePassword === true, "mustChangePassword: true set on User (Amendment 3)");
    assert(userInDb?.passwordHash !== null, "Password hash created");

    // Verify LeaveBalance record
    const balanceInDb = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: onboardResult.id,
          leaveTypeId: clpType.id,
          year: 2026,
        },
      },
    });
    assert(balanceInDb !== null, "LeaveBalance record created for employee");
    assert(balanceInDb?.allocated === 6, "Leave balance allocated: 6");
    assert(balanceInDb?.remaining === 6, "Leave balance remaining: 6");

    // ==========================================
    // TEST 2: Fail-Fast Rollback / Orphan Prevention
    // ==========================================
    console.log("    --- 2. Testing Fail-Fast Duplicate Email (Zero Orphan Records) ---");
    const dupEmail = `duplicate.${timestamp}@isolatedtest.local`;
    await employeeService.onboardEmployee(ctxA.company.id, {
      email: dupEmail,
      firstName: "Original",
      lastName: "User",
      designationId: ctxA.designation.id,
      joiningDate: "2026-01-01",
    });

    const userCountBefore = await prisma.user.count({ where: { companyId: ctxA.company.id } });
    const profileCountBefore = await prisma.employeeProfile.count({ where: { companyId: ctxA.company.id } });

    let dupErrorCaught: any = null;
    try {
      await employeeService.onboardEmployee(ctxA.company.id, {
        email: dupEmail,
        firstName: "Duplicate",
        lastName: "Attempt",
        designationId: ctxA.designation.id,
        joiningDate: "2026-02-01",
      });
    } catch (err: any) {
      dupErrorCaught = err;
    }

    assert(dupErrorCaught !== null, "Duplicate email attempt threw error");
    assert(dupErrorCaught.statusCode === 409, "Duplicate email returned 409 status code");
    assert(dupErrorCaught.message.includes("already exists"), "Duplicate email returned clear error message");

    const userCountAfter = await prisma.user.count({ where: { companyId: ctxA.company.id } });
    const profileCountAfter = await prisma.employeeProfile.count({ where: { companyId: ctxA.company.id } });
    assert(userCountAfter === userCountBefore, "ZERO orphaned User records created on failure");
    assert(profileCountAfter === profileCountBefore, "ZERO orphaned EmployeeProfile records created on failure");

    // ==========================================
    // TEST 3: Explicit Employee Code Conflict
    // ==========================================
    console.log("    --- 3. Testing Explicit Employee Code Conflict (409 Error) ---");
    const codeConflict = 7705;
    await employeeService.onboardEmployee(ctxA.company.id, {
      email: `code1.${timestamp}@isolatedtest.local`,
      firstName: "Code",
      lastName: "One",
      designationId: ctxA.designation.id,
      joiningDate: "2026-01-01",
      employeeCode: codeConflict,
    });

    let codeErrorCaught: any = null;
    try {
      await employeeService.onboardEmployee(ctxA.company.id, {
        email: `code2.${timestamp}@isolatedtest.local`,
        firstName: "Code",
        lastName: "Two",
        designationId: ctxA.designation.id,
        joiningDate: "2026-02-01",
        employeeCode: codeConflict,
      });
    } catch (err: any) {
      codeErrorCaught = err;
    }

    assert(codeErrorCaught !== null, "Duplicate employeeCode attempt threw error");
    assert(codeErrorCaught.statusCode === 409, "Duplicate employeeCode returned 409 status code");
    assert(
      codeErrorCaught.message === `Employee code ${codeConflict} is already in use for this company`,
      "Duplicate employeeCode returned exact naming conflict message"
    );

    // ==========================================
    // TEST 4: Tenant Isolation for Managers & Self-Relation Checks (Amendment 1)
    // ==========================================
    console.log("    --- 4. Testing Manager Tenant Isolation & Self-Manager Validation ---");
    // Manager created in Company B
    const compBMgr = await employeeService.onboardEmployee(ctxB.company.id, {
      email: `compb.mgr.${timestamp}@isolatedtest.local`,
      firstName: "CompanyB",
      lastName: "Manager",
      designationId: ctxB.designation.id,
      joiningDate: "2026-01-01",
    });

    // Cross-tenant primary manager attempt in Company A
    let crossPrimaryErr: any = null;
    try {
      await employeeService.onboardEmployee(ctxA.company.id, {
        email: `cross.prim.${timestamp}@isolatedtest.local`,
        firstName: "Cross",
        lastName: "Primary",
        designationId: ctxA.designation.id,
        joiningDate: "2026-01-01",
        managerId: compBMgr.id,
      });
    } catch (err: any) {
      crossPrimaryErr = err;
    }
    assert(crossPrimaryErr !== null, "Cross-tenant primary manager assignment rejected");
    assert(
      crossPrimaryErr.message.includes("Reporting manager not found or belongs to a different company"),
      "Cross-tenant primary manager rejected with tenant isolation error"
    );

    // Cross-tenant secondary manager attempt in Company A
    let crossSecErr: any = null;
    try {
      await employeeService.onboardEmployee(ctxA.company.id, {
        email: `cross.sec.${timestamp}@isolatedtest.local`,
        firstName: "Cross",
        lastName: "Secondary",
        designationId: ctxA.designation.id,
        joiningDate: "2026-01-01",
        secondaryManagerId: compBMgr.id,
      });
    } catch (err: any) {
      crossSecErr = err;
    }
    assert(crossSecErr !== null, "Cross-tenant secondary manager assignment rejected");
    assert(
      crossSecErr.message.includes("Secondary reporting manager not found or belongs to a different company"),
      "Cross-tenant secondary manager rejected with tenant isolation error"
    );

    // Self-manager checks on update
    const targetEmp = await employeeService.onboardEmployee(ctxA.company.id, {
      email: `self.check.${timestamp}@isolatedtest.local`,
      firstName: "Self",
      lastName: "Target",
      designationId: ctxA.designation.id,
      joiningDate: "2026-01-01",
    });

    let selfMgrErr: any = null;
    try {
      await employeeService.updateEmployeeAdmin(targetEmp.id, ctxA.company.id, {
        managerId: targetEmp.id,
      });
    } catch (err: any) {
      selfMgrErr = err;
    }
    assert(selfMgrErr !== null, "Self-manager update rejected");
    assert(selfMgrErr.message === "An employee cannot be their own manager", "Self-manager rejected with clear message");

    let selfSecMgrErr: any = null;
    try {
      await employeeService.updateEmployeeAdmin(targetEmp.id, ctxA.company.id, {
        secondaryManagerId: targetEmp.id,
      });
    } catch (err: any) {
      selfSecMgrErr = err;
    }
    assert(selfSecMgrErr !== null, "Self-secondary-manager update rejected");
    assert(
      selfSecMgrErr.message === "An employee cannot be their own secondary manager",
      "Self-secondary-manager rejected with clear message"
    );

    // ==========================================
    // TEST 5: Pre-Migration Compatibility Regression Test (Amendment 2)
    // ==========================================
    console.log("    --- 5. Testing Pre-Migration Employee Record Compatibility ---");
    const legacyUser = await prisma.user.create({
      data: {
        email: `legacy.${timestamp}@isolatedtest.local`,
        companyId: ctxA.company.id,
        roles: {
          create: [{ role: UserRole.EMPLOYEE }],
        },
        authProvider: AuthProvider.LOCAL,
      },
    });

    const legacyEmp = await prisma.employeeProfile.create({
      data: {
        userId: legacyUser.id,
        companyId: ctxA.company.id,
        designationId: ctxA.designation.id,
        employeeCode: 6501,
        firstName: "Legacy",
        lastName: "Employee",
        displayName: "Legacy Employee",
        joiningDate: new Date("2025-01-01"),
        phone: null,
        gender: null,
        secondaryManagerId: null,
      },
    });

    const fetchedLegacy = await employeeService.getEmployeeById(legacyEmp.id, ctxA.company.id);
    assert(fetchedLegacy !== null, "Legacy employee retrieved via getEmployeeById");
    assert(fetchedLegacy.phone === null, "Legacy phone is null without error");
    assert(fetchedLegacy.gender === null, "Legacy gender is null without error");
    assert(fetchedLegacy.secondaryManagerId === null, "Legacy secondaryManagerId is null");
    assert(fetchedLegacy.secondaryManager === null, "Legacy secondaryManager relation is null");
    assert(fetchedLegacy.user.personalEmail === null, "Legacy personalEmail is null");

    const listEmps = await employeeService.listEmployees(ctxA.company.id);
    const foundLegacy = listEmps.find((e) => e.id === legacyEmp.id);
    assert(foundLegacy !== undefined, "Legacy employee listed in listEmployees");
    assert(foundLegacy?.phone === null, "Listed legacy employee phone is null");
    assert(foundLegacy?.gender === null, "Listed legacy employee gender is null");

    // ==========================================
    // TEST 6: Admin Profile Update Parity
    // ==========================================
    console.log("    --- 6. Testing Admin Profile Update Parity ---");
    const updateTarget = await employeeService.onboardEmployee(ctxA.company.id, {
      email: `target.update.${timestamp}@isolatedtest.local`,
      firstName: "InitFirst",
      lastName: "InitLast",
      designationId: ctxA.designation.id,
      joiningDate: "2026-01-01",
    });

    const updated = await employeeService.updateEmployeeAdmin(updateTarget.id, ctxA.company.id, {
      firstName: "UpdatedFirst",
      middleName: "UpdatedMiddle",
      lastName: "UpdatedLast",
      displayName: "UpdatedFirst UpdatedMiddle UpdatedLast",
      personalEmail: `updated.personal.${timestamp}@gmail.com`,
      phone: "+1 987-654-3210",
      gender: Gender.FEMALE,
      dateOfBirth: "1992-11-20",
      joiningDate: "2026-01-10",
      secondaryManagerId: secMgr.id,
    });

    assert(updated.firstName === "UpdatedFirst", "Updated firstName persisted");
    assert(updated.middleName === "UpdatedMiddle", "Updated middleName persisted");
    assert(updated.lastName === "UpdatedLast", "Updated lastName persisted");
    assert(updated.phone === "+1 987-654-3210", "Updated phone persisted");
    assert(updated.gender === Gender.FEMALE, "Updated gender FEMALE persisted");
    assert(updated.secondaryManagerId === secMgr.id, "Updated secondaryManagerId persisted");
    assert(updated.dateOfBirth?.toISOString().startsWith("1992-11-20"), "Updated dateOfBirth persisted");
    assert(updated.joiningDate?.toISOString().startsWith("2026-01-10"), "Updated joiningDate persisted");

    const updatedUserInDb = await prisma.user.findUnique({ where: { id: updateTarget.userId } });
    assert(
      updatedUserInDb?.personalEmail === `updated.personal.${timestamp}@gmail.com`,
      "personalEmail on User model synced via updateEmployeeAdmin"
    );

    console.log("  ✔ All Atomic Onboarding & Master Data Parity tests passed successfully.");
  } finally {
    if (ctxA) await ctxA.cleanup();
    if (ctxB) await ctxB.cleanup();
  }
}
