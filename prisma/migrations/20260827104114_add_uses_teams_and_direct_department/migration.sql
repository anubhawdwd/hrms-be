-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "usesTeams" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "EmployeeProfile" ADD COLUMN     "departmentId" TEXT;

-- CreateIndex
CREATE INDEX "Designation_companyId_idx" ON "Designation"("companyId");

-- CreateIndex
CREATE INDEX "EmployeeProfile_departmentId_idx" ON "EmployeeProfile"("departmentId");

-- AddForeignKey
ALTER TABLE "EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
