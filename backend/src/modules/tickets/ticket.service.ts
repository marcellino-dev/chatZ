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
  canViewTicket,
} from './ticket.permissions';
import {
  emitToSector,
  emitToUser,
  emitToTicket,
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
      client: { select: { id: true, name: true, phone: true, role: true } },
      requestedAgent: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  emitToSector(ticket.sectorId, 'ticket:new', ticket);
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
      if (user.sectorId) where.sectorId = user.sectorId;
      where.OR = [{ agentId: null }, { agentId: user.id }];
    }
  }

  if (query.status) where.status = query.status;
  if (query.priority) where.priority = query.priority;
  if (query.sectorId) where.sectorId = query.sectorId;

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    include: {
      sector: { select: { id: true, name: true, slug: true } },
      client: { select: { id: true, name: true, phone: true, role: true } },
      agent: { select: { id: true, name: true, email: true, role: true } },
      requestedAgent: { select: { id: true, name: true, email: true, role: true } },
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
      client: { select: { id: true, name: true, phone: true, role: true } },
      agent: { select: { id: true, name: true, email: true, role: true } },
      requestedAgent: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  if (!ticket) throw new AppError('Ticket não encontrado', 404);
  if (!canViewTicket(user, ticket))
    throw new AppError('Sem permissão para ver este ticket', 403);

  return ticket;
}

// ==========================
// ASSUMIR
// ==========================
export async function assignTicket(user: AuthUser, id: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) throw new AppError('Ticket não encontrado', 404);

  if (user.role === 'AGENT' && user.sectorId && ticket.sectorId !== user.sectorId) {
    throw new AppError('Você só pode assumir tickets do seu setor', 403);
  }

  if (!canAssignTicket(user, ticket)) {
    throw new AppError('Não é possível assumir este ticket', 403);
  }

  const updated = await prisma.ticket.update({
    where: { id },
    data: {
      agentId: user.id,
      status: 'IN_PROGRESS',
    },
    include: {
      sector: { select: { id: true, name: true, slug: true } },
      client: { select: { id: true, name: true, phone: true, role: true } },
      agent: { select: { id: true, name: true, email: true, role: true } },
      requestedAgent: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  // 🔥 CORREÇÃO: atualiza a Conversation pra IN_ATTENDANCE
  // Assim o bot sabe que já pode salvar mensagens do cliente
  await prisma.conversation.updateMany({
    where: { ticketId: id },
    data: { state: 'IN_ATTENDANCE' },
  });

  emitToSector(ticket.sectorId, 'ticket:assigned', updated);
  emitToUser(user.id, 'ticket:assigned', updated);

  return updated;
}

// ==========================
// ATUALIZAR STATUS
// ==========================
export async function updateStatus(
  user: AuthUser,
  id: string,
  data: UpdateStatusInput
) {
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) throw new AppError('Ticket não encontrado', 404);
  if (!canModifyTicket(user, ticket))
    throw new AppError('Sem permissão para alterar este ticket', 403);

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
      client: { select: { id: true, name: true, phone: true, role: true } },
      agent: { select: { id: true, name: true, email: true, role: true } },
      requestedAgent: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  // 🔥 Se o ticket foi fechado/resolvido, fecha a Conversation também
  if (data.status === 'CLOSED' || data.status === 'RESOLVED') {
    await prisma.conversation.updateMany({
      where: { ticketId: id },
      data: { state: 'CLOSED' },
    });
  }

  emitToSector(ticket.sectorId, 'ticket:updated', updated);
  emitToTicket(id, 'ticket:updated', updated);

  return updated;
}

// ==========================
// ATUALIZAR PRIORIDADE
// ==========================
export async function updatePriority(
  user: AuthUser,
  id: string,
  data: UpdatePriorityInput
) {
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) throw new AppError('Ticket não encontrado', 404);
  if (!canModifyTicket(user, ticket))
    throw new AppError('Sem permissão para alterar este ticket', 403);

  const updated = await prisma.ticket.update({
    where: { id },
    data: { priority: data.priority },
    include: {
      sector: { select: { id: true, name: true, slug: true } },
      client: { select: { id: true, name: true, phone: true, role: true } },
      agent: { select: { id: true, name: true, email: true, role: true } },
      requestedAgent: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  emitToSector(ticket.sectorId, 'ticket:updated', updated);
  emitToTicket(id, 'ticket:updated', updated);

  return updated;
}