import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import {
  CreateTicketInput,
  ListTicketsQuery,
  UpdatePriorityInput,
  UpdateStatusInput,
} from './ticket.schemas';
import {
  canAssignTicket,
  canModifyTicket,
} from './ticket.permissions';
import { assertTicketAccess } from './ticket.access';
import {
  emitToSector,
  emitToUser,
  emitToTicket,
  removeUnauthorizedTicketRoomMembers,
} from '../../sockets/socket.server';

interface AuthUser {
  id: string;
  role: string;
  sectorId?: string | null;
}

// ==========================
// CRIAR TICKET
// ==========================
export async function createTicket(user: AuthUser, data: CreateTicketInput) {
  if (user.role !== 'CLIENT') {
    throw new AppError('Apenas clientes podem abrir tickets', 403);
  }

  const ticket = await prisma.ticket.create({
    data: {
      subject: data.subject,
      priority: data.priority ?? 'MEDIUM',
      sectorId: data.sectorId,
      clientId: user.id,
      status: 'WAITING',
      channel: 'WEB',
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
      requestedAgent: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  emitToSector(ticket.sectorId, 'ticket:new', { id: ticket.id });
  if (ticket.requestedAgentId) {
    emitToUser(ticket.requestedAgentId, 'ticket:new', ticket);
  }

  return ticket;
}

// ==========================
// LISTAR TICKETS
// ==========================
export async function listTickets(user: AuthUser, query: ListTicketsQuery) {
  const where: any = {};

  if (user.role === 'CLIENT') {
    where.clientId = user.id;
  } else if (user.role === 'AGENT') {
    if (query.mine) {
      where.agentId = user.id;
    } else {
      where.OR = [
        { agentId: user.id },
        { participants: { some: { userId: user.id } } },
        ...(user.sectorId
          ? [
              {
                sectorId: user.sectorId,
                agentId: null,
                requestedAgentId: null,
                status: 'WAITING',
              },
              {
                sectorId: user.sectorId,
                agentId: null,
                requestedAgentId: user.id,
                status: 'WAITING',
              },
            ]
          : []),
      ];
    }

    const agentVisibleStatuses = ['WAITING', 'IN_PROGRESS'];
    if (query.status && !agentVisibleStatuses.includes(query.status)) {
      return [];
    }
    where.status = query.status ?? { in: agentVisibleStatuses };
  }

  if (query.status && user.role !== 'AGENT') where.status = query.status;
  if (query.priority) where.priority = query.priority;
  if (query.sectorId) where.sectorId = query.sectorId;

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
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
      participants: {
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      },
      _count: { select: { messages: true } },
    },
  });

  return tickets;
}

// ==========================
// BUSCAR POR ID
// ==========================
export async function getTicketById(user: AuthUser, id: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
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
      transfers: {
        orderBy: { createdAt: 'desc' },
        include: {
          fromUser: { select: { id: true, name: true, role: true } },
          toUser: { select: { id: true, name: true, role: true } },
          toSector: { select: { id: true, name: true, slug: true } },
        },
      },
      participants: {
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
          addedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!ticket) throw new AppError('Ticket não encontrado', 404);

  await assertTicketAccess(user, ticket);

  return ticket;
}

