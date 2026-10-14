import { create } from 'zustand';
import { api } from '../lib/api';

export interface Message {
  id: string;
  content: string;
  channel: 'WHATSAPP' | 'WEB';
  read: boolean;
  ticketId: string;
  senderId: string;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    role: string;
  };
}

interface MessagesState {
  messages: Message[];
  loading: boolean;
  error: string | null;

  fetchMessages: (ticketId: string) => Promise<void>;
  sendMessage: (ticketId: string, content: string) => Promise<void>;
  addMessage: (message: Message) => void;
  clear: () => void;
}

export const useMessagesStore = create<MessagesState>((set, get) => ({
  messages: [],
  loading: false,
  error: null,

  fetchMessages: async (ticketId) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.get<Message[]>(`/tickets/${ticketId}/messages`);
      set({ messages: data, loading: false });
    } catch (err: any) {
      set({
        error: err.response?.data?.error || 'Erro ao carregar mensagens',
        loading: false,
      });
    }
  },

  sendMessage: async (ticketId, content) => {
    await api.post(`/tickets/${ticketId}/messages`, { content });
    // A mensagem vem via Socket.IO, então não adiciona manualmente
  },

  addMessage: (message) => {
    // Evita duplicar (se já tem pelo ID)
    if (get().messages.some((m) => m.id === message.id)) return;
    set({ messages: [...get().messages, message] });
  },

  clear: () => set({ messages: [], error: null, loading: false }),
}));