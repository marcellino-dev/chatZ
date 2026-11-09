import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IconBar } from '../components/chat/IconBar';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { api, getErrorMessage } from '../lib/api';
import type { TicketStatus } from '../types';

/* ======================================================================
 * Tipos
 * ==================================================================== */

interface PerformanceMetrics {
  assignmentsStarted: number;
  assignmentsCompleted: number;
  activeAssignments: number;
  totalAssignmentDurationMs: number;
  averageAssignmentDurationMs: number | null;
  ratingsReceived: number;
  averageRating: number | null;
  ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

interface DailyPoint {
  date: string;
  assignmentsStarted: number;
  assignmentsCompleted: number;
  activeAssignments: number;
}

interface RecentActivity {
  id: string;
  createdAt: string;
  clientName: string;
  clientProfilePictureUrl?: string | null;
  subject: string;
  durationMs: number | null;
  status: TicketStatus;
}

type Resource<T> = { status: 'loading' } | { status: 'ready'; data: T } | { status: 'unavailable' };

type RangeKey = 'today' | '7d' | '30d' | 'day';

const RANGE_LABEL: Record<RangeKey, string> = {
  today: 'Hoje',
  '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  day: 'Escolher um dia',
};

/* ======================================================================
 * Datas e formatação
 * ==================================================================== */

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayKey() {
  return dateKey(new Date());
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

function dayBounds(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  const from = new Date(year, month - 1, day);
  const to = new Date(year, month - 1, day + 1);
  return { from, to };
}

function boundsFor(key: RangeKey, dayValue: string) {
  const todayStart = startOfDay(new Date());
  switch (key) {
    case 'today':
      return { from: todayStart, to: addDays(todayStart, 1) };
    case '7d':
      return { from: addDays(todayStart, -6), to: addDays(todayStart, 1) };
    case '30d':
      return { from: addDays(todayStart, -29), to: addDays(todayStart, 1) };
    default:
      return dayBounds(dayValue);
  }
}

function formatDuration(milliseconds: number | null) {
  if (milliseconds === null) return '—';
  const minutes = Math.floor(milliseconds / 60_000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours > 0) return `${hours}h ${remainingMinutes}min`;
  if (minutes > 0) return `${minutes} min`;
  return '< 1 min';
}

function formatAverageDuration(milliseconds: number | null) {
  if (milliseconds === null) return '—';
  const totalSeconds = Math.round(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}min`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  return `${seconds}s`;
}

function formatPercent(value: number) {
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function percentDelta(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

/* ======================================================================
 * Página
 * ==================================================================== */

export function Performance() {
  const navigate = useNavigate();
  const [rangeKey, setRangeKey] = useState<RangeKey>('7d');
  const [dayValue, setDayValue] = useState(getTodayKey);
  const [compare, setCompare] = useState(true);
  const today = getTodayKey();

  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [previous, setPrevious] = useState<PerformanceMetrics | null>(null);
  const [previousLoading, setPreviousLoading] = useState(false);
  const [daily, setDaily] = useState<Resource<DailyPoint[]>>({ status: 'loading' });
  const [recent, setRecent] = useState<Resource<RecentActivity[]>>({ status: 'loading' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const { fromIso, toIso, prevFromIso, prevToIso } = useMemo(() => {
    const { from, to } = boundsFor(rangeKey, dayValue);
    const lengthInDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000));
    const prevFrom = addDays(from, -lengthInDays);
    return {
      fromIso: from.toISOString(),
      toIso: to.toISOString(),
      prevFromIso: prevFrom.toISOString(),
      prevToIso: from.toISOString(),
    };
  }, [rangeKey, dayValue]);

  // Métricas do período
  useEffect(() => {
    const controller = new AbortController();

    async function loadMetrics() {
      setLoading(true);
      setError('');
      setMetrics(null);
      try {
        const { data } = await api.get<PerformanceMetrics>('/performance/mine', {
          params: { from: fromIso, to: toIso },
          signal: controller.signal,
        });
        setMetrics(data);
      } catch (requestError) {
        if (!controller.signal.aborted) setError(getErrorMessage(requestError));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadMetrics();
    return () => controller.abort();
  }, [fromIso, toIso]);

  // Período anterior (só quando "Comparar" está ligado)
  useEffect(() => {
    if (!compare) {
      setPrevious(null);
      setPreviousLoading(false);
      return;
    }
    const controller = new AbortController();
    setPreviousLoading(true);
    setPrevious(null);
    api
      .get<PerformanceMetrics>('/performance/mine', {
        params: { from: prevFromIso, to: prevToIso },
        signal: controller.signal,
      })
      .then(({ data }) => setPrevious(data))
      .catch(() => {
        if (!controller.signal.aborted) setPrevious(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setPreviousLoading(false);
      });
    return () => controller.abort();
  }, [compare, prevFromIso, prevToIso]);

  // Série diária para o gráfico
  useEffect(() => {
    const controller = new AbortController();
    setDaily({ status: 'loading' });
    api
      .get<DailyPoint[]>('/performance/mine/daily', {
        params: { from: fromIso, to: toIso, timeZone },
        signal: controller.signal,
      })
      .then(({ data }) => setDaily({ status: 'ready', data }))
      .catch(() => {
        if (!controller.signal.aborted) setDaily({ status: 'unavailable' });
      });
    return () => controller.abort();
  }, [fromIso, toIso, timeZone]);

  // Atividade recente (independe do período escolhido)
  useEffect(() => {
    const controller = new AbortController();
    api
      .get<RecentActivity[]>('/performance/mine/recent', {
        params: { limit: 5 },
        signal: controller.signal,
      })
      .then(({ data }) => setRecent({ status: 'ready', data }))
      .catch(() => {
        if (!controller.signal.aborted) setRecent({ status: 'unavailable' });
      });
    return () => controller.abort();
  }, []);

  const startedDelta = percentDelta(metrics?.assignmentsStarted ?? null, previous?.assignmentsStarted ?? null);
  const durationDelta = percentDelta(
    metrics?.averageAssignmentDurationMs ?? null,
    previous?.averageAssignmentDurationMs ?? null
  );
  const ratingDelta = percentDelta(metrics?.averageRating ?? null, previous?.averageRating ?? null);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-chatz-bg">
      <IconBar />

      <main className="relative flex-1 overflow-y-auto">
        {/* Blob decorativo do canto superior direito */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-32 h-80 w-[28rem] rounded-full
                     bg-gradient-to-br from-orange-200/70 via-pink-200/60 to-fuchsia-200/30 blur-2xl"
        />

        <div className="relative mx-auto max-w-[1400px] px-4 py-6 sm:px-8">
          {/* Header */}
          <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-fuchsia-600">Análises e estatísticas</p>
              <h1 className="font-display text-3xl font-extrabold text-chatz-text">Meu desempenho</h1>
              <p className="mt-1 text-sm text-chatz-text-muted">
                Acompanhe o desempenho do seu atendimento em tempo real.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="relative block">
                <span className="sr-only">Período</span>
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fuchsia-600">
                  <CalendarIcon />
                </span>
                <select
                  value={rangeKey}
                  onChange={(event) => setRangeKey(event.target.value as RangeKey)}
                  className="h-12 cursor-pointer appearance-none rounded-2xl border border-slate-200 bg-white pl-11 pr-10
                             text-sm font-semibold text-chatz-text shadow-sm outline-none transition
                             focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/20"
                >
                  {(Object.keys(RANGE_LABEL) as RangeKey[]).map((key) => (
                    <option key={key} value={key}>
                      {RANGE_LABEL[key]}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                  <ChevronDownIcon />
                </span>
              </label>

              {rangeKey === 'day' && (
                <input
                  type="date"
                  value={dayValue}
                  max={today}
                  onChange={(event) => event.target.value && setDayValue(event.target.value)}
                  aria-label="Selecionar dia das métricas"
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-chatz-text
                             shadow-sm outline-none focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/20"
                />
              )}

              <button
                type="button"
                role="switch"
                aria-checked={compare}
                onClick={() => setCompare((value) => !value)}
                className="flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-sm
                           font-medium text-chatz-text shadow-sm transition hover:bg-slate-50"
              >
                Comparar com anterior
                <span
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    compare ? 'bg-fuchsia-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      compare ? 'left-[22px]' : 'left-0.5'
                    }`}
                  />
                </span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/follow-ups')}
                aria-label="Follow-ups"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-700 shadow-md
                           transition hover:shadow-lg"
              >
                <BellIcon />
              </button>
            </div>
          </header>

          {error && (
            <p
              role="alert"
              className="mb-5 rounded-2xl border border-chatz-danger-border bg-chatz-danger-light p-4 text-sm text-chatz-danger"
            >
              {error}
            </p>
          )}

          {loading ? (
            <div role="status" className="grid gap-4 sm:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="h-32 animate-pulse rounded-2xl border border-slate-100 bg-white" />
              ))}
              <span className="sr-only">Carregando métricas...</span>
            </div>
          ) : metrics ? (
            <>
              {/* Indicadores */}
              <section aria-label="Indicadores principais" className="grid gap-4 sm:grid-cols-3">
                <MetricCard
                  label="Atendimentos iniciados"
                  value={metrics.assignmentsStarted.toLocaleString('pt-BR')}
                  icon={<ChatIcon />}
                  iconClass="bg-purple-100 text-purple-600"
                  delta={startedDelta}
                  goodWhenUp
                  compare={compare}
                  comparing={previousLoading}
                />
                <MetricCard
                  label="Tempo médio de atendimento"
                  value={formatAverageDuration(metrics.averageAssignmentDurationMs)}
                  icon={<ClockIcon />}
                  iconClass="bg-blue-100 text-blue-600"
                  delta={durationDelta}
                  goodWhenUp={false}
                  compare={compare}
                  comparing={previousLoading}
                />
                <MetricCard
                  label="Nota média"
                  value={
                    metrics.averageRating === null
                      ? '—'
                      : `${metrics.averageRating.toFixed(1).replace('.', ',')} / 5`
                  }
                  icon={<StarIcon />}
                  iconClass="bg-orange-100 text-orange-500"
                  delta={ratingDelta}
                  goodWhenUp
                  compare={compare}
                  comparing={previousLoading}
                />
              </section>

              {/* Atendimentos por dia */}
              <Panel
                className="mt-5"
                icon={<BarChartIcon />}
                title="Atendimentos por dia"
                aside={<ChartLegend />}
              >
                {daily.status === 'loading' ? (
                  <div className="h-64 animate-pulse rounded-xl bg-slate-50" />
                ) : daily.status === 'unavailable' || daily.data.length === 0 ? (
                  <EmptyNote text="O gráfico diário ainda não está disponível para este período." />
                ) : (
                  <DailyChart points={daily.data} />
                )}
              </Panel>

              {/* Distribuição + avaliações */}
              <section className="mt-5 grid gap-5 lg:grid-cols-2">
                <Panel icon={<PieIcon />} title="Distribuição dos atendimentos">
                  <DistributionCard metrics={metrics} />
                </Panel>

                <Panel
                  icon={<StarFilledIcon />}
                  title="Avaliações dos clientes"
                  aside={
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      {metrics.ratingsReceived} {metrics.ratingsReceived === 1 ? 'avaliação' : 'avaliações'}
                    </span>
                  }
                >
                  <RatingBars metrics={metrics} />
                </Panel>
              </section>

              {/* Atividade recente */}
              <section className="mt-5 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                <header className="flex items-center justify-between gap-4 px-5 py-4">
                  <h2 className="flex items-center gap-2 text-base font-bold text-chatz-text">
                    <span className="text-blue-600">
                      <ActivityIcon />
                    </span>
                    Atividade recente
                  </h2>
                  <Link
                    to="/history"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 transition hover:text-blue-700"
                  >
                    Ver todo o histórico
                    <ArrowRightIcon />
                  </Link>
                </header>
                <RecentTable state={recent} />
              </section>

              {metrics.assignmentsStarted === 0 && metrics.ratingsReceived === 0 && (
                <div className="mt-5 rounded-2xl border border-dashed border-chatz-border-strong bg-chatz-surface-alt px-5 py-6 text-center">
                  <p className="text-sm font-semibold text-chatz-text">Nenhuma atividade registrada neste período</p>
                  <p className="mt-1 text-sm text-chatz-text-muted">Escolha outro período para consultar seus resultados.</p>
                </div>
              )}

              <p className="mt-5 text-xs leading-relaxed text-chatz-text-subtle">
                O tempo de atendimento começa quando o atendimento é atribuído a você e termina quando é transferido ou
                encerrado; atendimentos ainda abertos continuam sendo contabilizados (tempo acumulado no período:{' '}
                {formatDuration(metrics.totalAssignmentDurationMs)}). A nota média considera apenas avaliações respondidas.
              </p>
            </>
          ) : (
            <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm text-chatz-text-muted shadow-sm">
              Não foi possível exibir as métricas deste período.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/* ======================================================================
 * Cards e painéis
 * ==================================================================== */

function MetricCard({
  label,
  value,
  icon,
  iconClass,
  delta,
  goodWhenUp,
  compare,
  comparing,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  iconClass: string;
  delta: number | null;
  goodWhenUp: boolean;
  compare: boolean;
  comparing: boolean;
}) {
  return (
    <section className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full ${iconClass}`}>{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-sm text-chatz-text">{label}</p>
        <p className="text-3xl font-extrabold leading-tight tabular-nums text-chatz-text">{value}</p>
        {compare && <DeltaLine delta={delta} goodWhenUp={goodWhenUp} comparing={comparing} />}
      </div>
    </section>
  );
}

function DeltaLine({
  delta,
  goodWhenUp,
  comparing,
}: {
  delta: number | null;
  goodWhenUp: boolean;
  comparing: boolean;
}) {
  if (comparing) return <p className="mt-0.5 text-[11px] text-slate-400">Comparando...</p>;
  if (delta === null) return <p className="mt-0.5 text-[11px] text-slate-400">Sem dados no período anterior</p>;
  if (Math.abs(delta) < 0.5) {
    return <p className="mt-0.5 text-[11px] text-slate-500">Estável em relação ao período anterior</p>;
  }
  const up = delta > 0;
  const good = up === goodWhenUp;
  return (
    <p className={`mt-0.5 flex items-center gap-1 text-[11px] font-medium ${good ? 'text-emerald-600' : 'text-rose-600'}`}>
      <span aria-hidden="true">{up ? '↑' : '↓'}</span>
      {Math.round(Math.abs(delta))}% {up ? 'maior' : 'menor'} que o período anterior
    </p>
  );
}

function Panel({
  icon,
  title,
  aside,
  className = '',
  children,
}: {
  icon: ReactNode;
  title: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`rounded-2xl border border-slate-100 bg-white p-5 shadow-sm ${className}`}>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-chatz-text">
          <span className="text-blue-600">{icon}</span>
          {title}
        </h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-chatz-text-muted">
      {text}
    </div>
  );
}

/* ======================================================================
 * Gráfico de linhas (SVG, sem biblioteca)
 * ==================================================================== */

const SERIES = [
  { key: 'assignmentsStarted', label: 'Atendimentos', color: '#2563eb' },
  { key: 'assignmentsCompleted', label: 'Finalizados', color: '#9333ea' },
  { key: 'activeAssignments', label: 'Em andamento', color: '#f97316' },
] as const;

function ChartLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-4 text-xs text-chatz-text-muted">
      {SERIES.map((serie) => (
        <li key={serie.key} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: serie.color }} />
          {serie.label}
        </li>
      ))}
    </ul>
  );
}

const CHART_W = 900;
const CHART_H = 270;
const MARGIN = { left: 44, right: 20, top: 20, bottom: 30 };

function niceStep(rough: number) {
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return Math.max(1, nice * magnitude);
}

function shortDate(value: string) {
  return `${value.slice(8, 10)}/${value.slice(5, 7)}`;
}

function longDate(value: string) {
  return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
}

function DailyChart({ points }: { points: DailyPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const innerW = CHART_W - MARGIN.left - MARGIN.right;
  const innerH = CHART_H - MARGIN.top - MARGIN.bottom;
  const count = points.length;

  const rawMax = Math.max(
    1,
    ...points.flatMap((p) => [p.assignmentsStarted, p.assignmentsCompleted, p.activeAssignments])
  );
  const step = niceStep(rawMax / 4);
  const yMax = step * 4;

  const xAt = (index: number) =>
    count === 1 ? MARGIN.left + innerW / 2 : MARGIN.left + (index / (count - 1)) * innerW;
  const yAt = (value: number) => MARGIN.top + innerH - (value / yMax) * innerH;

  function linePath(key: (typeof SERIES)[number]['key']) {
    return points
      .map((point, index) => {
        const x = xAt(index);
        const y = yAt(point[key]);
        if (index === 0) return `M ${x} ${y}`;
        const prevX = xAt(index - 1);
        const prevY = yAt(points[index - 1][key]);
        const midX = (prevX + x) / 2;
        return `C ${midX} ${prevY}, ${midX} ${y}, ${x} ${y}`;
      })
      .join(' ');
  }

  const areaPath =
    count > 1
      ? `${linePath('assignmentsStarted')} L ${xAt(count - 1)} ${MARGIN.top + innerH} L ${xAt(0)} ${MARGIN.top + innerH} Z`
      : '';

  const labelEvery = Math.max(1, Math.ceil(count / 9));
  const ticks = [0, 1, 2, 3, 4].map((i) => i * step);

  function handleMove(event: MouseEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * CHART_W;
    const ratio = (x - MARGIN.left) / innerW;
    const index = count === 1 ? 0 : Math.round(ratio * (count - 1));
    setHover(Math.min(count - 1, Math.max(0, index)));
  }

  const hovered = hover !== null ? points[hover] : null;
  const tooltipLeft = hover !== null ? Math.min(Math.max((xAt(hover) / CHART_W) * 100, 14), 86) : 0;

  return (
    <div className="relative">
      {hovered && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-xl border border-slate-100 bg-white
                     px-3 py-2 text-xs shadow-lg"
          style={{ left: `${tooltipLeft}%` }}
        >
          <p className="mb-1 font-bold text-chatz-text">{longDate(hovered.date)}</p>
          {SERIES.map((serie) => (
            <p key={serie.key} className="flex items-center gap-1.5 whitespace-nowrap text-chatz-text-muted">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: serie.color }} />
              {serie.label}: <strong className="text-chatz-text">{hovered[serie.key]}</strong>
            </p>
          ))}
        </div>
      )}

      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="h-auto w-full"
        role="img"
        aria-label="Gráfico de atendimentos por dia"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="perf-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grade horizontal e rótulos do eixo Y */}
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={MARGIN.left}
              x2={CHART_W - MARGIN.right}
              y1={yAt(tick)}
              y2={yAt(tick)}
              stroke="#e2e8f0"
              strokeDasharray={tick === 0 ? undefined : '3 4'}
            />
            <text x={MARGIN.left - 10} y={yAt(tick) + 4} textAnchor="end" fontSize="12" fill="#64748b">
              {tick}
            </text>
          </g>
        ))}

        {/* Rótulos do eixo X */}
        {points.map((point, index) =>
          index % labelEvery === 0 ? (
            <text key={point.date} x={xAt(index)} y={CHART_H - 8} textAnchor="middle" fontSize="12" fill="#64748b">
              {shortDate(point.date)}
            </text>
          ) : null
        )}

        {areaPath && <path d={areaPath} fill="url(#perf-area)" />}

        {count > 1 &&
          SERIES.map((serie) => (
            <path
              key={serie.key}
              d={linePath(serie.key)}
              fill="none"
              stroke={serie.color}
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          ))}

        {/* Pontos */}
        {count <= 31 &&
          SERIES.map((serie) =>
            points.map((point, index) => (
              <circle key={`${serie.key}-${point.date}`} cx={xAt(index)} cy={yAt(point[serie.key])} r={3} fill={serie.color} />
            ))
          )}

        {/* Destaque do ponto sob o mouse */}
        {hover !== null && hovered && (
          <g>
            <line
              x1={xAt(hover)}
              x2={xAt(hover)}
              y1={MARGIN.top}
              y2={MARGIN.top + innerH}
              stroke="#94a3b8"
              strokeDasharray="4 4"
            />
            {SERIES.map((serie) => (
              <circle
                key={serie.key}
                cx={xAt(hover)}
                cy={yAt(hovered[serie.key])}
                r={5.5}
                fill="#fff"
                stroke={serie.color}
                strokeWidth={2.5}
              />
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}

/* ======================================================================
 * Distribuição (rosca) e avaliações
 * ==================================================================== */

function DistributionCard({ metrics }: { metrics: PerformanceMetrics }) {
  const completed = metrics.assignmentsCompleted;
  const active = metrics.activeAssignments;
  const other = Math.max(metrics.assignmentsStarted - completed - active, 0);
  const total = Math.max(metrics.assignmentsStarted, completed + active);

  const segments = [
    { label: 'Finalizados', value: completed, color: '#3b82f6' },
    { label: 'Em andamento', value: active, color: '#9333ea' },
    ...(other > 0 ? [{ label: 'Outros', value: other, color: '#f97316' }] : []),
  ];

  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-6 sm:gap-10">
      <div className="relative h-44 w-44 shrink-0">
        <svg viewBox="0 0 160 160" className="h-full w-full" role="img" aria-label="Distribuição dos atendimentos">
          <circle cx="80" cy="80" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="22" />
          {total > 0 &&
            segments.map((segment) => {
              const length = (segment.value / total) * circumference;
              const circle = (
                <circle
                  key={segment.label}
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="22"
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 80 80)"
                />
              );
              offset += length;
              return circle;
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold tabular-nums text-chatz-text">{total.toLocaleString('pt-BR')}</span>
          <span className="text-xs text-chatz-text-muted">Total</span>
        </div>
      </div>

      <ul className="min-w-[200px] flex-1 space-y-3">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center justify-between gap-4 text-sm">
            <span className="flex items-center gap-2 text-chatz-text-muted">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
              {segment.label}
            </span>
            <span className="font-semibold tabular-nums text-chatz-text">
              {formatPercent(total > 0 ? (segment.value / total) * 100 : 0)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const STAR_BAR_COLORS: Record<number, string> = {
  5: 'bg-blue-600',
  4: 'bg-blue-500',
  3: 'bg-blue-400',
  2: 'bg-indigo-600',
  1: 'bg-fuchsia-500',
};

function RatingBars({ metrics }: { metrics: PerformanceMetrics }) {
  return (
    <div className="space-y-3.5">
      {[5, 4, 3, 2, 1].map((score) => {
        const count = metrics.ratingDistribution[score as 1 | 2 | 3 | 4 | 5] ?? 0;
        const percent = metrics.ratingsReceived ? (count / metrics.ratingsReceived) * 100 : 0;
        return (
          <div key={score} className="grid grid-cols-[84px_1fr_44px] items-center gap-3">
            <span className="text-sm text-chatz-text">
              {score} {score === 1 ? 'estrela' : 'estrelas'}
            </span>
            <div
              className="h-2.5 overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-label={`${score} estrelas`}
              aria-valuenow={count}
              aria-valuemin={0}
              aria-valuemax={Math.max(metrics.ratingsReceived, 1)}
              title={`${count} ${count === 1 ? 'avaliação' : 'avaliações'}`}
            >
              <div
                className={`h-full rounded-full transition-all ${STAR_BAR_COLORS[score]}`}
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="text-right text-sm font-semibold tabular-nums text-chatz-text">
              {Math.round(percent)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ======================================================================
 * Atividade recente
 * ==================================================================== */

const STATUS_BADGE: Record<TicketStatus, { label: string; className: string; icon: ReactNode }> = {
  RESOLVED: { label: 'Finalizada', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: <CheckSmallIcon /> },
  CLOSED: { label: 'Finalizada', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: <CheckSmallIcon /> },
  IN_PROGRESS: { label: 'Em atendimento', className: 'bg-blue-50 text-blue-700 ring-blue-200', icon: <EyeIcon /> },
  WAITING: { label: 'Aguardando', className: 'bg-orange-50 text-orange-700 ring-orange-200', icon: <ClockSmallIcon /> },
  TRANSFERRED: { label: 'Transferida', className: 'bg-violet-50 text-violet-700 ring-violet-200', icon: <SwapIcon /> },
};

function RecentTable({ state }: { state: Resource<RecentActivity[]> }) {
  if (state.status === 'loading') {
    return <div className="mx-5 mb-5 h-32 animate-pulse rounded-xl bg-slate-50" />;
  }
  if (state.status === 'unavailable' || state.data.length === 0) {
    return (
      <div className="px-5 pb-5">
        <EmptyNote
          text={
            state.status === 'unavailable'
              ? 'A atividade recente ainda não está disponível.'
              : 'Você ainda não tem atendimentos recentes.'
          }
        />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-y border-slate-100 bg-slate-50/60 text-xs font-semibold text-chatz-text-muted">
            <th className="px-5 py-2.5">Data</th>
            <th className="px-3 py-2.5">Cliente</th>
            <th className="px-3 py-2.5">Assunto</th>
            <th className="px-3 py-2.5">Duração</th>
            <th className="px-5 py-2.5">Status</th>
          </tr>
        </thead>
        <tbody>
          {state.data.map((item) => {
            const badge = STATUS_BADGE[item.status];
            return (
              <tr key={item.id} className="border-b border-slate-100 last:border-0">
                <td className="whitespace-nowrap px-5 py-3 text-chatz-text">{formatDateTime(item.createdAt)}</td>
                <td className="px-3 py-3">
                  <span className="flex items-center gap-3">
                    <ProfileAvatar
                      name={item.clientName}
                      pictureUrl={item.clientProfilePictureUrl}
                      sizeClass="h-8 w-8"
                      textClass="text-[11px]"
                    />
                    <span className="whitespace-nowrap text-chatz-text">{item.clientName}</span>
                  </span>
                </td>
                <td className="max-w-[320px] truncate px-3 py-3 text-chatz-text">{item.subject}</td>
                <td className="whitespace-nowrap px-3 py-3 text-chatz-text">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-slate-500">
                      <ClockSmallIcon />
                    </span>
                    {formatDuration(item.durationMs)}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ring-1 ${badge.className}`}
                  >
                    {badge.icon}
                    {badge.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ======================================================================
 * Ícones
 * ==================================================================== */

function Svg({
  children,
  size = 20,
  fill = 'none',
  strokeWidth = 1.8,
}: {
  children: ReactNode;
  size?: number;
  fill?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function CalendarIcon() {
  return (<Svg><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></Svg>);
}
function ChevronDownIcon() {
  return (<Svg size={18} strokeWidth={2.2}><path d="m6 9 6 6 6-6" /></Svg>);
}
function BellIcon() {
  return (<Svg><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></Svg>);
}
function ChatIcon() {
  return (<Svg size={30} fill="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></Svg>);
}
function ClockIcon() {
  return (<Svg size={30} strokeWidth={2.2}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>);
}
function StarIcon() {
  return (<Svg size={30} fill="currentColor"><path d="m12 2.8 2.8 5.67 6.26.91-4.53 4.41 1.07 6.23L12 17.08l-5.6 2.94 1.07-6.23L2.94 9.38l6.26-.91L12 2.8Z" /></Svg>);
}
function BarChartIcon() {
  return (<Svg size={22}><rect x="3" y="14" width="4" height="7" rx="1" fill="currentColor" /><rect x="10" y="9" width="4" height="12" rx="1" fill="currentColor" /><rect x="17" y="3" width="4" height="18" rx="1" fill="currentColor" /></Svg>);
}
function PieIcon() {
  return (<Svg size={22} fill="currentColor"><path d="M21 12A9 9 0 1 1 12 3v9Z" /><path d="M15 3.5A9 9 0 0 1 20.5 9H15Z" /></Svg>);
}
function StarFilledIcon() {
  return (<Svg size={22} fill="currentColor"><path d="m12 2.8 2.8 5.67 6.26.91-4.53 4.41 1.07 6.23L12 17.08l-5.6 2.94 1.07-6.23L2.94 9.38l6.26-.91L12 2.8Z" /></Svg>);
}
function ActivityIcon() {
  return (<Svg size={22}><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5M12 7v5l3 2" /></Svg>);
}
function ArrowRightIcon() {
  return (<Svg size={16} strokeWidth={2.2}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>);
}
function CheckSmallIcon() {
  return (<Svg size={14} strokeWidth={2.6}><path d="m5 12 5 5 9-10" /></Svg>);
}
function EyeIcon() {
  return (<Svg size={14} strokeWidth={2.2}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></Svg>);
}
function ClockSmallIcon() {
  return (<Svg size={14} strokeWidth={2.2}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>);
}
function SwapIcon() {
  return (<Svg size={14} strokeWidth={2.2}><path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" /></Svg>);
}