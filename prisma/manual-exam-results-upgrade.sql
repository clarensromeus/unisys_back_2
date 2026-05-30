DO $$ BEGIN
  CREATE TYPE "ResultWorkflowStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AppealStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "roomId" TEXT;
ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL DEFAULT 'Untitled Exam';
ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "durationMinutes" INTEGER NOT NULL DEFAULT 120;
ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "passMark" DECIMAL(6,2) NOT NULL DEFAULT 50;
ALTER TABLE "Exam" ALTER COLUMN "weight" SET DEFAULT 0;
UPDATE "Exam" SET "weight" = 0 WHERE "weight" IS NULL;
ALTER TABLE "Exam" ALTER COLUMN "weight" SET NOT NULL;

ALTER TABLE "Result" ADD COLUMN IF NOT EXISTS "isPassed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Result" ADD COLUMN IF NOT EXISTS "status" "ResultWorkflowStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "Result" ADD COLUMN IF NOT EXISTS "isPublished" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Result" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);
ALTER TABLE "Result" ADD COLUMN IF NOT EXISTS "gradedById" TEXT;
ALTER TABLE "Result" ADD COLUMN IF NOT EXISTS "approvedById" TEXT;
ALTER TABLE "Result" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "Result" ADD COLUMN IF NOT EXISTS "remarks" TEXT;
ALTER TABLE "Result" ADD COLUMN IF NOT EXISTS "approvalNotes" TEXT;

CREATE TABLE IF NOT EXISTS "ExamSchedule" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "examId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "invigilatorId" TEXT,
  "startTime" TIMESTAMP(3) NOT NULL,
  "endTime" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExamSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GradingScheme" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "courseOfferingId" TEXT NOT NULL,
  "examType" "ExamType" NOT NULL,
  "title" TEXT,
  "weight" DECIMAL(5,2) NOT NULL,
  "minimumScore" DECIMAL(6,2),
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GradingScheme_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ResultAppeal" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "resultId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "AppealStatus" NOT NULL DEFAULT 'PENDING',
  "newScore" DECIMAL(6,2),
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "responseNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResultAppeal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Transcript" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isOfficial" BOOLEAN NOT NULL DEFAULT false,
  "verifyCode" TEXT NOT NULL,
  "issuedById" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Transcript_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ExamSchedule_examId_roomId_startTime_key" ON "ExamSchedule"("examId", "roomId", "startTime");
CREATE INDEX IF NOT EXISTS "ExamSchedule_organizationId_roomId_startTime_idx" ON "ExamSchedule"("organizationId", "roomId", "startTime");
CREATE INDEX IF NOT EXISTS "ExamSchedule_organizationId_invigilatorId_startTime_idx" ON "ExamSchedule"("organizationId", "invigilatorId", "startTime");
CREATE UNIQUE INDEX IF NOT EXISTS "GradingScheme_courseOfferingId_examType_key" ON "GradingScheme"("courseOfferingId", "examType");
CREATE INDEX IF NOT EXISTS "GradingScheme_organizationId_courseOfferingId_idx" ON "GradingScheme"("organizationId", "courseOfferingId");
CREATE INDEX IF NOT EXISTS "ResultAppeal_organizationId_status_idx" ON "ResultAppeal"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "ResultAppeal_studentId_resultId_idx" ON "ResultAppeal"("studentId", "resultId");
CREATE UNIQUE INDEX IF NOT EXISTS "Transcript_verifyCode_key" ON "Transcript"("verifyCode");
CREATE INDEX IF NOT EXISTS "Transcript_organizationId_studentId_idx" ON "Transcript"("organizationId", "studentId");
CREATE INDEX IF NOT EXISTS "Transcript_organizationId_isOfficial_idx" ON "Transcript"("organizationId", "isOfficial");
CREATE INDEX IF NOT EXISTS "Exam_organizationId_roomId_idx" ON "Exam"("organizationId", "roomId");
CREATE INDEX IF NOT EXISTS "Result_organizationId_status_isPublished_idx" ON "Result"("organizationId", "status", "isPublished");

DO $$ BEGIN
  ALTER TABLE "Exam" ADD CONSTRAINT "Exam_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Result" ADD CONSTRAINT "Result_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Result" ADD CONSTRAINT "Result_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ExamSchedule" ADD CONSTRAINT "ExamSchedule_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ExamSchedule" ADD CONSTRAINT "ExamSchedule_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ExamSchedule" ADD CONSTRAINT "ExamSchedule_invigilatorId_fkey" FOREIGN KEY ("invigilatorId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "GradingScheme" ADD CONSTRAINT "GradingScheme_courseOfferingId_fkey" FOREIGN KEY ("courseOfferingId") REFERENCES "CourseOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ResultAppeal" ADD CONSTRAINT "ResultAppeal_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Result"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ResultAppeal" ADD CONSTRAINT "ResultAppeal_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ResultAppeal" ADD CONSTRAINT "ResultAppeal_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Transcript" ADD CONSTRAINT "Transcript_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Transcript" ADD CONSTRAINT "Transcript_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
