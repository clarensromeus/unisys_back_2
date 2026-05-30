DO $$
BEGIN
  CREATE TYPE "HostelGender" AS ENUM ('MALE', 'FEMALE', 'MIXED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "HostelRoomType" AS ENUM ('SINGLE', 'DOUBLE', 'SHARED', 'SUITE', 'DORMITORY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Hostel" ADD COLUMN IF NOT EXISTS "location" TEXT;
ALTER TABLE "Hostel" ADD COLUMN IF NOT EXISTS "amenities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Hostel" ADD COLUMN IF NOT EXISTS "gender" "HostelGender" NOT NULL DEFAULT 'MIXED';
ALTER TABLE "Hostel" ADD COLUMN IF NOT EXISTS "capacityLimit" INTEGER;
ALTER TABLE "Hostel" ADD COLUMN IF NOT EXISTS "wardenId" TEXT;

ALTER TABLE "HostelRoom" ADD COLUMN IF NOT EXISTS "roomType" "HostelRoomType" NOT NULL DEFAULT 'SHARED';

DO $$
BEGIN
  ALTER TABLE "Hostel"
  ADD CONSTRAINT "Hostel_wardenId_fkey"
  FOREIGN KEY ("wardenId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Hostel_organizationId_gender_idx" ON "Hostel"("organizationId", "gender");
CREATE INDEX IF NOT EXISTS "Hostel_wardenId_idx" ON "Hostel"("wardenId");
