import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconBar } from '../components/chat/IconBar';
import { WorkspaceHeader } from '../components/WorkspaceHeader';
import { api, getErrorMessage } from '../lib/api';
import type { FollowUp } from '../types';

function toLocalDateTime(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export function FollowUps() {
  const navigate = useNavigate();
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [includeClosed, setIncludeClosed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [editing, setEditing] = useState<FollowUp | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editNote, setEditNote] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadFollowUps() {
      try {
        const { data } = await api.get<FollowUp[]>('/follow-ups/mine', {
          params: includeClosed ? { includeClosed: true } : undefined,
        });
        if (active) {
          setFollowUps(data);
          setError('');
          setCurrentTime(Date.now());
        }
      } catch (requestError) {
        if (active) setError(getErrorMessage(requestError));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadFollowUps();
    const interval = window.setInterval(() => {
      setCurrentTime(Date.now());
      void loadFollowUps();
    }, 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [includeClosed]);

  function beginEdit(followUp: FollowUp) {
    setEditing(followUp);
    setEditDate(toLocalDateTime(followUp.scheduledAt));
    setEditNote(followUp.note ?? '');
    setActionError('');
  }

  async function handleReschedule(event: FormEvent) {
    event.preventDefault();
    if (!editing || !editDate || savingId) return;

    setSavingId(editing.id);
    setActionError('');
    try {
      const { data } = await api.patch<FollowUp>(`/follow-ups/${editing.id}`, {
        scheduledAt: new Date(editDate).toISOString(),
        note: editNote,
      });
      setFollowUps((current) =>
        current.map((item) => (item.id === data.id ? data : item))
      );
      setEditing(null);
    } catch (requestError) {
      setActionError(getErrorMessage(requestError));
    } finally {
      setSavingId(null);
    }
  }

  async function handleFinish(id: string, action: 'complete' | 'cancel') {
    setSavingId(id);
    setActionError('');
    try {
      const { data } = await api.post<FollowUp>(
        `/follow-ups/${id}/${action}`
      );
      setFollowUps((current) =>
        includeClosed
          ? current.map((item) => (item.id === data.id ? data : item))
          : current.filter((item) => item.id !== data.id)
      );
      if (editing?.id === id) setEditing(null);
    } catch (requestError) {
      setActionError(getErrorMessage(requestError));
    } finally {
      setSavingId(null);
    }
  }

  const overdueCount = followUps.filter(
    (item) =>
      !item.completedAt &&
      !item.cancelledAt &&
      new Date(item.scheduledAt).getTime() <= currentTime
  ).length;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-chatz-bg">
      <IconBar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <WorkspaceHeader
            section="Relacionamento"
            title="Follow-ups"
            description="Organize os retornos combinados e não deixe nenhuma conversa sem acompanhamento."
            action={(
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  setIncludeClosed((value) => !value);
                }}
                className="w-full rounded-xl border border-chatz-border bg-white px-4 py-2.5 text-sm font-semibold text-chatz-text shadow-sm transition hover:border-chatz-primary-border hover:bg-chatz-primary-light hover:text-chatz-primary sm:w-auto"
              >
                {includeClosed ? 'Ver pendentes' : 'Ver histórico'}
              </button>
            )}
          />

          {!includeClosed && overdueCount > 0 && (
            <div
              role="status"
              className="mb-5 flex items-center gap-3 rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 to-white px-4 py-4 text-sm text-rose-800 shadow-sm"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-lg">!</span>
              <span>Você tem <strong>{overdueCount} follow-up{overdueCount === 1 ? '' : 's'}</strong> vencido{overdueCount === 1 ? '' : 's'} e aguardando atenção.</span>
            </div>
          )}

          {error && (
            <p role="alert" className="mb-5 rounded-chatz bg-chatz-danger-light p-4 text-sm text-chatz-danger">
              {error}
            </p>
          )}
          {actionError && (
            <p role="alert" className="mb-5 rounded-chatz bg-chatz-danger-light p-4 text-sm text-chatz-danger">
              {actionError}
            </p>
          )}

          {loading ? (
            <p className="py-16 text-center text-sm text-chatz-text-muted">
              Carregando follow-ups...
            </p>
          ) : followUps.length === 0 ? (
            <div className="rounded-chatz-xl border border-dashed border-chatz-border bg-chatz-surface p-12 text-center">
              <p className="text-chatz-text-muted">
                {includeClosed
                  ? 'Você ainda não tem follow-ups no histórico.'
                  : 'Você não tem follow-ups pendentes.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {followUps.map((followUp) => {
                const isOverdue =
                  !followUp.completedAt &&
                  !followUp.cancelledAt &&
                  new Date(followUp.scheduledAt).getTime() <= currentTime;
                const stateLabel = followUp.completedAt
                  ? 'Concluído'
                  : followUp.cancelledAt
                    ? 'Cancelado'
                    : isOverdue
                      ? 'Vencido'
                      : 'Agendado';

                return (
                  <article
                    key={followUp.id}
                    className={`rounded-2xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${
                      isOverdue
                        ? 'border-chatz-danger-border'
                        : 'border-chatz-border'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                              isOverdue
                                ? 'bg-chatz-danger-light text-chatz-danger'
                                : 'bg-chatz-primary-light text-chatz-primary'
                            }`}
                          >
                            {stateLabel}
                          </span>
                          <time
                            dateTime={followUp.scheduledAt}
                            className="text-sm font-medium text-chatz-text"
                          >
                            {formatDateTime(followUp.scheduledAt)}
                          </time>
                        </div>
                        <h2 className="font-semibold text-chatz-text">
                          {followUp.ticket.subject}
                        </h2>
                        <p className="mt-1 text-sm text-chatz-text-muted">
                          {followUp.ticket.clientName}
                          {followUp.ticket.agentName &&
                            ` · Atendente atual: ${followUp.ticket.agentName}`}
                        </p>
                        {followUp.note && (
                          <p className="mt-3 whitespace-pre-wrap text-sm text-chatz-text-muted">
                            {followUp.note}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {followUp.ticket.canOpen && (
                          <button
                            type="button"
                            onClick={() => navigate(`/chat/${followUp.ticket.id}`)}
                            className="rounded-chatz border border-chatz-border px-3 py-2 text-xs
                                       text-chatz-text hover:bg-chatz-surface-hover"
                          >
                            Abrir conversa
                          </button>
                        )}
                        {!followUp.completedAt && !followUp.cancelledAt && (
                          <>
                            <button
                              type="button"
                              disabled={savingId === followUp.id}
                              onClick={() => beginEdit(followUp)}
                              className="rounded-chatz border border-chatz-border px-3 py-2 text-xs
                                         text-chatz-text hover:bg-chatz-surface-hover
                                         disabled:opacity-50"
                            >
                              Reagendar
                            </button>
                            <button
                              type="button"
                              disabled={savingId === followUp.id}
                              onClick={() => void handleFinish(followUp.id, 'complete')}
                              className="rounded-chatz bg-chatz-success px-3 py-2 text-xs
                                         font-medium text-white hover:opacity-90
                                         disabled:opacity-50"
                            >
                              Concluir
                            </button>
                            <button
                              type="button"
                              disabled={savingId === followUp.id}
                              onClick={() => void handleFinish(followUp.id, 'cancel')}
                              className="rounded-chatz border border-chatz-danger-border px-3 py-2
                                         text-xs text-chatz-danger hover:bg-chatz-danger-light
                                         disabled:opacity-50"
                            >
                              Cancelar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {editing?.id === followUp.id && (
                      <form
                        onSubmit={handleReschedule}
                        className="mt-4 grid gap-3 border-t border-chatz-border pt-4 sm:grid-cols-[1fr_2fr_auto]"
                      >
                        <label className="text-xs text-chatz-text-muted">
                          Novo horário
                          <input
                            type="datetime-local"
                            required
                            value={editDate}
                            onChange={(event) => setEditDate(event.target.value)}
                            className="mt-1 w-full rounded-chatz border border-chatz-border
                                       bg-chatz-bg px-3 py-2 text-sm text-chatz-text"
                          />
                        </label>
                        <label className="text-xs text-chatz-text-muted">
                          Observação
                          <input
                            value={editNote}
                            maxLength={1000}
                            onChange={(event) => setEditNote(event.target.value)}
                            className="mt-1 w-full rounded-chatz border border-chatz-border
                                       bg-chatz-bg px-3 py-2 text-sm text-chatz-text"
                          />
                        </label>
                        <div className="flex items-end gap-2">
                          <button
                            type="submit"
                            disabled={savingId === followUp.id}
                            className="rounded-chatz bg-chatz-primary px-3 py-2 text-xs
                                       font-medium text-white disabled:opacity-50"
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditing(null)}
                            className="rounded-chatz border border-chatz-border px-3 py-2
                                       text-xs text-chatz-text"
                          >
                            Fechar
                          </button>
                        </div>
                      </form>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
