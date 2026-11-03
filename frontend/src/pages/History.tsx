import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconBar } from '../components/chat/IconBar';
import { WorkspaceHeader } from '../components/WorkspaceHeader';
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
          <WorkspaceHeader
            section="Atendimento"
            title="Histórico"
            description="Revise conversas finalizadas, consulte detalhes e retome o contexto quando precisar."
          />

          <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-chatz-border bg-white p-3 shadow-sm">
            <label htmlFor="ticket-history-search" className="sr-only">Buscar no histórico</label>
            <div className="flex min-w-[220px] flex-1 items-center gap-3 rounded-xl border border-chatz-border bg-chatz-surface-alt px-3">
              <SearchIcon />
              <input
                id="ticket-history-search"
                type="search"
                value={search}
                onChange={(event) => {
                  setLoading(true);
                  setSearch(event.target.value);
                }}
                placeholder="Buscar por cliente, telefone ou assunto..."
                className="w-full border-0 bg-transparent py-3 text-sm text-chatz-text outline-none placeholder:text-chatz-text-subtle"
              />
            </div>
            <span className="px-2 text-xs font-medium text-chatz-text-muted">
              {loading ? 'Buscando...' : `${tickets.length} ${tickets.length === 1 ? 'conversa' : 'conversas'}`}
            </span>
          </div>

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
                             bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-chatz-primary-border hover:shadow-md"
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
                                 text-xs font-semibold text-chatz-text transition hover:border-chatz-primary-border hover:bg-chatz-primary-light hover:text-chatz-primary"
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

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0 text-chatz-text-subtle">
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="m20 20-4-4" />
    </svg>
  );
}
