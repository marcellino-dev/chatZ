import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { emitToTicket, emitToSector } from '../../sockets/socket.server';
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
    throw new AppError('Sem permissão', 403);
  }

  const messages = await prisma.message.findMany({
    where: { ticketId },
    orderBy: { createdAt: 'asc' },
    include: {
      sender: { select: { id: true, name: true, role: true } },
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

  if (user.role === 'CLIENT' && ticket.clientId !== user.id) {
    throw new AppError('Sem permissão', 403);
  }
  if (user.role === 'AGENT' && ticket.agentId !== user.id) {
    throw new AppError(
      'Você só pode enviar mensagens em tickets que você assumiu',
      403
    );
  }

  // 🔥 Cria message — só passa attachment se existir
  const message = await prisma.message.create({
    data: {
      content: data.content ?? '',
      ticketId,
      senderId: user.id,
      ...(data.attachment && { attachment: data.attachment as any }),
    },
    include: {
      sender: { select: { id: true, name: true, role: true } },
    },
  });

  emitToTicket(ticketId, 'message:new', message);
  emitToSector(ticket.sectorId, 'ticket:updated', ticket);

  // 📱 WhatsApp
  if (user.role !== 'CLIENT' && ticket.client.phone) {
    try {
      const baseUrl = env.BASE_URL.replace(/\/$/, '');
      const phone = ticket.client.phone;

      if (data.attachment) {
        const fullUrl = `${baseUrl}${data.attachment.url}`;
        console.log(`📎 Enviando mídia: ${data.attachment.originalName}`);
        console.log(`   🔗 URL: ${fullUrl}`);

        await sendWhatsAppMedia({
          phone,
          url: fullUrl,
          mimetype: data.attachment.mimetype,
          filename: data.attachment.originalName,
          caption: data.content?.trim() || undefined,
        });
      } else if (data.content?.trim()) {
        await sendWhatsAppMessage({
          phone,
          text: data.content,
        });
      }
    } catch (err) {
      console.error('⚠️ Erro ao enviar pro WhatsApp:', err);
    }
  }

  return message;
}