import { z } from 'zod';

const attachmentSchema = z.object({
  url: z.string(),
  filename: z.string(),
  originalName: z.string(),
  mimetype: z.string(),
  size: z.number(),
  type: z.enum(['image', 'video', 'audio', 'document']),
  sticker: z.boolean().optional(),
}).superRefine((attachment, context) => {
  if (attachment.sticker && attachment.type !== 'image') {
    context.addIssue({
      code: 'custom',
      message: 'A figurinha deve ser uma imagem',
      path: ['type'],
    });
  }
  if (attachment.sticker && !attachment.mimetype.startsWith('image/')) {
    context.addIssue({
      code: 'custom',
      message: 'A figurinha deve ter formato de imagem',
      path: ['mimetype'],
    });
  }
});

export const sendMessageSchema = z.object({
  content: z.string().max(2000).optional().default(''),
  attachment: attachmentSchema.nullable().optional(),   // ← aceita null
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;