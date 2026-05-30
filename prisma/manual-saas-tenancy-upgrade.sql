DO $$
BEGIN
  CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAUSED', 'PAST_DUE', 'CANCELED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY', 'MANUAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "displayName" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "primaryColor" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "customDomain" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Organization_customDomain_key" ON "Organization"("customDomain");

CREATE TABLE IF NOT EXISTS "SubscriptionPlan" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
  "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MANUAL',
  "price" NUMERIC(65,30) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'HTG',
  "maxStudents" INTEGER,
  "maxStaff" INTEGER,
  "maxCampuses" INTEGER,
  "maxStorageGb" INTEGER,
  "features" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3)
);

CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionPlan_code_key" ON "SubscriptionPlan"("code");
CREATE INDEX IF NOT EXISTS "SubscriptionPlan_status_idx" ON "SubscriptionPlan"("status");
CREATE INDEX IF NOT EXISTS "SubscriptionPlan_billingCycle_idx" ON "SubscriptionPlan"("billingCycle");

CREATE TABLE IF NOT EXISTS "TenantSubscription" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
  "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MANUAL',
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "trialEndsAt" TIMESTAMP(3),
  "renewsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "canceledAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "TenantSubscription_organizationId_key" ON "TenantSubscription"("organizationId");
CREATE INDEX IF NOT EXISTS "TenantSubscription_planId_idx" ON "TenantSubscription"("planId");
CREATE INDEX IF NOT EXISTS "TenantSubscription_status_idx" ON "TenantSubscription"("status");
CREATE INDEX IF NOT EXISTS "TenantSubscription_renewsAt_idx" ON "TenantSubscription"("renewsAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TenantSubscription_organizationId_fkey') THEN
    ALTER TABLE "TenantSubscription"
      ADD CONSTRAINT "TenantSubscription_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TenantSubscription_planId_fkey') THEN
    ALTER TABLE "TenantSubscription"
      ADD CONSTRAINT "TenantSubscription_planId_fkey"
      FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "TenantFeatureFlag" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "config" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "TenantFeatureFlag_organizationId_key_key" ON "TenantFeatureFlag"("organizationId", "key");
CREATE INDEX IF NOT EXISTS "TenantFeatureFlag_organizationId_enabled_idx" ON "TenantFeatureFlag"("organizationId", "enabled");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TenantFeatureFlag_organizationId_fkey') THEN
    ALTER TABLE "TenantFeatureFlag"
      ADD CONSTRAINT "TenantFeatureFlag_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "TenantUsageSnapshot" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "usersCount" INTEGER NOT NULL DEFAULT 0,
  "studentsCount" INTEGER NOT NULL DEFAULT 0,
  "teachersCount" INTEGER NOT NULL DEFAULT 0,
  "staffCount" INTEGER NOT NULL DEFAULT 0,
  "coursesCount" INTEGER NOT NULL DEFAULT 0,
  "storageUsedMb" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "TenantUsageSnapshot_organizationId_snapshotAt_idx" ON "TenantUsageSnapshot"("organizationId", "snapshotAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TenantUsageSnapshot_organizationId_fkey') THEN
    ALTER TABLE "TenantUsageSnapshot"
      ADD CONSTRAINT "TenantUsageSnapshot_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "SubscriptionPlan" (
  "id", "code", "name", "description", "status", "billingCycle", "price", "currency",
  "maxStudents", "maxStaff", "maxCampuses", "maxStorageGb", "features"
)
VALUES (
  'plan-enterprise-manual',
  'ENTERPRISE_MANUAL',
  'Enterprise Manual',
  'Default manually managed SaaS plan for tenant onboarding.',
  'ACTIVE',
  'MANUAL',
  0,
  'HTG',
  10000,
  1000,
  10,
  500,
  '{"admissions":true,"academics":true,"finance":true,"library":true,"hr":true,"accommodation":true,"multilingual":true}'::jsonb
)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "TenantSubscription" (
  "id", "organizationId", "planId", "status", "billingCycle", "startsAt", "notes"
)
SELECT
  'sub-' || md5(org."id" || '-enterprise-manual'),
  org."id",
  plan."id",
  'ACTIVE',
  'MANUAL',
  CURRENT_TIMESTAMP,
  'Migrated to the default manually managed SaaS tenant plan.'
FROM "Organization" org
JOIN "SubscriptionPlan" plan ON plan."code" = 'ENTERPRISE_MANUAL'
ON CONFLICT ("organizationId") DO NOTHING;

WITH default_features("key") AS (
  VALUES
    ('admissions'),
    ('academics'),
    ('finance'),
    ('library'),
    ('hr'),
    ('accommodation'),
    ('multilingual')
)
INSERT INTO "TenantFeatureFlag" ("id", "organizationId", "key", "enabled")
SELECT
  'feature-' || md5(org."id" || '-' || default_features."key"),
  org."id",
  default_features."key",
  TRUE
FROM "Organization" org
CROSS JOIN default_features
ON CONFLICT ("organizationId", "key") DO NOTHING;
