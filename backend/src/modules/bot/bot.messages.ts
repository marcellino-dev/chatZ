import { Sector, User } from '@prisma/client';

// ==========================
// MENU DE SETORES
// ==========================
export function menuSectors(sectors: Sector[]): string {
  if (sectors.length === 0) {
    return '😔 Nenhum setor disponível no momento. Tente novamente mais tarde.';
  }

  const lines = sectors
    .map((s, i) => `${i + 1}️⃣ ${s.name}`)
    .join('\n');

  return [
    'Olá! Bem-vindo ao chatZ 👋',
    '',
    'Escolha um setor:',
    '',
    lines,
    '',
    'Digite o número da opção.',
  ].join('\n');
}

// ==========================
// MENU DE ATENDENTES
// ==========================
export function menuAgents(sector: Sector, agents: User[]): string {
  const lines = agents
    .map((a, i) => `${i + 1}️⃣ ${a.name}`)
    .join('\n');

  const qualquerUm = `${agents.length + 1}️⃣ Qualquer atendente do setor`;

  return [
    `Ótimo! Você escolheu *${sector.name}*.`,
    '',
    'Com quem deseja falar?',
    '',
    lines,
    qualquerUm,
    '',
    'Digite o número. (ou 0 para voltar)',
  ].join('\n');
}

// ==========================
// TICKET CRIADO
// ==========================
export function ticketCreated(params: {
  protocol: string;
  sectorName: string;
  agentName?: string;
}): string {
  const lines = [
    '✅ Pronto! Seu atendimento foi criado.',
    '',
    `🎫 Protocolo: #${params.protocol}`,
    `📋 Setor: ${params.sectorName}`,
  ];

  if (params.agentName) {
    lines.push(`🎧 Atendente: ${params.agentName}`);
  } else {
    lines.push('🎧 Atendente: qualquer um do setor');
  }

  lines.push('');
  lines.push('Aguarde que já vamos te atender. 😊');

  return lines.join('\n');
}

// ==========================
// ERROS / FALLBACKS
// ==========================
export const messages = {
  invalidOption: '❌ Opção inválida. Digite um dos números do menu.',
  backToMenu: '↩️ Voltando ao menu inicial...',
  noAgents:
    '😔 Nenhum atendente disponível no setor agora.\n\nMas não se preocupe: seu atendimento será registrado e assim que alguém entrar, você é atendido!',
  alreadyInAttendance:
    '⏳ Você já tem um atendimento em andamento. Aguarde a resposta do atendente.',
  greeting: 'Olá! 👋',
};