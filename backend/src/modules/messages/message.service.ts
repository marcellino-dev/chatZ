import fs from 'fs/promises';
import path from 'path';
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
  sendWhatsAppSticker,
} from '../whatsapp/whatsapp.service';
import { env } from '../../config/env';
import { uploadsDir } from '../uploads/upload.service';
import { SendMessageInput } from './message.schemas';
import { assertTicketAccess } from '../tickets/ticket.access';

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

  await assertTicketAccess(user, ticket);

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

  const participants = await prisma.ticketParticipant.findMany({
    where: { ticketId },
    select: { userId: true },
  });

  emitToTicket(ticketId, 'message:new', message);
  emitToSector(ticket.sectorId, 'ticket:updated', { id: ticket.id });

  for (const participant of participants) {
    if (participant.userId !== user.id) {
      emitToUser(participant.userId, 'message:new', message);
    }
  }
  if (ticket.agentId && ticket.agentId !== user.id) {
    emitToUser(ticket.agentId, 'message:new', message);
  }

  let deliveryWarning: string | undefined;
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
        const stickerFile = data.attachment.sticker
          ? await readStickerFile(data.attachment.filename, data.attachment.url)
          : undefined;

        if (data.attachment.type === 'audio') {
          await sendWhatsAppMessage({
            phone,
            text: formatWithName(data.content?.trim() || 'Enviou um áudio'),
          });
        }

        if (data.attachment.sticker && stickerFile) {
          await sendWhatsAppSticker({
            phone,
            mimetype: data.attachment.mimetype,
            file: stickerFile,
          });
        } else {
          await sendWhatsAppMedia({
            phone,
            url: fullUrl,
            mimetype: data.attachment.mimetype,
            filename: data.attachment.filename,
            caption: data.attachment.sticker
              ? ''
              : formatWithName(data.content?.trim() || ''),
            ...(stickerFile && { file: stickerFile }),
          });
        }
      } else if (data.content?.trim()) {
        await sendWhatsAppMessage({
          phone,
          text: formatWithName(data.content),
        });
      }
    } catch (err) {
      console.error('⚠️ Erro ao enviar pro WhatsApp:', err);
      deliveryWarning =
        'Mensagem registrada no chat, mas não foi possível enviá-la ao WhatsApp. Verifique a conexão da instância.';
    }
  }

  return deliveryWarning ? { ...message, deliveryWarning } : message;
}

async function readStickerFile(filename: string, url: string): Promise<Buffer> {
  const safeFilename = path.basename(filename);
  if (
    safeFilename !== filename ||
    url !== `/uploads/${safeFilename}` ||
    !/^[a-zA-Z0-9._-]+$/.test(safeFilename)
  ) {
    throw new AppError('Arquivo da figurinha inválido', 400);
  }

  try {
    return await fs.readFile(path.join(uploadsDir, safeFilename));
  } catch {
    throw new AppError('Arquivo da figurinha não está disponível', 400);
  }
}