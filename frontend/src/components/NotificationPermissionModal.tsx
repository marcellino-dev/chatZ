import { useState } from 'react';
import { useSettingsStore } from '../stores/settings';
import { requestNotificationPermission } from '../lib/notifications';

export function NotificationPermissionModal() {
  const { hasRequestedPermission, setHasRequestedPermission } = useSettingsStore();
  const [loading, setLoading] = useState(false);

  // Se já pediu OU navegador não suporta, não mostra
  if (hasRequestedPermission) return null;
  if (typeof window === 'undefined') return null;
  if (!('Notification' in window)) return null;

  // Se já concedeu (por algum motivo), não mostra
  if (Notification.permission === 'granted') {
    setHasRequestedPermission(true);
    return null;
  }

  async function handleAllow() {
    setLoading(true);
    try {
      await requestNotificationPermission();
      setHasRequestedPermission(true);
    } catch {
      setHasRequestedPermission(true);
    } finally {
      setLoading(false);
    }
  }

  function handleLater() {
    setHasRequestedPermission(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-chatz-surface border border-chatz-border rounded-chatz-xl p-8 w-full max-w-md shadow-2xl animate-scale-in">
        {/* Ícone */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-chatz-purple to-chatz-pink
                        flex items-center justify-center shadow-[0_8px_24px_rgba(236,72,153,0.35)]">
          <span className="text-4xl">🔔</span>
        </div>

        {/* Título */}
        <h2 className="text-2xl font-display font-extrabold text-chatz-text text-center mb-2">
          Ative as notificações
        </h2>

        {/* Descrição */}
        <p className="text-sm text-chatz-text-muted text-center mb-6 leading-relaxed">
          Receba alertas em <strong className="text-chatz-text">tempo real</strong> quando:
        </p>

        {/* Lista de benefícios */}
        <ul className="space-y-3 mb-6">
          <li className="flex items-start gap-3 text-sm text-chatz-text-muted">
            <span className="text-chatz-success text-lg shrink-0">✓</span>
            <span>Chegar mensagem de um cliente</span>
          </li>
          <li className="flex items-start gap-3 text-sm text-chatz-text-muted">
            <span className="text-chatz-success text-lg shrink-0">✓</span>
            <span>Um novo atendimento entrar na fila</span>
          </li>
          <li className="flex items-start gap-3 text-sm text-chatz-text-muted">
            <span className="text-chatz-success text-lg shrink-0">✓</span>
            <span>Você estiver em outra aba ou chat</span>
          </li>
        </ul>

        {/* Aviso */}
        <div className="bg-chatz-primary-light border border-chatz-primary-border rounded-chatz px-4 py-3 mb-6">
          <p className="text-xs text-chatz-text-muted">
            💡 Você pode desativar a qualquer momento nas <strong>Configurações</strong>
          </p>
        </div>

        {/* Botões */}
        <div className="flex flex-col gap-2">
          <button
            onClick={handleAllow}
            disabled={loading}
            className="w-full py-3 rounded-chatz bg-chatz-button-gradient text-white
                       text-sm font-semibold shadow-[0_4px_14px_rgba(236,72,153,0.35)]
                       hover:brightness-105 transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processando...' : '🔔 Ativar notificações'}
          </button>
          <button
            onClick={handleLater}
            disabled={loading}
            className="w-full py-3 rounded-chatz bg-transparent text-chatz-text-muted
                       text-sm font-medium hover:text-chatz-text hover:bg-chatz-surface-hover
                       transition-all disabled:opacity-50"
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}