import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { sendWhatsAppMessage } from '../whatsapp/whatsapp.service';

type DbClient = typeof prisma | Prisma.TransactionClient;

export async function startAgentTicketSession(
  client: DbClient,
  ticketId: string,
  agentId: string
) {
  const agent = await client.user.findUnique({
    where: { id: agentId },
    select: { role: true },
  });
  if (agent?.role !== 'AGENT') return;

  const activeSession = await client.agentTicketSession.findFirst({
    where: { ticketId, endedAt: null },
  });
  if (activeSession) {
    if (activeSession.agentId === agentId) return;
    await client.agentTicketSession.update({
      where: { id: activeSession.id },
      data: { endedAt: new Date() },
    });
  }

  await client.agentTicketSession.create({ data: { ticketId, agentId } });
}

export async function endAgentTicketSession(
  client: DbClient,
  ticketId: string,
  agentId?: string | null
) {
  if (!agentId) return;
  await client.agentTicketSession.updateMany({
    where: { ticketId, agentId, endedAt: null },
    data: { endedAt: new Date() },
  });
}

export async function requestTicketRating(
  ticket: { id: string; agentId: string | null; channel: string; client: { phone: string | null } },
  closedAt: Date
) {
  if (ticket.channel !== 'WHATSAPP' || !ticket.agentId || !ticket.client.phone) return;

  const existing = await prisma.ticketRating.findUnique({
    where: { ticketId: ticket.id },
  });
  if (existing) return;

  const protocol = crypto.randomBytes(4).toString('hex').toUpperCase();
  try {
    await prisma.ticketRating.create({
      data: {
        ticketId: ticket.id,
        agentId: ticket.agentId,
        protocol,
        requestedAt: closedAt,
      },
    });
  } catch (error) {
    const target =
      error instanceof Prisma.PrismaClientKnownRequestError
        ? error.meta?.target
        : undefined;
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      ((Array.isArray(target) && target.includes('ticketId')) ||
        (typeof target === 'string' && target.includes('ticketId')))
    ) {
      return;
    }
    throw error;
  }

  try {
    await sendWhatsAppMessage({
      phone: ticket.client.phone,
      text: `Como foi seu atendimento? Responda com uma nota de 1 a 5, seguida do protocolo: #${protocol} 5`,
    });
  } catch (error) {
    console.error(`Não foi possível solicitar avaliação do ticket ${ticket.id}:`, error);
  }
}

export async function captureTicketRating(phone: string, message: string) {
  const match = message.trim().match(/^#([A-Fa-f0-9]{8})\s+([1-5])$/);
  if (!match) return null;

  const protocol = match[1].toUpperCase();
  const score = Number(match[2]);
  const rating = await prisma.ticketRating.findUnique({
    where: { protocol },
    include: { ticket: { include: { client: { select: { phone: true } } } } },
  });

  if (!rating || rating.ticket.client.phone?.replace(/\D/g, '') !== phone.replace(/\D/g, '')) {
    return 'Não encontrei uma avaliação pendente para esse protocolo e telefone.';
  }
  if (rating.score !== null) {
    return 'Essa avaliação já foi recebida. Obrigado!';
  }

  const updated = await prisma.ticketRating.updateMany({
    where: { id: rating.id, score: null },
    data: { score, receivedAt: new Date() },
  });
  if (updated.count === 0) return 'Essa avaliação já foi recebida. Obrigado!';
  return 'Obrigado por avaliar nosso atendimento!';
}

export async function getMyPerformance(
  agentId: string,
  from: Date,
  to: Date
) {
  if (from >= to || to.getTime() - from.getTime() > 26 * 60 * 60 * 1000) {
    throw new AppError('Período inválido', 400);
  }

  const [sessions, ratings] = await Promise.all([
    prisma.agentTicketSession.findMany({
      where: { agentId, assignedAt: { gte: from, lt: to } },
      select: { assignedAt: true, endedAt: true },
    }),
    prisma.ticketRating.findMany({
      where: { agentId, receivedAt: { gte: from, lt: to }, score: { not: null } },
      select: { score: true },
    }),
  ]);
  const now = new Date();
  const durations = sessions.map(
    (session) => Math.max(0, (session.endedAt ?? now).getTime() - session.assignedAt.getTime())
  );
  const durationMs = durations.reduce((total, duration) => total + duration, 0);

  return {
    assignmentsStarted: sessions.length,
    averageAssignmentDurationMs: durations.length ? Math.round(durationMs / durations.length) : null,
    ratingsReceived: ratings.length,
    averageRating: ratings.length
      ? Number((ratings.reduce((sum, rating) => sum + (rating.score ?? 0), 0) / ratings.length).toFixed(1))
      : null,
  };
}
