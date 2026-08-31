// tests/run-all.ts
import { prisma } from "../src/config/prisma.js";
import { runAuthTests } from "./auth.test.js";
import { runAttendanceTests } from "./attendance.test.js";
import { runLeaveTests } from "./leave.test.js";

async function main() {
  const startTime = Date.now();
  console.log("==================================================");
  console.log("HRMS AUTOMATED TEST SUITE (PHASE 10)");
  console.log("==================================================");

  try {
    await runAuthTests();
    await runAttendanceTests();
    await runLeaveTests();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log("\n==================================================");
    console.log(`ALL TEST SUITES PASSED! (${duration}s)`);
    console.log("==================================================\n");
    process.exit(0);
  } catch (error) {
    console.error("\nTEST SUITE FAILED:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
