import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTicketsStore } from '../../stores/tickets';
import { useAuthStore } from '../../stores/auth';
import { getSocket } from '../../lib/socket';
import type { Ticket } from '../../types';

type Filter = 'all' | 'waiting' | 'active' | 'resolved';

export function ChatList() {
  const navigate = useNavigate();
  const { id: activeId } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const { tickets, loading, fetchTickets } = useTicketsStore();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  // Carrega tickets
  useEffect(() => {
    if (!user) return;
    const params: any = {};
    if (user.role === 'AGENT') {
      if (filter === 'active') params.mine = true;
    }
    fetchTickets(params);
  }, [user, filter, fetchTickets]);

  // Socket.IO: novo ticket / atualização
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !user) return;

    function reload() {
      const params: any = {};
      if (user && user.role === 'AGENT' && filter === 'active') params.mine = true;
      fetchTickets(params);
    }

    socket.on('ticket:new', reload);
    socket.on('ticket:assigned', reload);
    socket.on('ticket:updated', reload);

    return () => {
      socket.off('ticket:new', reload);
      socket.off('ticket:assigned', reload);
      socket.off('ticket:updated', reload);
    };
  }, [user, filter, fetchTickets]);

  // Filtra localmente
  const filtered = tickets
    .filter((t) => {
      if (filter === 'waiting') return t.status === 'WAITING';
      if (filter === 'active') return t.status === 'IN_PROGRESS';
      if (filter === 'resolved') return t.status === 'RESOLVED' || t.status === 'CLOSED';
      return true;
    })
    .filter((t) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        t.client.name.toLowerCase().includes(q) ||
        t.client.phone?.includes(q) ||
        t.subject.toLowerCase().includes(q)
      );
    });

  return (
    <aside className="w-[340px] bg-chatz-surface border-r border-chatz-border flex flex-col shrink-0">

      {/* Header + Filtros */}
      <div className="border-b border-chatz-border p-3">
        {/* Busca */}
        <div className="relative mb-3">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-chatz-text-subtle">
            <SearchIcon />
          </span>
          <input
            type="text"
            placeholder="Buscar conversa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-chatz-surface-alt border border-chatz-border rounded-chatz
                       text-chatz-text placeholder:text-chatz-text-subtle
                       focus:border-chatz-primary focus:ring-2 focus:ring-chatz-primary/20 transition-all"
          />
        </div>

        {/* Filtros */}
        <div className="flex gap-1 text-xs">
          {(
            [
              { key: 'all', label: 'Todas' },
              { key: 'waiting', label: 'Aguardando' },
              { key: 'active', label: 'Em atendimento' },
              { key: 'resolved', label: 'Resolvidas' },
            ] as { key: Filter; label: string }[]
          ).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-2.5 py-1 rounded-full font-medium transition-all ${
                filter === f.key
                  ? 'bg-chatz-primary text-white'
                  : 'bg-chatz-surface-alt text-chatz-text-muted hover:text-chatz-text'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="p-6 text-center text-chatz-text-muted text-sm">
            Carregando...
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="p-6 text-center">
            <p className="text-chatz-text-muted text-sm mb-1">
              Nenhuma conversa
            </p>
            <p className="text-chatz-text-subtle text-xs">
              Os atendimentos aparecem aqui automaticamente
            </p>
          </div>
        )}

        {!loading &&
          filtered.map((ticket) => (
            <ChatListItem
              key={ticket.id}
              ticket={ticket}
              active={ticket.id === activeId}
              onClick={() => navigate(`/chat/${ticket.id}`)}
            />
          ))}
      </div>
    </aside>
  );
}

// ==========================
// ITEM DA LISTA
// ==========================
function ChatListItem({
  ticket,
  active,
  onClick,
}: {
  ticket: Ticket;
  active: boolean;
  onClick: () => void;
}) {
  const lastMessage = ticket._count?.messages
    ? `${ticket._count.messages} mensagens`
    : 'Sem mensagens';

  const initials = ticket.client.name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const time = new Date(ticket.createdAt).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-3 border-b border-chatz-border
                  transition-all flex gap-3 items-start ${
                    active
                      ? 'bg-chatz-primary-light border-l-4 border-l-chatz-primary'
                      : 'hover:bg-chatz-surface-alt'
                  }`}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <div
          className="w-11 h-11 rounded-full bg-gradient-to-br from-chatz-purple to-chatz-pink
                     flex items-center justify-center text-white font-semibold text-sm"
        >
          {initials}
        </div>
        {/* Indicador de status */}
        {ticket.status === 'WAITING' && (
          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-chatz-warning border-2 border-chatz-surface" />
        )}
        {ticket.status === 'IN_PROGRESS' && (
          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-chatz-success border-2 border-chatz-surface" />
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 mb-0.5">
          <p className="text-sm font-semibold text-chatz-text truncate">
            {ticket.client.name}
          </p>
          <span className="text-[10px] text-chatz-text-subtle shrink-0">
            {time}
          </span>
        </div>
        <p className="text-xs text-chatz-text-muted truncate mb-1">
          {ticket.subject}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-chatz-text-subtle">
            {lastMessage}
          </span>
          {ticket.priority === 'URGENT' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-chatz-danger-light text-chatz-danger font-medium">
              Urgente
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}