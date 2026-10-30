import { z } from 'zod';

// ==========================
// LOGIN (admin/agent)
// ==========================
export const loginSchema = z.object({
  email: z.string().email('Email inválido').toLowerCase(),
  password: z.string().min(1, 'Senha obrigatória'),
});

export const updateStatusSchema = z.object({
  status: z.enum(['ONLINE', 'AWAY', 'BUSY', 'OFFLINE']),
});

// ==========================
// CRIAR USUÁRIO (só ADMIN)
// ==========================
export const createUserSchema = z
  .object({
    name: z.string().min(2, 'Nome muito curto').max(80),
    email: z.string().email('Email inválido').toLowerCase(),
    password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
    role: z.literal('AGENT'),
    sectorId: z.string().optional(),
  })
  .refine(
    (data) => !!data.sectorId,
    {
      message: 'Atendente precisa ter um setor',
      path: ['sectorId'],
    }
  );

// ==========================
// TIPOS
// ==========================
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;