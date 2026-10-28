import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTicketsStore } from '../../stores/tickets';
import { useAuthStore } from '../../stores/auth';
import { getSocket } from '../../lib/socket';
import {
  getTicketUnread,
  resetTicketUnread,
  onUnreadChange,
} from '../../lib/notifications';
import type { Ticket } from '../../types';

type Filter = 'active' | 'waiting' | 'all' | 'resolved';

export function ChatList() {
  const navigate = useNavigate();
  const { id: activeId } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const { tickets, loading, fetchTickets } = useTicketsStore();
  const [filter, setFilter] = useState<Filter>('active');
  const [search, setSearch] = useState('');
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Atualiza unread
  useEffect(() => {
    const update = () => {
      const map: Record<string, number> = {};
      tickets.forEach((t) => {
        const count = getTicketUnread(t.id);
        if (count > 0) map[t.id] = count;
      });
      setUnreadMap(map);
    };

    update();
    const unsub = onUnreadChange(update);
    return unsub;
  }, [tickets]);

  // Zera unread ao abrir ticket
  useEffect(() => {
    if (activeId) {
      resetTicketUnread(activeId);
    }
  }, [activeId]);

  // 🔥 Carrega tickets (SEMPRE sem mine=true, pra incluir participantes)
  useEffect(() => {
    if (!user) return;
    fetchTickets({});
  }, [user, filter, fetchTickets, reloadTrigger]);

  // Socket.IO — reload em QUALQUER evento relevante
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !user) return;

    function reload() {
      console.log('🔄 [ChatList] Reloading tickets...');
      fetchTickets({}).then(() => {
        setReloadTrigger((r) => r + 1);
      });
    }

    socket.on('ticket:new', reload);
    socket.on('ticket:assigned', reload);
    socket.on('ticket:updated', reload);
    socket.on('ticket:participant-added', reload);
    socket.on('ticket:participant-removed', reload);

    return () => {
      socket.off('ticket:new', reload);
      socket.off('ticket:assigned', reload);
      socket.off('ticket:updated', reload);
      socket.off('ticket:participant-added', reload);
      socket.off('ticket:participant-removed', reload);
    };
  }, [user, filter, fetchTickets]);

  const counts = useMemo(() => {
    const waiting = tickets.filter((t) => t.status === 'WAITING').length;
    const active = tickets.filter((t) => t.status === 'IN_PROGRESS').length;
    const resolved = tickets.filter(
      (t) => t.status === 'RESOLVED' || t.status === 'CLOSED'
    ).length;

    return { all: tickets.length, waiting, active, resolved };
  }, [tickets]);

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

  const sorted = [...filtered].sort((a, b) => {
    const unreadA = unreadMap[a.id] || 0;
    const unreadB = unreadMap[b.id] || 0;
    if (unreadA !== unreadB) return unreadB - unreadA;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const tabs: { key: Filter; label: string; count: number; color: string }[] = [
    { key: 'active', label: 'Em atendimento', count: counts.active, color: 'bg-chatz-success' },
    { key: 'waiting', label: 'Aguardando', count: counts.waiting, color: 'bg-chatz-warning' },
    { key: 'all', label: 'Todas', count: counts.all, color: 'bg-chatz-primary' },
    { key: 'resolved', label: 'Resolvidas', count: counts.resolved, color: 'bg-chatz-text-subtle' },
  ];

  return (
    <aside className="w-[340px] bg-chatz-surface border-r border-chatz-border flex flex-col shrink-0">
      <div className="border-b border-chatz-border p-3">
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

        <div className="flex flex-wrap gap-1 text-xs">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`px-2.5 py-1 rounded-full font-medium transition-all flex items-center gap-1.5 ${
                filter === t.key
                  ? `${t.color} text-white`
                  : 'bg-chatz-surface-alt text-chatz-text-muted hover:text-chatz-text'
              }`}
            >
              <span>{t.label}</span>
              {t.count > 0 && (
                <span
                  className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                    filter === t.key
                      ? 'bg-white/25 text-white'
                      : `${t.color} text-white`
                  }`}
                >
                  {t.count > 99 ? '99+' : t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="p-6 text-center text-chatz-text-muted text-sm">
            Carregando...
          </div>
        )}

        {!loading && sorted.length === 0 && (
          <div className="p-6 text-center">
            <p className="text-chatz-text-muted text-sm mb-1">Nenhuma conversa</p>
            <p className="text-chatz-text-subtle text-xs">
              {filter === 'active' && 'Nenhum atendimento em andamento'}
              {filter === 'waiting' && 'Nenhum atendimento aguardando'}
              {filter === 'resolved' && 'Nenhum atendimento resolvido'}
              {filter === 'all' && 'Os atendimentos aparecem aqui automaticamente'}
            </p>
          </div>
        )}

        {!loading &&
          sorted.map((ticket) => (
            <ChatListItem
              key={ticket.id}
              ticket={ticket}
              active={ticket.id === activeId}
              unread={unreadMap[ticket.id] || 0}
              onClick={() => navigate(`/chat/${ticket.id}`)}
            />
          ))}
      </div>
    </aside>
  );
}

function ChatListItem({
  ticket,
  active,
  unread,
  onClick,
}: {
  ticket: Ticket;
  active: boolean;
  unread: number;
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

  const time = new Date(ticket.updatedAt).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-3 border-b border-chatz-border
                  transition-all flex gap-3 items-start relative ${
                    active
                      ? 'bg-chatz-primary-light border-l-4 border-l-chatz-primary'
                      : unread > 0
                      ? 'bg-chatz-primary-light/30 hover:bg-chatz-surface-alt'
                      : 'hover:bg-chatz-surface-alt'
                  }`}
    >
      <div className="relative shrink-0">
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-chatz-purple to-chatz-pink
                        flex items-center justify-center text-white font-semibold text-sm">
          {initials}
        </div>
        {ticket.status === 'WAITING' && (
          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-chatz-warning border-2 border-chatz-surface" />
        )}
        {ticket.status === 'IN_PROGRESS' && (
          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-chatz-success border-2 border-chatz-surface" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 mb-0.5">
          <p className={`text-sm truncate ${unread > 0 ? 'font-bold text-chatz-text' : 'font-semibold text-chatz-text'}`}>
            {ticket.client.name}
          </p>
          <span className={`text-[10px] shrink-0 ${unread > 0 ? 'text-chatz-primary font-bold' : 'text-chatz-text-subtle'}`}>
            {time}
          </span>
        </div>
        <p className={`text-xs truncate mb-1 ${unread > 0 ? 'text-chatz-text font-medium' : 'text-chatz-text-muted'}`}>
          {ticket.subject}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-chatz-text-subtle truncate">
            {lastMessage}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {ticket.priority === 'URGENT' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-chatz-danger-light text-chatz-danger font-medium">
                Urgente
              </span>
            )}
            {unread > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-chatz-success text-white
                               text-[11px] font-bold flex items-center justify-center">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </div>
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