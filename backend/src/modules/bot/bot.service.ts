import { prisma } from '../../config/prisma';
import * as msg from './bot.messages';

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

    // Garante que o User cliente existe
    await ensureClientUser(phone);

    return {
      reply: await buildSectorMenu(),
    };
  }

  // Roteia conforme estado
  switch (conversation.state) {
    case 'WAITING_SECTOR':
      return handleSectorChoice(conversation, message);

    case 'WAITING_AGENT':
      return handleAgentChoice(conversation, message);

    case 'WAITING_ATTENDANCE':
      // Cliente mandou msg enquanto aguardava atendente
      return {
        reply: msg.messages.alreadyInAttendance,
      };

    case 'IN_ATTENDANCE':
      return handleInAttendance(conversation, message);

    default:
      return {
        reply: msg.messages.greeting + '\n\n' + (await buildSectorMenu()),
      };
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

  // Busca atendentes ativos do setor
  const agents = await prisma.user.findMany({
    where: {
      role: 'AGENT',
      active: true,
      sectorId: chosenSector.id,
    },
    orderBy: { name: 'asc' },
  });

  // Atualiza Conversation
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
      reply:
        msg.messages.backToMenu + '\n\n' + (await buildSectorMenu()),
    };
  }

  if (!conversation.sectorId) {
    // Estado inconsistente — reseta
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
  });

  // Atualiza Conversation
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      state: 'WAITING_ATTENDANCE',
      ticketId: ticket.id,
    },
  });

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
    // Estado inconsistente
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { state: 'WAITING_SECTOR' },
    });
    return { reply: await buildSectorMenu() };
  }

  // Busca o ticket + cliente
  const ticket = await prisma.ticket.findUnique({
    where: { id: conversation.ticketId },
    include: { client: true },
  });

  if (!ticket) {
    // Ticket sumiu — reseta
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { state: 'WAITING_SECTOR', ticketId: null, sectorId: null },
    });
    return { reply: await buildSectorMenu() };
  }

  // Salva mensagem no ticket
  await prisma.message.create({
    data: {
      content: message,
      ticketId: ticket.id,
      senderId: ticket.clientId,
      channel: 'WHATSAPP',
    },
  });

  // Atendente já assumiu? Se sim, avisa que vai responder
  // (futuro: enviar via Socket.IO pro atendente)
  if (ticket.agentId) {
    return {
      reply: '', // não responde (atendente humano vai responder)
    };
  }

  return {
    reply: msg.messages.alreadyInAttendance,
  };
}

// ==========================
// HELPERS
// ==========================
function normalizePhone(phone: string): string {
  // Remove tudo que não for dígito
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