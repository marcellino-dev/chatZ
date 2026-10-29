ALTER TABLE "stickers" ADD COLUMN "sourceMessageId" TEXT;

CREATE UNIQUE INDEX "stickers_userId_sourceMessageId_key"
ON "stickers"("userId", "sourceMessageId");
