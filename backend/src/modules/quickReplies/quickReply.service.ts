import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import type {
  CreateQuickReplyInput,
  UpdateQuickReplyInput,
} from './quickReply.schemas';

export async function listQuickReplies() {
  return prisma.quickReply.findMany({ orderBy: { title: 'asc' } });
}

export async function createQuickReply(data: CreateQuickReplyInput) {
  return prisma.quickReply.create({ data });
}

export async function updateQuickReply(
  id: string,
  data: UpdateQuickReplyInput
) {
  const existing = await prisma.quickReply.findUnique({ where: { id } });
  if (!existing) throw new AppError('Resposta pronta não encontrada', 404);

  return prisma.quickReply.update({ where: { id }, data });
}

export async function deleteQuickReply(id: string) {
  const existing = await prisma.quickReply.findUnique({ where: { id } });
  if (!existing) throw new AppError('Resposta pronta não encontrada', 404);

  await prisma.quickReply.delete({ where: { id } });
  return { message: 'Resposta pronta excluída com sucesso' };
}
