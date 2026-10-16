import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET precisa ter no mínimo 16 caracteres'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // Base URL do backend (pra montar URLs de upload)
  BASE_URL: z.string().default('http://localhost:3000'),

  // Evolution API
  EVOLUTION_API_URL: z.string().url().default('http://localhost:8080'),
  EVOLUTION_API_KEY: z.string(),
  EVOLUTION_INSTANCE: z.string().default('chatz'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;