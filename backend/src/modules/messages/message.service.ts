import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import {
  emitToTicket,
  emitToSector,
  emitToUser,
} from '../../sockets/socket.server';
import {
  sendWhatsAppMessage,
  sendWhatsAppMedia,
} from '../whatsapp/whatsapp.service';
import { env } from '../../config/env';
import { SendMessageInput } from './message.schemas';

interface AuthUser {
  id: string;
  role: string;
  sectorId?: string | null;
}

// ==========================
// LISTAR MENSAGENS
// ==========================
export async function listMessages(user: AuthUser, ticketId: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new AppError('Ticket não encontrado', 404);

  if (user.role === 'CLIENT' && ticket.clientId !== user.id) {
    throw new AppError('Sem permissão', 403);
  }
  if (
    user.role === 'AGENT' &&
    user.sectorId &&
    ticket.sectorId !== user.sectorId &&
    ticket.agentId !== user.id
  ) {
    // Verifica se é participante
    const isParticipant = await prisma.ticketParticipant.findUnique({
      where: { ticketId_userId: { ticketId, userId: user.id } },
    });
    if (!isParticipant) {
      throw new AppError('Sem permissão', 403);
    }
  }

  const messages = await prisma.message.findMany({
    where: { ticketId },
    orderBy: { createdAt: 'asc' },
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
      agent: { select: { id: true, name: true, email: true, role: true } },
      sector: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!ticket) throw new AppError('Ticket não encontrado', 404);

  if (user.role === 'CLIENT' && ticket.clientId !== user.id) {
    throw new AppError('Sem permissão', 403);
  }

  // Permite AGENT se for o agent OU participante
  if (user.role === 'AGENT' && ticket.agentId !== user.id) {
    const isParticipant = await prisma.ticketParticipant.findUnique({
      where: { ticketId_userId: { ticketId, userId: user.id } },
    });
    if (!isParticipant) {
      throw new AppError(
        'Você não é o atendente nem participante deste ticket',
        403
      );
    }
  }

  const message = await prisma.message.create({
    data: {
      content: data.content ?? '',
      ticketId,
      senderId: user.id,
      ...(data.attachment && { attachment: data.attachment as any }),
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

  // 🔥 Emite pra sala do ticket (quem tá com ele aberto)
  emitToTicket(ticketId, 'message:new', message);

  // 🔥 Emite pro setor (atualiza lista)
  emitToSector(ticket.sectorId, 'ticket:updated', ticket);

  // 🔥 Emite pra cada participante (menos o próprio sender)
  const participants = await prisma.ticketParticipant.findMany({
    where: { ticketId },
    select: { userId: true },
  });

  for (const p of participants) {
    if (p.userId !== user.id) {
      emitToUser(p.userId, 'message:new', message);
    }
  }

  // 🔥 Se quem mandou não é o agent, emite pro agent também
  if (ticket.agentId && ticket.agentId !== user.id) {
    emitToUser(ticket.agentId, 'message:new', message);
  }

  // 📱 WhatsApp (só do atendente/participante pro cliente)
  if (user.role !== 'CLIENT' && ticket.client.phone) {
    try {
      const baseUrl = env.BASE_URL.replace(/\/$/, '');
      const phone = ticket.client.phone;
      const senderName = message.sender.name;

      const formatWithName = (text: string) => {
        return text ? `*${senderName}:*\n${text}` : `*${senderName}:*`;
      };

      if (data.attachment) {
        const fullUrl = `${baseUrl}${data.attachment.url}`;

        if (data.attachment.type === 'audio') {
          await sendWhatsAppMessage({
            phone,
            text: formatWithName(data.content?.trim() || 'Enviou um áudio'),
          });
        }

        await sendWhatsAppMedia({
          phone,
          url: fullUrl,
          mimetype: data.attachment.mimetype,
          filename: data.attachment.originalName,
          caption: formatWithName(data.content?.trim() || ''),
        });
      } else if (data.content?.trim()) {
        await sendWhatsAppMessage({
          phone,
          text: formatWithName(data.content),
        });
      }
    } catch (err) {
      console.error('⚠️ Erro ao enviar pro WhatsApp:', err);
    }
  }

  return message;
}