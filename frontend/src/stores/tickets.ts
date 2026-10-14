import { create } from 'zustand';
import { api } from '../lib/api';
import type { Ticket, CreateTicketPayload } from '../types';

interface TicketsState {
  tickets: Ticket[];
  loading: boolean;
  error: string | null;

  fetchTickets: (params?: {
    status?: string;
    priority?: string;
    queue?: string;
    mine?: boolean;
  }) => Promise<void>;

  createTicket: (payload: CreateTicketPayload) => Promise<Ticket>;
  assignTicket: (id: string) => Promise<void>;
  updateStatus: (id: string, status: string) => Promise<void>;
  updatePriority: (id: string, priority: string) => Promise<void>;

  clear: () => void;
}

export const useTicketsStore = create<TicketsState>((set, get) => ({
  tickets: [],
  loading: false,
  error: null,

  fetchTickets: async (params = {}) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.get<Ticket[]>('/tickets', { params });
      set({ tickets: data, loading: false });
    } catch (err: any) {
      set({
        error: err.response?.data?.error || 'Erro ao carregar tickets',
        loading: false,
      });
    }
  },

  createTicket: async (payload) => {
    const { data } = await api.post<Ticket>('/tickets', payload);
    set({ tickets: [data, ...get().tickets] });
    return data;
  },

  assignTicket: async (id) => {
    const { data } = await api.patch<Ticket>(`/tickets/${id}/assign`);
    set({
      tickets: get().tickets.map((t) => (t.id === id ? data : t)),
    });
  },

  updateStatus: async (id, status) => {
    const { data } = await api.patch<Ticket>(`/tickets/${id}/status`, { status });
    set({
      tickets: get().tickets.map((t) => (t.id === id ? { ...t, ...data } : t)),
    });
  },

  updatePriority: async (id, priority) => {
    const { data } = await api.patch<Ticket>(`/tickets/${id}/priority`, {
      priority,
    });
    set({
      tickets: get().tickets.map((t) => (t.id === id ? { ...t, ...data } : t)),
    });
  },

  clear: () => set({ tickets: [], error: null, loading: false }),
}));