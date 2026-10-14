import { z } from 'zod';

export const createSectorSchema = z.object({
  name: z.string().min(2, 'Nome muito curto').max(60),
  slug: z
    .string()
    .min(2, 'Slug muito curto')
    .max(40)
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífen'),
  description: z.string().max(200).optional(),
});

export const updateSectorSchema = z.object({
  name: z.string().min(2).max(60).optional(),
  description: z.string().max(200).optional(),
  active: z.boolean().optional(),
});

export type CreateSectorInput = z.infer<typeof createSectorSchema>;
export type UpdateSectorInput = z.infer<typeof updateSectorSchema>;