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

const profileEmailSchema = z
  .string()
  .trim()
  .email('Email inválido')
  .toLowerCase()
  .nullable();
const profilePhoneSchema = z
  .string()
  .trim()
  .max(25, 'Telefone muito longo')
  .regex(/^\+?[\d\s().-]+$/, 'Telefone inválido')
  .transform((value) => value || null)
  .nullable();

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2, 'Nome muito curto').max(80).optional(),
    email: profileEmailSchema.optional(),
    phone: profilePhoneSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo para atualizar',
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Senha atual obrigatória'),
    newPassword: z.string().min(8, 'A nova senha deve ter no mínimo 8 caracteres').max(128),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'A nova senha deve ser diferente da senha atual',
    path: ['newPassword'],
  });

export const updatePreferencesSchema = z
  .object({
    soundEnabled: z.boolean().optional(),
    desktopNotifications: z.boolean().optional(),
    notificationSound: z.enum(['ding', 'notification', 'none']).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos uma preferência para atualizar',
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
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;