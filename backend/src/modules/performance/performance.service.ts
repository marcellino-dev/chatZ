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
      text: `Como foi seu atendimento? Responda apenas com uma nota de 1 a 5. Se tiver mais de um pedido de avaliação pendente, envie a nota e o protocolo: #${protocol} 5`,
    });
  } catch (error) {
    console.error(`Não foi possível solicitar avaliação do ticket ${ticket.id}:`, error);
  }
}

export async function captureTicketRating(phone: string, message: string) {
  const content = message.trim();
  const match = content.match(/^#([A-Fa-f0-9]{8})\s+([1-5])$/);
  const simpleScore = content.match(/^([1-5])$/);
  if (!match && !simpleScore) return null;

  const normalizedPhone = phone.replace(/\D/g, '');
  let rating:
    | Prisma.TicketRatingGetPayload<{
        include: {
          ticket: {
            include: { client: { select: { phone: true } } };
          };
        };
      }>
    | null;
  let score: number;

  if (match) {
    rating = await prisma.ticketRating.findUnique({
      where: { protocol: match[1].toUpperCase() },
      include: { ticket: { include: { client: { select: { phone: true } } } } },
    });
    score = Number(match[2]);
    if (
      !rating ||
      rating.ticket.client.phone?.replace(/\D/g, '') !== normalizedPhone
    ) {
      return 'Não encontrei uma avaliação pendente para esse protocolo e telefone.';
    }
  } else {
    const pendingRatings = await prisma.ticketRating.findMany({
      where: {
        score: null,
        ticket: { client: { phone: normalizedPhone } },
      },
      orderBy: { requestedAt: 'desc' },
      include: { ticket: { include: { client: { select: { phone: true } } } } },
    });
    if (pendingRatings.length === 0) return null;
    if (pendingRatings.length > 1) {
      return 'Recebi mais de um pedido de avaliação. Envie a nota junto com o protocolo no formato #AB12CD34 5.';
    }
    rating = pendingRatings[0];
    score = Number(content);
  }
  if (!rating || rating.score !== null) {
    return 'Essa avaliação já foi recebida. Obrigado!';
  }

  const updated = await prisma.ticketRating.updateMany({
    where: { id: rating.id, score: null },
    data: { score, receivedAt: new Date() },
  });
  if (updated.count === 0) return 'Essa avaliação já foi recebida. Obrigado!';
  return 'Obrigado por avaliar nosso atendimento! Agradecemos pelo contato e estamos à disposição.';
}

export async function getMyPerformance(
  agentId: string,
  from: Date,
  to: Date
) {
  if (from >= to || to.getTime() - from.getTime() > 32 * 24 * 60 * 60 * 1000) {
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
  const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const rating of ratings) {
    if (rating.score !== null && rating.score >= 1 && rating.score <= 5) {
      ratingDistribution[rating.score as 1 | 2 | 3 | 4 | 5] += 1;
    }
  }

  return {
    assignmentsStarted: sessions.length,
    assignmentsCompleted: sessions.filter((session) => session.endedAt !== null).length,
    activeAssignments: sessions.filter((session) => session.endedAt === null).length,
    totalAssignmentDurationMs: durationMs,
    averageAssignmentDurationMs: durations.length ? Math.round(durationMs / durations.length) : null,
    ratingsReceived: ratings.length,
    averageRating: ratings.length
      ? Number((ratings.reduce((sum, rating) => sum + (rating.score ?? 0), 0) / ratings.length).toFixed(1))
      : null,
    ratingDistribution,
  };
}

function dateKeyInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export async function getMyDailyPerformance(
  agentId: string,
  from: Date,
  to: Date,
  timeZone: string
) {
  if (from >= to || to.getTime() - from.getTime() > 32 * 24 * 60 * 60 * 1000) {
    throw new AppError('Período inválido', 400);
  }

  const sessions = await prisma.agentTicketSession.findMany({
    where: { agentId, assignedAt: { gte: from, lt: to } },
    select: { assignedAt: true, endedAt: true },
  });
  const days = new Map<string, {
    assignmentsStarted: number;
    assignmentsCompleted: number;
    activeAssignments: number;
  }>();

  for (const session of sessions) {
    const key = dateKeyInTimeZone(session.assignedAt, timeZone);
    const day = days.get(key) ?? {
      assignmentsStarted: 0,
      assignmentsCompleted: 0,
      activeAssignments: 0,
    };
    day.assignmentsStarted += 1;
    if (session.endedAt) day.assignmentsCompleted += 1;
    else day.activeAssignments += 1;
    days.set(key, day);
  }

  const startDate = dateKeyInTimeZone(from, timeZone);
  const endDate = dateKeyInTimeZone(new Date(to.getTime() - 1), timeZone);
  const results: Array<{
    date: string;
    assignmentsStarted: number;
    assignmentsCompleted: number;
    activeAssignments: number;
  }> = [];
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const lastDay = new Date(`${endDate}T00:00:00.000Z`);

  while (cursor <= lastDay) {
    const date = cursor.toISOString().slice(0, 10);
    results.push({
      date,
      ...(days.get(date) ?? {
        assignmentsStarted: 0,
        assignmentsCompleted: 0,
        activeAssignments: 0,
      }),
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return results;
}

export async function getMyRecentPerformance(agentId: string, limit: number) {
  const sessions = await prisma.agentTicketSession.findMany({
    where: { agentId },
    orderBy: { assignedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      assignedAt: true,
      endedAt: true,
      ticket: {
        select: {
          subject: true,
          status: true,
          client: { select: { name: true, profilePictureUrl: true } },
        },
      },
    },
  });
  const now = new Date();

  return sessions.map((session) => ({
    id: session.id,
    createdAt: session.assignedAt,
    clientName: session.ticket.client.name,
    clientProfilePictureUrl: session.ticket.client.profilePictureUrl,
    subject: session.ticket.subject,
    durationMs: Math.max(
      0,
      (session.endedAt ?? now).getTime() - session.assignedAt.getTime()
    ),
    status: session.ticket.status,
  }));
}
