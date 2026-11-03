import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTicketsStore } from '../../stores/tickets';
import { useAuthStore } from '../../stores/auth';
import { getSocket } from '../../lib/socket';
import { ProfileAvatar } from '../ProfileAvatar';
import {
  getTicketUnread,
  resetTicketUnread,
  onUnreadChange,
} from '../../lib/notifications';
import type { Ticket } from '../../types';

type Filter = 'active' | 'waiting' | 'all' | 'resolved';

// Se o backend já enviar a última mensagem no ticket, ela aparece no preview.
type TicketWithPreview = Ticket & { lastMessage?: { content?: string | null } | null };

export function ChatList() {
  const navigate = useNavigate();
  const { id: activeId } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const { tickets, loading, error, fetchTickets } = useTicketsStore();
  const [filter, setFilter] = useState<Filter>('active');
  const [search, setSearch] = useState('');
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [connected, setConnected] = useState(() => getSocket()?.connected ?? false);

  useEffect(() => {
    if (user?.role !== 'ADMIN' && (filter === 'all' || filter === 'resolved')) {
      setFilter('active');
    }
  }, [filter, user?.role]);

  // Indicador "Conectado"
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !user) {
      setConnected(false);
      return;
    }
    setConnected(socket.connected);
    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [user]);

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

  // Carrega tickets sem mine=true para incluir conversas em que participa.
  useEffect(() => {
    if (!user) return;
    fetchTickets({});
  }, [user, fetchTickets]);

  // Socket.IO — reload em QUALQUER evento relevante
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !user) return;

    function reload() {
      console.log('🔄 [ChatList] Reloading tickets...');
      void fetchTickets({});
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
    .filter((t) => !onlyUnread || (unreadMap[t.id] || 0) > 0)
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
    { key: 'active', label: 'Em atendimento', count: counts.active, color: 'bg-emerald-500' },
    { key: 'waiting', label: 'Aguardando', count: counts.waiting, color: 'bg-amber-500' },
    ...(user?.role === 'ADMIN'
      ? [
          { key: 'all' as const, label: 'Todas', count: counts.all, color: 'bg-violet-600' },
          { key: 'resolved' as const, label: 'Resolvidas', count: counts.resolved, color: 'bg-slate-500' },
        ]
      : []),
  ];

  return (
    <aside className="flex h-full w-[min(340px,calc(100vw-68px))] shrink-0 flex-col border-r border-slate-200/70 bg-white lg:w-[340px] xl:w-[356px]">
      <div className="px-5 pb-3 pt-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h1 className="font-display text-[26px] font-extrabold tracking-tight text-slate-900">
            Caixa de entrada
          </h1>
          <span
            className={`flex items-center gap-1.5 text-xs font-semibold ${
              connected ? 'text-emerald-500' : 'text-slate-400'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-300'}`}
            />
            {connected ? 'Conectado' : 'Offline'}
          </span>
        </div>

        <div className="mb-4 flex items-center gap-2.5">
          <div className="relative min-w-0 flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
              <SearchIcon />
            </span>
            <input
              type="text"
              aria-label="Buscar conversa"
              placeholder="Buscar conversa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-12 w-full rounded-full border border-slate-200 bg-white pl-11 pr-4 text-sm
                         text-slate-800 placeholder:text-slate-500 shadow-sm outline-none
                         transition-all focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
            />
          </div>
          <button
            type="button"
            onClick={() => setOnlyUnread((v) => !v)}
            aria-pressed={onlyUnread}
            title={onlyUnread ? 'Mostrar todas' : 'Mostrar somente não lidas'}
            aria-label="Filtrar conversas não lidas"
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border shadow-sm transition ${
              onlyUnread
                ? 'border-violet-600 bg-violet-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <FilterIcon />
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-0.5 text-[13px]">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 font-semibold transition-all ${
                filter === t.key
                  ? `${t.color} text-white shadow-sm`
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>{t.label}</span>
              {t.count > 0 && (
                <span
                  className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                    filter === t.key
                      ? 'bg-white text-slate-800'
                      : 'bg-slate-400 text-white'
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
          <div className="p-6 text-center text-sm text-slate-500">Carregando...</div>
        )}

        {!loading && error && (
          <div role="alert" className="p-4 text-center text-sm text-chatz-danger">
            {error}
          </div>
        )}

        {!loading && !error && sorted.length === 0 && (
          <div className="p-6 text-center">
            <p className="mb-1 text-sm text-slate-500">Nenhuma conversa</p>
            <p className="text-xs text-slate-400">
              {onlyUnread && 'Nenhuma conversa não lida'}
              {!onlyUnread && filter === 'active' && 'Nenhum atendimento em andamento'}
              {!onlyUnread && filter === 'waiting' && 'Nenhum atendimento aguardando'}
              {!onlyUnread && filter === 'resolved' && 'Nenhum atendimento resolvido'}
              {!onlyUnread && filter === 'all' && 'Os atendimentos aparecem aqui automaticamente'}
            </p>
          </div>
        )}

        {!loading && !error &&
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

function formatListTime(value: string): string {
  const date = new Date(value);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 24 * 60 * 60 * 1000;

  if (date.getTime() >= startOfToday) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  if (date.getTime() >= startOfToday - day) return 'Ontem';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
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
  const preview =
    (ticket as TicketWithPreview).lastMessage?.content?.trim() || ticket.subject;
  const time = formatListTime(ticket.updatedAt);

  return (
    <button
      onClick={onClick}
      className={`relative flex w-full items-center gap-3.5 px-5 py-3.5 text-left transition-colors ${
        active ? 'bg-violet-50' : unread > 0 ? 'bg-violet-50/40 hover:bg-slate-50' : 'hover:bg-slate-50'
      }`}
    >
      {active && <span className="absolute inset-y-0 left-0 w-1 bg-violet-600" />}

      <div className="relative shrink-0">
        <ProfileAvatar
          name={ticket.client.name}
          pictureUrl={ticket.client.profilePictureUrl}
          sizeClass="h-[52px] w-[52px]"
        />
        {ticket.status === 'WAITING' && (
          <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-amber-400" />
        )}
        {ticket.status === 'IN_PROGRESS' && (
          <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p
            className={`truncate text-[15px] text-slate-900 ${
              unread > 0 || active ? 'font-bold' : 'font-semibold'
            }`}
          >
            {ticket.client.name}
          </p>
          <span className="shrink-0 text-xs text-slate-500">{time}</span>
        </div>
        {ticket.client.company && (
          <p className="truncate text-[11px] font-medium text-slate-400">
            {ticket.client.company}
          </p>
        )}
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p
            className={`truncate text-[13px] ${
              unread > 0 ? 'font-medium text-slate-700' : 'text-slate-500'
            }`}
          >
            {preview}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            {ticket.priority === 'URGENT' && (
              <span className="rounded-full bg-chatz-danger-light px-1.5 py-0.5 text-[10px] font-medium text-chatz-danger">
                Urgente
              </span>
            )}
            {unread > 0 && (
              <span
                className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white ${
                  active ? 'bg-violet-600' : 'bg-slate-400'
                }`}
              >
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 3H2l8 9.46V19l4 2v-8.54z" />
    </svg>
  );
}