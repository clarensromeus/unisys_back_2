ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'TENANT_ADMIN';

UPDATE "User"
SET "role" = 'TENANT_ADMIN'
WHERE "role" = 'ADMIN';

UPDATE "Role"
SET "systemRole" = 'TENANT_ADMIN',
    "name" = 'TENANT_ADMIN'
WHERE "systemRole" = 'ADMIN'
  AND "name" = 'ADMIN';

DO $$
DECLARE
  platform_org_id TEXT;
  password_hash TEXT;
BEGIN
  SELECT "id" INTO platform_org_id
  FROM "Organization"
  ORDER BY "createdAt" ASC
  LIMIT 1;

  SELECT "password" INTO password_hash
  FROM "User"
  WHERE "email" = 'admin@northbridge.edu'
  LIMIT 1;

  IF platform_org_id IS NOT NULL AND password_hash IS NOT NULL THEN
    INSERT INTO "User" (
      "id",
      "organizationId",
      "email",
      "password",
      "role",
      "firstName",
      "lastName",
      "isActive",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      'platform-super-admin',
      platform_org_id,
      'superadmin@platform.edu',
      password_hash,
      'SUPER_ADMIN',
      'Platform',
      'Owner',
      TRUE,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("email") DO UPDATE
    SET "role" = 'SUPER_ADMIN',
        "isActive" = TRUE,
        "updatedAt" = CURRENT_TIMESTAMP;
  END IF;
END $$;
