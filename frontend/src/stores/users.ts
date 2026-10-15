import { create } from 'zustand';
import { api } from '../lib/api';
import type { User } from '../types';

interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'AGENT';
  sectorId?: string;
}

interface UsersState {
  users: User[];
  loading: boolean;
  error: string | null;

  fetchUsers: () => Promise<void>;
  createUser: (data: CreateUserPayload) => Promise<User>;
  updateUser: (
    id: string,
    data: {
      name?: string;
      email?: string;
      password?: string;
      role?: 'ADMIN' | 'AGENT';
      sectorId?: string | null;
      active?: boolean;
    }
  ) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
}

export const useUsersStore = create<UsersState>((set, get) => ({
  users: [],
  loading: false,
  error: null,

  fetchUsers: async () => {
    set({ loading: true, error: null });
    try {
      // Ainda não tem GET /auth/users, vamos usar o de setores
      // Ou pedir pra listar via outro endpoint
      // Por enquanto, agregamos dos setores
      const { data: sectors } = await api.get<any[]>('/sectors');

      const allUsers: User[] = [];
      const seenIds = new Set<string>();

      // Inclui admins (sem setor) - precisamos de um endpoint direto
      // Solução temporária: buscar cada setor e agregar
      for (const sector of sectors) {
        const { data } = await api.get<{ users: User[] }>(`/sectors/${sector.id}`);
        data.users.forEach((u) => {
          if (!seenIds.has(u.id)) {
            seenIds.add(u.id);
            allUsers.push({ ...u, sector });
          }
        });
      }

      // Adiciona o admin atual (fallback)
      set({ users: allUsers, loading: false });
    } catch (err: any) {
      set({
        error: err.response?.data?.error || 'Erro ao carregar usuários',
        loading: false,
      });
    }
  },

  createUser: async (data) => {
    const { data: user } = await api.post<User>('/auth/users', data);
    set({ users: [...get().users, user] });
    return user;
  },

  updateUser: async (id, data) => {
    const { data: updated } = await api.patch<User>(
      `/auth/users/${id}`,
      data
    );
    set({
      users: get().users.map((u) => (u.id === id ? updated : u)),
    });
  },

  deleteUser: async (id) => {
    await api.delete(`/auth/users/${id}`);
    set({
      users: get().users.map((u) =>
        u.id === id ? { ...u, active: false } : u
      ),
    });
  },
}));