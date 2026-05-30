ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "studentId" TEXT;
ALTER TABLE "LeaveRequest" ALTER COLUMN "staffId" DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'LeaveRequest_studentId_fkey'
  ) THEN
    ALTER TABLE "LeaveRequest"
      ADD CONSTRAINT "LeaveRequest_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "Student"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "LeaveRequest_staffId_idx" ON "LeaveRequest"("staffId");
CREATE INDEX IF NOT EXISTS "LeaveRequest_studentId_idx" ON "LeaveRequest"("studentId");
