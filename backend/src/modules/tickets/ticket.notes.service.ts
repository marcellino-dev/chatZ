import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { emitToTicketStaff } from '../../sockets/socket.server';
import { assertTicketAccess } from './ticket.access';
import type { TicketNoteInput } from './ticket.schemas';

interface AuthUser {
  id: string;
  role: string;
  sectorId?: string | null;
}

const openStatuses = ['WAITING', 'IN_PROGRESS', 'TRANSFERRED'] as const;

async function getAccessibleTicket(user: AuthUser, ticketId: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new AppError('Ticket não encontrado', 404);
  await assertTicketAccess(user, ticket);
  return ticket;
}

function assertOpen(status: string) {
  if (!openStatuses.includes(status as (typeof openStatuses)[number])) {
    throw new AppError('Notas só podem ser alteradas enquanto o atendimento estiver aberto', 409);
  }
}

const noteInclude = {
  author: { select: { id: true, name: true, role: true } },
};

export async function listTicketNotes(user: AuthUser, ticketId: string) {
  await getAccessibleTicket(user, ticketId);
  return prisma.ticketNote.findMany({
    where: { ticketId },
    include: noteInclude,
    orderBy: { createdAt: 'asc' },
  });
}

export async function createTicketNote(
  user: AuthUser,
  ticketId: string,
  data: TicketNoteInput
) {
  const ticket = await getAccessibleTicket(user, ticketId);
  assertOpen(ticket.status);

  const note = await prisma.ticketNote.create({
    data: { ticketId, authorId: user.id, content: data.content },
    include: noteInclude,
  });
  await emitToTicketStaff(ticketId, 'ticket:note-created', note);
  return note;
}

export async function updateTicketNote(
  user: AuthUser,
  ticketId: string,
  noteId: string,
  data: TicketNoteInput
) {
  const updated = await prisma.$transaction(async (transaction) => {
    const ticket = await transaction.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new AppError('Ticket não encontrado', 404);
    await assertTicketAccess(user, ticket);
    assertOpen(ticket.status);

    const note = await transaction.ticketNote.findFirst({
      where: { id: noteId, ticketId },
    });
    if (!note) throw new AppError('Nota não encontrada', 404);
    if (note.authorId !== user.id) {
      throw new AppError('Você só pode editar suas próprias notas', 403);
    }

    return transaction.ticketNote.update({
      where: { id: noteId },
      data: { content: data.content },
      include: noteInclude,
    });
  });
  await emitToTicketStaff(ticketId, 'ticket:note-updated', updated);
  return updated;
}

export async function deleteTicketNote(
  user: AuthUser,
  ticketId: string,
  noteId: string
) {
  await prisma.$transaction(async (transaction) => {
    const ticket = await transaction.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new AppError('Ticket não encontrado', 404);
    await assertTicketAccess(user, ticket);
    assertOpen(ticket.status);

    const note = await transaction.ticketNote.findFirst({
      where: { id: noteId, ticketId },
    });
    if (!note) throw new AppError('Nota não encontrada', 404);
    if (note.authorId !== user.id) {
      throw new AppError('Você só pode excluir suas próprias notas', 403);
    }

    await transaction.ticketNote.delete({ where: { id: noteId } });
  });
  await emitToTicketStaff(ticketId, 'ticket:note-deleted', { ticketId, noteId });
  return { ok: true };
}
