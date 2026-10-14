import { useState, FormEvent } from 'react';
import { useTicketsStore } from '../stores/tickets';
import { getErrorMessage } from '../lib/api';
import type { TicketPriority } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const QUEUES = [
  { value: 'geral', label: 'Geral' },
  { value: 'suporte', label: 'Suporte Técnico' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'comercial', label: 'Comercial' },
];

const PRIORITIES: { value: TicketPriority; label: string }[] = [
  { value: 'LOW', label: 'Baixa' },
  { value: 'MEDIUM', label: 'Média' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'URGENT', label: 'Urgente' },
];

export function NewTicketModal({ isOpen, onClose }: Props) {
  const createTicket = useTicketsStore((s) => s.createTicket);

  const [subject, setSubject] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('MEDIUM');
  const [queue, setQueue] = useState('geral');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await createTicket({ subject, priority, queue });
      setSubject('');
      setPriority('MEDIUM');
      setQueue('geral');
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
            Novo atendimento
          </h2>
          <button
            onClick={onClose}
            className="text-chatz-muted hover:text-chatz-text text-2xl leading-none transition-colors"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-chatz-muted mb-2">
              Assunto
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Descreva brevemente o problema"
              className="w-full px-4 py-3 bg-chatz-bg border border-chatz-border rounded-lg
                         text-chatz-text placeholder-chatz-muted
                         focus:border-chatz-primary focus:ring-2 focus:ring-chatz-primary/20
                         transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-chatz-muted mb-2">
                Fila
              </label>
              <select
                value={queue}
                onChange={(e) => setQueue(e.target.value)}
                className="w-full px-4 py-3 bg-chatz-bg border border-chatz-border rounded-lg
                           text-chatz-text focus:border-chatz-primary
                           focus:ring-2 focus:ring-chatz-primary/20 transition-all"
              >
                {QUEUES.map((q) => (
                  <option key={q.value} value={q.value}>
                    {q.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-chatz-muted mb-2">
                Prioridade
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                className="w-full px-4 py-3 bg-chatz-bg border border-chatz-border rounded-lg
                           text-chatz-text focus:border-chatz-primary
                           focus:ring-2 focus:ring-chatz-primary/20 transition-all"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
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
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Criando...' : 'Criar atendimento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}