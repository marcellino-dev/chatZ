import { z } from 'zod';

export const createStickerSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome da figurinha').max(60),
});

export const saveIncomingStickerSchema = z.object({
  messageId: z.string().min(1),
  name: z.string().trim().min(1, 'Informe o nome da figurinha').max(60),
});

export type CreateStickerInput = z.infer<typeof createStickerSchema>;
export type SaveIncomingStickerInput = z.infer<typeof saveIncomingStickerSchema>;
