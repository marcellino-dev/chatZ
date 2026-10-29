import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import {
  emitToSector,
  emitToUser,
  emitToTicket,
} from '../../sockets/socket.server';
import { TransferTicketInput } from './transfer.schemas';

interface AuthUser {
  id: string;
  role: string;
  sectorId?: string | null;
}

// ==========================
// TRANSFERIR TICKET
// ==========================
export async function transferTicket(
  user: AuthUser,
  ticketId: string,
  data: TransferTicketInput
) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      sector: { select: { id: true, name: true, slug: true } },
      agent: { select: { id: true, name: true } },
    },
  });

  if (!ticket) throw new AppError('Ticket não encontrado', 404);

  // Permissões: precisa ser o agente do ticket ou ADMIN
  if (user.role !== 'ADMIN' && ticket.agentId !== user.id) {
    throw new AppError(
      'Você só pode transferir tickets que você assumiu',
      403
    );
  }

  // Ticket precisa estar em atendimento
  if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
    throw new AppError('Não é possível transferir ticket fechado', 400);
  }

  // ==========================
  // TRANSFERIR PRA OUTRO ATENDENTE
  // ==========================
  if (data.toUserId) {
    if (data.toUserId === user.id) {
      throw new AppError('Você não pode transferir para você mesmo', 400);
    }

    const target = await prisma.user.findUnique({
      where: { id: data.toUserId },
      select: {
        id: true,
        name: true,
        role: true,
        active: true,
        sectorId: true,
      },
    });

    if (!target) throw new AppError('Atendente não encontrado', 404);
    if (!target.active) throw new AppError('Atendente inativo', 400);
    if (target.role !== 'AGENT' && target.role !== 'ADMIN') {
      throw new AppError('Destino precisa ser um atendente', 400);
    }

    // Cria registro de transferência
    const transfer = await prisma.transfer.create({
      data: {
        ticketId,
        fromUserId: user.id,
        toUserId: target.id,
        reason: data.reason,
      },
    });

    // Atualiza ticket
    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        agentId: target.id,
        status: 'IN_PROGRESS',
      },
      include: {
        sector: { select: { id: true, name: true, slug: true } },
        client: {
          select: {
            id: true,
            name: true,
            company: true,
            phone: true,
            role: true,
            profilePictureUrl: true,
          },
        },
        agent: { select: { id: true, name: true, email: true, role: true } },
        requestedAgent: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    // 🔔 Notifica
    emitToUser(target.id, 'ticket:transferred', {
      ticket: updated,
      from: { id: user.id },
      reason: data.reason,
    });
    emitToSector(ticket.sectorId, 'ticket:updated', updated);
    emitToTicket(ticketId, 'ticket:updated', updated);

    return { ticket: updated, transfer };
  }

  // ==========================
  // TRANSFERIR PRA OUTRO SETOR
  // ==========================
  if (data.toSectorId) {
    const targetSector = await prisma.sector.findUnique({
      where: { id: data.toSectorId },
      select: { id: true, name: true, active: true },
    });

    if (!targetSector) throw new AppError('Setor não encontrado', 404);
    if (!targetSector.active) throw new AppError('Setor inativo', 400);
    if (targetSector.id === ticket.sectorId) {
      throw new AppError('O ticket já está nesse setor', 400);
    }

    // Cria registro de transferência
    const transfer = await prisma.transfer.create({
      data: {
        ticketId,
        fromUserId: user.id,
        toSectorId: targetSector.id,
        reason: data.reason,
      },
    });

    // Atualiza ticket (volta pra fila do novo setor)
    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        sectorId: targetSector.id,
        agentId: null,
        requestedAgentId: null,
        status: 'WAITING',
      },
      include: {
        sector: { select: { id: true, name: true, slug: true } },
        client: {
          select: {
            id: true,
            name: true,
            company: true,
            phone: true,
            role: true,
            profilePictureUrl: true,
          },
        },
        agent: { select: { id: true, name: true, email: true, role: true } },
        requestedAgent: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    // 🔔 Notifica
    // 1. Setor de origem (some da fila)
    emitToSector(ticket.sectorId, 'ticket:transferred', {
      ticket: updated,
      fromSectorId: ticket.sectorId,
    });

    // 2. Setor de destino (aparece na fila)
    emitToSector(targetSector.id, 'ticket:new', updated);

    // 3. Quem tava vendo
    emitToTicket(ticketId, 'ticket:updated', updated);

    return { ticket: updated, transfer };
  }

  throw new AppError('Destino inválido', 400);
}

// ==========================
// LISTAR HISTÓRICO DE TRANSFERÊNCIAS
// ==========================
export async function listTransfers(user: AuthUser, ticketId: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
  });

  if (!ticket) throw new AppError('Ticket não encontrado', 404);

  // Permissões
  if (user.role === 'CLIENT' && ticket.clientId !== user.id) {
    throw new AppError('Sem permissão', 403);
  }
  if (
    user.role === 'AGENT' &&
    user.sectorId &&
    ticket.sectorId !== user.sectorId &&
    ticket.agentId !== user.id
  ) {
    throw new AppError('Sem permissão', 403);
  }

  const transfers = await prisma.transfer.findMany({
    where: { ticketId },
    orderBy: { createdAt: 'desc' },
    include: {
      fromUser: { select: { id: true, name: true, role: true } },
      toUser: { select: { id: true, name: true, role: true } },
      toSector: { select: { id: true, name: true, slug: true } },
    },
  });

  return transfers;
}