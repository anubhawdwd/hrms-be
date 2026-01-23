/*
  Warnings:

  - A unique constraint covering the columns `[companyId,employeeCode]` on the table `EmployeeProfile` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `displayName` to the `EmployeeProfile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `employeeCode` to the `EmployeeProfile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `firstName` to the `EmployeeProfile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastName` to the `EmployeeProfile` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "EmployeeProfile" ADD COLUMN     "displayName" TEXT NOT NULL,
ADD COLUMN     "employeeCode" INTEGER NOT NULL,
ADD COLUMN     "firstName" TEXT NOT NULL,
ADD COLUMN     "lastName" TEXT NOT NULL,
ADD COLUMN     "middleName" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeProfile_companyId_employeeCode_key" ON "EmployeeProfile"("companyId", "employeeCode");
