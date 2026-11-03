import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconBar } from '../components/chat/IconBar';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { api, getErrorMessage } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import type { Ticket, TicketStatus, User } from '../types';

type Period = 'all' | '7' | '30' | '90';
type StatusFilter = 'all' | 'RESOLVED' | 'CLOSED';
type ChannelFilter = string; // 'all' | 'WHATSAPP' | 'WEB' | 'EMAIL'

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function formatClosedAt(value: string | null, fallback: string) {
  const date = new Date(value ?? fallback);
  if (Number.isNaN(date.getTime())) return '—';
  const day = date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const time = date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${day} às ${time}`;
}

function formatDuration(milliseconds: number): string {
  const minutes = Math.max(0, Math.round(milliseconds / 60_000));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${remainingMinutes}min`;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}min`;
}

function getStatusLabel(status: TicketStatus): string {
  return status === 'RESOLVED' ? 'Resolvido' : status === 'CLOSED' ? 'Fechado' : status;
}

// TODO(backend): enviar `client.email` no /tickets/history.
// Enquanto não vier, mostra o telefone.
function getClientContact(ticket: Ticket): string {
  return ticket.client.email || ticket.client.phone || 'Sem contato';
}

// TODO(backend): enviar `lastMessage.content` no /tickets/history.
// Enquanto não vier, mostra o nome do setor.
function getSubjectPreview(ticket: Ticket): string {
  const preview = ticket.lastMessage?.content?.trim();
  return preview || ticket.sector?.name || 'Sem setor';
}

export function History() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [agents, setAgents] = useState<User[]>([]);
  const [agentsError, setAgentsError] = useState('');
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<Period>('all');
  const [periodCutoff, setPeriodCutoff] = useState<number | null>(null);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [channel, setChannel] = useState<ChannelFilter>('all');
  const [agent, setAgent] = useState('all');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.role !== 'ADMIN') return;

    const controller = new AbortController();
    api
      .get<User[]>('/auth/users', { signal: controller.signal })
      .then(({ data }) => {
        setAgents(data.filter((agentUser) => agentUser.role === 'AGENT'));
        setAgentsError('');
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setAgentsError(getErrorMessage(requestError));
        }
      });

    return () => controller.abort();
  }, [user?.role]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get<Ticket[]>('/tickets/history', {
          params: {
            ...(search.trim() ? { q: search.trim() } : {}),
            ...(user?.role === 'ADMIN' && agent !== 'all' ? { agentId: agent } : {}),
          },
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
  }, [search, refreshKey, user?.role, agent]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const closedAt = new Date(ticket.closedAt ?? ticket.updatedAt).getTime();
      if (periodCutoff !== null && closedAt < periodCutoff) return false;
      if (status !== 'all' && ticket.status !== status) return false;
      if (channel !== 'all' && ticket.channel !== channel) return false;
      return true;
    });
  }, [tickets, periodCutoff, status, channel]);

  const averageDuration = useMemo(() => {
    const durations = filteredTickets
      .map((ticket) => {
        const start = new Date(ticket.createdAt).getTime();
        const end = new Date(ticket.closedAt ?? ticket.updatedAt).getTime();
        return Number.isFinite(start) && Number.isFinite(end) && end >= start ? end - start : null;
      })
      .filter((duration): duration is number => duration !== null);

    if (durations.length === 0) return null;
    return durations.reduce((total, duration) => total + duration, 0) / durations.length;
  }, [filteredTickets]);

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleTickets = filteredTickets.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const resolvedCount = filteredTickets.filter((ticket) => ticket.status === 'RESOLVED').length;
  // TODO(backend): contar conversas "em acompanhamento" (ex.: com follow-up pendente).
  // Enquanto não houver esse dado, o card mostra "—".
  const firstItem = filteredTickets.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastItem = Math.min(currentPage * pageSize, filteredTickets.length);
  const hasActiveFilters =
    Boolean(search) || period !== 'all' || status !== 'all' || channel !== 'all' || agent !== 'all';

  function resetPage() {
    setPage(1);
  }

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
          <header className="mb-6">
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.22em] text-fuchsia-600">
              Atendimento
            </p>
            <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-900">
              Histórico
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500 sm:text-base">
              Consulte atendimentos finalizados e retome conversas quando precisar.
            </p>
          </header>

          <section aria-label="Resumo do histórico" className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={<ChatMetricIcon />}
              tone="violet"
              label="Total de conversas"
              value={loading ? '—' : filteredTickets.length.toLocaleString('pt-BR')}
            />
            <MetricCard
              icon={<CheckMetricIcon />}
              tone="green"
              label="Resolvidas"
              value={loading ? '—' : resolvedCount.toLocaleString('pt-BR')}
            />
            <MetricCard
              icon={<ArchiveMetricIcon />}
              tone="orange"
              label="Em acompanhamento"
              value="—"
            />
            <MetricCard
              icon={<HourglassMetricIcon />}
              tone="violet"
              label="Tempo médio"
              value={loading || averageDuration === null ? '—' : formatDuration(averageDuration)}
            />
          </section>

          <section className="mb-6 flex flex-col gap-3 xl:flex-row" aria-label="Filtros do histórico">
            <label
              htmlFor="ticket-history-search"
              className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm transition focus-within:border-violet-300 focus-within:ring-2 focus-within:ring-violet-100"
            >
              <SearchIcon />
              <input
                id="ticket-history-search"
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  resetPage();
                }}
                placeholder="Buscar por cliente, assunto, telefone ou atendente..."
                className="h-[50px] min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />
            </label>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:flex">
              <FilterSelect
                icon={<CalendarIcon />}
                label="Período"
                value={period}
                onChange={(value) => {
                  const nextPeriod = value as Period;
                  setPeriod(nextPeriod);
                  setPeriodCutoff(
                    nextPeriod === 'all'
                      ? null
                      : Date.now() - Number(nextPeriod) * 24 * 60 * 60 * 1000
                  );
                  resetPage();
                }}
              >
                <option value="all">Período</option>
                <option value="7">Últimos 7 dias</option>
                <option value="30">Últimos 30 dias</option>
                <option value="90">Últimos 90 dias</option>
              </FilterSelect>
              <FilterSelect
                icon={<StatusDotIcon />}
                label="Status"
                value={status}
                onChange={(value) => {
                  setStatus(value as StatusFilter);
                  resetPage();
                }}
              >
                <option value="all">Status</option>
                <option value="RESOLVED">Resolvido</option>
                <option value="CLOSED">Fechado</option>
              </FilterSelect>
              <FilterSelect
                icon={<ChannelDotIcon />}
                label="Canal"
                value={channel}
                onChange={(value) => {
                  setChannel(value as ChannelFilter);
                  resetPage();
                }}
              >
                <option value="all">Canal</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="WEB">Chat online</option>
                <option value="EMAIL">E-mail</option>
              </FilterSelect>
              {user?.role === 'ADMIN' && (
                <FilterSelect
                  icon={<UserIcon />}
                  label="Atendente"
                  value={agent}
                  onChange={(value) => {
                    setAgent(value);
                    resetPage();
                  }}
                >
                  <option value="all">Atendente</option>
                  {agents.map((agentUser) => (
                    <option key={agentUser.id} value={agentUser.id}>{agentUser.name}</option>
                  ))}
                </FilterSelect>
              )}
              <button
                type="button"
                onClick={() => setRefreshKey((key) => key + 1)}
                disabled={loading}
                className="col-span-2 flex h-[50px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-pink-500 to-orange-500 px-6 text-sm font-bold text-white shadow-md shadow-pink-200/60 transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-wait disabled:opacity-70 sm:col-span-1"
              >
                <RefreshIcon className={loading ? 'animate-spin' : ''} />
                Atualizar
              </button>
            </div>
          </section>

          {error && (
            <p role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </p>
          )}
          {agentsError && user?.role === 'ADMIN' && (
            <p role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Não foi possível carregar a lista de atendentes: {agentsError}
            </p>
          )}

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[15px] text-slate-800" aria-live="polite">
              {loading ? (
                'Carregando conversas...'
              ) : (
                <>
                  <span className="font-extrabold">{filteredTickets.length.toLocaleString('pt-BR')}</span>{' '}
                  <span className="font-semibold">conversas encontradas</span>
                </>
              )}
            </p>
            <label className="flex items-center gap-2 text-sm text-slate-500">
              Exibir
              <span className="relative">
                <select
                  aria-label="Conversas por página"
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    resetPage();
                  }}
                  className="appearance-none rounded-xl border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-violet-300"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500">
                  <ChevronDownIcon />
                </span>
              </span>
            </label>
          </div>

          <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] border-collapse text-left">
                <thead>
                  <tr className="bg-[#f6f6fc] text-sm font-semibold text-slate-700">
                    <th scope="col" className="px-5 py-3.5">Cliente</th>
                    <th scope="col" className="px-4 py-3.5">Assunto</th>
                    <th scope="col" className="px-4 py-3.5">Canal</th>
                    <th scope="col" className="px-4 py-3.5">Atendente</th>
                    <th scope="col" className="px-4 py-3.5">Data de encerramento</th>
                    <th scope="col" className="px-4 py-3.5">Status</th>
                    <th scope="col" className="px-5 py-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!loading && !error && visibleTickets.map((ticket) => (
                    <tr key={ticket.id} className="transition-colors hover:bg-violet-50/30">
                      <td className="px-5 py-3.5">
                        <div className="flex min-w-[170px] items-center gap-3">
                          <ProfileAvatar
                            name={ticket.client.name}
                            pictureUrl={ticket.client.profilePictureUrl}
                            sizeClass="h-11 w-11"
                            textClass="text-xs"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-900">{ticket.client.name}</p>
                            <p className="truncate text-xs text-slate-500">{getClientContact(ticket)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="max-w-[230px]">
                          <p className="truncate text-sm font-bold text-slate-900">{ticket.subject}</p>
                          <p className="truncate text-xs text-slate-500">{getSubjectPreview(ticket)}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <ChannelBadge channel={ticket.channel} />
                      </td>
                      <td className="px-4 py-3.5">
                        {ticket.agent ? (
                          <div className="flex items-center gap-2.5">
                            <ProfileAvatar
                              name={ticket.agent.name}
                              pictureUrl={ticket.agent.profilePictureUrl}
                              sizeClass="h-9 w-9"
                              textClass="text-[10px]"
                            />
                            <span className="max-w-[110px] truncate text-sm font-medium text-slate-700">{ticket.agent.name}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-sm text-slate-700">
                        {formatClosedAt(ticket.closedAt, ticket.updatedAt)}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusPill status={ticket.status} />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => navigate(`/chat/${ticket.id}`)}
                          className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-800 shadow-sm transition hover:border-violet-300 hover:bg-violet-50"
                        >
                          Ver conversa
                          <ArrowRightIcon />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!loading && !error && visibleTickets.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-14 text-center">
                        <p className="text-sm font-semibold text-slate-700">Nenhuma conversa encontrada</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {hasActiveFilters
                            ? 'Tente ajustar a busca ou os filtros.'
                            : 'Seus atendimentos finalizados aparecerão aqui.'}
                        </p>
                      </td>
                    </tr>
                  )}
                  {loading && (
                    <tr>
                      <td colSpan={7} className="px-5 py-14 text-center text-sm text-slate-500">
                        Carregando histórico...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 pb-2">
            <nav className="flex items-center gap-2" aria-label="Paginação do histórico">
              <button
                type="button"
                aria-label="Página anterior"
                disabled={currentPage <= 1 || loading}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronIcon direction="left" />
              </button>
              {getPageNumbers(currentPage, totalPages).map((pageNumber, index) =>
                pageNumber === 'ellipsis' ? (
                  <span key={`ellipsis-${index}`} className="px-1.5 text-sm tracking-widest text-slate-400">···</span>
                ) : (
                  <button
                    key={pageNumber}
                    type="button"
                    aria-current={currentPage === pageNumber ? 'page' : undefined}
                    onClick={() => setPage(pageNumber)}
                    className={`h-10 min-w-10 rounded-full px-2 text-sm font-semibold transition ${
                      currentPage === pageNumber
                        ? 'bg-violet-600 text-white shadow-md shadow-violet-300/60'
                        : 'border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50'
                    }`}
                  >
                    {pageNumber}
                  </button>
                )
              )}
              <button
                type="button"
                aria-label="Próxima página"
                disabled={currentPage >= totalPages || loading}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronIcon direction="right" />
              </button>
            </nav>
            <p className="text-xs text-slate-500" aria-live="polite">
              Mostrando {firstItem}–{lastItem} de {filteredTickets.length.toLocaleString('pt-BR')} conversas
            </p>
          </footer>
        </div>
      </main>
    </div>
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
  icon: React.ReactNode;
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
      <MiniWave tone={tone} />
    </article>
  );
}

function FilterSelect({
  icon,
  label,
  value,
  onChange,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
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
      <span className="pointer-events-none absolute right-3.5 text-slate-700"><ChevronDownIcon /></span>
    </label>
  );
}

function ChannelBadge({ channel }: { channel: Ticket['channel'] }) {
  const config =
    channel === 'WHATSAPP'
      ? { label: 'WhatsApp', circle: 'bg-emerald-500', icon: <WhatsAppIcon /> }
      : channel === 'EMAIL'
      ? { label: 'E-mail', circle: 'bg-sky-500', icon: <MailIcon /> }
      : { label: 'Chat online', circle: 'bg-violet-600', icon: <WebIcon /> };

  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap text-sm font-medium text-slate-700">
      <span className={`flex h-8 w-8 items-center justify-center rounded-full text-white ${config.circle}`}>
        {config.icon}
      </span>
      {config.label}
    </span>
  );
}

function StatusPill({ status }: { status: TicketStatus }) {
  const resolved = status === 'RESOLVED';
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${
        resolved
          ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'
          : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
      }`}
    >
      {resolved ? <CheckCircleIcon /> : <LockSmallIcon />}
      {getStatusLabel(status)}
    </span>
  );
}

