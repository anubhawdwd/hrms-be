/*
  Warnings:

  - You are about to drop the column `gender` on the `LeavePolicy` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "GenderRestriction" AS ENUM ('ALL', 'MALE', 'FEMALE', 'OTHER');

-- AlterTable
ALTER TABLE "EmployeeLeaveOverride" ADD COLUMN     "extraAllocation" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "LeavePolicy" DROP COLUMN "gender",
ADD COLUMN     "genderRestriction" "GenderRestriction" NOT NULL DEFAULT 'ALL',
ALTER COLUMN "yearlyAllocation" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "LeaveType" ADD COLUMN     "isPaid" BOOLEAN NOT NULL DEFAULT true;
