import { useEffect, useState } from 'react';
import { IconBar } from '../components/chat/IconBar';
import { WorkspaceHeader } from '../components/WorkspaceHeader';
import { api, getErrorMessage } from '../lib/api';

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

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayKey() {
  return dateKey(new Date());
}

function dayBounds(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  const from = new Date(year, month - 1, day);
  const to = new Date(year, month - 1, day + 1);
  return { from, to };
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

export function Performance() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(getTodayKey);
  const today = getTodayKey();
  const selectedIsToday = selectedDate === today;

  useEffect(() => {
    const { from, to } = dayBounds(selectedDate);
    const controller = new AbortController();

    async function loadMetrics() {
      setLoading(true);
      setError('');
      setMetrics(null);
      try {
        const { data } = await api.get<PerformanceMetrics>('/performance/mine', {
          params: { from: from.toISOString(), to: to.toISOString() },
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
  }, [selectedDate]);

  const periodLabel = selectedIsToday
    ? 'Hoje'
    : new Date(`${selectedDate}T12:00:00`).toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
  const ratingLabel = metrics?.averageRating === null || metrics?.averageRating === undefined
    ? 'Sem avaliações'
    : metrics.averageRating >= 4.5
      ? 'Excelente'
      : metrics.averageRating >= 4
        ? 'Muito bom'
        : metrics.averageRating >= 3
          ? 'Bom'
          : 'Pode melhorar';

  function changeDay(offset: number) {
    const date = new Date(`${selectedDate}T12:00:00`);
    date.setDate(date.getDate() + offset);
    setSelectedDate(dateKey(date));
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-chatz-bg">
      <IconBar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-5 py-7 sm:px-8 sm:py-9">
          <WorkspaceHeader
            section="Resultados"
            title="Meu desempenho"
            description="Acompanhe seus atendimentos, tempos de atribuição e a experiência dos clientes."
            action={(
              <div className="flex w-full items-center justify-between gap-2 rounded-xl border border-chatz-border bg-white p-2 shadow-sm sm:w-auto">
                <button
                  type="button"
                  onClick={() => changeDay(-1)}
                  aria-label="Ver dia anterior"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-lg text-chatz-text-muted transition hover:bg-chatz-surface-hover hover:text-chatz-text"
                >
                  ‹
                </button>
                <label className="flex flex-col px-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-chatz-text-subtle">Período</span>
                  <input
                    type="date"
                    value={selectedDate}
                    max={today}
                    onChange={(event) => event.target.value && setSelectedDate(event.target.value)}
                    aria-label="Selecionar dia das métricas"
                    className="max-w-[145px] border-0 bg-transparent p-0 text-sm font-semibold text-chatz-text outline-none"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => changeDay(1)}
                  disabled={selectedIsToday}
                  aria-label="Ver próximo dia"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-lg text-chatz-text-muted transition hover:bg-chatz-surface-hover hover:text-chatz-text disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ›
                </button>
              </div>
            )}
          />

          {error && (
            <p role="alert" className="mb-5 rounded-chatz-xl border border-chatz-danger-border bg-chatz-danger-light p-4 text-sm text-chatz-danger">
              {error}
            </p>
          )}

          {loading ? (
            <div role="status" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="h-36 animate-pulse rounded-chatz-xl border border-chatz-border bg-chatz-surface" />
              ))}
              <span className="sr-only">Carregando métricas...</span>
            </div>
          ) : metrics ? (
            <>
              <div className="mb-5 flex items-center gap-2 text-sm text-chatz-text-muted">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>Dados de <strong className="font-semibold capitalize text-chatz-text">{periodLabel}</strong></span>
              </div>

              <section aria-label="Indicadores principais" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Atendimentos iniciados"
                  value={metrics.assignmentsStarted}
                  description="Vezes que um atendimento foi atribuído a você neste dia."
                  color="blue"
                  icon={<HeadsetIcon />}
                />
                <MetricCard
                  label="Tempo médio por atendimento"
                  value={formatDuration(metrics.averageAssignmentDurationMs)}
                  description="Média do tempo em cada atribuição, incluindo as que seguem abertas."
                  color="orange"
                  icon={<ClockIcon />}
                />
                <MetricCard
                  label="Avaliações recebidas"
                  value={metrics.ratingsReceived}
                  description="Clientes que enviaram uma nota de 1 a 5 neste dia."
                  color="violet"
                  icon={<ReviewIcon />}
                />
                <MetricCard
                  label="Nota média"
                  value={metrics.averageRating === null ? '—' : `${metrics.averageRating.toFixed(1)} / 5`}
                  description={ratingLabel === 'Sem avaliações' ? 'Ainda não há notas para este período.' : `${ratingLabel} — média das notas enviadas pelos clientes.`}
                  color="amber"
                  icon={<StarIcon />}
                />
              </section>

              <section className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-chatz-xl border border-chatz-border bg-chatz-surface p-5 shadow-sm sm:p-6">
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-base font-bold text-chatz-text">Visão dos atendimentos</h2>
                      <p className="mt-1 text-sm text-chatz-text-muted">Como ficaram as atribuições iniciadas no período.</p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      {metrics.assignmentsStarted} no total
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <SummaryItem label="Em andamento" value={metrics.activeAssignments} color="blue" />
                    <SummaryItem label="Finalizados" value={metrics.assignmentsCompleted} color="emerald" />
                    <SummaryItem label="Tempo acumulado" value={formatDuration(metrics.totalAssignmentDurationMs)} color="orange" />
                  </div>
                  <div className="mt-5 rounded-chatz-lg bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Tempo por atribuição</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      O cronômetro começa quando o atendimento é atribuído a você e termina quando é transferido ou encerrado.
                      Atendimentos ainda abertos continuam sendo contabilizados.
                    </p>
                  </div>
                </div>

                <div className="rounded-chatz-xl border border-chatz-border bg-chatz-surface p-5 shadow-sm sm:p-6">
                  <div className="mb-5">
                    <h2 className="text-base font-bold text-chatz-text">Notas dos clientes</h2>
                    <p className="mt-1 text-sm text-chatz-text-muted">Distribuição das avaliações recebidas de 1 a 5.</p>
                  </div>
                  <div className="space-y-3">
                    {[5, 4, 3, 2, 1].map((score) => {
                      const count = metrics.ratingDistribution[score as 1 | 2 | 3 | 4 | 5] ?? 0;
                      const percent = metrics.ratingsReceived ? (count / metrics.ratingsReceived) * 100 : 0;
                      return (
                        <div key={score} className="grid grid-cols-[36px_1fr_28px] items-center gap-3">
                          <span className="flex items-center gap-1 text-xs font-semibold text-chatz-text-muted">
                            {score} <span className="text-amber-500">★</span>
                          </span>
                          <div
                            className="h-2 overflow-hidden rounded-full bg-slate-100"
                            role="progressbar"
                            aria-label={`${score} estrelas`}
                            aria-valuenow={count}
                            aria-valuemin={0}
                            aria-valuemax={Math.max(metrics.ratingsReceived, 1)}
                          >
                            <div
                              className={`h-full rounded-full transition-all ${score >= 4 ? 'bg-emerald-500' : score === 3 ? 'bg-amber-400' : 'bg-rose-400'}`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className="text-right text-xs font-semibold tabular-nums text-chatz-text">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-5 rounded-chatz-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                    A nota média considera apenas avaliações respondidas. As barras mostram quantos clientes deram cada nota.
                  </p>
                </div>
              </section>

              {metrics.assignmentsStarted === 0 && metrics.ratingsReceived === 0 && (
                <div className="mt-5 rounded-chatz-xl border border-dashed border-chatz-border-strong bg-chatz-surface-alt px-5 py-6 text-center">
                  <p className="text-sm font-semibold text-chatz-text">Nenhuma atividade registrada neste dia</p>
                  <p className="mt-1 text-sm text-chatz-text-muted">Escolha outra data para consultar seus resultados.</p>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-chatz-xl border border-chatz-border bg-chatz-surface p-8 text-center text-sm text-chatz-text-muted">
              Não foi possível exibir as métricas deste período.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function MetricCard({
  label, value, description, color, icon,
}: {
  label: string;
  value: string | number;
  description: string;
  color: 'blue' | 'orange' | 'violet' | 'amber';
  icon: React.ReactNode;
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 ring-blue-100',
    orange: 'bg-orange-50 text-orange-700 ring-orange-100',
    violet: 'bg-violet-50 text-violet-700 ring-violet-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  };
  return (
    <section className="rounded-chatz-xl border border-chatz-border bg-chatz-surface p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium leading-5 text-chatz-text-muted">{label}</p>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${colors[color]}`}>{icon}</span>
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-chatz-text">{value}</p>
      <p className="mt-2 text-xs leading-relaxed text-chatz-text-subtle">{description}</p>
    </section>
  );
}

function SummaryItem({
  label, value, color,
}: {
  label: string;
  value: string | number;
  color: 'blue' | 'emerald' | 'orange';
}) {
  const colors = {
    blue: 'border-blue-200 bg-blue-50 text-blue-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    orange: 'border-orange-200 bg-orange-50 text-orange-800',
  };
  return (
    <div className={`min-w-0 rounded-chatz-lg border p-3 ${colors[color]}`}>
      <p className="text-xs font-medium opacity-80">{label}</p>
      <p className="mt-2 truncate text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function HeadsetIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13v-1a9 9 0 0 1 18 0v1M3 13v4a2 2 0 0 0 2 2h2v-7H5a2 2 0 0 0-2 2Zm18 0v4a2 2 0 0 1-2 2h-2v-7h2a2 2 0 0 1 2 2Z" /></svg>;
}

function ClockIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" /></svg>;
}

function ReviewIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5m-8 7 3.2-3H19a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16Z" /></svg>;
}

function StarIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="m12 2.8 2.8 5.67 6.26.91-4.53 4.41 1.07 6.23L12 17.08l-5.6 2.94 1.07-6.23L2.94 9.38l6.26-.91L12 2.8Z" /></svg>;
}
