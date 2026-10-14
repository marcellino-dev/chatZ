import { useState, useEffect, FormEvent } from 'react';
import { api, getErrorMessage } from '../lib/api';
import type { Sector, User } from '../types';

interface Props {
  isOpen: boolean;
  ticketId: string;
  currentSectorId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function TransferModal({
  isOpen,
  ticketId,
  currentSectorId,
  onClose,
  onSuccess,
}: Props) {
  const [mode, setMode] = useState<'sector' | 'agent'>('sector');
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [agents, setAgents] = useState<User[]>([]);
  const [selectedSectorId, setSelectedSectorId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Carrega setores
  useEffect(() => {
    if (!isOpen) return;
    api.get<Sector[]>('/sectors?active=true').then(({ data }) => {
      // Exclui o setor atual
      setSectors(data.filter((s) => s.id !== currentSectorId));
    });
  }, [isOpen, currentSectorId]);

  // Carrega agentes do setor selecionado
  useEffect(() => {
    if (mode !== 'agent' || !selectedSectorId) {
      setAgents([]);
      return;
    }
    api
      .get<{ users: User[] }>(`/sectors/${selectedSectorId}`)
      .then(({ data }) => {
        setAgents(data.users.filter((u) => u.role === 'AGENT' && u.active));
      })
      .catch(() => setAgents([]));
  }, [mode, selectedSectorId]);

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post(`/tickets/${ticketId}/transfers`, {
        toSectorId: mode === 'sector' ? selectedSectorId : undefined,
        toUserId: mode === 'agent' ? selectedUserId : undefined,
        reason: reason || undefined,
      });

      setSelectedSectorId('');
      setSelectedUserId('');
      setReason('');
      onSuccess();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-chatz-card border border-chatz-border rounded-2xl w-full max-w-lg p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-chatz-text">
            Transferir atendimento
          </h2>
          <button
            onClick={onClose}
            className="text-chatz-muted hover:text-chatz-text text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Modo */}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setMode('sector')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === 'sector'
                ? 'bg-chatz-primary text-white'
                : 'bg-chatz-bg border border-chatz-border text-chatz-muted'
            }`}
          >
            🏢 Para setor
          </button>
          <button
            type="button"
            onClick={() => setMode('agent')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === 'agent'
                ? 'bg-chatz-primary text-white'
                : 'bg-chatz-bg border border-chatz-border text-chatz-muted'
            }`}
          >
            🎧 Para atendente
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Setor */}
          <div>
            <label className="block text-sm font-medium text-chatz-muted mb-2">
              {mode === 'sector' ? 'Setor de destino' : 'Setor do atendente'}
            </label>
            <select
              value={selectedSectorId}
              onChange={(e) => {
                setSelectedSectorId(e.target.value);
                setSelectedUserId('');
              }}
              required
              className="w-full px-4 py-3 bg-chatz-bg border border-chatz-border rounded-lg
                         text-chatz-text focus:border-chatz-primary transition-all"
            >
              <option value="">Selecione um setor</option>
              {sectors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Atendente (só no modo agent) */}
          {mode === 'agent' && (
            <div>
              <label className="block text-sm font-medium text-chatz-muted mb-2">
                Atendente de destino
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                required
                disabled={!selectedSectorId}
                className="w-full px-4 py-3 bg-chatz-bg border border-chatz-border rounded-lg
                           text-chatz-text focus:border-chatz-primary transition-all
                           disabled:opacity-50"
              >
                <option value="">
                  {selectedSectorId
                    ? agents.length === 0
                      ? 'Nenhum atendente neste setor'
                      : 'Selecione um atendente'
                    : 'Escolha um setor primeiro'}
                </option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Motivo */}
          <div>
            <label className="block text-sm font-medium text-chatz-muted mb-2">
              Motivo (opcional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Ex: cliente precisa de suporte especializado"
              className="w-full px-4 py-3 bg-chatz-bg border border-chatz-border rounded-lg
                         text-chatz-text placeholder-chatz-muted
                         focus:border-chatz-primary transition-all resize-none"
            />
          </div>

          {error && (
            <div className="bg-chatz-danger/10 border border-chatz-danger/30 text-chatz-danger
                            text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-chatz-bg hover:bg-chatz-card-hover
                         border border-chatz-border text-chatz-text font-medium
                         rounded-lg transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-chatz-primary hover:bg-chatz-primary-hover
                         text-white font-semibold rounded-lg transition-all
                         disabled:opacity-50"
            >
              {loading ? 'Transferindo...' : 'Transferir'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}