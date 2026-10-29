import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { api } from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';
import type { User, AuthResponse, LoginPayload } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;

  login: (payload: LoginPayload) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
  hydrateSocket: () => void;
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

      logout: () => {
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
      },

      setUser: (user) => set({ user }),

      // Reconecta socket ao abrir o app (se já logado)
      hydrateSocket: () => {
        const { token, isAuthenticated } = get();
        if (isAuthenticated && token) {
          connectSocket(token);
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