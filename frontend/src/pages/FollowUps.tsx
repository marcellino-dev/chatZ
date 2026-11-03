import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconBar } from '../components/chat/IconBar';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { api, getErrorMessage } from '../lib/api';
import type { FollowUp, TicketPriority } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

type Bucket = 'today' | 'overdue' | 'upcoming' | 'done' | 'cancelled';
type PeriodFilter = 'all' | 'today' | 'next7' | 'next30' | 'past30';
type PriorityFilter = 'all' | TicketPriority;

const GROUPS: Record<Bucket, { title: string; dot: string }> = {
  today: { title: 'Hoje', dot: 'bg-violet-700' },
  overdue: { title: 'Atrasados', dot: 'bg-rose-500' },
  upcoming: { title: 'Próximos dias', dot: 'bg-violet-400' },
  done: { title: 'Concluídos', dot: 'bg-emerald-500' },
  cancelled: { title: 'Cancelados', dot: 'bg-slate-400' },
};

// Ordem dos grupos na referência: Hoje, Atrasados, Próximos dias.
const PENDING_ORDER: Bucket[] = ['today', 'overdue', 'upcoming'];
const CLOSED_ORDER: Bucket[] = ['done', 'cancelled'];

// ==========================
// Helpers
// ==========================
function toLocalDateTime(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function formatScheduled(value: string, now: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const diff = Math.round((startOfDay(date.getTime()) - startOfDay(now)) / DAY_MS);
  if (diff === 0) return `Hoje, ${time}`;
  if (diff === -1) return `Ontem, ${time}`;
  if (diff === 1) return `Amanhã, ${time}`;
  const day = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `${day}, ${time}`;
}

function getBucket(followUp: FollowUp, now: number): Bucket {
  if (followUp.completedAt) return 'done';
  if (followUp.cancelledAt) return 'cancelled';
  const scheduled = new Date(followUp.scheduledAt).getTime();
  if (scheduled <= now) return 'overdue';
  if (scheduled < startOfDay(now) + DAY_MS) return 'today';
  return 'upcoming';
}

function matchesPeriod(followUp: FollowUp, period: PeriodFilter, now: number): boolean {
  if (period === 'all') return true;
  const scheduled = new Date(followUp.scheduledAt).getTime();
  const today = startOfDay(now);
  if (period === 'today') return scheduled >= today && scheduled < today + DAY_MS;
  if (period === 'next7') return scheduled >= today && scheduled < today + 7 * DAY_MS;
  if (period === 'next30') return scheduled >= today && scheduled < today + 30 * DAY_MS;
  return scheduled >= today - 30 * DAY_MS && scheduled < today;
}

function countLabel(count: number): string {
  return `${count.toLocaleString('pt-BR')} follow-up${count === 1 ? '' : 's'}`;
}

// ==========================
// Página
// ==========================
export function FollowUps() {
  const navigate = useNavigate();
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [showClosed, setShowClosed] = useState(false);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [priority, setPriority] = useState<PriorityFilter>('all');
  const [agent, setAgent] = useState('all');
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [editing, setEditing] = useState<FollowUp | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editNote, setEditNote] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadFollowUps() {
      try {
        // Carrega também os encerrados: os cards "Concluídos" e a visão de
        // histórico trabalham em cima da mesma lista.
        const { data } = await api.get<FollowUp[]>('/follow-ups/mine', {
          params: { includeClosed: true },
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
  }, []);

  // Fecha o menu "⋮" ao clicar em qualquer outro lugar.
  useEffect(() => {
    if (!menuId) return;
    const close = () => setMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuId]);

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
      const { data } = await api.post<FollowUp>(`/follow-ups/${id}/${action}`);
      setFollowUps((current) => current.map((item) => (item.id === data.id ? data : item)));
      if (editing?.id === id) setEditing(null);
    } catch (requestError) {
      setActionError(getErrorMessage(requestError));
    } finally {
      setSavingId(null);
    }
  }

  const agentOptions = useMemo(() => {
    const names = new Set<string>();
    followUps.forEach((item) => {
      if (item.ticket.agentName) names.add(item.ticket.agentName);
    });
    return [...names].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [followUps]);

  const metrics = useMemo(() => {
    const counts = { pending: 0, today: 0, overdue: 0, done: 0 };
    followUps.forEach((item) => {
      const bucket = getBucket(item, currentTime);
      if (bucket === 'done') counts.done += 1;
      if (bucket === 'today') counts.today += 1;
      if (bucket === 'overdue') counts.overdue += 1;
      if (bucket === 'today' || bucket === 'overdue' || bucket === 'upcoming') counts.pending += 1;
    });
    return counts;
  }, [followUps, currentTime]);

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const order = showClosed ? CLOSED_ORDER : PENDING_ORDER;
    const byBucket = new Map<Bucket, FollowUp[]>();

    followUps.forEach((item) => {
      const bucket = getBucket(item, currentTime);
      if (!order.includes(bucket)) return;
      if (term) {
        const haystack = `${item.ticket.clientName} ${item.ticket.subject} ${item.note ?? ''}`.toLowerCase();
        if (!haystack.includes(term)) return;
      }
      if (!matchesPeriod(item, period, currentTime)) return;
      if (priority !== 'all' && item.ticket.priority !== priority) return;
      if (agent !== 'all' && item.ticket.agentName !== agent) return;
      byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), item]);
    });

    return order
      .map((bucket) => {
        const items = [...(byBucket.get(bucket) ?? [])];
        items.sort((a, b) =>
          showClosed
            ? new Date(b.completedAt ?? b.cancelledAt ?? b.scheduledAt).getTime() -
              new Date(a.completedAt ?? a.cancelledAt ?? a.scheduledAt).getTime()
            : new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
        );
        return { bucket, items };
      })
      .filter((group) => group.items.length > 0);
  }, [followUps, currentTime, showClosed, search, period, priority, agent]);

  const hasActiveFilters =
    Boolean(search.trim()) || period !== 'all' || priority !== 'all' || agent !== 'all';

  return (
    <div className="flex h-[100dvh] w-screen overflow-hidden bg-[#f7f8fd]">
      <IconBar />
      <main className="relative min-w-0 flex-1 overflow-y-auto">
        {/* Brilho decorativo do canto superior direito */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-28 -top-36 h-[22rem] w-[22rem] rounded-full bg-[radial-gradient(circle_at_40%_60%,rgba(251,146,60,0.35),rgba(244,114,182,0.28)_45%,transparent_70%)]"
        />

        <div className="relative mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.22em] text-fuchsia-600">
                Follow-ups
              </p>
              <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-900">
                Follow-ups
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500 sm:text-base">
                Organize seus retornos e não deixe nenhuma conversa sem acompanhamento.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowClosed((value) => !value)}
              className="flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-bold text-slate-800 shadow-sm transition hover:border-violet-300 hover:bg-violet-50"
            >
              <Icon name="history" className="h-[18px] w-[18px]" />
              {showClosed ? 'Ver pendentes' : 'Ver histórico'}
            </button>
          </header>

          <section aria-label="Resumo dos follow-ups" className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={<Icon name="clock" className="h-7 w-7" />}
              tone="violet"
              label="Pendentes"
              value={loading ? '—' : metrics.pending.toLocaleString('pt-BR')}
            />
            <MetricCard
              icon={<Icon name="calendarCheck" className="h-7 w-7" />}
              tone="green"
              label="Para hoje"
              value={loading ? '—' : metrics.today.toLocaleString('pt-BR')}
            />
            <MetricCard
              icon={<Icon name="alert" className="h-7 w-7" />}
              tone="orange"
              label="Atrasados"
              value={loading ? '—' : metrics.overdue.toLocaleString('pt-BR')}
            />
            <MetricCard
              icon={<Icon name="checkCircle" className="h-7 w-7" />}
              tone="green"
              label="Concluídos"
              value={loading ? '—' : metrics.done.toLocaleString('pt-BR')}
            />
          </section>

          <section className="mb-6 flex flex-col gap-3 xl:flex-row" aria-label="Filtros dos follow-ups">
            <label
              htmlFor="follow-up-search"
              className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm transition focus-within:border-violet-300 focus-within:ring-2 focus-within:ring-violet-100"
            >
              <Icon name="search" className="h-5 w-5 shrink-0 text-slate-500" />
              <input
                id="follow-up-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por cliente ou assunto..."
                className="h-[50px] min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />
            </label>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:flex">
              <FilterSelect
                icon={<Icon name="calendar" />}
                label="Período"
                value={period}
                onChange={(value) => setPeriod(value as PeriodFilter)}
              >
                <option value="all">Período</option>
                <option value="today">Hoje</option>
                <option value="next7">Próximos 7 dias</option>
                <option value="next30">Próximos 30 dias</option>
                <option value="past30">Últimos 30 dias</option>
              </FilterSelect>
              <FilterSelect
                icon={<Icon name="star" />}
                label="Prioridade"
                value={priority}
                onChange={(value) => setPriority(value as PriorityFilter)}
              >
                <option value="all">Prioridade</option>
                <option value="URGENT">Urgente</option>
                <option value="HIGH">Alta</option>
                <option value="MEDIUM">Média</option>
                <option value="LOW">Baixa</option>
              </FilterSelect>
              <FilterSelect
                icon={<Icon name="user" />}
                label="Atendente"
                value={agent}
                onChange={setAgent}
              >
                <option value="all">Atendente</option>
                {agentOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </FilterSelect>
              {/* Não há endpoint para criar follow-up sem uma conversa: o agendamento é feito no painel do chat. */}
              <button
                type="button"
                onClick={() => navigate('/chat')}
                title="Abra uma conversa e agende o follow-up pelo painel lateral"
                className="col-span-2 flex h-[50px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-500 px-6 text-sm font-bold text-white shadow-md shadow-pink-200/60 transition hover:-translate-y-0.5 hover:shadow-lg sm:col-span-1"
              >
                <Icon name="plus" className="h-5 w-5" />
                Novo follow-up
              </button>
            </div>
          </section>

          {error && (
            <p role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </p>
          )}
          {actionError && (
            <p role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {actionError}
            </p>
          )}

          {loading ? (
            <p className="py-16 text-center text-sm text-slate-500">Carregando follow-ups...</p>
          ) : groups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-12 text-center">
              <p className="text-sm font-semibold text-slate-700">
                {hasActiveFilters
                  ? 'Nenhum follow-up encontrado'
                  : showClosed
                    ? 'Você ainda não tem follow-ups no histórico'
                    : 'Você não tem follow-ups pendentes'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {hasActiveFilters
                  ? 'Tente ajustar a busca ou os filtros.'
                  : 'Agende retornos pelo painel de uma conversa.'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {groups.map(({ bucket, items }) => (
                <section key={bucket} aria-label={GROUPS[bucket].title}>
                  <div className="mb-2.5 flex items-center justify-between gap-3">
                    <h2 className="flex items-center gap-2.5 text-lg font-extrabold text-slate-900">
                      <span aria-hidden="true" className={`h-3.5 w-3.5 rounded-full ${GROUPS[bucket].dot}`} />
                      {GROUPS[bucket].title}
                    </h2>
                    <span className="text-sm text-slate-500">{countLabel(items.length)}</span>
                  </div>

                  <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
                    {items.map((followUp) => {
                      const isPending = bucket === 'today' || bucket === 'overdue' || bucket === 'upcoming';
                      const busy = savingId === followUp.id;
                      const contact = followUp.ticket.clientPhone || 'Telefone não informado';

                      return (
                        <li
                          key={followUp.id}
                          className={`flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 2xl:grid 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_8rem_6.5rem_7.5rem_auto] ${
                            bucket === 'overdue' ? 'bg-rose-50/70' : ''
                          }`}
                        >
                          <div className="flex min-w-[220px] flex-1 items-center gap-3 2xl:min-w-0 2xl:border-r 2xl:border-slate-200 2xl:pr-4">
                            <ProfileAvatar
                              name={followUp.ticket.clientName}
                              pictureUrl={followUp.ticket.clientProfilePictureUrl}
                              sizeClass="h-12 w-12"
                              textClass="text-sm"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-slate-900">{followUp.ticket.clientName}</p>
                              <p className="truncate text-xs text-slate-500">{contact}</p>
                            </div>
                          </div>

                          <div className="min-w-[220px] flex-1 2xl:min-w-0">
                            <p className="truncate text-sm font-bold text-slate-900">{followUp.ticket.subject}</p>
                            {followUp.note && (
                              <p className="truncate text-xs text-slate-500">{followUp.note}</p>
                            )}
                          </div>

                          <time
                            dateTime={followUp.scheduledAt}
                            className={`inline-flex items-center gap-2 whitespace-nowrap text-sm font-bold ${
                              bucket === 'overdue' ? 'text-rose-600' : 'text-slate-800'
                            }`}
                          >
                            <Icon
                              name="calendar"
                              className={`h-4 w-4 ${bucket === 'overdue' ? 'text-rose-500' : 'text-violet-600'}`}
                            />
                            {formatScheduled(followUp.scheduledAt, currentTime)}
                          </time>

                          <PriorityPill priority={followUp.ticket.priority} />
                          <StatusPill bucket={bucket} />

                          <div className="relative ml-auto flex items-center justify-end gap-2">
                            {isPending && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void handleFinish(followUp.id, 'complete')}
                                className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-50"
                              >
                                <Icon name="check" className="h-3.5 w-3.5" />
                                Concluir
                              </button>
                            )}
                            {followUp.ticket.canOpen && (
                              <button
                                type="button"
                                onClick={() => navigate(`/chat/${followUp.ticket.id}`)}
                                className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-violet-100 px-4 py-2 text-xs font-bold text-violet-700 ring-1 ring-violet-200 transition hover:bg-violet-200/70"
                              >
                                <Icon name="chat" className="h-3.5 w-3.5" />
                                Abrir conversa
                              </button>
                            )}
                            {isPending && (
                              <>
                                <button
                                  type="button"
                                  aria-label="Mais ações"
                                  aria-haspopup="menu"
                                  aria-expanded={menuId === followUp.id}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setMenuId((current) => (current === followUp.id ? null : followUp.id));
                                  }}
                                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100"
                                >
                                  <Icon name="dots" className="h-4 w-4" />
                                </button>
                                {menuId === followUp.id && (
                                  <div
                                    role="menu"
                                    className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-2xl bg-white py-1.5 text-left shadow-xl ring-1 ring-slate-200"
                                  >
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => {
                                        setMenuId(null);
                                        beginEdit(followUp);
                                      }}
                                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-violet-50"
                                    >
                                      <Icon name="calendar" className="h-4 w-4" />
                                      Reagendar
                                    </button>
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => {
                                        setMenuId(null);
                                        void handleFinish(followUp.id, 'cancel');
                                      }}
                                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
                                    >
                                      <Icon name="x" className="h-4 w-4" />
                                      Cancelar follow-up
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>

                          {editing?.id === followUp.id && (
                            <form
                              onSubmit={handleReschedule}
                              className="grid basis-full gap-3 border-t border-slate-100 pt-3 sm:grid-cols-[1fr_2fr_auto] 2xl:col-span-full"
                            >
                              <label className="text-xs font-medium text-slate-600">
                                Novo horário
                                <input
                                  type="datetime-local"
                                  required
                                  value={editDate}
                                  onChange={(event) => setEditDate(event.target.value)}
                                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-violet-300"
                                />
                              </label>
                              <label className="text-xs font-medium text-slate-600">
                                Observação
                                <input
                                  value={editNote}
                                  maxLength={1000}
                                  onChange={(event) => setEditNote(event.target.value)}
                                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-violet-300"
                                />
                              </label>
                              <div className="flex items-end gap-2">
                                <button
                                  type="submit"
                                  disabled={busy}
                                  className="rounded-full bg-violet-600 px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-50"
                                >
                                  Salvar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditing(null)}
                                  className="rounded-full border border-slate-200 bg-white px-5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                                >
                                  Fechar
                                </button>
                              </div>
                            </form>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ==========================
// Componentes de apresentação
// ==========================
const PRIORITY_CONFIG: Record<TicketPriority, { label: string; className: string; icon: IconName }> = {
  URGENT: { label: 'Urgente', className: 'bg-red-100 text-red-700', icon: 'alertCircle' },
  HIGH: { label: 'Alta', className: 'bg-rose-100 text-rose-600', icon: 'alertCircle' },
  MEDIUM: { label: 'Média', className: 'bg-amber-100 text-amber-700', icon: 'star' },
  LOW: { label: 'Baixa', className: 'bg-emerald-100 text-emerald-700', icon: 'arrowDown' },
};

function PriorityPill({ priority }: { priority: TicketPriority }) {
  const config = PRIORITY_CONFIG[priority];
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${config.className}`}
    >
      <Icon name={config.icon} className="h-3.5 w-3.5" filled={config.icon === 'star'} />
      {config.label}
    </span>
  );
}

const STATUS_CONFIG: Record<Bucket, { label: string; className: string; icon: IconName }> = {
  today: { label: 'Pendente', className: 'bg-orange-100 text-orange-600', icon: 'clock' },
  overdue: { label: 'Atrasado', className: 'bg-rose-100 text-rose-600', icon: 'alert' },
  upcoming: { label: 'Agendado', className: 'bg-violet-100 text-violet-700', icon: 'calendar' },
  done: { label: 'Concluído', className: 'bg-emerald-100 text-emerald-700', icon: 'checkCircle' },
  cancelled: { label: 'Cancelado', className: 'bg-slate-100 text-slate-600', icon: 'x' },
};

function StatusPill({ bucket }: { bucket: Bucket }) {
  const config = STATUS_CONFIG[bucket];
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${config.className}`}
    >
      <Icon name={config.icon} className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
}

type Tone = 'violet' | 'green' | 'orange';

const TONES: Record<Tone, { circle: string; stroke: string }> = {
  violet: { circle: 'bg-violet-100 text-violet-600', stroke: '#a855f7' },
  green: { circle: 'bg-emerald-100 text-emerald-600', stroke: '#10b981' },
  orange: { circle: 'bg-orange-100 text-orange-500', stroke: '#f97316' },
};

function MetricCard({
  icon,
  tone,
  label,
  value,
}: {
  icon: ReactNode;
  tone: Tone;
  label: string;
  value: string;
}) {
  return (
    <article className="relative flex min-h-[96px] items-center gap-4 overflow-hidden rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-slate-200/50">
      <div className={`relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${TONES[tone].circle}`}>
        {icon}
      </div>
      <div className="relative z-10 min-w-0">
        <p className="truncate text-sm font-medium text-slate-600">{label}</p>
        <p className="mt-0.5 text-3xl font-extrabold tracking-tight text-slate-900">{value}</p>
      </div>
      <MiniWave tone={tone} label={label} />
    </article>
  );
}

function MiniWave({ tone, label }: { tone: Tone; label: string }) {
  const color = TONES[tone].stroke;
  // O id precisa ser único por card (dois cards usam o tom "green").
  const gradientId = `followups-wave-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 160 56"
      preserveAspectRatio="none"
      className="pointer-events-none absolute bottom-0 right-0 hidden h-14 w-44 sm:block"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0 46c14 0 14-12 28-12s12 8 26 8 16-20 30-20 14 10 28 10 18-24 32-24 10 8 16 8V56H0Z"
        fill={`url(#${gradientId})`}
      />
      <path
        d="M0 46c14 0 14-12 28-12s12 8 26 8 16-20 30-20 14 10 28 10 18-24 32-24 10 8 16 8"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FilterSelect({
  icon,
  label,
  value,
  onChange,
  children,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="relative flex h-[50px] min-w-0 items-center gap-2 rounded-full border border-slate-200 bg-white pl-4 pr-9 shadow-sm transition focus-within:border-violet-300 sm:min-w-[140px]">
      <span className="sr-only">{label}</span>
      <span className="shrink-0 text-slate-800">{icon}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full min-w-0 cursor-pointer appearance-none bg-transparent text-sm font-bold text-slate-800 outline-none"
      >
        {children}
      </select>
      <span className="pointer-events-none absolute right-3.5 text-slate-700">
        <Icon name="chevronDown" className="h-3.5 w-3.5" />
      </span>
    </label>
  );
}

// ==========================
// Ícones
// ==========================
type IconName =
  | 'search' | 'calendar' | 'calendarCheck' | 'star' | 'user' | 'plus' | 'history'
  | 'clock' | 'alert' | 'alertCircle' | 'arrowDown' | 'check' | 'checkCircle'
  | 'chat' | 'dots' | 'chevronDown' | 'x';

const ICON_PATHS: Record<IconName, ReactNode> = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  calendarCheck: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4" /></>,
  star: <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1Z" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a7 7 0 0 1 7-7h2a7 7 0 0 1 7 7v1" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  alert: <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>,
  alertCircle: <><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></>,
  arrowDown: <path d="M12 5v14m0 0 6-6m-6 6-6-6" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  checkCircle: <><circle cx="12" cy="12" r="10" /><path d="m7.5 12.5 3 3 6-6.5" /></>,
  chat: <path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12Z" />,
  dots: <><circle cx="12" cy="5" r="1.4" fill="currentColor" /><circle cx="12" cy="12" r="1.4" fill="currentColor" /><circle cx="12" cy="19" r="1.4" fill="currentColor" /></>,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
};

function Icon({
  name,
  className = 'h-[18px] w-[18px]',
  filled = false,
}: {
  name: IconName;
  className?: string;
  filled?: boolean;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {ICON_PATHS[name]}
    </svg>
  );
}