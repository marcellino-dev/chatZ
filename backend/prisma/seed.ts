import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do chatZ...\n');

  const password = await bcrypt.hash('123456', 10);

  const users = [
    { name: 'Admin Master',    email: 'admin@chatz.com',  role: Role.ADMIN },
    { name: 'Ana Atendente',   email: 'ana@chatz.com',    role: Role.AGENT },
    { name: 'Bruno Atendente', email: 'bruno@chatz.com',  role: Role.AGENT },
    { name: 'Carlos Cliente',  email: 'carlos@chatz.com', role: Role.CLIENT },
    { name: 'Duda Cliente',    email: 'duda@chatz.com',   role: Role.CLIENT },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, password },
    });
  }

  console.log('✅ 5 usuários criados!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📧 admin@chatz.com    🔑 123456   [ADMIN]');
  console.log('📧 ana@chatz.com      🔑 123456   [AGENT]');
  console.log('📧 bruno@chatz.com    🔑 123456   [AGENT]');
  console.log('📧 carlos@chatz.com   🔑 123456   [CLIENT]');
  console.log('📧 duda@chatz.com     🔑 123456   [CLIENT]');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });