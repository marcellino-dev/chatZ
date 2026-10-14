import { useEffect, useState } from 'react';
import { useTicketsStore } from '../stores/tickets';
import { useAuthStore } from '../stores/auth';
import { TicketCard } from '../components/TicketCard';
import { NewTicketModal } from '../components/NewTicketModal';
import type { TicketStatus } from '../types';

type Tab = 'queue' | 'mine' | 'all';

export function Tickets() {
  const user = useAuthStore((s) => s.user);
  const {
    tickets,
    loading,
    error,
    fetchTickets,
    assignTicket,
    updateStatus,
  } = useTicketsStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [tab, setTab] = useState<Tab>(
    user?.role === 'CLIENT' ? 'all' : 'queue'
  );
  const [statusFilter, setStatusFilter] = useState<TicketStatus | ''>('');

  // Carrega conforme tab
  useEffect(() => {
    if (!user) return;

    const params: any = {};

    if (user.role === 'CLIENT') {
      // Cliente: só os próprios
    } else if (user.role === 'AGENT') {
      if (tab === 'mine') params.mine = true;
      // tab === 'queue' → default (fila + assumidos)
    }

    if (statusFilter) params.status = statusFilter;

    fetchTickets(params);
  }, [user, tab, statusFilter, fetchTickets]);

  async function handleAssign(id: string) {
    try {
      await assignTicket(id);
      // Recarrega pra atualizar as abas
      fetchTickets(tab === 'mine' ? { mine: true } : {});
    } catch (err) {
      alert('Erro ao assumir ticket');
    }
  }

  async function handleResolve(id: string) {
    try {
      await updateStatus(id, 'RESOLVED');
    } catch (err) {
      alert('Erro ao resolver ticket');
    }
  }

  if (!user) return null;

  // Filtra localmente conforme tab
  const displayed =
    user.role === 'AGENT' && tab === 'queue'
      ? tickets.filter((t) => !t.agentId && t.status === 'WAITING')
      : user.role === 'AGENT' && tab === 'mine'
      ? tickets.filter((t) => t.agentId === user.id)
      : tickets;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-chatz-text">Atendimentos</h1>
          <p className="text-chatz-muted text-sm">
            {user.role === 'CLIENT' && 'Seus chamados abertos'}
            {user.role === 'AGENT' && 'Fila e seus atendimentos'}
            {user.role === 'ADMIN' && 'Visão geral do sistema'}
          </p>
        </div>

        {user.role === 'CLIENT' && (
          <button
            onClick={() => setModalOpen(true)}
            className="px-5 py-2.5 bg-chatz-primary hover:bg-chatz-primary-hover
                       text-white font-medium rounded-lg transition-all"
          >
            ➕ Novo atendimento
          </button>
        )}
      </div>

      {/* Tabs (só pra AGENT) */}
      {user.role === 'AGENT' && (
        <div className="flex gap-2 mb-6">
          <TabButton active={tab === 'queue'} onClick={() => setTab('queue')}>
            📥 Fila
          </TabButton>
          <TabButton active={tab === 'mine'} onClick={() => setTab('mine')}>
            🎧 Meus atendimentos
          </TabButton>
        </div>
      )}

      {/* Filtro de status */}
      <div className="mb-6">
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
      </div>

      {/* Conteúdo */}
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
          <p className="text-chatz-muted text-lg mb-2">
            {user.role === 'CLIENT'
              ? '📭 Você ainda não abriu nenhum atendimento'
              : tab === 'queue'
              ? '✨ Fila vazia! Nenhum ticket aguardando'
              : '📭 Nenhum atendimento encontrado'}
          </p>
          {user.role === 'CLIENT' && (
            <button
              onClick={() => setModalOpen(true)}
              className="text-chatz-primary hover:text-chatz-primary-hover text-sm font-medium"
            >
              Criar o primeiro atendimento
            </button>
          )}
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

      <NewTicketModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
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