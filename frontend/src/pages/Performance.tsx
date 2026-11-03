import { useEffect, useState } from 'react';
import { IconBar } from '../components/chat/IconBar';
import { PageBackButton } from '../components/PageBackButton';
import { api, getErrorMessage } from '../lib/api';

interface PerformanceMetrics {
  assignmentsStarted: number;
  averageAssignmentDurationMs: number | null;
  ratingsReceived: number;
  averageRating: number | null;
}

function formatDuration(milliseconds: number | null) {
  if (milliseconds === null) return '—';
  const minutes = Math.floor(milliseconds / 60_000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours ? `${hours}h ${remainingMinutes}min` : `${remainingMinutes}min`;
}

export function Performance() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    const controller = new AbortController();

    async function loadMetrics() {
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
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-chatz-bg">
      <IconBar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <div className="mb-8 flex items-center gap-3">
            <PageBackButton />
            <div>
              <h1 className="text-2xl font-bold text-chatz-text">Meu desempenho</h1>
              <p className="text-sm text-chatz-text-muted">Resumo dos atendimentos de hoje</p>
            </div>
          </div>

          {error && (
            <p role="alert" className="mb-5 rounded-chatz bg-chatz-danger-light p-4 text-sm text-chatz-danger">
              {error}
            </p>
          )}

          {loading ? (
            <p className="py-16 text-center text-sm text-chatz-text-muted">Carregando métricas...</p>
          ) : metrics ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Atendimentos iniciados" value={metrics.assignmentsStarted} />
              <MetricCard
                label="Tempo médio atribuído"
                value={formatDuration(metrics.averageAssignmentDurationMs)}
              />
              <MetricCard label="Avaliações recebidas" value={metrics.ratingsReceived} />
              <MetricCard
                label="Nota média"
                value={metrics.averageRating === null ? '—' : `${metrics.averageRating} / 5`}
              />
            </div>
          ) : null}
          <p className="mt-5 text-xs text-chatz-text-subtle">
            O tempo médio considera os períodos de atribuição iniciados hoje, incluindo atendimentos em andamento.
          </p>
        </div>
      </main>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <section className="rounded-chatz-xl border border-chatz-border bg-chatz-surface p-5">
      <p className="text-sm text-chatz-text-muted">{label}</p>
      <p className="mt-3 text-3xl font-bold text-chatz-text">{value}</p>
    </section>
  );
}
