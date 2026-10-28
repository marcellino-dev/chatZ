import { z } from 'zod';

export const createTicketSchema = z.object({
  subject: z.string().min(3, 'Assunto muito curto').max(120, 'Assunto muito longo'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  sectorId: z.string().min(1, 'Setor obrigatório'),
});

export const updateStatusSchema = z.object({
  status: z.enum(['WAITING', 'IN_PROGRESS', 'TRANSFERRED', 'RESOLVED', 'CLOSED']),
});

export const updatePrioritySchema = z.object({
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
});

export const listTicketsSchema = z.object({
  status: z
    .enum(['WAITING', 'IN_PROGRESS', 'TRANSFERRED', 'RESOLVED', 'CLOSED'])
    .optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  sectorId: z.string().optional(),
  mine: z.coerce.boolean().optional(),
});

export const addParticipantSchema = z.object({
  userId: z.string().min(1, 'Usuário obrigatório'),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type UpdatePriorityInput = z.infer<typeof updatePrioritySchema>;
export type ListTicketsQuery = z.infer<typeof listTicketsSchema>;
export type AddParticipantInput = z.infer<typeof addParticipantSchema>;