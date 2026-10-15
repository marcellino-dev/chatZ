import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { UserModal } from '../components/UserModal';
import type { User } from '../types';

export function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  async function loadUsers() {
    setLoading(true);
    try {
      const { data } = await api.get<User[]>('/auth/users');
      setUsers(data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  function handleCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function handleEdit(user: User) {
    setEditing(user);
    setModalOpen(true);
  }

  async function handleToggleActive(user: User) {
    const action = user.active ? 'desativar' : 'reativar';
    if (!confirm(`Tem certeza que quer ${action} "${user.name}"?`)) return;

    try {
      if (user.active) {
        await api.delete(`/auth/users/${user.id}`);
      } else {
        await api.patch(`/auth/users/${user.id}`, { active: true });
      }
      loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Erro ao alterar usuário');
    }
  }

  const roleLabel = (role: string) =>
    role === 'ADMIN' ? '👑 Admin' : role === 'AGENT' ? '🎧 Atendente' : '👤 Cliente';

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-chatz-text">Usuários</h1>
          <p className="text-chatz-muted text-sm">
            Gerencie atendentes e administradores
          </p>
        </div>

        <button
          onClick={handleCreate}
          className="px-5 py-2.5 bg-chatz-primary hover:bg-chatz-primary-hover
                     text-white font-medium rounded-lg transition-all"
        >
          ➕ Novo usuário
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

      {!loading && users.length > 0 && (
        <div className="bg-chatz-card border border-chatz-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-chatz-bg border-b border-chatz-border">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-medium text-chatz-muted uppercase tracking-wide">
                  Nome
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-chatz-muted uppercase tracking-wide">
                  Email
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-chatz-muted uppercase tracking-wide">
                  Papel
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-chatz-muted uppercase tracking-wide">
                  Setor
                </th>
                <th className="text-right px-5 py-3 text-xs font-medium text-chatz-muted uppercase tracking-wide">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className={`border-b border-chatz-border last:border-0 ${
                    user.active ? '' : 'opacity-50'
                  }`}
                >
                  <td className="px-5 py-4">
                    <p className="text-chatz-text text-sm font-medium">
                      {user.name}
                    </p>
                    {!user.active && (
                      <span className="text-xs text-chatz-muted">
                        Desativado
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-chatz-muted text-sm">
                    {user.email ?? '—'}
                  </td>
                  <td className="px-5 py-4 text-sm">{roleLabel(user.role)}</td>
                  <td className="px-5 py-4 text-chatz-muted text-sm">
                    {user.sector?.name ?? '—'}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleEdit(user)}
                        className="px-3 py-1.5 bg-chatz-bg hover:bg-chatz-card-hover
                                   border border-chatz-border text-chatz-text
                                   text-xs font-medium rounded-lg transition-all"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleToggleActive(user)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg
                                   transition-all border ${
                                     user.active
                                       ? 'bg-chatz-danger/10 hover:bg-chatz-danger/20 border-chatz-danger/30 text-chatz-danger'
                                       : 'bg-chatz-success/10 hover:bg-chatz-success/20 border-chatz-success/30 text-chatz-success'
                                   }`}
                      >
                        {user.active ? 'Desativar' : 'Reativar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <UserModal
        isOpen={modalOpen}
        user={editing}
        onClose={() => {
          setModalOpen(false);
          loadUsers();
        }}
      />
    </div>
  );
}