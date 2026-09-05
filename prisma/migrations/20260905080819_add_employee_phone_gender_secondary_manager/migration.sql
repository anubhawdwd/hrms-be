-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- AlterTable
ALTER TABLE "EmployeeProfile" ADD COLUMN     "gender" "Gender",
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "secondaryManagerId" TEXT;

-- CreateIndex
CREATE INDEX "EmployeeProfile_secondaryManagerId_idx" ON "EmployeeProfile"("secondaryManagerId");

-- AddForeignKey
ALTER TABLE "EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_secondaryManagerId_fkey" FOREIGN KEY ("secondaryManagerId") REFERENCES "EmployeeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
