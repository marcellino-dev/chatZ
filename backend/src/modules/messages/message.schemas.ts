import { z } from 'zod';

export const sendMessageSchema = z.object({
  content: z.string().min(1, 'Mensagem vazia').max(2000, 'Mensagem muito longa'),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;