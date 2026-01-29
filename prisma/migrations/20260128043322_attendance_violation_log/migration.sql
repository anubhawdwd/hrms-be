-- CreateTable
CREATE TABLE "AttendanceViolation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "distanceM" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "source" "AttendanceSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceViolation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceViolation_companyId_idx" ON "AttendanceViolation"("companyId");

-- CreateIndex
CREATE INDEX "AttendanceViolation_employeeId_idx" ON "AttendanceViolation"("employeeId");

-- AddForeignKey
ALTER TABLE "AttendanceViolation" ADD CONSTRAINT "AttendanceViolation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceViolation" ADD CONSTRAINT "AttendanceViolation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
