import { useState, useEffect, FormEvent } from 'react';
import { useSectorsStore } from '../stores/sectors';
import { getErrorMessage } from '../lib/api';
import type { Sector } from '../types';

interface Props {
  isOpen: boolean;
  sector?: Sector | null; // se null, modo criação
  onClose: () => void;
}

export function SectorModal({ isOpen, sector, onClose }: Props) {
  const { createSector, updateSector } = useSectorsStore();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isEdit = !!sector;

  // Preenche form quando abrir em modo edição
  useEffect(() => {
    if (sector) {
      setName(sector.name);
      setSlug(sector.slug);
      setDescription(sector.description ?? '');
    } else {
      setName('');
      setSlug('');
      setDescription('');
    }
    setError('');
  }, [sector, isOpen]);

  // Auto-gera slug ao digitar nome (só em criação)
  useEffect(() => {
    if (isEdit) return;
    const generated = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    setSlug(generated);
  }, [name, isEdit]);

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isEdit && sector) {
        await updateSector(sector.id, { name, description });
      } else {
        await createSector({ name, slug, description });
      }
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-chatz-card border border-chatz-border rounded-2xl w-full max-w-md p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-chatz-text">
            {isEdit ? 'Editar setor' : 'Novo setor'}
          </h2>
          <button
            onClick={onClose}
            className="text-chatz-muted hover:text-chatz-text text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-chatz-muted mb-2">
              Nome
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Financeiro"
              className="w-full px-4 py-3 bg-chatz-bg border border-chatz-border rounded-lg
                         text-chatz-text placeholder-chatz-muted
                         focus:border-chatz-primary focus:ring-2 focus:ring-chatz-primary/20
                         transition-all"
            />
          </div>

          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-chatz-muted mb-2">
                Slug (identificador)
              </label>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="financeiro"
                className="w-full px-4 py-3 bg-chatz-bg border border-chatz-border rounded-lg
                           text-chatz-text placeholder-chatz-muted font-mono text-sm
                           focus:border-chatz-primary transition-all"
              />
              <p className="text-xs text-chatz-muted mt-1">
                Apenas letras minúsculas, números e hífen
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-chatz-muted mb-2">
              Descrição (opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Ex: Boletos, faturas e questões financeiras"
              className="w-full px-4 py-3 bg-chatz-bg border border-chatz-border rounded-lg
                         text-chatz-text placeholder-chatz-muted
                         focus:border-chatz-primary transition-all resize-none"
            />
          </div>

          {error && (
            <div className="bg-chatz-danger/10 border border-chatz-danger/30 text-chatz-danger
                            text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-chatz-bg hover:bg-chatz-card-hover
                         border border-chatz-border text-chatz-text font-medium
                         rounded-lg transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-chatz-primary hover:bg-chatz-primary-hover
                         text-white font-semibold rounded-lg transition-all
                         disabled:opacity-50"
            >
              {loading ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar setor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}