import fs from 'fs/promises';
import crypto from 'crypto';
import path from 'path';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import {
  saveUploadedFile,
  uploadsDir,
} from '../uploads/upload.service';
import type {
  CreateStickerInput,
  SaveIncomingStickerInput,
} from './sticker.schemas';

interface AuthUser {
  id: string;
  role: string;
  sectorId?: string | null;
}

interface StoredAttachment {
  url: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  type: string;
  sticker?: boolean;
}

export async function listStickers(user: AuthUser) {
  return prisma.sticker.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createSticker(
  user: AuthUser,
  data: CreateStickerInput,
  file: Express.Multer.File
) {
  const saved = saveUploadedFile(file);

  try {
    return await prisma.sticker.create({
      data: {
        name: data.name,
        url: saved.url,
        filename: saved.filename,
        mimetype: saved.mimetype,
        size: saved.size,
        userId: user.id,
      },
    });
  } catch (error) {
    await fs.unlink(path.join(uploadsDir, saved.filename)).catch((cleanupError: NodeJS.ErrnoException) => {
      if (cleanupError.code !== 'ENOENT') throw cleanupError;
    });
    throw error;
  }
}

export async function saveIncomingSticker(
  user: AuthUser,
  data: SaveIncomingStickerInput
) {
  const message = await prisma.message.findUnique({
    where: { id: data.messageId },
    include: {
      sender: { select: { role: true } },
      ticket: {
        select: {
          clientId: true,
          sectorId: true,
          agentId: true,
        },
      },
    },
  });

  if (!message) throw new AppError('Mensagem não encontrada', 404);
  if (message.sender.role !== 'CLIENT') {
    throw new AppError('Só é possível favoritar figurinhas enviadas pelo cliente', 400);
  }
  if (user.role !== 'ADMIN' && user.role !== 'AGENT') {
    throw new AppError('Sem permissão', 403);
  }

  if (user.role === 'AGENT') {
    const isParticipant = await prisma.ticketParticipant.findUnique({
      where: {
        ticketId_userId: {
          ticketId: message.ticketId,
          userId: user.id,
        },
      },
    });
    const canAccessTicket =
      message.ticket.agentId === user.id ||
      isParticipant !== null ||
      (message.ticket.agentId === null &&
        message.ticket.sectorId === user.sectorId);

    if (!canAccessTicket) throw new AppError('Sem permissão', 403);
  }

  const attachment = parseStickerAttachment(message.attachment);
  if (!attachment) {
    throw new AppError('A mensagem não contém uma figurinha compatível', 400);
  }

  const existing = await prisma.sticker.findUnique({
    where: {
      userId_sourceMessageId: {
        userId: user.id,
        sourceMessageId: message.id,
      },
    },
  });
  if (existing) return existing;

  const sourceFilename = path.basename(attachment.filename);
  if (
    sourceFilename !== attachment.filename ||
    attachment.url !== `/uploads/${sourceFilename}`
  ) {
    throw new AppError('Arquivo da figurinha inválido', 400);
  }

  const sourcePath = path.join(uploadsDir, sourceFilename);
  const filename = `${crypto.randomUUID()}${path.extname(sourceFilename) || '.webp'}`;
  const destinationPath = path.join(uploadsDir, filename);
  await fs.copyFile(sourcePath, destinationPath);

  try {
    return await prisma.sticker.create({
      data: {
        name: data.name,
        url: `/uploads/${filename}`,
        filename,
        mimetype: attachment.mimetype,
        size: attachment.size,
        userId: user.id,
        sourceMessageId: message.id,
      },
    });
  } catch (error) {
    await fs.unlink(destinationPath).catch((cleanupError: NodeJS.ErrnoException) => {
      if (cleanupError.code !== 'ENOENT') throw cleanupError;
    });
    throw error;
  }
}

export async function deleteSticker(user: AuthUser, id: string) {
  const sticker = await prisma.sticker.findFirst({
    where: { id, userId: user.id },
  });
  if (!sticker) throw new AppError('Figurinha não encontrada', 404);

  await prisma.sticker.delete({ where: { id: sticker.id } });
  return { message: 'Figurinha excluída com sucesso' };
}

function parseStickerAttachment(value: unknown): StoredAttachment | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const attachment = value as Partial<StoredAttachment>;
  if (
    attachment.type !== 'image' ||
    attachment.sticker !== true ||
    typeof attachment.url !== 'string' ||
    typeof attachment.filename !== 'string' ||
    typeof attachment.mimetype !== 'string' ||
    !attachment.mimetype.startsWith('image/') ||
    typeof attachment.size !== 'number'
  ) {
    return null;
  }
  return attachment as StoredAttachment;
}
