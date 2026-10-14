import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

export function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  if (!user) return null;

  const roleLabel = {
    ADMIN: '👑 Administrador',
    AGENT: '🎧 Atendente',
    CLIENT: '👤 Cliente',
  }[user.role];

  return (
    <div className="min-h-screen bg-chatz-bg">
      {/* Header */}
      <header className="border-b border-chatz-border bg-chatz-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-chatz-primary">chatZ 🚀</h1>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-chatz-text">{user.name}</p>
              <p className="text-xs text-chatz-muted">{roleLabel}</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-chatz-danger/10 hover:bg-chatz-danger/20
                         border border-chatz-danger/30 text-chatz-danger
                         text-sm font-medium rounded-lg transition-all"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="bg-chatz-card border border-chatz-border rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-chatz-text mb-2">
            Olá, {user.name.split(' ')[0]}! 👋
          </h2>
          <p className="text-chatz-muted mb-6">
            Você está logado como <strong className="text-chatz-text">{roleLabel}</strong>
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InfoCard label="ID" value={user.id.slice(0, 12) + '...'} />
            <InfoCard label="Email" value={user.email} />
            <InfoCard label="Role" value={user.role} />
          </div>
        </div>

        <div className="mt-8 bg-chatz-card/50 border border-chatz-border
                        border-dashed rounded-2xl p-8 text-center">
          <p className="text-chatz-muted">
            🚧 Próximas features: filas, tickets, transferências e chat em tempo real
          </p>
        </div>
      </main>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-chatz-bg border border-chatz-border rounded-xl p-4">
      <p className="text-xs text-chatz-muted mb-1 uppercase tracking-wide">
        {label}
      </p>
      <p className="text-sm text-chatz-text font-medium truncate">{value}</p>
    </div>
  );
}