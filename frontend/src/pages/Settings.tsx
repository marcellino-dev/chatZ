import { useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '../stores/settings';
import { useAuthStore } from '../stores/auth';
import { requestNotificationPermission } from '../lib/notifications';
import { playDing, playNotification } from '../lib/sounds';
import { api, getErrorMessage } from '../lib/api';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { IconBar } from '../components/chat/IconBar';
import { PageBackButton } from '../components/PageBackButton';
import type { User } from '../types';

type Section =
  | 'profile'
  | 'account'
  | 'privacy'
  | 'conversations'
  | 'notifications'
  | 'appearance'
  | 'advanced';

const SECTIONS: { key: Section; label: string; icon: React.ReactNode; description: string }[] = [
  { key: 'profile', label: 'Perfil', icon: <UserIcon />, description: 'Nome, email, foto' },
  { key: 'account', label: 'Conta', icon: <KeyIcon />, description: 'Segurança e dados' },
  { key: 'privacy', label: 'Privacidade', icon: <LockIcon />, description: 'Visibilidade das informações' },
  { key: 'conversations', label: 'Conversas', icon: <ChatIcon />, description: 'Tema e preferências' },
  { key: 'notifications', label: 'Notificações', icon: <BellIcon />, description: 'Mensagens, tickets e sons' },
  { key: 'appearance', label: 'Aparência', icon: <PaletteIcon />, description: 'Tema e densidade' },
  { key: 'advanced', label: 'Avançado', icon: <SettingsIcon />, description: 'Opções avançadas' },
];

export function Settings() {
  const user = useAuthStore((s) => s.user);
  const [section, setSection] = useState<Section>('profile');
  const [permission, setPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied'
  );

  async function handleRequestPermission() {
    const granted = await requestNotificationPermission();
    setPermission(granted ? 'granted' : Notification.permission);
  }

  if (!user) return null;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-chatz-bg">
      <IconBar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-4 border-b border-chatz-border bg-chatz-surface px-6 py-4">
          <PageBackButton />
          <div>
            <h1 className="text-xl font-display font-extrabold text-chatz-text">Configurações</h1>
            <p className="text-xs text-chatz-text-muted">chatZ — {user.name}</p>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="w-[340px] bg-chatz-surface border-r border-chatz-border overflow-y-auto shrink-0">
          <nav className="py-2">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className={`w-full text-left px-6 py-3 flex items-start gap-3 transition-all ${
                  section === s.key
                    ? 'bg-chatz-primary-light border-l-4 border-l-chatz-primary'
                    : 'border-l-4 border-l-transparent hover:bg-chatz-surface-hover'
                }`}
              >
                <span className={section === s.key ? 'text-chatz-primary' : 'text-chatz-text-muted'}>
                  {s.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${section === s.key ? 'text-chatz-primary' : 'text-chatz-text'}`}>
                    {s.label}
                  </p>
                  <p className="text-xs text-chatz-text-muted truncate">{s.description}</p>
                </div>
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto p-8">
            {section === 'profile' && <ProfileSection user={user} />}
            {section === 'account' && <AccountSection />}
            {section === 'privacy' && <PrivacySection />}
            {section === 'conversations' && <ConversationsSection />}
            {section === 'notifications' && (
              <NotificationsSection
                permission={permission}
                onRequestPermission={handleRequestPermission}
              />
            )}
            {section === 'appearance' && <AppearanceSection />}
            {section === 'advanced' && <AdvancedSection />}
          </div>
        </main>
      </div>
      </div>
    </div>
  );
}

function ProfileSection({ user }: { user: User }) {
  const setUser = useAuthStore((state) => state.setUser);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [pictureError, setPictureError] = useState('');

  async function handlePictureChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setPictureError('Escolha uma imagem JPG, PNG ou WEBP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPictureError('A imagem deve ter no máximo 5 MB.');
      return;
    }

    setUploadingPicture(true);
    setPictureError('');
    try {
      const body = new FormData();
      body.append('file', file);
      const { data } = await api.post<User>('/auth/me/profile-picture', body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUser(data);
    } catch (error) {
      setPictureError(getErrorMessage(error));
    } finally {
      setUploadingPicture(false);
    }
  }

  async function handleRemovePicture() {
    if (!user.profilePictureUrl) return;
    if (!confirm('Remover sua foto de perfil?')) return;

    setUploadingPicture(true);
    setPictureError('');
    try {
      const { data } = await api.delete<User>('/auth/me/profile-picture');
      setUser(data);
    } catch (error) {
      setPictureError(getErrorMessage(error));
    } finally {
      setUploadingPicture(false);
    }
  }

  return (
    <div>
      <SectionTitle icon="👤" title="Perfil" description="Suas informações pessoais" />
      <div className="flex items-center gap-4 mb-6">
        <ProfileAvatar
          name={user.name}
          pictureUrl={user.profilePictureUrl}
          sizeClass="w-20 h-20"
          textClass="text-2xl"
        />
        <div>
          <p className="text-lg font-semibold text-chatz-text">{user.name}</p>
          <p className="text-sm text-chatz-text-muted">{user.role === 'ADMIN' ? '👑 Administrador' : '🎧 Atendente'}</p>
          {user.sector && <p className="text-sm text-chatz-text-muted">🏢 {user.sector.name}</p>}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handlePictureChange}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={uploadingPicture}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-chatz border border-chatz-primary-border px-3 py-1.5
                         text-xs font-medium text-chatz-primary hover:bg-chatz-primary-light
                         disabled:opacity-50"
            >
              {uploadingPicture ? 'Enviando foto...' : user.profilePictureUrl ? 'Alterar foto' : 'Adicionar foto'}
            </button>
            {user.profilePictureUrl && (
              <button
                type="button"
                disabled={uploadingPicture}
                onClick={handleRemovePicture}
                className="rounded-chatz border border-chatz-danger-border px-3 py-1.5
                           text-xs font-medium text-chatz-danger hover:bg-chatz-danger-light
                           disabled:opacity-50"
              >
                Remover foto
              </button>
            )}
          </div>
          {pictureError && (
            <p role="alert" className="text-xs text-chatz-danger mt-2">
              {pictureError}
            </p>
          )}
        </div>
      </div>
      <InfoRow label="Nome" value={user.name} />
      <InfoRow label="Email" value={user.email || '—'} />
      <InfoRow label="Telefone" value={user.phone || '—'} />
      <InfoRow label="Setor" value={user.sector?.name || '—'} />
      <InfoRow label="ID" value={user.id} mono />
    </div>
  );
}

function AccountSection() {
  return (
    <div>
      <SectionTitle icon="🔒" title="Conta" description="Segurança e dados da conta" />
      <Card>
        <p className="text-sm text-chatz-text-muted">
          Funcionalidade em desenvolvimento. Em breve você poderá alterar sua senha, ativar 2FA e ver histórico de login.
        </p>
      </Card>
    </div>
  );
}

function PrivacySection() {
  const { hidePhone, hideEmail, setHidePhone, setHideEmail } = useSettingsStore();
  return (
    <div>
      <SectionTitle icon="🔐" title="Privacidade" description="Controle a visibilidade dos seus dados" />
      <Card>
        <ToggleRow label="Ocultar telefone" description="Esconde seu telefone no painel de atendimento" checked={hidePhone} onChange={setHidePhone} />
        <Divider />
        <ToggleRow label="Ocultar email" description="Esconde seu email no painel de atendimento" checked={hideEmail} onChange={setHideEmail} />
      </Card>
    </div>
  );
}

function ConversationsSection() {
  return (
    <div>
      <SectionTitle icon="💬" title="Conversas" description="Preferências do chat" />
      <Card>
        <p className="text-sm text-chatz-text-muted">
          Em breve você poderá escolher tema, wallpaper e sons específicos do chat.
        </p>
      </Card>
    </div>
  );
}

function NotificationsSection({
  permission,
  onRequestPermission,
}: {
  permission: NotificationPermission;
  onRequestPermission: () => void;
}) {
  const {
    notificationsEnabled, messageNotifications, ticketNotifications,
    soundEnabled, soundType, showPreview,
    setNotificationsEnabled, setMessageNotifications, setTicketNotifications,
    setSoundEnabled, setSoundType, setShowPreview,
  } = useSettingsStore();

  return (
    <div>
      <SectionTitle icon="🔔" title="Notificações" description="Configure como você é alertado" />

      <Card>
        <div className="flex items-start gap-3">
          <span className="text-2xl">
            {permission === 'granted' ? '✅' : permission === 'denied' ? '❌' : '⚠️'}
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-chatz-text">
              Permissão do navegador:{' '}
              {permission === 'granted' ? 'Concedida' : permission === 'denied' ? 'Bloqueada' : 'Não solicitada'}
            </p>
            <p className="text-xs text-chatz-text-muted mt-1">
              {permission === 'granted'
                ? 'Você está recebendo notificações nativas'
                : permission === 'denied'
                ? 'Libere nas configurações do navegador (cadeado 🔒 na barra)'
                : 'Clique abaixo para ativar notificações nativas'}
            </p>
          </div>
          {permission !== 'granted' && (
            <button onClick={onRequestPermission} className="px-3 py-1.5 rounded-chatz bg-chatz-primary text-white text-xs font-semibold hover:bg-chatz-primary-hover transition-all shrink-0">
              Ativar
            </button>
          )}
        </div>
      </Card>

      <Card>
        <p className="text-xs font-semibold text-chatz-text-muted uppercase tracking-wide mb-3">Tipos de notificação</p>
        <ToggleRow label="Notificações ativas" description="Mestre — desliga tudo" checked={notificationsEnabled} onChange={setNotificationsEnabled} />
        <Divider />
        <ToggleRow label="Mensagens do cliente" description="Notifica quando cliente manda mensagem" checked={messageNotifications} onChange={setMessageNotifications} disabled={!notificationsEnabled} />
        <Divider />
        <ToggleRow label="Novo ticket na fila" description="Notifica quando novo atendimento chega no setor" checked={ticketNotifications} onChange={setTicketNotifications} disabled={!notificationsEnabled} />
        <Divider />
        <ToggleRow label="Mostrar prévia" description="Inclui o texto da mensagem na notificação" checked={showPreview} onChange={setShowPreview} disabled={!notificationsEnabled} />
      </Card>

      <Card>
        <p className="text-xs font-semibold text-chatz-text-muted uppercase tracking-wide mb-3">Sons</p>
        <ToggleRow label="Sons ativos" description="Toca som ao receber notificação" checked={soundEnabled} onChange={setSoundEnabled} />
        {soundEnabled && (
          <>
            <Divider />
            <div className="mb-4">
              <p className="text-sm font-medium text-chatz-text mb-2">Som de mensagem</p>
              <div className="flex gap-2">
                {(['ding', 'notification', 'none'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setSoundType(s);
                      if (s === 'ding') playDing();
                      if (s === 'notification') playNotification();
                    }}
                    className={`px-3 py-1.5 rounded-chatz text-xs font-medium transition-all ${
                      soundType === s
                        ? 'bg-chatz-primary text-white'
                        : 'bg-chatz-surface-alt border border-chatz-border text-chatz-text-muted hover:text-chatz-text'
                    }`}
                  >
                    {s === 'ding' ? '🔔 Ding' : s === 'notification' ? '🎵 Notificação' : '🔇 Nenhum'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => playDing()} className="flex-1 px-3 py-2 rounded-chatz bg-chatz-surface-alt border border-chatz-border text-sm text-chatz-text hover:bg-chatz-surface-hover transition-all">
                🎧 Testar ding
              </button>
              <button onClick={() => playNotification()} className="flex-1 px-3 py-2 rounded-chatz bg-chatz-surface-alt border border-chatz-border text-sm text-chatz-text hover:bg-chatz-surface-hover transition-all">
                🎵 Testar notificação
              </button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function AppearanceSection() {
  const { theme, density, setTheme, setDensity } = useSettingsStore();
  return (
    <div>
      <SectionTitle icon="🎨" title="Aparência" description="Tema e densidade do painel" />
      <Card>
        <p className="text-sm font-medium text-chatz-text mb-3">Tema</p>
        <div className="grid grid-cols-2 gap-3">
          {(['light', 'dark'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`p-4 rounded-chatz border-2 text-center transition-all ${
                theme === t ? 'border-chatz-primary bg-chatz-primary-light' : 'border-chatz-border bg-chatz-surface-alt hover:border-chatz-border-strong'
              }`}
            >
              <p className="text-2xl mb-1">{t === 'light' ? '☀️' : '🌙'}</p>
              <p className="text-sm font-medium text-chatz-text">{t === 'light' ? 'Claro' : 'Escuro'}</p>
            </button>
          ))}
        </div>
        <p className="text-xs text-chatz-text-muted mt-2">⚠️ Em breve — dark mode ainda não implementado</p>
      </Card>
      <Card>
        <p className="text-sm font-medium text-chatz-text mb-3">Densidade</p>
        <div className="grid grid-cols-2 gap-3">
          {(['compact', 'comfortable'] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDensity(d)}
              className={`p-3 rounded-chatz border-2 transition-all ${
                density === d ? 'border-chatz-primary bg-chatz-primary-light' : 'border-chatz-border bg-chatz-surface-alt hover:border-chatz-border-strong'
              }`}
            >
              <p className="text-sm font-medium text-chatz-text">{d === 'compact' ? '📦 Compacto' : '📏 Confortável'}</p>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

function AdvancedSection() {
  const { reset } = useSettingsStore();
  const navigate = useNavigate();
  return (
    <div>
      <SectionTitle icon="⚙️" title="Avançado" description="Opções avançadas do sistema" />
      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-chatz-text">Resetar configurações</p>
            <p className="text-xs text-chatz-text-muted">Volta todas as opções ao padrão</p>
          </div>
          <button
            onClick={() => {
              if (confirm('Resetar todas as configurações?')) {
                reset();
                alert('Configurações resetadas');
              }
            }}
            className="px-4 py-2 rounded-chatz bg-chatz-danger text-white text-sm font-semibold hover:bg-red-600 transition-all"
          >
            Resetar
          </button>
        </div>
      </Card>
      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-chatz-text">Sair da conta</p>
            <p className="text-xs text-chatz-text-muted">Desconectar do chatZ</p>
          </div>
          <button
            onClick={async () => {
              try {
                await useAuthStore.getState().logout();
              } catch {
                window.alert(
                  'Sua sessão foi encerrada, mas não foi possível atualizar o status para offline.',
                );
              } finally {
                navigate('/login');
              }
            }}
            className="px-4 py-2 rounded-chatz bg-chatz-danger-light border border-chatz-danger-border text-chatz-danger text-sm font-semibold hover:bg-chatz-danger/10 transition-all"
          >
            Sair
          </button>
        </div>
      </Card>
    </div>
  );
}

function SectionTitle({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-display font-bold text-chatz-text flex items-center gap-2">
        <span>{icon}</span>
        {title}
      </h2>
      <p className="text-sm text-chatz-text-muted mt-1">{description}</p>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-chatz-surface border border-chatz-border rounded-chatz-md p-5 mb-4">{children}</div>;
}

function Divider() {
  return <div className="h-px bg-chatz-border my-3" />;
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`w-11 h-6 rounded-full transition-all relative shrink-0 ${
        checked && !disabled ? 'bg-chatz-primary' : 'bg-chatz-border'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

function ToggleRow({
  label, description, checked, onChange, disabled,
}: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${disabled ? 'text-chatz-text-subtle' : 'text-chatz-text'}`}>{label}</p>
        <p className="text-xs text-chatz-text-muted">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-chatz-border last:border-0">
      <span className="text-sm text-chatz-text-muted">{label}</span>
      <span className={`text-sm text-chatz-text font-medium text-right truncate ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  );
}

function UserIcon() {
  return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>);
}
function KeyIcon() {
  return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/></svg>);
}
function LockIcon() {
  return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>);
}
function ChatIcon() {
  return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>);
}
function BellIcon() {
  return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>);
}
function PaletteIcon() {
  return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>);
}
function SettingsIcon() {
  return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>);
}