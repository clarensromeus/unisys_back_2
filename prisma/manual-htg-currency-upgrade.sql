ALTER TABLE "SubscriptionPlan" ALTER COLUMN "currency" SET DEFAULT 'HTG';
ALTER TABLE "FeeStructure" ALTER COLUMN "currency" SET DEFAULT 'HTG';

UPDATE "SubscriptionPlan"
SET "currency" = 'HTG'
WHERE "currency" IS NULL OR UPPER("currency") IN ('USD', 'DOLLAR', 'DOLLARS');

UPDATE "FeeStructure"
SET "currency" = 'HTG'
WHERE "currency" IS NULL OR UPPER("currency") IN ('USD', 'DOLLAR', 'DOLLARS');
