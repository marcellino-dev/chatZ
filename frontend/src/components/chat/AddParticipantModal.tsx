import { useState, useEffect, type FormEvent } from 'react';
import { api, getErrorMessage } from '../../lib/api';
import type { User, Sector, TicketParticipant } from '../../types';

interface Props {
  isOpen: boolean;
  ticketId: string;
  currentSectorId: string;
  currentAgentId: string | null;
  participants: TicketParticipant[];
  onClose: () => void;
  onSuccess: () => void;
}

export function AddParticipantModal({
  isOpen,
  ticketId,
  currentSectorId,
  currentAgentId,
  participants,
  onClose,
  onSuccess,
}: Props) {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [selectedSectorId, setSelectedSectorId] = useState(currentSectorId);
  const [agents, setAgents] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(false);

  // 🔥 Carrega TODOS os setores
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setError('');

    api.get<Sector[]>('/sectors?active=true').then(({ data }) => {
      if (!cancelled) setSectors(data);
    }).catch((err) => {
      if (!cancelled) {
        setSectors([]);
        setError(getErrorMessage(err));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // 🔥 Carrega agentes do setor selecionado (TODOS, não só ativos)
  useEffect(() => {
    if (!isOpen || !selectedSectorId) {
      setAgents([]);
      return;
    }

    let cancelled = false;
    setLoadingAgents(true);
    setAgents([]);
    setSelectedUserId('');

    api
      .get<{ users: User[] }>(`/sectors/${selectedSectorId}`)
      .then(({ data }) => {
        if (!cancelled) {
          setAgents(data.users.filter((agent) => agent.role === 'AGENT' && agent.active));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setAgents([]);
          setError(getErrorMessage(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingAgents(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedSectorId]);

  if (!isOpen) return null;

  const participantIds = new Set(participants.map((p) => p.userId));
  const availableAgents = agents.filter(
    (a) => a.id !== currentAgentId && !participantIds.has(a.id)
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post(`/tickets/${ticketId}/participants`, {
        userId: selectedUserId,
      });
      setSelectedUserId('');
      onSuccess();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(userId: string) {
    if (!confirm('Remover este participante?')) return;
    try {
      await api.delete(`/tickets/${ticketId}/participants/${userId}`);
      onSuccess();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  }

  let dropdownText = 'Selecione um atendente';
  if (loadingAgents) dropdownText = 'Carregando...';
  else if (availableAgents.length === 0) dropdownText = 'Nenhum atendente neste setor';

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-chatz-surface border border-chatz-border rounded-chatz-xl w-full max-w-lg p-6 shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-display font-bold text-chatz-text">
              ➕ Adicionar à conversa
            </h2>
            <p className="text-sm text-chatz-text-muted mt-1">
              Convide outro atendente pra ajudar
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-chatz-text-muted hover:text-chatz-text text-2xl"
          >
            ×
          </button>
        </div>

        {/* Participantes atuais */}
        {participants.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-chatz-text-muted uppercase tracking-wide mb-2">
              Já estão nesta conversa
            </p>
            <div className="space-y-1">
              {participants.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 bg-chatz-surface-alt rounded-chatz px-3 py-2"
                >
                  <span className="text-sm text-chatz-text">
                    🎧 {p.user.name}
                  </span>
                  <button
                    onClick={() => handleRemove(p.userId)}
                    className="text-xs text-chatz-danger hover:underline"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Setor */}
          <div>
            <label className="block text-sm font-medium text-chatz-text mb-2">
              Setor
            </label>
            <select
              value={selectedSectorId}
              onChange={(e) => setSelectedSectorId(e.target.value)}
              required
              className="w-full px-4 py-3 bg-chatz-surface-alt border border-chatz-border rounded-chatz
                         text-chatz-text text-sm focus:border-chatz-primary transition-all"
            >
              <option value="">Selecione um setor</option>
              {sectors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Atendente */}
          <div>
            <label className="block text-sm font-medium text-chatz-text mb-2">
              Atendente
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              required
              disabled={loadingAgents || availableAgents.length === 0}
              className="w-full px-4 py-3 bg-chatz-surface-alt border border-chatz-border rounded-chatz
                         text-chatz-text text-sm focus:border-chatz-primary transition-all
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">{dropdownText}</option>
              {availableAgents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>

            {/* Debug */}
            {import.meta.env.DEV && !loadingAgents && (
              <p className="text-[10px] text-chatz-text-subtle mt-1">
                {agents.length} atendente(s) no setor · {availableAgents.length} disponível(is)
              </p>
            )}
          </div>

          {error && (
            <div className="bg-chatz-danger-light border border-chatz-danger-border text-chatz-danger
                            text-sm rounded-chatz px-4 py-3">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-chatz-surface-alt border border-chatz-border
                         text-chatz-text font-medium rounded-chatz transition-all
                         hover:bg-chatz-surface-hover"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !selectedUserId}
              className="flex-1 py-3 bg-chatz-button-gradient text-white font-semibold
                         rounded-chatz shadow-[0_4px_14px_rgba(236,72,153,0.35)]
                         hover:brightness-105 transition-all
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Adicionando...' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}