import { Ticket } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { canViewTicket } from './ticket.permissions';

export interface TicketAccessUser {
  id: string;
  role: string;
  sectorId?: string | null;
}

export async function hasTicketAccess(
  user: TicketAccessUser,
  ticket: Ticket
): Promise<boolean> {
  if (canViewTicket(user, ticket)) return true;

  const participant = await prisma.ticketParticipant.findUnique({
    where: { ticketId_userId: { ticketId: ticket.id, userId: user.id } },
    select: { id: true },
  });

  return participant !== null;
}

export async function assertTicketAccess(
  user: TicketAccessUser,
  ticket: Ticket
): Promise<void> {
  if (!(await hasTicketAccess(user, ticket))) {
    throw new AppError('Sem permissão para ver este ticket', 403);
  }
}
