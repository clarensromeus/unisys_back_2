CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE "EmployeeType" AS ENUM ('ACADEMIC', 'ADMINISTRATIVE', 'BOTH');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RoleScopeType" AS ENUM ('ORGANIZATION', 'FACULTY', 'DEPARTMENT', 'PROGRAM', 'COURSE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Employee" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "employeeNo" TEXT,
  "employeeType" "EmployeeType" NOT NULL DEFAULT 'ADMINISTRATIVE',
  "designation" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Teacher" ADD COLUMN IF NOT EXISTS "employeeId" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "employeeId" TEXT;
ALTER TABLE "Faculty" ADD COLUMN IF NOT EXISTS "headId" TEXT;
ALTER TABLE "UserRoleAssignment" ADD COLUMN IF NOT EXISTS "scopeType" "RoleScopeType";
ALTER TABLE "UserRoleAssignment" ADD COLUMN IF NOT EXISTS "scopeId" TEXT;

INSERT INTO "Employee" ("id", "organizationId", "userId", "employeeNo", "employeeType", "designation", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  u."organizationId",
  u."id",
  COALESCE(t."employeeNo", s."employeeNo"),
  CASE
    WHEN t."id" IS NOT NULL AND s."id" IS NOT NULL THEN 'BOTH'::"EmployeeType"
    WHEN t."id" IS NOT NULL THEN 'ACADEMIC'::"EmployeeType"
    ELSE 'ADMINISTRATIVE'::"EmployeeType"
  END,
  COALESCE(t."specialization", s."role"),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User" u
LEFT JOIN "Teacher" t ON t."userId" = u."id"
LEFT JOIN "Staff" s ON s."userId" = u."id"
LEFT JOIN "Employee" e ON e."userId" = u."id"
WHERE e."id" IS NULL AND (t."id" IS NOT NULL OR s."id" IS NOT NULL);

UPDATE "Teacher" t
SET "employeeId" = e."id"
FROM "Employee" e
WHERE t."userId" = e."userId" AND (t."employeeId" IS NULL OR t."employeeId" <> e."id");

UPDATE "Staff" s
SET "employeeId" = e."id"
FROM "Employee" e
WHERE s."userId" = e."userId" AND (s."employeeId" IS NULL OR s."employeeId" <> e."id");

UPDATE "Employee" e
SET "employeeType" = 'BOTH'
WHERE EXISTS (SELECT 1 FROM "Teacher" t WHERE t."userId" = e."userId")
  AND EXISTS (SELECT 1 FROM "Staff" s WHERE s."userId" = e."userId");

DO $$ BEGIN
  ALTER TABLE "Department" DROP CONSTRAINT IF EXISTS "Department_headId_fkey";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

UPDATE "Department" d
SET "headId" = t."employeeId"
FROM "Teacher" t
WHERE d."headId" = t."id" AND t."employeeId" IS NOT NULL;

DROP INDEX IF EXISTS "UserRoleAssignment_userId_roleId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Employee_userId_key" ON "Employee"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "Employee_organizationId_employeeNo_key" ON "Employee"("organizationId", "employeeNo");
CREATE INDEX IF NOT EXISTS "Employee_organizationId_employeeType_idx" ON "Employee"("organizationId", "employeeType");
CREATE UNIQUE INDEX IF NOT EXISTS "Teacher_employeeId_key" ON "Teacher"("employeeId");
CREATE UNIQUE INDEX IF NOT EXISTS "Staff_employeeId_key" ON "Staff"("employeeId");
CREATE UNIQUE INDEX IF NOT EXISTS "Faculty_headId_key" ON "Faculty"("headId");
CREATE UNIQUE INDEX IF NOT EXISTS "UserRoleAssignment_userId_roleId_scopeType_scopeId_key" ON "UserRoleAssignment"("userId", "roleId", "scopeType", "scopeId");
CREATE INDEX IF NOT EXISTS "UserRoleAssignment_scopeType_scopeId_idx" ON "UserRoleAssignment"("scopeType", "scopeId");

DO $$ BEGIN
  ALTER TABLE "Employee" ADD CONSTRAINT "Employee_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Staff" ADD CONSTRAINT "Staff_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Department" ADD CONSTRAINT "Department_headId_fkey" FOREIGN KEY ("headId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Faculty" ADD CONSTRAINT "Faculty_headId_fkey" FOREIGN KEY ("headId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