// Paginação no padrão da referência: 1 2 3 ··· 25
function getPageNumbers(current: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1);
  if (current <= 3) return [1, 2, 3, 'ellipsis', total];
  if (current >= total - 2) return [1, 'ellipsis', total - 2, total - 1, total];
  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total];
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 shrink-0 text-slate-500">
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="m20 20-4-4" />
    </svg>
  );
}

function RefreshIcon({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`h-[18px] w-[18px] ${className}`}>
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M5.6 9a7 7 0 0 1 11.6-2L20 12M4 12l2.8 5a7 7 0 0 0 11.6-2" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function StatusDotIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    </svg>
  );
}

function ChannelDotIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-[18px] w-[18px]">
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a7 7 0 0 1 7-7h2a7 7 0 0 1 7 7v1" />
    </svg>
  );
}

function ChevronDownIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="h-3.5 w-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" /></svg>;
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      {direction === 'left' ? <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" /> : <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />}
    </svg>
  );
}

function ArrowRightIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-violet-600"><path d="m9 18 6-6-6-6" /></svg>;
}

function CheckCircleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <circle cx="12" cy="12" r="10" fill="#10b981" />
      <path d="m7.5 12.5 3 3 6-6.5" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockSmallIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function ChatMetricIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7"><path d="M12 3C6.48 3 2 6.8 2 11.5c0 2.2 1 4.2 2.7 5.7L4 21l4.3-1.8c1.2.4 2.4.6 3.7.6 5.52 0 10-3.8 10-8.5S17.52 3 12 3Z" /><circle cx="8" cy="12" r="1.1" fill="white" /><circle cx="12" cy="12" r="1.1" fill="white" /><circle cx="16" cy="12" r="1.1" fill="white" /></svg>;
}

function CheckMetricIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8">
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path d="m7.5 12.5 3 3 6-6.5" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArchiveMetricIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function HourglassMetricIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
      <path d="M6 2h12M6 22h12M8 2v4a4 4 0 0 0 1.6 3.2L12 12l-2.4 2.8A4 4 0 0 0 8 18v4M16 2v4a4 4 0 0 1-1.6 3.2L12 12l2.4 2.8A4 4 0 0 1 16 18v4" />
    </svg>
  );
}

function WhatsAppIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]"><path d="M20 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20l1.2-4.4A8.4 8.4 0 1 1 20 11.5Z" /><path d="M8.5 8.5c.5 2.5 2 4 4.5 5" /></svg>;
}

function WebIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]"><path d="M12 3C6.48 3 2 6.8 2 11.5c0 2.2 1 4.2 2.7 5.7L4 21l4.3-1.8c1.2.4 2.4.6 3.7.6 5.52 0 10-3.8 10-8.5S17.52 3 12 3Z" /><circle cx="8.5" cy="11.5" r="1" fill="#7c3aed" /><circle cx="12" cy="11.5" r="1" fill="#7c3aed" /><circle cx="15.5" cy="11.5" r="1" fill="#7c3aed" /></svg>;
}

function MailIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>;
}

function MiniWave({ tone }: { tone: Tone }) {
  const color = TONES[tone].stroke;
  const gradientId = `wave-${tone}`;
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