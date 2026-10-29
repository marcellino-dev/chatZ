import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { emitToSector, emitToUser } from '../../sockets/socket.server';
import type {
  CreateContactInput,
  UpdateContactInput,
} from './contact.schemas';

interface AuthUser {
  id: string;
  role: string;
  sectorId?: string | null;
}

const ticketInclude = {
  sector: { select: { id: true, name: true, slug: true } },
  client: { select: { id: true, name: true, phone: true, role: true } },
  agent: { select: { id: true, name: true, email: true, role: true } },
  requestedAgent: { select: { id: true, name: true, email: true, role: true } },
} satisfies Prisma.TicketInclude;

const contactSelect = {
  id: true,
  name: true,
  phone: true,
  company: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ContactSelect;

const brazilianAreaCodes = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19',
  '21', '22', '24', '27', '28',
  '31', '32', '33', '34', '35', '37', '38',
  '41', '42', '43', '44', '45', '46', '47', '48', '49',
  '51', '53', '54', '55', '61', '62', '63', '64', '65', '66', '67',
  '68', '69', '71', '73', '74', '75', '77', '79',
  '81', '82', '83', '84', '85', '86', '87', '88', '89',
  '91', '92', '93', '94', '95', '96', '97', '98', '99',
]);

function normalizePhone(phone: string): string {
  const normalized = phone.replace(/\D/g, '');
  const brazilianNumber = toBrazilianPhone(normalized);

  if (!brazilianNumber) {
    throw new AppError(
      'Informe um telefone brasileiro com DDD: 10 ou 11 dígitos, com ou sem o código 55'
    );
  }

  return brazilianNumber;
}

function toBrazilianPhone(digits: string): string | null {
  let nationalNumber: string;

  if (digits.length === 10 || digits.length === 11) {
    nationalNumber = digits;
  } else if (
    (digits.length === 12 || digits.length === 13) &&
    digits.startsWith('55')
  ) {
    nationalNumber = digits.slice(2);
  } else {
    return null;
  }

  const areaCode = nationalNumber.slice(0, 2);
  const subscriberNumber = nationalNumber.slice(2);
  const validSubscriber =
    (subscriberNumber.length === 8 && /^[2-5]/.test(subscriberNumber)) ||
    (subscriberNumber.length === 9 && subscriberNumber.startsWith('9'));

  if (!brazilianAreaCodes.has(areaCode) || !validSubscriber) return null;
  return `55${nationalNumber}`;
}

function handleDuplicatePhone(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new AppError('Já existe um contato com esse telefone', 409);
  }

  throw error;
}

export async function listContacts(query?: string) {
  const search = query?.trim();
  const normalizedSearch = search?.replace(/\D/g, '');
  const contacts = await prisma.contact.findMany({
    select: contactSelect,
    where: search
      ? {
          OR: [
            { name: { contains: search } },
            { company: { contains: search } },
            ...(normalizedSearch ? [{ normalizedPhone: { contains: normalizedSearch } }] : []),
          ],
        }
      : undefined,
    orderBy: { name: 'asc' },
  });

  return contacts;
}

export async function createContact(data: CreateContactInput) {
  try {
    return await prisma.contact.create({
      select: contactSelect,
      data: {
        name: data.name,
        phone: data.phone,
        normalizedPhone: normalizePhone(data.phone),
        company: data.company,
      },
    });
  } catch (error) {
    handleDuplicatePhone(error);
  }
}

export async function updateContact(id: string, data: UpdateContactInput) {
  const existing = await prisma.contact.findUnique({ where: { id } });
  if (!existing) throw new AppError('Contato não encontrado', 404);

  try {
    return await prisma.contact.update({
      select: contactSelect,
      where: { id },
      data: {
        ...data,
        ...(data.phone ? { normalizedPhone: normalizePhone(data.phone) } : {}),
      },
    });
  } catch (error) {
    handleDuplicatePhone(error);
  }
}

export async function deleteContact(id: string) {
  const existing = await prisma.contact.findUnique({ where: { id } });
  if (!existing) throw new AppError('Contato não encontrado', 404);

  await prisma.contact.delete({ where: { id } });
  return { message: 'Contato excluído com sucesso' };
}

