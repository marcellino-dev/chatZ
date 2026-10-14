import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { emitToTicket, emitToSector } from '../../sockets/socket.server';
import { SendMessageInput } from './message.schemas';

interface AuthUser {
  id: string;
  role: string;
  sectorId?: string | null;
}

// ==========================
// LISTAR MENSAGENS DE UM TICKET
// ==========================
export async function listMessages(user: AuthUser, ticketId: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
  });

  if (!ticket) throw new AppError('Ticket não encontrado', 404);

  // Permissões
  if (user.role === 'CLIENT' && ticket.clientId !== user.id) {
    throw new AppError('Sem permissão', 403);
  }
  if (
    user.role === 'AGENT' &&
    user.sectorId &&
    ticket.sectorId !== user.sectorId &&
    ticket.agentId !== user.id
  ) {
    throw new AppError('Sem permissão', 403);
  }

  const messages = await prisma.message.findMany({
    where: { ticketId },
    orderBy: { createdAt: 'asc' },
    include: {
      sender: {
        select: { id: true, name: true, role: true },
      },
    },
  });

  // Marca mensagens do cliente como lidas (quando o atendente abre)
  if (user.role !== 'CLIENT') {
    await prisma.message.updateMany({
      where: {
        ticketId,
        read: false,
        sender: { role: 'CLIENT' },
      },
      data: { read: true },
    });
  }

  return messages;
}

// ==========================
// ENVIAR MENSAGEM
// ==========================
export async function sendMessage(
  user: AuthUser,
  ticketId: string,
  data: SendMessageInput
) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      client: { select: { id: true, name: true, phone: true, role: true } },
      agent: { select: { id: true, name: true, email: true, role: true } },
      sector: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!ticket) throw new AppError('Ticket não encontrado', 404);

  // Permissões
  if (user.role === 'CLIENT' && ticket.clientId !== user.id) {
    throw new AppError('Sem permissão', 403);
  }
  if (user.role === 'AGENT' && ticket.agentId !== user.id) {
    throw new AppError(
      'Você só pode enviar mensagens em tickets que você assumiu',
      403
    );
  }

  // Cria a mensagem
  const message = await prisma.message.create({
    data: {
      content: data.content,
      ticketId,
      senderId: user.id,
      channel: ticket.channel,
    },
    include: {
      sender: {
        select: { id: true, name: true, role: true },
      },
    },
  });

  // 🔔 Emite via Socket.IO pra sala do ticket
  emitToTicket(ticketId, 'message:new', message);

  // 🔔 Notifica o setor (pra quem tá com a lista aberta)
  emitToSector(ticket.sectorId, 'ticket:updated', ticket);

  // TODO (futuro): enviar via Evolution API pro WhatsApp
  // if (ticket.channel === 'WHATSAPP') {
  //   await whatsappService.sendMessage(ticket.client.phone, data.content);
  // }

  return message;
}