import { useEffect, useState } from 'react';
import { useTicketsStore } from '../stores/tickets';
import { useAuthStore } from '../stores/auth';
import { useSectorsStore } from '../stores/sectors';
import { TicketCard } from '../components/TicketCard';
import { getSocket } from '../lib/socket';
import type { Ticket, TicketStatus } from '../types';

type Tab = 'queue' | 'mine' | 'all';

export function Tickets() {
  const user = useAuthStore((s) => s.user);
  const { sectors, fetchSectors } = useSectorsStore();
  const {
    tickets,
    loading,
    error,
    fetchTickets,
    assignTicket,
    updateStatus,
  } = useTicketsStore();

  const [tab, setTab] = useState<Tab>('queue');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | ''>('');
  const [sectorFilter, setSectorFilter] = useState<string>('');

  // Carrega setores (ADMIN)
  useEffect(() => {
    if (user?.role === 'ADMIN') fetchSectors();
  }, [user, fetchSectors]);

  // Carrega tickets
  useEffect(() => {
    if (!user) return;

    const params: any = {};
    if (user.role === 'AGENT' && tab === 'mine') params.mine = true;
    if (statusFilter) params.status = statusFilter;
    if (sectorFilter) params.sectorId = sectorFilter;

    fetchTickets(params);
  }, [user, tab, statusFilter, sectorFilter, fetchTickets]);

  // 🔌 Escuta eventos do Socket.IO
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Novo ticket criado
    function handleNewTicket(ticket: Ticket) {
      console.log('🔔 Novo ticket:', ticket);
      // Recarrega a lista
      const params: any = {};
      if (user?.role === 'AGENT' && tab === 'mine') params.mine = true;
      if (statusFilter) params.status = statusFilter;
      if (sectorFilter) params.sectorId = sectorFilter;
      fetchTickets(params);

      // 🔔 Toca som "ding"
      playDing();
    }

    // Ticket assumido
    function handleAssigned(ticket: Ticket) {
      console.log('🔔 Ticket assumido:', ticket.id);
      const params: any = {};
      if (user?.role === 'AGENT' && tab === 'mine') params.mine = true;
      if (statusFilter) params.status = statusFilter;
      if (sectorFilter) params.sectorId = sectorFilter;
      fetchTickets(params);
    }

    // Ticket atualizado (status/prioridade)
    function handleUpdated(ticket: Ticket) {
      console.log('🔔 Ticket atualizado:', ticket.id);
      const params: any = {};
      if (user?.role === 'AGENT' && tab === 'mine') params.mine = true;
      if (statusFilter) params.status = statusFilter;
      if (sectorFilter) params.sectorId = sectorFilter;
      fetchTickets(params);
    }

    socket.on('ticket:new', handleNewTicket);
    socket.on('ticket:assigned', handleAssigned);
    socket.on('ticket:updated', handleUpdated);

    return () => {
      socket.off('ticket:new', handleNewTicket);
      socket.off('ticket:assigned', handleAssigned);
      socket.off('ticket:updated', handleUpdated);
    };
  }, [user, tab, statusFilter, sectorFilter, fetchTickets]);

  async function handleAssign(id: string) {
    try {
      await assignTicket(id);
    } catch {
      alert('Erro ao assumir ticket');
    }
  }

  async function handleResolve(id: string) {
    try {
      await updateStatus(id, 'RESOLVED');
    } catch {
      alert('Erro ao resolver ticket');
    }
  }

  if (!user) return null;

  const displayed =
    user.role === 'AGENT' && tab === 'queue'
      ? tickets.filter((t) => t.status === 'WAITING' && !t.agentId)
      : user.role === 'AGENT' && tab === 'mine'
      ? tickets.filter((t) => t.agentId === user.id)
      : tickets;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-chatz-text">Atendimentos</h1>
        <p className="text-chatz-muted text-sm">
          {user.role === 'AGENT' && `Setor ${user.sector?.name ?? ''} · Fila e seus atendimentos`}
          {user.role === 'ADMIN' && 'Visão geral do sistema'}
        </p>
      </div>

      {user.role === 'AGENT' && (
        <div className="flex gap-2 mb-4">
          <TabButton active={tab === 'queue'} onClick={() => setTab('queue')}>
            📥 Fila
          </TabButton>
          <TabButton active={tab === 'mine'} onClick={() => setTab('mine')}>
            🎧 Meus atendimentos
          </TabButton>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TicketStatus | '')}
          className="px-4 py-2 bg-chatz-card border border-chatz-border rounded-lg
                     text-chatz-text text-sm focus:border-chatz-primary transition-all"
        >
          <option value="">Todos os status</option>
          <option value="WAITING">Aguardando</option>
          <option value="IN_PROGRESS">Em atendimento</option>
          <option value="RESOLVED">Resolvido</option>
          <option value="CLOSED">Fechado</option>
        </select>

        {user.role === 'ADMIN' && (
          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className="px-4 py-2 bg-chatz-card border border-chatz-border rounded-lg
                       text-chatz-text text-sm focus:border-chatz-primary transition-all"
          >
            <option value="">Todos os setores</option>
            {sectors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading && (
        <div className="text-center py-16 text-chatz-muted">Carregando...</div>
      )}

      {error && (
        <div className="bg-chatz-danger/10 border border-chatz-danger/30 text-chatz-danger
                        rounded-lg px-4 py-3 mb-6">
          {error}
        </div>
      )}

      {!loading && displayed.length === 0 && (
        <div className="text-center py-16 bg-chatz-card/50 border border-chatz-border
                        border-dashed rounded-2xl">
          <p className="text-chatz-muted text-lg">
            {tab === 'queue'
              ? '✨ Fila vazia! Nenhum ticket aguardando'
              : '📭 Nenhum atendimento encontrado'}
          </p>
        </div>
      )}

      {!loading && displayed.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayed.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              showActions={user.role === 'AGENT' || user.role === 'ADMIN'}
              onAssign={handleAssign}
              onResolve={handleResolve}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
        active
          ? 'bg-chatz-primary text-white'
          : 'bg-chatz-card border border-chatz-border text-chatz-muted hover:text-chatz-text'
      }`}
    >
      {children}
    </button>
  );
}

// 🔔 Toca som "ding" simples via Web Audio API
function playDing() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.value = 880; // A5
    osc.type = 'sine';

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {
    console.warn('Erro ao tocar som:', e);
  }
}