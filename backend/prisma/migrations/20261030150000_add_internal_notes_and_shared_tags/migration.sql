CREATE TABLE "ticket_notes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ticket_notes_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ticket_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "ticket_notes_ticketId_createdAt_idx" ON "ticket_notes"("ticketId", "createdAt");

CREATE TABLE "tags" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

CREATE TABLE "_ContactToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ContactToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "contacts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ContactToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "tags" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "_ContactToTag_AB_unique" ON "_ContactToTag"("A", "B");
CREATE INDEX "_ContactToTag_B_index" ON "_ContactToTag"("B");

CREATE TABLE "_TagToTicket" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_TagToTicket_A_fkey" FOREIGN KEY ("A") REFERENCES "tags" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_TagToTicket_B_fkey" FOREIGN KEY ("B") REFERENCES "tickets" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "_TagToTicket_AB_unique" ON "_TagToTicket"("A", "B");
CREATE INDEX "_TagToTicket_B_index" ON "_TagToTicket"("B");

INSERT OR IGNORE INTO "tags" ("id", "name", "createdAt") VALUES
    ('tag-default-orcamento', 'Orçamento', CURRENT_TIMESTAMP),
    ('tag-default-duvida', 'Dúvida', CURRENT_TIMESTAMP),
    ('tag-default-reclamacao', 'Reclamação', CURRENT_TIMESTAMP),
    ('tag-default-suporte', 'Suporte', CURRENT_TIMESTAMP),
    ('tag-default-financeiro', 'Financeiro', CURRENT_TIMESTAMP);
