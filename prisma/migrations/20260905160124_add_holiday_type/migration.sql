-- CreateEnum
CREATE TYPE "HolidayType" AS ENUM ('NORMAL', 'RESTRICTED');

-- AlterTable
ALTER TABLE "Holiday" ADD COLUMN     "type" "HolidayType" NOT NULL DEFAULT 'NORMAL';
