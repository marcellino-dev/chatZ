import { Prisma, type Ticket } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { emitToSector, emitToUser } from '../../sockets/socket.server';
import { canViewTicket } from '../tickets/ticket.permissions';
import {
  findClientUsersByPhone,
  normalizeBrazilianPhone,
  syncContactIdentity,
} from './contactIdentity.service';
import type {
  CreateContactInput,
  SaveTicketContactInput,
  UpdateContactInput,
} from './contact.schemas';

interface AuthUser {
  id: string;
  role: string;
  sectorId?: string | null;
}

const ticketInclude = {
  sector: { select: { id: true, name: true, slug: true } },
  client: {
    select: {
      id: true,
      name: true,
      phone: true,
      role: true,
      company: true,
      profilePictureUrl: true,
    },
  },
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

const contactFromTicketSelect = {
  id: true,
  name: true,
  phone: true,
  company: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ContactSelect;

function normalizePhone(phone: string): string {
  const brazilianNumber = normalizeBrazilianPhone(phone);
  if (!brazilianNumber) {
    throw new AppError(
      'Informe um telefone brasileiro com DDD: 10 ou 11 dígitos, com ou sem o código 55'
    );
  }

  return brazilianNumber;
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

export async function getContactById(id: string) {
  const contact = await prisma.contact.findUnique({
    where: { id },
    select: contactSelect,
  });
  if (!contact) throw new AppError('Contato não encontrado', 404);
  return contact;
}

export async function getTicketClientContact(user: AuthUser, ticketId: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { client: { select: { phone: true } } },
  });
  if (!ticket) throw new AppError('Ticket não encontrado', 404);
  await assertTicketAccess(user, ticket);
  if (!ticket.client.phone) return null;

  return prisma.contact.findUnique({
    where: { normalizedPhone: normalizePhone(ticket.client.phone) },
    select: contactFromTicketSelect,
  });
}

export async function saveTicketClientAsContact(
  user: AuthUser,
  ticketId: string,
  data: SaveTicketContactInput
) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { client: true },
  });
  if (!ticket) throw new AppError('Ticket não encontrado', 404);
  await assertTicketAccess(user, ticket);
  if (!ticket.client.phone) {
    throw new AppError('O cliente não possui telefone cadastrado', 400);
  }

  const normalizedPhone = normalizePhone(ticket.client.phone);
  const existing = await prisma.contact.findUnique({
    where: { normalizedPhone },
    select: contactFromTicketSelect,
  });
  const name = data.name ?? existing?.name ?? ticket.client.name;
  const company =
    data.company === undefined ? existing?.company ?? null : data.company;

  try {
    const contact = existing
      ? await prisma.contact.update({
          where: { id: existing.id },
          data: { name, company },
          select: contactFromTicketSelect,
        })
      : await prisma.contact.create({
          data: {
            name,
            phone: ticket.client.phone,
            normalizedPhone,
            company,
          },
          select: contactFromTicketSelect,
        });
    await syncContactIdentity(contact);
    return { contact, existing: Boolean(existing) };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const contact = await prisma.contact.findUnique({
        where: { normalizedPhone },
        select: contactFromTicketSelect,
      });
      if (contact) {
        const updatedContact = await prisma.contact.update({
          where: { id: contact.id },
          data: { name, company },
          select: contactFromTicketSelect,
        });
        await syncContactIdentity(updatedContact);
        return { contact: updatedContact, existing: true };
      }
    }
    throw error;
  }
}

async function assertTicketAccess(
  user: AuthUser,
  ticket: Ticket
) {
  if (canViewTicket(user, ticket)) return;
  const participant = await prisma.ticketParticipant.findUnique({
    where: { ticketId_userId: { ticketId: ticket.id, userId: user.id } },
  });
  if (!participant) {
    throw new AppError('Sem permissão para ver este ticket', 403);
  }
}

export async function createContact(data: CreateContactInput) {
  try {
    const contact = await prisma.contact.create({
      select: contactSelect,
      data: {
        name: data.name,
        phone: data.phone,
        normalizedPhone: normalizePhone(data.phone),
        company: data.company,
      },
    });
    await syncContactIdentity(contact);
    return contact;
  } catch (error) {
    handleDuplicatePhone(error);
  }
}

export async function updateContact(id: string, data: UpdateContactInput) {
  const existing = await prisma.contact.findUnique({ where: { id } });
  if (!existing) throw new AppError('Contato não encontrado', 404);

  try {
    const contact = await prisma.contact.update({
      select: contactSelect,
      where: { id },
      data: {
        ...data,
        ...(data.phone ? { normalizedPhone: normalizePhone(data.phone) } : {}),
      },
    });
    await syncContactIdentity(contact, existing.normalizedPhone);
    return contact;
  } catch (error) {
    handleDuplicatePhone(error);
  }
}

export async function deleteContact(id: string) {
  const existing = await prisma.contact.findUnique({ where: { id } });
  if (!existing) throw new AppError('Contato não encontrado', 404);

  await prisma.contact.delete({ where: { id } });
  await syncContactIdentity({
    ...existing,
    name: `Cliente ${existing.phone.replace(/\D/g, '').slice(-4)}`,
    company: null,
  });
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

  const existingClients = await findClientUsersByPhone(contact.normalizedPhone);
  let client = existingClients[0];

  if (client && client.role !== 'CLIENT') {
    throw new AppError('Esse telefone já está associado a um usuário da equipe', 409);
  }

  if (!client) {
    try {
      client = await prisma.user.create({
        data: {
          name: contact.name,
          company: contact.company,
          phone: contact.normalizedPhone,
          role: 'CLIENT',
        },
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
      });
      if (!conflictingUser || conflictingUser.role !== 'CLIENT') {
        throw new AppError('Esse telefone já está associado a outro usuário', 409);
      }
      client = conflictingUser;
    }
  }

  const [syncedClient] = await syncContactIdentity(contact);
  if (syncedClient) client = syncedClient;

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
