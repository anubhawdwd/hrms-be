-- CreateTable
CREATE TABLE "DesignationAttendancePolicy" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "designationId" TEXT NOT NULL,
    "autoPresent" BOOLEAN NOT NULL DEFAULT false,
    "attendanceExempt" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignationAttendancePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DesignationAttendancePolicy_designationId_key" ON "DesignationAttendancePolicy"("designationId");

-- CreateIndex
CREATE INDEX "DesignationAttendancePolicy_companyId_idx" ON "DesignationAttendancePolicy"("companyId");

-- AddForeignKey
ALTER TABLE "DesignationAttendancePolicy" ADD CONSTRAINT "DesignationAttendancePolicy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignationAttendancePolicy" ADD CONSTRAINT "DesignationAttendancePolicy_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
