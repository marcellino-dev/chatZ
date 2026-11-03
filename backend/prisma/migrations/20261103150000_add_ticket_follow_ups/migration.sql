CREATE TABLE "follow_ups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "scheduledAt" DATETIME NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "cancelledAt" DATETIME,
    CONSTRAINT "follow_ups_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "follow_ups_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "follow_ups_creatorId_scheduledAt_idx" ON "follow_ups"("creatorId", "scheduledAt");
CREATE INDEX "follow_ups_ticketId_scheduledAt_idx" ON "follow_ups"("ticketId", "scheduledAt");
