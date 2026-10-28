import { useState, useEffect, FormEvent } from 'react';
import { api, getErrorMessage } from '../../lib/api';
import type { Sector, User } from '../../types';

interface Props {
  isOpen: boolean;
  ticketId: string;
  currentSectorId: string;
  currentAgentId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function TransferModal({
  isOpen,
  ticketId,
  currentSectorId,
  currentAgentId,
  onClose,
  onSuccess,
}: Props) {
  const [mode, setMode] = useState<'sector' | 'agent'>('agent');
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [agents, setAgents] = useState<User[]>([]);
  const [selectedSectorId, setSelectedSectorId] = useState(currentSectorId);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    api.get<Sector[]>('/sectors?active=true').then(({ data }) => {
      setSectors(data);
    });
  }, [isOpen]);

  useEffect(() => {
    if (mode !== 'agent' || !selectedSectorId) {
      setAgents([]);
      return;
    }
    api
      .get<{ users: User[] }>(`/sectors/${selectedSectorId}`)
      .then(({ data }) => {
        setAgents(
          data.users.filter(
            (u) => u.role === 'AGENT' && u.active && u.id !== currentAgentId
          )
        );
      })
      .catch(() => setAgents([]));
  }, [mode, selectedSectorId, currentAgentId]);

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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-chatz-surface border border-chatz-border rounded-chatz-xl w-full max-w-lg p-6 shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-display font-bold text-chatz-text">🔄 Transferir</h2>
            <p className="text-sm text-chatz-text-muted mt-1">O ticket sai do seu controle</p>
          </div>
          <button onClick={onClose} className="text-chatz-text-muted hover:text-chatz-text text-2xl">×</button>
        </div>

        <div className="flex gap-2 mb-4">
          <button type="button" onClick={() => setMode('agent')} className={`flex-1 py-2 rounded-chatz text-sm font-medium transition-all ${mode === 'agent' ? 'bg-chatz-primary text-white' : 'bg-chatz-surface-alt border border-chatz-border text-chatz-text-muted'}`}>🎧 Para atendente</button>
          <button type="button" onClick={() => setMode('sector')} className={`flex-1 py-2 rounded-chatz text-sm font-medium transition-all ${mode === 'sector' ? 'bg-chatz-primary text-white' : 'bg-chatz-surface-alt border border-chatz-border text-chatz-text-muted'}`}>🏢 Para setor</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-chatz-text mb-2">{mode === 'agent' ? 'Setor do atendente' : 'Setor de destino'}</label>
            <select value={selectedSectorId} onChange={(e) => { setSelectedSectorId(e.target.value); setSelectedUserId(''); }} required className="w-full px-4 py-3 bg-chatz-surface-alt border border-chatz-border rounded-chatz text-chatz-text text-sm focus:border-chatz-primary transition-all">
              <option value="">Selecione um setor</option>
              {sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {mode === 'agent' && (
            <div>
              <label className="block text-sm font-medium text-chatz-text mb-2">Atendente</label>
              <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} required disabled={!selectedSectorId} className="w-full px-4 py-3 bg-chatz-surface-alt border border-chatz-border rounded-chatz text-chatz-text text-sm focus:border-chatz-primary transition-all disabled:opacity-50">
                <option value="">{!selectedSectorId ? 'Escolha um setor' : agents.length === 0 ? 'Nenhum atendente' : 'Selecione'}</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-chatz-text mb-2">Motivo (opcional)</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Ex: cliente precisa de outro setor" className="w-full px-4 py-3 bg-chatz-surface-alt border border-chatz-border rounded-chatz text-chatz-text text-sm placeholder:text-chatz-text-subtle focus:border-chatz-primary transition-all resize-none" />
          </div>

          {error && <div className="bg-chatz-danger-light border border-chatz-danger-border text-chatz-danger text-sm rounded-chatz px-4 py-3">{error}</div>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-chatz-surface-alt border border-chatz-border text-chatz-text font-medium rounded-chatz transition-all">Cancelar</button>
            <button type="submit" disabled={loading} className="flex-1 py-3 bg-chatz-button-gradient text-white font-semibold rounded-chatz shadow-[0_4px_14px_rgba(236,72,153,0.35)] hover:brightness-105 transition-all disabled:opacity-50">{loading ? 'Transferindo...' : 'Transferir'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}