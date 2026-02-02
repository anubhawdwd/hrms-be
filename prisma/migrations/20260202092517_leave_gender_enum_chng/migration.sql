/*
  Warnings:

  - The values [ALL] on the enum `GenderRestriction` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "GenderRestriction_new" AS ENUM ('MALE', 'FEMALE', 'OTHER');
ALTER TABLE "public"."LeavePolicy" ALTER COLUMN "genderRestriction" DROP DEFAULT;
ALTER TABLE "LeavePolicy" ALTER COLUMN "genderRestriction" TYPE "GenderRestriction_new" USING ("genderRestriction"::text::"GenderRestriction_new");
ALTER TYPE "GenderRestriction" RENAME TO "GenderRestriction_old";
ALTER TYPE "GenderRestriction_new" RENAME TO "GenderRestriction";
DROP TYPE "public"."GenderRestriction_old";
COMMIT;

-- AlterTable
ALTER TABLE "LeavePolicy" ALTER COLUMN "genderRestriction" DROP NOT NULL,
ALTER COLUMN "genderRestriction" DROP DEFAULT;
