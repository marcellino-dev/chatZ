CREATE TABLE "knowledge_articles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "knowledge_articles_active_category_idx" ON "knowledge_articles"("active", "category");
CREATE INDEX "knowledge_articles_title_idx" ON "knowledge_articles"("title");
