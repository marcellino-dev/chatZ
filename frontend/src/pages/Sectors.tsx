import { useEffect, useState } from 'react';
import { useSectorsStore } from '../stores/sectors';
import { SectorModal } from '../components/SectorModal';
import { IconBar } from '../components/chat/IconBar';
import { PageBackButton } from '../components/PageBackButton';
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <PageBackButton />
          <div>
          <h1 className="text-2xl font-bold text-chatz-text">Setores</h1>
          <p className="text-chatz-muted text-sm">
            Gerencie os setores de atendimento
          </p>
          </div>
        </div>

        <button
          onClick={handleCreate}
          className="px-5 py-2.5 bg-chatz-primary hover:bg-chatz-primary-hover
                     text-white font-medium rounded-lg transition-all"
        >
          ➕ Novo setor
        </button>
      </div>

      {loading && (
        <div className="text-center py-16 text-chatz-muted">Carregando...</div>
      )}

      {error && (
        <div className="bg-chatz-danger/10 border border-chatz-danger/30 text-chatz-danger
                        rounded-lg px-4 py-3 mb-6">
          {error}
        </div>
      )}

      {!loading && sectors.length === 0 && (
        <div className="text-center py-16 bg-chatz-card/50 border border-chatz-border
                        border-dashed rounded-2xl">
          <p className="text-chatz-muted mb-2">Nenhum setor cadastrado</p>
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
              className={`bg-chatz-card border rounded-xl p-5 transition-all ${
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
                      <span className="text-xs px-2 py-0.5 rounded-full
                                       bg-chatz-muted/10 text-chatz-muted
                                       border border-chatz-muted/30">
                        Desativado
                      </span>
                    )}
                  </div>
                  <p className="text-chatz-muted text-xs font-mono mb-2">
                    /{sector.slug}
                  </p>
                  {sector.description && (
                    <p className="text-chatz-muted text-sm mb-3">
                      {sector.description}
                    </p>
                  )}
                  <div className="flex gap-4 text-xs text-chatz-muted">
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
                    className="px-3 py-1.5 bg-chatz-bg hover:bg-chatz-card-hover
                               border border-chatz-border text-chatz-text
                               text-xs font-medium rounded-lg transition-all"
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