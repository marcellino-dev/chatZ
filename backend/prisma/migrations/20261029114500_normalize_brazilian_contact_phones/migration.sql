UPDATE "contacts"
SET "normalizedPhone" = '55' || "normalizedPhone"
WHERE length("normalizedPhone") IN (10, 11);
