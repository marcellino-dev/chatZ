import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { api } from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';
import type { User, AgentStatus, AuthResponse, LoginPayload } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;

  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  updateStatus: (status: AgentStatus) => Promise<void>;
  setUser: (user: User) => void;
  hydrateSocket: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (payload) => {
        const { data } = await api.post<AuthResponse>('/auth/login', payload);

        sessionStorage.setItem('chatz_token', data.token);
        localStorage.removeItem('chatz_token');
        localStorage.removeItem('chatz_user');

        set({
          user: data.user,
          token: data.token,
          isAuthenticated: true,
        });

        // 🔌 Conecta socket
        connectSocket(data.token);
      },

      logout: async () => {
        const { user } = get();
        try {
          if (user?.role === 'AGENT' && user.status !== 'OFFLINE') {
            await api.put('/auth/me/status', { status: 'OFFLINE' });
          }
        } finally {
          disconnectSocket();
          sessionStorage.removeItem('chatz_token');
          sessionStorage.removeItem('chatz_user');
          localStorage.removeItem('chatz_token');
          localStorage.removeItem('chatz_user');
          set({
            user: null,
            token: null,
            isAuthenticated: false,
          });
        }
      },

      updateStatus: async (status) => {
        const { data } = await api.put<Pick<User, 'status' | 'statusChangedAt'>>(
          '/auth/me/status',
          { status },
        );
        set((state) => ({
          user: state.user ? { ...state.user, ...data } : null,
        }));
      },

      setUser: (user) => set({ user }),

      // Reconecta socket ao abrir o app (se já logado)
      hydrateSocket: async () => {
        const { token, isAuthenticated } = get();
        if (isAuthenticated && token) {
          connectSocket(token);
          const { data } = await api.get<User>('/auth/me');
          set({ user: data });
          if (data.role === 'AGENT' && data.status === 'OFFLINE') {
            await get().updateStatus('ONLINE');
          }
        }
      },
    }),
    {
      name: 'chatz_user',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);