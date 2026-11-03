import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import type {
  CreateArticleInput,
  ListArticlesInput,
  UpdateArticleInput,
} from './knowledgeBase.schemas';

export async function listArticles(
  role: string,
  query: ListArticlesInput
) {
  const includeArchived = role === 'ADMIN' && query.includeArchived;
  const search = query.q?.trim();
  return prisma.knowledgeArticle.findMany({
    where: {
      ...(!includeArchived && { active: true }),
      ...(search && {
        OR: [
          { title: { contains: search } },
          { category: { contains: search } },
          { content: { contains: search } },
        ],
      }),
    },
    orderBy: [{ category: 'asc' }, { title: 'asc' }],
  });
}

export async function createArticle(data: CreateArticleInput) {
  return prisma.knowledgeArticle.create({ data });
}

export async function updateArticle(id: string, data: UpdateArticleInput) {
  const existing = await prisma.knowledgeArticle.findUnique({ where: { id } });
  if (!existing) throw new AppError('Artigo não encontrado', 404);
  return prisma.knowledgeArticle.update({ where: { id }, data });
}
