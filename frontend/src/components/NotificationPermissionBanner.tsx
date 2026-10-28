import { useState, useEffect } from 'react';
import { requestNotificationPermission } from '../lib/notifications';

export function NotificationPermissionBanner() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'denied'
  );
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Já permitiu → não mostra
  if (permission === 'granted') return null;

  // User fechou o banner
  if (dismissed) return null;

  // Navegador não suporta
  if (!('Notification' in window)) return null;

  async function handleEnable() {
    const granted = await requestNotificationPermission();
    setPermission(granted ? 'granted' : Notification.permission);
  }

  // ==========================
  // DENIED — precisa desbloquear manualmente
  // ==========================
  if (permission === 'denied') {
    return (
      <div className="bg-chatz-warning-light border-b border-chatz-warning-border px-4 py-3 shrink-0">
        <div className="max-w-6xl mx-auto flex items-start gap-3">
          <span className="text-2xl">🔕</span>
          <div className="flex-1">
            <p className="text-sm font-medium text-chatz-text">
              Notificações bloqueadas
            </p>
            <p className="text-xs text-chatz-text-muted mt-1">
              Você bloqueou as notificações anteriormente. Pra receber alertas de novas mensagens:
            </p>
            <p className="text-xs text-chatz-text-muted mt-2">
              🔒 Clique no <strong>cadeado</strong> na barra de endereço → "Notificações" → <strong>Permitir</strong> → Recarregue a página
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-chatz-text-muted hover:text-chatz-text text-xl leading-none shrink-0"
            title="Fechar"
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  // ==========================
  // DEFAULT — pode pedir
  // ==========================
  return (
    <div className="bg-chatz-primary-light border-b border-chatz-primary-border px-4 py-3 shrink-0">
      <div className="max-w-6xl mx-auto flex items-center gap-3">
        <span className="text-2xl">🔔</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-chatz-text">
            Ative as notificações
          </p>
          <p className="text-xs text-chatz-text-muted mt-0.5">
            Receba alertas de novas mensagens mesmo em outra aba
          </p>
        </div>
        <button
          onClick={handleEnable}
          className="px-4 py-2 rounded-chatz bg-chatz-primary text-white text-sm font-semibold
                     hover:bg-chatz-primary-hover transition-all shrink-0"
        >
          Ativar
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-chatz-text-muted hover:text-chatz-text text-xl leading-none shrink-0"
          title="Fechar"
        >
          ×
        </button>
      </div>
    </div>
  );
}