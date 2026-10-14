import { create } from 'zustand';
import { api } from '../lib/api';
import type { Sector } from '../types';

interface SectorsState {
  sectors: Sector[];
  loading: boolean;
  error: string | null;

  fetchSectors: (onlyActive?: boolean) => Promise<void>;
  createSector: (data: { name: string; slug: string; description?: string }) => Promise<Sector>;
  updateSector: (id: string, data: Partial<Sector>) => Promise<void>;
  deleteSector: (id: string) => Promise<void>;
}

export const useSectorsStore = create<SectorsState>((set, get) => ({
  sectors: [],
  loading: false,
  error: null,

  fetchSectors: async (onlyActive = false) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.get<Sector[]>('/sectors', {
        params: onlyActive ? { active: true } : {},
      });
      set({ sectors: data, loading: false });
    } catch (err: any) {
      set({
        error: err.response?.data?.error || 'Erro ao carregar setores',
        loading: false,
      });
    }
  },

  createSector: async (data) => {
    const { data: sector } = await api.post<Sector>('/sectors', data);
    set({ sectors: [...get().sectors, sector] });
    return sector;
  },

  updateSector: async (id, data) => {
    const { data: updated } = await api.patch<Sector>(`/sectors/${id}`, data);
    set({
      sectors: get().sectors.map((s) => (s.id === id ? updated : s)),
    });
  },

  deleteSector: async (id) => {
    await api.delete(`/sectors/${id}`);
    set({
      sectors: get().sectors.map((s) =>
        s.id === id ? { ...s, active: false } : s
      ),
    });
  },
}));