export async function startConversation(
  user: AuthUser,
  contactId: string,
  requestedSectorId?: string
) {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
  });
  if (!contact) throw new AppError('Contato não encontrado', 404);

  let sectorId = requestedSectorId;
  if (user.role === 'AGENT') {
    if (!user.sectorId) {
      throw new AppError('Seu usuário não está vinculado a um setor', 400);
    }
    if (sectorId && sectorId !== user.sectorId) {
      throw new AppError('Você só pode iniciar conversas no seu setor', 403);
    }
    sectorId = user.sectorId;
  }
  if (!sectorId) throw new AppError('Setor obrigatório', 400);

  const sector = await prisma.sector.findUnique({ where: { id: sectorId } });
  if (!sector || !sector.active) {
    throw new AppError('Setor não encontrado ou inativo', 404);
  }

  const usersWithPhone = await prisma.user.findMany({
    where: { phone: { not: null } },
    select: { id: true, name: true, phone: true, role: true },
  });
  let client = usersWithPhone.find(
    (candidate) =>
      candidate.phone !== null &&
      toBrazilianPhone(candidate.phone.replace(/\D/g, '')) ===
        contact.normalizedPhone
  );

  if (client && client.role !== 'CLIENT') {
    throw new AppError('Esse telefone já está associado a um usuário da equipe', 409);
  }

  if (!client) {
    try {
      client = await prisma.user.create({
        data: {
          name: contact.name,
          phone: contact.normalizedPhone,
          role: 'CLIENT',
        },
        select: { id: true, name: true, phone: true, role: true },
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }

      const conflictingUser = await prisma.user.findUnique({
        where: { phone: contact.normalizedPhone },
        select: { id: true, name: true, phone: true, role: true },
      });
      if (!conflictingUser || conflictingUser.role !== 'CLIENT') {
        throw new AppError('Esse telefone já está associado a outro usuário', 409);
      }
      client = conflictingUser;
    }
  }

  const activeStatuses = ['WAITING', 'IN_PROGRESS', 'TRANSFERRED'] as const;
  const conversation = await prisma.conversation.findUnique({
    where: { phone: contact.normalizedPhone },
    include: { ticket: true },
  });
  let ticket =
    conversation?.ticket &&
    conversation.ticket.clientId === client.id &&
    activeStatuses.includes(conversation.ticket.status as (typeof activeStatuses)[number])
      ? conversation.ticket
      : await prisma.ticket.findFirst({
          where: { clientId: client.id, status: { in: [...activeStatuses] } },
          orderBy: { updatedAt: 'desc' },
        });

  if (ticket) {
    if (ticket.sectorId !== sectorId) {
      throw new AppError('Esse contato já possui atendimento aberto em outro setor', 409);
    }

    const isParticipant = await prisma.ticketParticipant.findUnique({
      where: { ticketId_userId: { ticketId: ticket.id, userId: user.id } },
    });
    if (
      user.role !== 'ADMIN' &&
      ticket.agentId !== user.id &&
      ticket.agentId !== null &&
      !isParticipant
    ) {
      throw new AppError('Esse contato já possui outro atendimento em aberto', 409);
    }

    if (ticket.agentId === null) {
      ticket = await prisma.ticket.update({
        where: { id: ticket.id },
        data: { agentId: user.id, status: 'IN_PROGRESS' },
      });
      emitToSector(ticket.sectorId, 'ticket:assigned', ticket);
      emitToUser(user.id, 'ticket:assigned', ticket);
    }

    await prisma.conversation.upsert({
      where: { phone: contact.normalizedPhone },
      create: {
        phone: contact.normalizedPhone,
        state: 'IN_ATTENDANCE',
        sectorId: ticket.sectorId,
        ticketId: ticket.id,
      },
      update: {
        state: 'IN_ATTENDANCE',
        sectorId: ticket.sectorId,
        ticketId: ticket.id,
      },
    });

    return prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
      include: ticketInclude,
    });
  }

  const createdTicket = await prisma.$transaction(async (transaction) => {
    const newTicket = await transaction.ticket.create({
      data: {
        subject: `Atendimento direto - ${contact.name}`,
        priority: 'MEDIUM',
        status: 'IN_PROGRESS',
        channel: 'WHATSAPP',
        sectorId,
        clientId: client.id,
        agentId: user.id,
      },
    });

    await transaction.conversation.upsert({
      where: { phone: contact.normalizedPhone },
      create: {
        phone: contact.normalizedPhone,
        state: 'IN_ATTENDANCE',
        sectorId,
        ticketId: newTicket.id,
      },
      update: {
        state: 'IN_ATTENDANCE',
        sectorId,
        ticketId: newTicket.id,
      },
    });

    return transaction.ticket.findUniqueOrThrow({
      where: { id: newTicket.id },
      include: ticketInclude,
    });
  });

  emitToSector(sectorId, 'ticket:new', createdTicket);
  emitToUser(user.id, 'ticket:new', createdTicket);

  return createdTicket;
}
