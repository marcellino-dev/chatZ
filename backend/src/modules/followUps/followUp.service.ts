import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { assertTicketAccess } from '../tickets/ticket.access';
import { canViewTicket } from '../tickets/ticket.permissions';
import type {
  CreateFollowUpInput,
  ListFollowUpsQuery,
  UpdateFollowUpInput,
} from './followUp.schemas';

interface AuthUser {
  id: string;
  role: string;
  sectorId?: string | null;
}

const followUpInclude = {
  ticket: {
    select: {
      id: true,
      subject: true,
      clientId: true,
      agentId: true,
      requestedAgentId: true,
      sectorId: true,
      status: true,
      priority: true,
      client: {
        select: {
          name: true,
          phone: true,
          profilePictureUrl: true,
        },
      },
      agent: { select: { name: true } },
      participants: {
        select: { userId: true },
      },
    },
  },
} as const;

type FollowUpWithTicket = Prisma.FollowUpGetPayload<{
  include: typeof followUpInclude;
}>;

function toResponse(
  { ticket, ...followUp }: FollowUpWithTicket,
  user: AuthUser
) {
  return {
    ...followUp,
    ticket: {
      id: ticket.id,
      subject: ticket.subject,
      status: ticket.status,
      clientName: ticket.client.name,
      clientPhone: ticket.client.phone,
      clientProfilePictureUrl: ticket.client.profilePictureUrl,
      agentName: ticket.agent?.name ?? null,
      priority: ticket.priority,
      canOpen:
        canViewTicket(user, ticket) ||
        ticket.participants.some(({ userId }) => userId === user.id),
    },
  };
}

function assertFutureDate(scheduledAt: Date) {
  if (scheduledAt.getTime() <= Date.now()) {
    throw new AppError('O follow-up deve ser agendado para um horário futuro', 400);
  }
}

async function getOwnedFollowUp(userId: string, id: string) {
  const followUp = await prisma.followUp.findUnique({
    where: { id },
    select: { id: true, creatorId: true, completedAt: true, cancelledAt: true },
  });
  if (!followUp) throw new AppError('Follow-up não encontrado', 404);
  if (followUp.creatorId !== userId) {
    throw new AppError('Você só pode alterar seus próprios follow-ups', 403);
  }
  if (followUp.completedAt || followUp.cancelledAt) {
    throw new AppError('Este follow-up já foi encerrado', 409);
  }
  return followUp;
}

export async function listFollowUps(
  user: AuthUser,
  query: ListFollowUpsQuery
) {
  const followUps = await prisma.followUp.findMany({
    where: {
      creatorId: user.id,
      ...(query.ticketId ? { ticketId: query.ticketId } : {}),
      ...(query.includeClosed === 'true'
        ? {}
        : { completedAt: null, cancelledAt: null }),
    },
    include: followUpInclude,
    orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
  });

  return followUps.map((followUp) => toResponse(followUp, user));
}

export async function countOverdueFollowUps(userId: string) {
  return prisma.followUp.count({
    where: {
      creatorId: userId,
      completedAt: null,
      cancelledAt: null,
      scheduledAt: { lte: new Date() },
    },
  });
}

export async function createFollowUp(
  user: AuthUser,
  data: CreateFollowUpInput
) {
  assertFutureDate(data.scheduledAt);
  const ticket = await prisma.ticket.findUnique({
    where: { id: data.ticketId },
  });
  if (!ticket) throw new AppError('Conversa não encontrada', 404);
  await assertTicketAccess(user, ticket);

  const followUp = await prisma.followUp.create({
    data: {
      ticketId: data.ticketId,
      creatorId: user.id,
      scheduledAt: data.scheduledAt,
      note: data.note || null,
    },
    include: followUpInclude,
  });
  return toResponse(followUp, user);
}

export async function updateFollowUp(
  user: AuthUser,
  id: string,
  data: UpdateFollowUpInput
) {
  await getOwnedFollowUp(user.id, id);
  if (data.scheduledAt) assertFutureDate(data.scheduledAt);

  const result = await prisma.followUp.updateMany({
    where: {
      id,
      creatorId: user.id,
      completedAt: null,
      cancelledAt: null,
    },
    data: {
      ...(data.scheduledAt ? { scheduledAt: data.scheduledAt } : {}),
      ...(data.note !== undefined ? { note: data.note || null } : {}),
    },
  });
  if (result.count !== 1) {
    throw new AppError('Este follow-up já foi encerrado', 409);
  }

  const followUp = await prisma.followUp.findUniqueOrThrow({
    where: { id },
    include: followUpInclude,
  });
  return toResponse(followUp, user);
}

export async function completeFollowUp(user: AuthUser, id: string) {
  await getOwnedFollowUp(user.id, id);
  const result = await prisma.followUp.updateMany({
    where: {
      id,
      creatorId: user.id,
      completedAt: null,
      cancelledAt: null,
    },
    data: { completedAt: new Date() },
  });
  if (result.count !== 1) {
    throw new AppError('Este follow-up já foi encerrado', 409);
  }

  const followUp = await prisma.followUp.findUniqueOrThrow({
    where: { id },
    include: followUpInclude,
  });
  return toResponse(followUp, user);
}

export async function cancelFollowUp(user: AuthUser, id: string) {
  await getOwnedFollowUp(user.id, id);
  const result = await prisma.followUp.updateMany({
    where: {
      id,
      creatorId: user.id,
      completedAt: null,
      cancelledAt: null,
    },
    data: { cancelledAt: new Date() },
  });
  if (result.count !== 1) {
    throw new AppError('Este follow-up já foi encerrado', 409);
  }

  const followUp = await prisma.followUp.findUniqueOrThrow({
    where: { id },
    include: followUpInclude,
  });
  return toResponse(followUp, user);
}
