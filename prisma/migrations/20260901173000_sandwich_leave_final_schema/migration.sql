-- AlterTable
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "workWeekDays" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "sandwichRuleEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "LeaveType" ADD COLUMN IF NOT EXISTS "autoGrantOnOnboarding" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "EmployeeLeaveOverride" DROP COLUMN IF EXISTS "allowSandwich";

-- CreateTable
CREATE TABLE IF NOT EXISTS "LeaveRequestDay" (
    "id" TEXT NOT NULL,
    "leaveRequestId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
    "isSandwichDay" BOOLEAN NOT NULL DEFAULT false,
    "deductDays" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveRequestDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "LeaveRequestDay_leaveRequestId_date_key" ON "LeaveRequestDay"("leaveRequestId", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LeaveRequestDay_date_status_idx" ON "LeaveRequestDay"("date", "status");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'LeaveRequestDay_leaveRequestId_fkey'
    ) THEN
        ALTER TABLE "LeaveRequestDay" ADD CONSTRAINT "LeaveRequestDay_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "LeaveRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
