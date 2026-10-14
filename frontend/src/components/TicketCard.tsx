import { Link } from 'react-router-dom';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import type { Ticket } from '../types';

interface Props {
  ticket: Ticket;
  showActions?: boolean;
  onAssign?: (id: string) => void;
  onResolve?: (id: string) => void;
}

export function TicketCard({ ticket, showActions, onAssign, onResolve }: Props) {
  const sectorName = ticket.sector?.name ?? 'Sem setor';
  const clientName = ticket.client?.name ?? 'Cliente';
  const agentName = ticket.agent?.name;
  const requestedName = ticket.requestedAgent?.name;

  const canAssign = showActions && ticket.status === 'WAITING' && !ticket.agentId;
  const canResolve =
    showActions && ticket.status === 'IN_PROGRESS' && ticket.agentId;

  const date = new Date(ticket.createdAt).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="bg-chatz-card border border-chatz-border rounded-xl p-5
                    hover:border-chatz-primary/50 transition-all">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <Link
            to={`/tickets/${ticket.id}`}
            className="text-chatz-text font-medium truncate block hover:text-chatz-primary transition-colors"
          >
            {ticket.subject}
          </Link>
          <p className="text-chatz-muted text-xs mt-1">
            #{ticket.id.slice(0, 8)} · {date}
          </p>
        </div>
        <StatusBadge status={ticket.status} />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4 text-xs">
        <PriorityBadge priority={ticket.priority} />
        <span className="text-chatz-muted">🏢 {sectorName}</span>
        <span className="text-chatz-muted">👤 {clientName}</span>
        {agentName && <span className="text-chatz-muted">🎧 {agentName}</span>}
        {requestedName && !agentName && (
          <span className="text-chatz-primary">⭐ pediu: {requestedName}</span>
        )}
      </div>

      {showActions && (canAssign || canResolve) && (
        <div className="flex gap-2 pt-3 border-t border-chatz-border">
          {canAssign && (
            <button
              onClick={() => onAssign?.(ticket.id)}
              className="px-4 py-2 bg-chatz-primary hover:bg-chatz-primary-hover
                         text-white text-sm font-medium rounded-lg transition-all"
            >
              Assumir
            </button>
          )}
          {canResolve && (
            <button
              onClick={() => onResolve?.(ticket.id)}
              className="px-4 py-2 bg-chatz-success/10 hover:bg-chatz-success/20
                         border border-chatz-success/30 text-chatz-success
                         text-sm font-medium rounded-lg transition-all"
            >
              Resolver
            </button>
          )}
          <Link
            to={`/tickets/${ticket.id}`}
            className="px-4 py-2 bg-chatz-bg hover:bg-chatz-card-hover
                       border border-chatz-border text-chatz-text
                       text-sm font-medium rounded-lg transition-all ml-auto"
          >
            Abrir →
          </Link>
        </div>
      )}

      {/* Se não tem ações, mostra só o botão Abrir */}
      {(!showActions || (!canAssign && !canResolve)) && (
        <div className="pt-3 border-t border-chatz-border">
          <Link
            to={`/tickets/${ticket.id}`}
            className="text-chatz-primary hover:text-chatz-primary-hover
                       text-sm font-medium"
          >
            Abrir conversa →
          </Link>
        </div>
      )}
    </div>
  );
}