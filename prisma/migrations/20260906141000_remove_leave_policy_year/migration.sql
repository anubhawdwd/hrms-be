-- Deduplicate existing LeavePolicy records: keep only the most recent year's record per (companyId, leaveTypeId)
DELETE FROM "LeavePolicy"
WHERE id NOT IN (
    SELECT DISTINCT ON ("companyId", "leaveTypeId") id
    FROM "LeavePolicy"
    ORDER BY "companyId", "leaveTypeId", "year" DESC, "updatedAt" DESC
);

-- Drop old index and unique constraint
DROP INDEX IF EXISTS "LeavePolicy_leaveTypeId_year_key";
DROP INDEX IF EXISTS "LeavePolicy_companyId_year_idx";

-- AlterTable
ALTER TABLE "LeavePolicy" DROP COLUMN "year";

-- CreateIndex
CREATE UNIQUE INDEX "LeavePolicy_companyId_leaveTypeId_key" ON "LeavePolicy"("companyId", "leaveTypeId");

-- CreateIndex
CREATE INDEX "LeavePolicy_companyId_idx" ON "LeavePolicy"("companyId");
