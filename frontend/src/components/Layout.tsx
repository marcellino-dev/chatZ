import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuthStore } from '../stores/auth';

export function Layout() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  async function handleLogout() {
    try {
      await logout();
    } catch {
      window.alert(
        'Sua sessão foi encerrada, mas não foi possível atualizar o status para offline.',
      );
    } finally {
      navigate('/login', { replace: true });
    }
  }

  if (!user) return null;

  const roleLabel = {
    ADMIN: '👑 Administrador',
    AGENT: '🎧 Atendente',
    CLIENT: '👤 Cliente',
  }[user.role];

  return (
    <div className="min-h-screen flex bg-chatz-bg">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="border-b border-chatz-border bg-chatz-card px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-chatz-text">{user.name}</p>
            <p className="text-xs text-chatz-muted">
              {roleLabel}
              {user.sector && ` · ${user.sector.name}`}
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-chatz-danger/10 hover:bg-chatz-danger/20
                       border border-chatz-danger/30 text-chatz-danger
                       text-sm font-medium rounded-lg transition-all"
          >
            Sair
          </button>
        </header>

        {/* Conteúdo */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}