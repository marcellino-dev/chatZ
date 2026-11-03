import { z } from 'zod';

const title = z.string().trim().min(2, 'Título muito curto').max(120);
const category = z.string().trim().min(2, 'Categoria obrigatória').max(60);
const content = z.string().trim().min(1, 'Conteúdo obrigatório').max(20000);

export const listArticlesSchema = z.object({
  q: z.string().trim().max(120).optional(),
  includeArchived: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

export const createArticleSchema = z.object({
  title,
  category,
  content,
});

export const updateArticleSchema = z
  .object({
    title: title.optional(),
    category: category.optional(),
    content: content.optional(),
    active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo para atualizar',
  });

export type ListArticlesInput = z.infer<typeof listArticlesSchema>;
export type CreateArticleInput = z.infer<typeof createArticleSchema>;
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;
