import { Ticket, User } from '@prisma/client';

/**
 * Verifica se um usuário pode ver um ticket específico.
 */
export function canViewTicket(user: { id: string; role: string }, ticket: Ticket): boolean {
  // ADMIN vê tudo
  if (user.role === 'ADMIN') return true;

  // CLIENT só vê os próprios
  if (user.role === 'CLIENT') return ticket.clientId === user.id;

  // AGENT vê: tickets da fila (sem dono) OU tickets que ele assumiu
  if (user.role === 'AGENT') {
    return ticket.agentId === user.id || ticket.agentId === null;
  }

  return false;
}

/**
 * Verifica se um usuário pode assumir um ticket.
 */
export function canAssignTicket(user: { role: string }, ticket: Ticket): boolean {
  if (user.role === 'ADMIN') return true;
  if (user.role === 'AGENT') {
    // Só assume se estiver sem dono
    return ticket.agentId === null;
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