import { z } from 'zod';

const scheduledAtSchema = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value));

const noteSchema = z
  .string()
  .trim()
  .max(1000, 'A observação deve ter no máximo 1000 caracteres')
  .optional();

export const createFollowUpSchema = z.object({
  ticketId: z.string().min(1, 'Conversa obrigatória'),
  scheduledAt: scheduledAtSchema,
  note: noteSchema,
});

export const updateFollowUpSchema = z
  .object({
    scheduledAt: scheduledAtSchema.optional(),
    note: noteSchema,
  })
  .refine(
    (data) => data.scheduledAt !== undefined || data.note !== undefined,
    { message: 'Informe o horário ou a observação para atualizar' }
  );

export const listFollowUpsSchema = z.object({
  ticketId: z.string().min(1).optional(),
  includeClosed: z.enum(['true', 'false']).optional(),
});

export type CreateFollowUpInput = z.infer<typeof createFollowUpSchema>;
export type UpdateFollowUpInput = z.infer<typeof updateFollowUpSchema>;
export type ListFollowUpsQuery = z.infer<typeof listFollowUpsSchema>;
