import { prisma } from '../../config/prisma';
import * as msg from './bot.messages';
import { emitToSector, emitToUser, emitToTicket } from '../../sockets/socket.server';
import { sendWhatsAppMessage } from '../whatsapp/whatsapp.service';
import {
  findClientUsersByPhone,
  findContactByPhone,
  syncContactIdentity,
} from '../contacts/contactIdentity.service';

interface BotInput {
  phone: string;
  message: string;
  attachment?: {
    url: string;
    filename: string;
    originalName: string;
    mimetype: string;
    size: number;
    type: 'image' | 'video' | 'audio' | 'document';
    sticker?: boolean;
  } | null;
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

  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log(`🤖 BOT [${phone}]`);
  console.log(`📩 Recebido: "${message}"`);
  if (input.attachment) {
    console.log(`📎 Anexo: ${input.attachment.originalName} (${input.attachment.type})`);
  }

  let conversation = await prisma.conversation.findUnique({
    where: { phone },
    include: {
      sector: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!conversation) {
    console.log('🆕 Primeira vez — criando Conversation em WAITING_SECTOR');
    console.log('───────────────────────────────────────────────────');

    conversation = await prisma.conversation.create({
      data: { phone, state: 'WAITING_SECTOR' },
      include: {
        sector: { select: { id: true, name: true, slug: true } },
      },
    });

    await ensureClientUser(phone);

    const reply = await buildSectorMenu();
    await sendWhatsAppMessage({ phone, text: reply });

    console.log('═══════════════════════════════════════════════════');
    return { reply };
  }

  console.log(`📍 Estado atual: ${conversation.state}`);
  if (conversation.sector) {
    console.log(`🏢 Setor: ${conversation.sector.name} (${conversation.sector.slug})`);
  }
  if (conversation.ticketId) {
    console.log(`🎫 Ticket: ${conversation.ticketId}`);
  }
  console.log('───────────────────────────────────────────────────');

  // Se tá em atendimento (IN_ATTENDANCE) e chegou mídia → salva sem processar como texto
  if (conversation.state === 'IN_ATTENDANCE' && input.attachment) {
    console.log('➡️  Mídia recebida em atendimento — salvando no ticket');
    return handleInAttendance(conversation, message, input.attachment);
  }

  switch (conversation.state) {
    case 'WAITING_SECTOR': {
      console.log('➡️  Roteando para: handleSectorChoice');
      const result = await handleSectorChoice(conversation, message);
      if (result.reply) {
        await sendWhatsAppMessage({ phone, text: result.reply });
      }
      console.log('═══════════════════════════════════════════════════');
      return result;
    }

    case 'WAITING_AGENT': {
      console.log('➡️  Roteando para: handleAgentChoice');
      const result = await handleAgentChoice(conversation, message);
      if (result.reply) {
        await sendWhatsAppMessage({ phone, text: result.reply });
      }
      console.log('═══════════════════════════════════════════════════');
      return result;
    }

    case 'WAITING_ATTENDANCE': {
      console.log('➡️  Roteando para: WAITING_ATTENDANCE');
      const reply = msg.messages.alreadyInAttendance;
      await sendWhatsAppMessage({ phone, text: reply });
      console.log('═══════════════════════════════════════════════════');
      return { reply };
    }

    case 'IN_ATTENDANCE': {
      console.log('➡️  Roteando para: handleInAttendance');
      const result = await handleInAttendance(conversation, message, input.attachment);
      console.log('═══════════════════════════════════════════════════');
      return result;
    }

    case 'CLOSED':
    default: {
      console.log(`♻️  Estado "${conversation.state}" — resetando para WAITING_SECTOR`);

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          state: 'WAITING_SECTOR',
          sectorId: null,
          ticketId: null,
          context: null,
        },
      });

      console.log('♻️  Conversation resetada. Mostrando menu de setores.');

      const reply = await buildSectorMenu();
      await sendWhatsAppMessage({ phone, text: reply });
      console.log('═══════════════════════════════════════════════════');
      return { reply };
    }
  }
}

