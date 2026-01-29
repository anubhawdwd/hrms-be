-- CreateTable
CREATE TABLE "EmployeeAttendanceOverride" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "autoPresent" BOOLEAN NOT NULL DEFAULT false,
    "attendanceExempt" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeAttendanceOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeAttendanceOverride_employeeId_idx" ON "EmployeeAttendanceOverride"("employeeId");

-- AddForeignKey
ALTER TABLE "EmployeeAttendanceOverride" ADD CONSTRAINT "EmployeeAttendanceOverride_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
