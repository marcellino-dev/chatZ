ALTER TABLE "users" ADD COLUMN "company" TEXT;

UPDATE "users"
SET
    "name" = (
        SELECT "contacts"."name"
        FROM "contacts"
        WHERE "contacts"."normalizedPhone" = "users"."phone"
           OR substr("contacts"."normalizedPhone", 3) = "users"."phone"
        LIMIT 1
    ),
    "company" = (
        SELECT "contacts"."company"
        FROM "contacts"
        WHERE "contacts"."normalizedPhone" = "users"."phone"
           OR substr("contacts"."normalizedPhone", 3) = "users"."phone"
        LIMIT 1
    )
WHERE "users"."role" = 'CLIENT'
  AND EXISTS (
      SELECT 1
      FROM "contacts"
      WHERE "contacts"."normalizedPhone" = "users"."phone"
         OR substr("contacts"."normalizedPhone", 3) = "users"."phone"
  );
