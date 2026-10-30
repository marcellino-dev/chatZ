import { Ticket } from '@prisma/client';

/**
 * Verifica se um usuário pode ver um ticket específico.
 */
export function canViewTicket(
  user: { id: string; role: string; sectorId?: string | null },
  ticket: Pick<
    Ticket,
    'clientId' | 'agentId' | 'sectorId' | 'requestedAgentId' | 'status'
  >
): boolean {
  // ADMIN vê tudo
  if (user.role === 'ADMIN') return true;

  // CLIENT só vê os próprios
  if (user.role === 'CLIENT') return ticket.clientId === user.id;

  // AGENT vê tickets próprios ou tickets aguardando no próprio setor.
  if (user.role === 'AGENT') {
    return (
      ticket.agentId === user.id ||
      (ticket.agentId === null &&
        ticket.status === 'WAITING' &&
        !!user.sectorId &&
        ticket.sectorId === user.sectorId &&
        (!ticket.requestedAgentId || ticket.requestedAgentId === user.id))
    );
  }

  return false;
}

/**
 * Verifica se um usuário pode assumir um ticket.
 */
export function canAssignTicket(
  user: { id: string; role: string; sectorId?: string | null },
  ticket: Pick<Ticket, 'agentId' | 'sectorId' | 'requestedAgentId' | 'status'>
): boolean {
  if (user.role === 'ADMIN') return true;
  if (user.role === 'AGENT') {
    return (
      ticket.agentId === null &&
      ticket.status === 'WAITING' &&
      !!user.sectorId &&
      ticket.sectorId === user.sectorId &&
      (!ticket.requestedAgentId || ticket.requestedAgentId === user.id)
    );
  }
  return false;
}

/**
 * Verifica se um usuário pode modificar status/prioridade.
 */
export function canModifyTicket(user: { id: string; role: string }, ticket: Ticket): boolean {
  if (user.role === 'ADMIN') return true;
  if (user.role === 'AGENT') {
    // Só modifica tickets que ele assumiu
    return ticket.agentId === user.id;
  }
  return false;
}