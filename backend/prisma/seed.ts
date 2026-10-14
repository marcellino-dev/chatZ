import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do chatZ...\n');

  // ==========================
  // LIMPAR (ordem importa por causa das FKs)
  // ==========================
  await prisma.transfer.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.user.deleteMany();
  await prisma.sector.deleteMany();

  // ==========================
  // SETORES
  // ==========================
  const sectors = await Promise.all([
    prisma.sector.create({
      data: {
        name: 'Comercial',
        slug: 'comercial',
        description: 'Vendas, orçamentos e novas propostas',
      },
    }),
    prisma.sector.create({
      data: {
        name: 'Certificados',
        slug: 'certificados',
        description: 'Emissão e renovação de certificados digitais',
      },
    }),
    prisma.sector.create({
      data: {
        name: 'Suporte',
        slug: 'suporte',
        description: 'Suporte técnico e resolução de problemas',
      },
    }),
  ]);

  const [comercial, certificados, suporte] = sectors;

  console.log('🏢 3 setores criados:');
  sectors.forEach((s) => console.log(`   • ${s.name} (${s.slug})`));
  console.log('');

  // ==========================
  // USUÁRIOS
  // ==========================
  const password = await bcrypt.hash('123456', 10);

  // Admin
  const admin = await prisma.user.create({
    data: {
      name: 'Admin Master',
      email: 'admin@chatz.com',
      password,
      role: Role.ADMIN,
    },
  });

  // Atendentes (1 setor cada)
  const ana = await prisma.user.create({
    data: {
      name: 'Ana Atendente',
      email: 'ana@chatz.com',
      password,
      role: Role.AGENT,
      sectorId: suporte.id,
    },
  });

  const bruno = await prisma.user.create({
    data: {
      name: 'Bruno Atendente',
      email: 'bruno@chatz.com',
      password,
      role: Role.AGENT,
      sectorId: certificados.id,
    },
  });

  const carla = await prisma.user.create({
    data: {
      name: 'Carla Comercial',
      email: 'carla@chatz.com',
      password,
      role: Role.AGENT,
      sectorId: comercial.id,
    },
  });

  // Clientes (WhatsApp - sem email/senha)
  const carlos = await prisma.user.create({
    data: {
      name: 'Carlos Cliente',
      phone: '5511999990001',
      role: Role.CLIENT,
    },
  });

  const duda = await prisma.user.create({
    data: {
      name: 'Duda Cliente',
      phone: '5511999990002',
      role: Role.CLIENT,
    },
  });

  console.log('👥 6 usuários criados:');
  console.log('   👑 Admin Master  → admin@chatz.com');
  console.log('   🎧 Ana Atendente  → ana@chatz.com (Suporte)');
  console.log('   🎧 Bruno Atendente → bruno@chatz.com (Certificados)');
  console.log('   🎧 Carla Comercial → carla@chatz.com (Comercial)');
  console.log(`   👤 Carlos Cliente  → ${carlos.phone}`);
  console.log(`   👤 Duda Cliente    → ${duda.phone}`);
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔐 CREDENCIAIS DE LOGIN (painel web)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('👑 admin@chatz.com   / 123456  [ADMIN]');
  console.log('🎧 ana@chatz.com     / 123456  [AGENT · Suporte]');
  console.log('🎧 bruno@chatz.com   / 123456  [AGENT · Certificados]');
  console.log('🎧 carla@chatz.com   / 123456  [AGENT · Comercial]');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('📱 CLIENTES WHATSAPP (sem login)');
  console.log('   Carlos: 5511999990001');
  console.log('   Duda:   5511999990002');
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