// ==========================
// HANDLER: ESCOLHA DE SETOR
// ==========================
async function handleSectorChoice(conversation: any, message: string): Promise<BotReply> {
  const sectors = await prisma.sector.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
  });

  console.log(`📋 Setores disponíveis (${sectors.length}):`);
  sectors.forEach((s, i) => {
    console.log(`   ${i + 1}️⃣ ${s.name} (${s.slug})`);
  });

  const index = parseInt(message) - 1;
  const chosenSector = sectors[index];

  if (!chosenSector) {
    console.log(`❌ Opção inválida: "${message}"`);
    return {
      reply: msg.messages.invalidOption + '\n\n' + (await buildSectorMenu()),
    };
  }

  console.log(`✅ Setor escolhido: ${chosenSector.name}`);

  const agents = await prisma.user.findMany({
    where: { role: 'AGENT', active: true, sectorId: chosenSector.id },
    orderBy: { name: 'asc' },
  });

  console.log(`👥 Atendentes do setor (${agents.length}):`);
  agents.forEach((a, i) => {
    console.log(`   ${i + 1}️⃣ ${a.name}`);
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { state: 'WAITING_AGENT', sectorId: chosenSector.id },
  });

  return { reply: msg.menuAgents(chosenSector, agents) };
}

// ==========================
// HANDLER: ESCOLHA DE ATENDENTE
// ==========================
async function handleAgentChoice(conversation: any, message: string): Promise<BotReply> {
  if (message === '0') {
    console.log('↩️  Voltando ao menu de setores');
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { state: 'WAITING_SECTOR', sectorId: null },
    });
    return {
      reply: msg.messages.backToMenu + '\n\n' + (await buildSectorMenu()),
    };
  }

  if (!conversation.sectorId) {
    console.log('⚠️  Sem sectorId — resetando');
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
    console.log('⚠️  Setor não encontrado — resetando');
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { state: 'WAITING_SECTOR', sectorId: null },
    });
    return { reply: await buildSectorMenu() };
  }

  const agents = await prisma.user.findMany({
    where: { role: 'AGENT', active: true, sectorId: sector.id },
    orderBy: { name: 'asc' },
  });

  console.log(`👥 Atendentes de ${sector.name} (${agents.length}):`);
  agents.forEach((a, i) => {
    console.log(`   ${i + 1}️⃣ ${a.name}`);
  });
  console.log(`   ${agents.length + 1}️⃣ Qualquer um`);

  const index = parseInt(message) - 1;
  const isQualquerUm = index === agents.length;
  const chosenAgent = isQualquerUm ? null : agents[index];

  if (!isQualquerUm && (!chosenAgent || chosenAgent === undefined)) {
    console.log(`❌ Opção inválida: "${message}"`);
    return {
      reply: msg.messages.invalidOption + '\n\n' + msg.menuAgents(sector, agents),
    };
  }

  // ==========================
  // CRIA O TICKET
  // ==========================
  console.log('🎫 Criando ticket...');
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

  console.log(`✅ Ticket criado: ${ticket.id}`);

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { state: 'WAITING_ATTENDANCE', ticketId: ticket.id },
  });

  emitToSector(ticket.sectorId, 'ticket:new', { id: ticket.id });
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
  message: string,
  attachment?: BotInput['attachment']
): Promise<BotReply> {
  if (!conversation.ticketId) {
    console.log('⚠️  IN_ATTENDANCE sem ticketId — resetando');
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
    console.log('⚠️  Ticket não encontrado — resetando');
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { state: 'WAITING_SECTOR', ticketId: null, sectorId: null },
    });
    return { reply: await buildSectorMenu() };
  }

  console.log(`💾 Salvando mensagem no ticket ${ticket.id}`);

  const newMessage = await prisma.message.create({
    data: {
      content: message || '',
      ticketId: ticket.id,
      senderId: ticket.clientId,
      ...(attachment && { attachment: attachment as any }),
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          company: true,
          role: true,
          profilePictureUrl: true,
        },
      },
    },
  });

  console.log(`✅ Mensagem salva (id: ${newMessage.id})`);
  if (attachment) {
    console.log(`   📎 Com anexo: ${attachment.originalName}`);
  }

  emitToTicket(ticket.id, 'message:new', newMessage);

  if (ticket.agentId) {
    console.log('👤 Atendente ativo — não responde (deixa pro humano)');
    return { reply: '' };
  }

  console.log('⏳ Aguardando atendente assumir');
  return { reply: msg.messages.alreadyInAttendance };
}

// ==========================
// HELPERS
// ==========================
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export async function prepareIncomingClient(phone: string) {
  await ensureClientUser(normalizePhone(phone));
}

async function ensureClientUser(phone: string) {
  const contact = await findContactByPhone(phone);
  const clients = await findClientUsersByPhone(phone);
  let user = clients[0] ?? null;

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: contact?.name ?? `Cliente ${phone.slice(-4)}`,
        company: contact?.company ?? null,
        phone,
        role: 'CLIENT',
      },
    });
    console.log(`👤 Cliente criado: ${user.name} (${user.phone})`);
  }

  if (contact) {
    const syncedClients = await syncContactIdentity(contact);
    user = syncedClients.find((client) => client.id === user?.id) ?? user;
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