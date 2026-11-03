import { useEffect, useState } from 'react';
import { useSectorsStore } from '../stores/sectors';
import { SectorModal } from '../components/SectorModal';
import { IconBar } from '../components/chat/IconBar';
import { WorkspaceHeader } from '../components/WorkspaceHeader';
import type { Sector } from '../types';

export function Sectors() {
  const { sectors, loading, error, fetchSectors, deleteSector } =
    useSectorsStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Sector | null>(null);

  useEffect(() => {
    fetchSectors();
  }, [fetchSectors]);

  function handleCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function handleEdit(sector: Sector) {
    setEditing(sector);
    setModalOpen(true);
  }

  async function handleToggleActive(sector: Sector) {
    const action = sector.active ? 'desativar' : 'reativar';
    if (!confirm(`Tem certeza que quer ${action} o setor "${sector.name}"?`)) {
      return;
    }

    try {
      if (sector.active) {
        await deleteSector(sector.id);
      } else {
        // Reativar: usar updateSector
        const { updateSector } = useSectorsStore.getState();
        await updateSector(sector.id, { active: true });
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao alterar setor');
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-chatz-bg">
      <IconBar />
      <main className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-8">
      <WorkspaceHeader
        section="Organização"
        title="Setores"
        description="Organize a equipe por áreas de atendimento e acompanhe a estrutura de cada setor."
        action={(
          <button
            onClick={handleCreate}
            className="w-full rounded-xl bg-chatz-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-chatz-primary-hover hover:shadow-md sm:w-auto"
          >
            + Novo setor
          </button>
        )}
      />

      {loading && (
        <div className="rounded-2xl border border-chatz-border bg-white py-16 text-center text-sm text-chatz-text-muted shadow-sm">Carregando setores...</div>
      )}

      {error && (
        <div role="alert" className="mb-6 rounded-xl border border-chatz-danger-border bg-chatz-danger-light px-4 py-3 text-sm text-chatz-danger">
          {error}
        </div>
      )}

      {!loading && sectors.length === 0 && (
        <div className="rounded-2xl border border-dashed border-chatz-border bg-white py-16 text-center shadow-sm">
          <p className="mb-2 font-semibold text-chatz-text">Nenhum setor cadastrado</p>
          <p className="mb-3 text-sm text-chatz-text-muted">Crie setores para organizar a distribuição dos atendimentos.</p>
          <button
            onClick={handleCreate}
            className="text-chatz-primary hover:text-chatz-primary-hover text-sm font-medium"
          >
            Criar o primeiro setor
          </button>
        </div>
      )}

      {!loading && sectors.length > 0 && (
        <div className="space-y-3">
          {sectors.map((sector) => (
            <div
              key={sector.id}
              className={`rounded-2xl border bg-white p-5 shadow-sm transition-all hover:shadow-md ${
                sector.active
                  ? 'border-chatz-border hover:border-chatz-primary/50'
                  : 'border-chatz-border opacity-50'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-chatz-text font-medium">
                      {sector.name}
                    </h3>
                    {!sector.active && (
                      <span className="rounded-full border border-chatz-border bg-chatz-surface-hover px-2 py-0.5 text-xs text-chatz-text-muted">
                        Desativado
                      </span>
                    )}
                  </div>
                  <p className="mb-2 font-mono text-xs text-chatz-text-subtle">
                    /{sector.slug}
                  </p>
                  {sector.description && (
                    <p className="mb-3 text-sm text-chatz-text-muted">
                      {sector.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-chatz-text-muted">
                    <span>
                      👥 {sector._count?.users ?? 0}{' '}
                      {sector._count?.users === 1 ? 'atendente' : 'atendentes'}
                    </span>
                    <span>
                      🎫 {sector._count?.tickets ?? 0}{' '}
                      {sector._count?.tickets === 1 ? 'ticket' : 'tickets'}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(sector)}
                    className="rounded-lg border border-chatz-border bg-white px-3 py-1.5 text-xs font-semibold text-chatz-text transition-all hover:bg-chatz-surface-hover"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleToggleActive(sector)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg
                               transition-all border ${
                                 sector.active
                                   ? 'bg-chatz-danger/10 hover:bg-chatz-danger/20 border-chatz-danger/30 text-chatz-danger'
                                   : 'bg-chatz-success/10 hover:bg-chatz-success/20 border-chatz-success/30 text-chatz-success'
                               }`}
                  >
                    {sector.active ? 'Desativar' : 'Reativar'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <SectorModal
        isOpen={modalOpen}
        sector={editing}
        onClose={() => setModalOpen(false)}
      />
      </div>
      </main>
    </div>
  );
}