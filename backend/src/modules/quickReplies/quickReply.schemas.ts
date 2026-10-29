import { z } from 'zod';

const titleSchema = z.string().trim().min(2, 'Título muito curto').max(80);
const contentSchema = z.string().trim().min(1, 'Mensagem obrigatória').max(4000);

export const createQuickReplySchema = z.object({
  title: titleSchema,
  content: contentSchema,
});

export const updateQuickReplySchema = z
  .object({
    title: titleSchema.optional(),
    content: contentSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo para atualizar',
  });

export type CreateQuickReplyInput = z.infer<typeof createQuickReplySchema>;
export type UpdateQuickReplyInput = z.infer<typeof updateQuickReplySchema>;
