import { z } from 'zod';

const nameSchema = z.string().trim().min(2, 'Nome muito curto').max(100);
const phoneSchema = z
  .string()
  .trim()
  .min(10, 'Informe um telefone brasileiro com DDD')
  .max(25, 'Telefone muito longo')
  .regex(/^\+?[\d\s().-]+$/, 'Telefone inválido');
const companySchema = z
  .string()
  .trim()
  .max(120, 'Nome da empresa muito longo')
  .transform((value) => value || null);

export const createContactSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  company: companySchema.optional(),
});

export const updateContactSchema = z
  .object({
    name: nameSchema.optional(),
    phone: phoneSchema.optional(),
    company: companySchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo para atualizar',
  });

export const saveTicketContactSchema = z.object({
  name: nameSchema.optional(),
  company: companySchema.optional(),
});

export const listContactsSchema = z.object({
  q: z.string().trim().max(100).optional(),
});

export const startConversationSchema = z.object({
  sectorId: z.string().min(1).optional(),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type SaveTicketContactInput = z.infer<typeof saveTicketContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