// ==========================
// ASSUMIR
// ==========================
export async function assignTicket(user: AuthUser, id: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) throw new AppError('Ticket não encontrado', 404);

  if (!canAssignTicket(user, ticket)) {
    if (user.role === 'AGENT' && ticket.agentId !== null) {
      throw new AppError('Este ticket já foi assumido', 409);
    }
    throw new AppError('Você só pode assumir tickets disponíveis no seu setor', 403);
  }

  if (user.role === 'AGENT') {
    const sectorId = user.sectorId;
    if (!sectorId) {
      throw new AppError('Seu usuário não está vinculado a um setor', 403);
    }

    const claim = await prisma.ticket.updateMany({
      where: {
        id,
        agentId: null,
        status: 'WAITING',
        sectorId,
        requestedAgentId: ticket.requestedAgentId,
      },
      data: { agentId: user.id, status: 'IN_PROGRESS' },
    });
    if (claim.count === 0) {
      throw new AppError('Este ticket já foi assumido ou não está mais disponível', 409);
    }
  } else {
    await prisma.ticket.update({
      where: { id },
      data: { agentId: user.id, status: 'IN_PROGRESS' },
    });
  }

  const updated = await prisma.ticket.findUniqueOrThrow({
    where: { id },
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

  await prisma.conversation.updateMany({
    where: { ticketId: id },
    data: { state: 'IN_ATTENDANCE' },
  });

  await removeUnauthorizedTicketRoomMembers(id);
  emitToSector(ticket.sectorId, 'ticket:assigned', { id: updated.id });
  emitToUser(user.id, 'ticket:assigned', updated);

  return updated;
}

// ==========================
// ATUALIZAR STATUS
// ==========================
export async function updateStatus(user: AuthUser, id: string, data: UpdateStatusInput) {
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) throw new AppError('Ticket não encontrado', 404);

  // Permite agent, ADMIN, ou participante
  const isParticipant = await prisma.ticketParticipant.findUnique({
    where: { ticketId_userId: { ticketId: id, userId: user.id } },
  });

  if (!canModifyTicket(user, ticket) && !isParticipant) {
    throw new AppError('Sem permissão para alterar este ticket', 403);
  }

  const updated = await prisma.ticket.update({
    where: { id },
    data: {
      status: data.status,
      closedAt:
        data.status === 'CLOSED' || data.status === 'RESOLVED'
          ? new Date()
          : null,
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

  if (data.status === 'CLOSED' || data.status === 'RESOLVED') {
    await prisma.conversation.updateMany({
      where: { ticketId: id },
      data: { state: 'CLOSED' },
    });
  }

  emitToSector(ticket.sectorId, 'ticket:updated', { id: updated.id });
  emitToTicket(id, 'ticket:updated', updated);

  return updated;
}

// ==========================
// ATUALIZAR PRIORIDADE
// ==========================
export async function updatePriority(user: AuthUser, id: string, data: UpdatePriorityInput) {
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) throw new AppError('Ticket não encontrado', 404);

  const isParticipant = await prisma.ticketParticipant.findUnique({
    where: { ticketId_userId: { ticketId: id, userId: user.id } },
  });

  if (!canModifyTicket(user, ticket) && !isParticipant) {
    throw new AppError('Sem permissão para alterar este ticket', 403);
  }

  const updated = await prisma.ticket.update({
    where: { id },
    data: { priority: data.priority },
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

  emitToSector(ticket.sectorId, 'ticket:updated', { id: updated.id });
  emitToTicket(id, 'ticket:updated', updated);

  return updated;
}

// ==========================
// ADICIONAR PARTICIPANTE
// ==========================
export async function addParticipant(
  user: AuthUser,
  ticketId: string,
  participantUserId: string
) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new AppError('Ticket não encontrado', 404);

  if (ticket.agentId !== user.id && user.role !== 'ADMIN') {
    throw new AppError('Apenas o atendente responsável pode adicionar', 403);
  }

  if (participantUserId === user.id) {
    throw new AppError('Você já é o atendente principal', 400);
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: participantUserId },
    select: { id: true, name: true, role: true, active: true },
  });

  if (!targetUser) throw new AppError('Usuário não encontrado', 404);
  if (!targetUser.active) throw new AppError('Usuário inativo', 400);
  if (targetUser.role !== 'AGENT' && targetUser.role !== 'ADMIN') {
    throw new AppError('Apenas atendentes podem ser adicionados', 400);
  }

  const existing = await prisma.ticketParticipant.findUnique({
    where: { ticketId_userId: { ticketId, userId: participantUserId } },
  });
  if (existing) throw new AppError('Este usuário já está participando', 409);

  const participant = await prisma.ticketParticipant.create({
    data: { ticketId, userId: participantUserId, addedById: user.id },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      addedBy: { select: { id: true, name: true } },
    },
  });

  // 🔥 Emite pra quem foi adicionado
  emitToUser(participantUserId, 'ticket:participant-added', {
    ticketId,
    participant,
  });

  // 🔥 Emite pra sala do ticket
  emitToTicket(ticketId, 'ticket:participant-added', participant);

  // 🔥 IMPORTANTE: força o participante a recarregar a lista (via ticket:new)
  const fullTicket = await prisma.ticket.findUnique({
    where: { id: ticketId },
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
      participants: {
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      },
    },
  });

  if (fullTicket) {
    emitToUser(participantUserId, 'ticket:new', fullTicket);
  }

  // 🔥 Emite pro setor
  emitToSector(ticket.sectorId, 'ticket:updated', { id: ticket.id });

  return participant;
}

// ==========================
// REMOVER PARTICIPANTE
// ==========================
export async function removeParticipant(
  user: AuthUser,
  ticketId: string,
  participantUserId: string
) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new AppError('Ticket não encontrado', 404);

  if (ticket.agentId !== user.id && user.role !== 'ADMIN') {
    throw new AppError('Apenas o atendente responsável pode remover', 403);
  }

  const participant = await prisma.ticketParticipant.findUnique({
    where: { ticketId_userId: { ticketId, userId: participantUserId } },
  });

  if (!participant) throw new AppError('Participante não encontrado', 404);

  await prisma.ticketParticipant.delete({ where: { id: participant.id } });

  await removeUnauthorizedTicketRoomMembers(ticketId);
  emitToUser(participantUserId, 'ticket:participant-removed', { ticketId });
  emitToTicket(ticketId, 'ticket:participant-removed', {
    ticketId,
    userId: participantUserId,
  });
  emitToSector(ticket.sectorId, 'ticket:updated', { id: ticket.id });

  return { ok: true };
}

// ==========================
// LISTAR PARTICIPANTES
// ==========================
export async function listParticipants(user: AuthUser, ticketId: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new AppError('Ticket não encontrado', 404);
  await assertTicketAccess(user, ticket);

  const participants = await prisma.ticketParticipant.findMany({
    where: { ticketId },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      addedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return participants;
}