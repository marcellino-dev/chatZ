import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconBar } from '../components/chat/IconBar';
import { PageBackButton } from '../components/PageBackButton';
import { StatusBadge } from '../components/StatusBadge';
import { api, getErrorMessage } from '../lib/api';
import type { Ticket } from '../types';

function formatClosedAt(value: string | null, fallback: string) {
  const date = value ?? fallback;
  return new Date(date).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export function History() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const { data } = await api.get<Ticket[]>('/tickets/history', {
          params: search.trim() ? { q: search.trim() } : undefined,
          signal: controller.signal,
        });
        setTickets(data);
        setError('');
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(getErrorMessage(requestError));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, search ? 250 : 0);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [search]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-chatz-bg">
      <IconBar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <div className="mb-6 flex items-center gap-3">
            <PageBackButton />
            <div>
              <h1 className="text-2xl font-bold text-chatz-text">Histórico</h1>
              <p className="text-sm text-chatz-text-muted">
                Suas conversas resolvidas ou encerradas
              </p>
            </div>
          </div>

          <label htmlFor="ticket-history-search" className="sr-only">
            Buscar no histórico
          </label>
          <input
            id="ticket-history-search"
            type="search"
            value={search}
            onChange={(event) => {
              setLoading(true);
              setSearch(event.target.value);
            }}
            placeholder="Buscar por cliente, telefone ou assunto..."
            className="mb-5 w-full rounded-chatz border border-chatz-border
                       bg-chatz-surface px-4 py-3 text-sm text-chatz-text
                       placeholder:text-chatz-text-subtle focus:border-chatz-primary
                       focus:ring-2 focus:ring-chatz-primary/20"
          />

          {error && (
            <p
              role="alert"
              className="mb-5 rounded-chatz bg-chatz-danger-light p-4 text-sm text-chatz-danger"
            >
              {error}
            </p>
          )}

          {loading ? (
            <p className="py-16 text-center text-sm text-chatz-text-muted">
              Carregando histórico...
            </p>
          ) : !error && tickets.length === 0 ? (
            <div className="rounded-chatz-xl border border-dashed border-chatz-border bg-chatz-surface p-12 text-center">
              <p className="text-chatz-text-muted">
                {search
                  ? 'Nenhuma conversa encontrada.'
                  : 'Suas conversas finalizadas aparecerão aqui.'}
              </p>
            </div>
          ) : !error ? (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <article
                  key={ticket.id}
                  className="rounded-chatz-xl border border-chatz-border
                             bg-chatz-surface p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <StatusBadge status={ticket.status} />
                        <span className="text-xs text-chatz-text-subtle">
                          Encerrada em{' '}
                          {formatClosedAt(ticket.closedAt, ticket.updatedAt)}
                        </span>
                      </div>
                      <h2 className="font-semibold text-chatz-text">
                        {ticket.subject}
                      </h2>
                      <p className="mt-1 text-sm text-chatz-text-muted">
                        {ticket.client.name}
                        {ticket.client.phone && ` · ${ticket.client.phone}`}
                        {ticket.sector?.name && ` · ${ticket.sector.name}`}
                      </p>
                      {ticket.tags && ticket.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {ticket.tags.map((tag) => (
                            <span
                              key={tag.id}
                              className="rounded-full border border-chatz-border
                                         px-2.5 py-1 text-[11px] text-chatz-text-muted"
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/chat/${ticket.id}`)}
                      className="rounded-chatz border border-chatz-border px-3 py-2
                                 text-xs text-chatz-text hover:bg-chatz-surface-hover"
                    >
                      Ver conversa
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
