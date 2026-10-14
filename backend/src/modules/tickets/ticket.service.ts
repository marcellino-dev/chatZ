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

interface AuthUser {
  id: string;
  role: string;
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
      queue: data.queue ?? 'geral',
      clientId: user.id,
      status: 'WAITING',
    },
    include: {
      client: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });

  return ticket;
}

// ==========================
// LISTAR TICKETS (com filtros)
// ==========================
export async function listTickets(user: AuthUser, query: ListTicketsQuery) {
  const where: any = {};

  // Escopo por role
  if (user.role === 'CLIENT') {
    where.clientId = user.id;
  } else if (user.role === 'AGENT') {
    if (query.mine) {
      where.agentId = user.id;
    } else {
      // Fila + assumidos
      where.OR = [{ agentId: null }, { agentId: user.id }];
    }
  }
  // ADMIN: sem filtro de escopo

  // Filtros opcionais
  if (query.status) where.status = query.status;
  if (query.priority) where.priority = query.priority;
  if (query.queue) where.queue = query.queue;

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: [
      { priority: 'desc' }, // URGENT primeiro
      { createdAt: 'asc' }, // mais antigo primeiro na fila
    ],
    include: {
      client: {
        select: { id: true, name: true, email: true, role: true },
      },
      agent: {
        select: { id: true, name: true, email: true, role: true },
      },
      _count: {
        select: { messages: true },
      },
    },
  });

  return tickets;
}

// ==========================
// BUSCAR TICKET POR ID
// ==========================
export async function getTicketById(user: AuthUser, id: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      client: {
        select: { id: true, name: true, email: true, role: true },
      },
      agent: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });

  if (!ticket) {
    throw new AppError('Ticket não encontrado', 404);
  }

  if (!canViewTicket(user, ticket)) {
    throw new AppError('Sem permissão para ver este ticket', 403);
  }

  return ticket;
}

// ==========================
// ASSUMIR TICKET
// ==========================
export async function assignTicket(user: AuthUser, id: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id } });

  if (!ticket) {
    throw new AppError('Ticket não encontrado', 404);
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
      client: {
        select: { id: true, name: true, email: true, role: true },
      },
      agent: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });

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

  if (!ticket) {
    throw new AppError('Ticket não encontrado', 404);
  }

  if (!canModifyTicket(user, ticket)) {
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
  });

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

  if (!ticket) {
    throw new AppError('Ticket não encontrado', 404);
  }

  if (!canModifyTicket(user, ticket)) {
    throw new AppError('Sem permissão para alterar este ticket', 403);
  }

  const updated = await prisma.ticket.update({
    where: { id },
    data: { priority: data.priority },
  });

  return updated;
}