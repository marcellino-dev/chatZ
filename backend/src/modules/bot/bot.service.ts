import { prisma } from '../../config/prisma';
import * as msg from './bot.messages';
import { emitToSector, emitToUser, emitToTicket } from '../../sockets/socket.server';
import { sendWhatsAppMessage } from '../whatsapp/whatsapp.service';

interface BotInput {
  phone: string;
  message: string;
}

interface BotReply {
  reply: string;
  ticketId?: string;
}

// ==========================
// PROCESSAR MENSAGEM RECEBIDA
// ==========================
export async function processMessage(input: BotInput): Promise<BotReply> {
  const phone = normalizePhone(input.phone);
  const message = input.message.trim();

  // Busca ou cria Conversation
  let conversation = await prisma.conversation.findUnique({
    where: { phone },
  });

  // Primeira vez → cria e mostra setores
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        phone,
        state: 'WAITING_SECTOR',
      },
    });

    await ensureClientUser(phone);

    const reply = await buildSectorMenu();
    await sendWhatsAppMessage({ phone, text: reply });

    return { reply };
  }

  // Roteia conforme estado
  switch (conversation.state) {
    case 'WAITING_SECTOR': {
      const result = await handleSectorChoice(conversation, message);
      if (result.reply) {
        await sendWhatsAppMessage({ phone, text: result.reply });
      }
      return result;
    }

    case 'WAITING_AGENT': {
      const result = await handleAgentChoice(conversation, message);
      if (result.reply) {
        await sendWhatsAppMessage({ phone, text: result.reply });
      }
      return result;
    }

    case 'WAITING_ATTENDANCE': {
      const reply = msg.messages.alreadyInAttendance;
      await sendWhatsAppMessage({ phone, text: reply });
      return { reply };
    }

    case 'IN_ATTENDANCE': {
      // Mensagem do cliente durante atendimento — NÃO responde (atendente humano responde)
      return handleInAttendance(conversation, message);
    }

    default: {
      const reply = msg.messages.greeting + '\n\n' + (await buildSectorMenu());
      await sendWhatsAppMessage({ phone, text: reply });
      return { reply };
    }
  }
}

// ==========================
// HANDLER: ESCOLHA DE SETOR
// ==========================
async function handleSectorChoice(
  conversation: any,
  message: string
): Promise<BotReply> {
  const sectors = await prisma.sector.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
  });

  const index = parseInt(message) - 1;
  const chosenSector = sectors[index];

  if (!chosenSector) {
    return {
      reply: msg.messages.invalidOption + '\n\n' + (await buildSectorMenu()),
    };
  }

  const agents = await prisma.user.findMany({
    where: {
      role: 'AGENT',
      active: true,
      sectorId: chosenSector.id,
    },
    orderBy: { name: 'asc' },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      state: 'WAITING_AGENT',
      sectorId: chosenSector.id,
    },
  });

  return {
    reply: msg.menuAgents(chosenSector, agents),
  };
}

// ==========================
// HANDLER: ESCOLHA DE ATENDENTE
// ==========================
async function handleAgentChoice(
  conversation: any,
  message: string
): Promise<BotReply> {
  // Opção 0 → volta ao menu de setores
  if (message === '0') {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { state: 'WAITING_SECTOR', sectorId: null },
    });

    return {
      reply: msg.messages.backToMenu + '\n\n' + (await buildSectorMenu()),
    };
  }

  if (!conversation.sectorId) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { state: 'WAITING_SECTOR' },
    });
    return { reply: await buildSectorMenu() };
  }

  const sector = await prisma.sector.findUnique({
    where: { id: conversation.sectorId },
  });

  if (!sector) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { state: 'WAITING_SECTOR', sectorId: null },
    });
    return { reply: await buildSectorMenu() };
  }

  const agents = await prisma.user.findMany({
    where: {
      role: 'AGENT',
      active: true,
      sectorId: sector.id,
    },
    orderBy: { name: 'asc' },
  });

  const index = parseInt(message) - 1;
  const isQualquerUm = index === agents.length;
  const chosenAgent = isQualquerUm ? null : agents[index];

  // Opção inválida
  if (!isQualquerUm && (!chosenAgent || chosenAgent === undefined)) {
    return {
      reply:
        msg.messages.invalidOption + '\n\n' + msg.menuAgents(sector, agents),
    };
  }

  // ==========================
  // CRIA O TICKET
  // ==========================
  const client = await ensureClientUser(conversation.phone);

  const now = new Date();
  const subject = `Atendimento WhatsApp - ${now.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })}`;

  const ticket = await prisma.ticket.create({
    data: {
      subject,
      sectorId: sector.id,
      clientId: client.id,
      requestedAgentId: chosenAgent?.id ?? null,
      status: 'WAITING',
      priority: 'MEDIUM',
      channel: 'WHATSAPP',
    },
    include: {
      sector: { select: { id: true, name: true, slug: true } },
      client: { select: { id: true, name: true, phone: true, role: true } },
      requestedAgent: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      state: 'WAITING_ATTENDANCE',
      ticketId: ticket.id,
    },
  });

  // 🔔 Notifica o setor (tempo real no painel)
  emitToSector(ticket.sectorId, 'ticket:new', ticket);

  // 🔔 Notifica o atendente específico (se pedido)
  if (ticket.requestedAgentId) {
    emitToUser(ticket.requestedAgentId, 'ticket:new', ticket);
  }

  return {
    reply: msg.ticketCreated({
      protocol: ticket.id.slice(0, 8),
      sectorName: sector.name,
      agentName: chosenAgent?.name,
    }),
    ticketId: ticket.id,
  };
}

// ==========================
// HANDLER: EM ATENDIMENTO
// ==========================
async function handleInAttendance(
  conversation: any,
  message: string
): Promise<BotReply> {
  if (!conversation.ticketId) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { state: 'WAITING_SECTOR' },
    });
    return { reply: await buildSectorMenu() };
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: conversation.ticketId },
    include: { client: true },
  });

  if (!ticket) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { state: 'WAITING_SECTOR', ticketId: null, sectorId: null },
    });
    return { reply: await buildSectorMenu() };
  }

  // Salva mensagem no ticket
  const newMessage = await prisma.message.create({
    data: {
      content: message,
      ticketId: ticket.id,
      senderId: ticket.clientId,
      channel: 'WHATSAPP',
    },
    include: {
      sender: {
        select: { id: true, name: true, role: true },
      },
    },
  });

  // 🔔 Emite pra sala do ticket (atendente vê em tempo real)
  emitToTicket(ticket.id, 'message:new', newMessage);

  // Atendente já assumiu? Se sim, não responde (atendente humano responde)
  if (ticket.agentId) {
    return { reply: '' };
  }

  return {
    reply: msg.messages.alreadyInAttendance,
  };
}

// ==========================
// HELPERS
// ==========================
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

async function ensureClientUser(phone: string) {
  let user = await prisma.user.findUnique({ where: { phone } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: `Cliente ${phone.slice(-4)}`,
        phone,
        role: 'CLIENT',
      },
    });
  }

  return user;
}

async function buildSectorMenu(): Promise<string> {
  const sectors = await prisma.sector.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
  });

  return msg.menuSectors(sectors);
}