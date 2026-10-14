import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

export function Dashboard() {
  const user = useAuthStore((s) => s.user);

  if (!user) return null;

  const roleLabel = {
    ADMIN: '👑 Administrador',
    AGENT: '🎧 Atendente',
    CLIENT: '👤 Cliente',
  }[user.role];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Boas-vindas */}
      <div className="bg-chatz-card border border-chatz-border rounded-2xl p-8 mb-6">
        <h1 className="text-3xl font-bold text-chatz-text mb-2">
          Olá, {user.name.split(' ')[0]}! 👋
        </h1>
        <p className="text-chatz-muted">
          Você está logado como <strong className="text-chatz-text">{roleLabel}</strong>
          {user.sector && (
            <>
              {' '}no setor <strong className="text-chatz-primary">{user.sector.name}</strong>
            </>
          )}
        </p>
      </div>

      {/* Cards de ação */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          to="/tickets"
          className="block bg-chatz-card border border-chatz-border rounded-2xl p-6
                     hover:border-chatz-primary transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-3xl">🎫</span>
            <span className="text-chatz-primary text-2xl group-hover:translate-x-1 transition-transform">
              →
            </span>
          </div>
          <h3 className="text-lg font-semibold text-chatz-text mb-1">
            Atendimentos
          </h3>
          <p className="text-chatz-muted text-sm">
            {user.role === 'AGENT'
              ? `Fila do setor ${user.sector?.name ?? ''} + seus atendimentos`
              : 'Visão geral de todos os tickets'}
          </p>
        </Link>

        {user.role === 'ADMIN' && (
          <>
            <Link
              to="/sectors"
              className="block bg-chatz-card border border-chatz-border rounded-2xl p-6
                         hover:border-chatz-primary transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-3xl">🏢</span>
                <span className="text-chatz-primary text-2xl group-hover:translate-x-1 transition-transform">
                  →
                </span>
              </div>
              <h3 className="text-lg font-semibold text-chatz-text mb-1">
                Setores
              </h3>
              <p className="text-chatz-muted text-sm">
                Gerenciar setores de atendimento
              </p>
            </Link>

            <Link
              to="/users"
              className="block bg-chatz-card border border-chatz-border rounded-2xl p-6
                         hover:border-chatz-primary transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-3xl">👥</span>
                <span className="text-chatz-primary text-2xl group-hover:translate-x-1 transition-transform">
                  →
                </span>
              </div>
              <h3 className="text-lg font-semibold text-chatz-text mb-1">
                Usuários
              </h3>
              <p className="text-chatz-muted text-sm">
                Gerenciar atendentes e administradores
              </p>
            </Link>
          </>
        )}
      </div>

      {/* Info card */}
      <div className="mt-6 bg-chatz-card/50 border border-chatz-border border-dashed rounded-2xl p-6">
        <p className="text-sm text-chatz-muted">
          🚧 Próximas features: chat em tempo real (Socket.IO) e integração com WhatsApp
        </p>
      </div>
    </div>
  );
}