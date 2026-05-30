DO $$
BEGIN
  CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'PUSH');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "AnnouncementAudience" AS ENUM ('ALL', 'STUDENTS', 'TEACHERS', 'STAFF', 'ACCOUNTANTS', 'LIBRARIANS', 'FACULTY', 'DEPARTMENT', 'PROGRAM', 'COURSE', 'SEMESTER', 'YEAR_GROUP');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ADMISSION';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REGISTRATION';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RESULT';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'APPEAL';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ATTENDANCE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TRANSCRIPT';

ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP';
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "entityType" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "entityId" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "link" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "isRead" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "failedAt" TIMESTAMP(3);
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Notification"
SET "isRead" = true
WHERE "readAt" IS NOT NULL;

DO $$
BEGIN
  ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Notification_organizationId_userId_isRead_idx" ON "Notification"("organizationId", "userId", "isRead");
CREATE INDEX IF NOT EXISTS "Notification_organizationId_type_idx" ON "Notification"("organizationId", "type");
CREATE INDEX IF NOT EXISTS "Notification_organizationId_priority_idx" ON "Notification"("organizationId", "priority");
CREATE INDEX IF NOT EXISTS "Notification_entityType_entityId_idx" ON "Notification"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "Notification_expiresAt_idx" ON "Notification"("expiresAt");

ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "audienceScopeId" TEXT;
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "semesterId" TEXT;
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "courseOfferingId" TEXT;
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "requiresAcknowledgment" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

DO $$
DECLARE
  current_udt TEXT;
BEGIN
  SELECT udt_name INTO current_udt
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'Announcement'
    AND column_name = 'audience';

  IF current_udt IS DISTINCT FROM 'AnnouncementAudience' THEN
    UPDATE "Announcement"
    SET "audience" = 'ALL'
    WHERE UPPER("audience") NOT IN ('ALL', 'STUDENTS', 'TEACHERS', 'STAFF', 'ACCOUNTANTS', 'LIBRARIANS', 'FACULTY', 'DEPARTMENT', 'PROGRAM', 'COURSE', 'SEMESTER', 'YEAR_GROUP');

    UPDATE "Announcement"
    SET "audience" = UPPER("audience");

    ALTER TABLE "Announcement" ALTER COLUMN "audience" DROP DEFAULT;
    ALTER TABLE "Announcement" ALTER COLUMN "audience" TYPE "AnnouncementAudience" USING "audience"::"AnnouncementAudience";
    ALTER TABLE "Announcement" ALTER COLUMN "audience" SET DEFAULT 'ALL';
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE "Announcement"
  ADD CONSTRAINT "Announcement_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Announcement"
  ADD CONSTRAINT "Announcement_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Announcement"
  ADD CONSTRAINT "Announcement_semesterId_fkey"
  FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Announcement"
  ADD CONSTRAINT "Announcement_courseOfferingId_fkey"
  FOREIGN KEY ("courseOfferingId") REFERENCES "CourseOffering"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Announcement_organizationId_audience_idx" ON "Announcement"("organizationId", "audience");
CREATE INDEX IF NOT EXISTS "Announcement_organizationId_publishedAt_idx" ON "Announcement"("organizationId", "publishedAt");
CREATE INDEX IF NOT EXISTS "Announcement_organizationId_expiresAt_idx" ON "Announcement"("organizationId", "expiresAt");
CREATE INDEX IF NOT EXISTS "Announcement_semesterId_idx" ON "Announcement"("semesterId");
CREATE INDEX IF NOT EXISTS "Announcement_courseOfferingId_idx" ON "Announcement"("courseOfferingId");
CREATE INDEX IF NOT EXISTS "Announcement_createdById_idx" ON "Announcement"("createdById");

CREATE TABLE IF NOT EXISTS "AnnouncementRead" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "announcementId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnnouncementRead_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  ALTER TABLE "AnnouncementRead"
  ADD CONSTRAINT "AnnouncementRead_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "AnnouncementRead"
  ADD CONSTRAINT "AnnouncementRead_announcementId_fkey"
  FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "AnnouncementRead"
  ADD CONSTRAINT "AnnouncementRead_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "AnnouncementRead_announcementId_userId_key" ON "AnnouncementRead"("announcementId", "userId");
CREATE INDEX IF NOT EXISTS "AnnouncementRead_organizationId_userId_idx" ON "AnnouncementRead"("organizationId", "userId");
CREATE INDEX IF NOT EXISTS "AnnouncementRead_organizationId_announcementId_idx" ON "AnnouncementRead"("organizationId", "announcementId");

CREATE TABLE IF NOT EXISTS "AnnouncementAttachment" (
  "id" TEXT NOT NULL,
  "announcementId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "mimeType" TEXT,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnnouncementAttachment_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  ALTER TABLE "AnnouncementAttachment"
  ADD CONSTRAINT "AnnouncementAttachment_announcementId_fkey"
  FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "AnnouncementAttachment_announcementId_idx" ON "AnnouncementAttachment"("announcementId");
