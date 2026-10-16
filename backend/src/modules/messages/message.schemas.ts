import { z } from 'zod';

const attachmentSchema = z.object({
  url: z.string(),
  filename: z.string(),
  originalName: z.string(),
  mimetype: z.string(),
  size: z.number(),
  type: z.enum(['image', 'video', 'audio', 'document']),
});

export const sendMessageSchema = z.object({
  content: z.string().max(2000).optional().default(''),
  attachment: attachmentSchema.nullable().optional(),   // ← aceita null
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;