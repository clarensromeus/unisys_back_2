ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "bedCount" INTEGER;

UPDATE "Room"
SET "bedCount" = "capacity"
WHERE "type" = 'HOSTEL'
  AND "bedCount" IS NULL;
