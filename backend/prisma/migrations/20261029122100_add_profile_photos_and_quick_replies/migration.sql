ALTER TABLE "users" ADD COLUMN "profilePictureUrl" TEXT;
ALTER TABLE "users" ADD COLUMN "profilePictureUpdatedAt" DATETIME;

CREATE TABLE "quick_replies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "quick_replies_title_idx" ON "quick_replies"("title");
