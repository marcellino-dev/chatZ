CREATE TABLE "agent_ticket_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    CONSTRAINT "agent_ticket_sessions_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "agent_ticket_sessions_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "agent_ticket_sessions_agentId_assignedAt_idx" ON "agent_ticket_sessions"("agentId", "assignedAt");
CREATE INDEX "agent_ticket_sessions_ticketId_endedAt_idx" ON "agent_ticket_sessions"("ticketId", "endedAt");

CREATE TABLE "ticket_ratings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "score" INTEGER,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" DATETIME,
    CONSTRAINT "ticket_ratings_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ticket_ratings_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ticket_ratings_ticketId_key" ON "ticket_ratings"("ticketId");
CREATE UNIQUE INDEX "ticket_ratings_protocol_key" ON "ticket_ratings"("protocol");
CREATE INDEX "ticket_ratings_agentId_receivedAt_idx" ON "ticket_ratings"("agentId", "receivedAt");
