import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../lib/api';
import { UserModal } from '../components/UserModal';
import { IconBar } from '../components/chat/IconBar';
import { WorkspaceHeader } from '../components/WorkspaceHeader';
import { useAuthStore } from '../stores/auth';
import { ProfileAvatar } from '../components/ProfileAvatar';
import type { User } from '../types';

export function Users() {
  const currentUser = useAuthStore((state) => state.user);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const activeUsers = users.filter((user) => user.active).length;

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
    if (currentUser?.role === 'ADMIN') loadUsers();
  }, [currentUser]);

  if (currentUser?.role !== 'ADMIN') return <Navigate to="/chat" replace />;

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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-chatz-bg">
      <IconBar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <WorkspaceHeader
            section="Administração"
            title="Equipe"
            description="Gerencie acessos, setores e disponibilidade dos atendentes."
            action={(
              <button
                onClick={handleCreate}
                className="w-full rounded-xl bg-chatz-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-chatz-primary-hover hover:shadow-md sm:w-auto"
              >
                + Adicionar atendente
              </button>
            )}
          />

          {!loading && !error && users.length > 0 && (
            <div className="mb-5 grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-2xl border border-chatz-border bg-white p-4 shadow-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><TeamIcon /></span>
                <div><p className="text-xs font-medium text-chatz-text-muted">Total de atendentes</p><p className="text-xl font-bold text-chatz-text">{users.length}</p></div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /></span>
                <div><p className="text-xs font-medium text-chatz-text-muted">Contas ativas</p><p className="text-xl font-bold text-chatz-text">{activeUsers}</p></div>
              </div>
            </div>
          )}

          {loading && (
            <div className="py-16 text-center text-sm text-chatz-text-muted">
              Carregando equipe...
            </div>
          )}

          {error && (
            <div role="alert" className="mb-6 rounded-xl border border-chatz-danger-border
                                        bg-chatz-danger-light px-4 py-3 text-sm text-chatz-danger">
              {error}
            </div>
          )}

          {!loading && !error && users.length === 0 && (
            <div className="rounded-2xl border border-dashed border-chatz-border
                            bg-chatz-surface px-6 py-16 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center
                              rounded-2xl bg-chatz-primary-light text-chatz-primary">
                <TeamIcon />
              </div>
              <h2 className="font-semibold text-chatz-text">Sua equipe está vazia</h2>
              <p className="mt-1 text-sm text-chatz-text-muted">
                Adicione atendentes para começar a organizar os funcionários.
              </p>
              <button
                onClick={handleCreate}
                className="mt-5 rounded-xl bg-chatz-button-gradient px-4 py-2
                           text-sm font-semibold text-white hover:brightness-105"
              >
                Adicionar primeiro funcionário
              </button>
            </div>
          )}

          {!loading && !error && users.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-chatz-border
                            bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-chatz-border
                              bg-chatz-surface-alt px-5 py-4">
                <div>
                  <h2 className="font-semibold text-chatz-text">Funcionários</h2>
                  <p className="mt-0.5 text-xs text-chatz-text-muted">
                    {users.length} {users.length === 1 ? 'atendente cadastrado' : 'atendentes cadastrados'}
                  </p>
                </div>
                <TeamIcon />
              </div>
              <div className="divide-y divide-chatz-border">
                {users.map((user) => (
                  <article
                    key={user.id}
                    className={`flex flex-wrap items-center justify-between gap-4 px-5 py-4
                                transition-colors hover:bg-chatz-surface-alt/70 ${
                                  user.active ? '' : 'opacity-60'
                                }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <ProfileAvatar
                        name={user.name}
                        pictureUrl={user.profilePictureUrl}
                        sizeClass="h-12 w-12"
                        textClass="text-sm"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-semibold text-chatz-text">
                            {user.name}
                          </h3>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            user.active
                              ? 'bg-chatz-success-light text-chatz-success'
                              : 'bg-chatz-surface-hover text-chatz-text-muted'
                          }`}>
                            {user.active ? 'Ativo' : 'Desativado'}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-chatz-text-muted">
                          {user.email ?? 'Sem e-mail'}
                        </p>
                        <p className="mt-1 text-xs font-medium text-chatz-primary">
                          {user.sector?.name ?? 'Sem setor'}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => handleEdit(user)}
                        className="rounded-lg border border-chatz-border px-3 py-2
                                   text-xs font-semibold text-chatz-text transition
                                   hover:border-chatz-primary-border hover:bg-chatz-primary-light
                                   hover:text-chatz-primary"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleToggleActive(user)}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                          user.active
                            ? 'border-chatz-danger-border text-chatz-danger hover:bg-chatz-danger-light'
                            : 'border-chatz-success-border text-chatz-success hover:bg-chatz-success-light'
                        }`}
                      >
                        {user.active ? 'Desativar' : 'Reativar'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
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
      </main>
    </div>
  );
}

function TeamIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}