import { z } from 'zod';

export const transferTicketSchema = z
  .object({
    toUserId: z.string().optional(),
    toSectorId: z.string().optional(),
    reason: z.string().max(200).optional(),
  })
  .refine((data) => !!data.toUserId || !!data.toSectorId, {
    message: 'Informe o atendente ou o setor de destino',
  })
  .refine((data) => !(data.toUserId && data.toSectorId), {
    message: 'Informe apenas o atendente OU o setor, não os dois',
  });

export type TransferTicketInput = z.infer<typeof transferTicketSchema>;