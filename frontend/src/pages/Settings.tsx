import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '../stores/settings';
import { useAuthStore } from '../stores/auth';
import { requestNotificationPermission } from '../lib/notifications';
import { playDing, playNotification } from '../lib/sounds';
import { api, getErrorMessage } from '../lib/api';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { IconBar } from '../components/chat/IconBar';
import { PageBackButton } from '../components/PageBackButton';
import type { AgentStatus, User } from '../types';

type Section =
  | 'profile'
  | 'account'
  | 'privacy'
  | 'conversations'
  | 'notifications'
  | 'appearance'
  | 'advanced';

const SECTIONS: { key: Section; label: string; icon: React.ReactNode; description: string }[] = [
  { key: 'profile', label: 'Perfil', icon: <UserIcon />, description: 'Suas informações pessoais' },
  { key: 'account', label: 'Conta', icon: <KeyIcon />, description: 'Segurança e acesso' },
  { key: 'privacy', label: 'Privacidade', icon: <LockIcon />, description: 'Visibilidade das informações' },
  { key: 'conversations', label: 'Conversas', icon: <ChatIcon />, description: 'Preferências de chat' },
  { key: 'notifications', label: 'Notificações', icon: <BellIcon />, description: 'Mensagens, tickets e sons' },
  { key: 'appearance', label: 'Aparência', icon: <PaletteIcon />, description: 'Tema e densidade' },
  { key: 'advanced', label: 'Avançado', icon: <SettingsIcon />, description: 'Opções avançadas' },
];

// Classes compartilhadas dos inputs com ícone à esquerda (sem depender de CSS global).
const FIELD_INPUT =
  'w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-3 text-sm text-chatz-text ' +
  'outline-none transition focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/20';

const STATUS_STYLE: Record<AgentStatus, { label: string; badge: string; dot: string }> = {
  ONLINE: { label: 'Online', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  AWAY: { label: 'Ausente', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  BUSY: { label: 'Ocupado', badge: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500' },
  OFFLINE: { label: 'Offline', badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
};

/* ======================================================================
 * Página
 * ==================================================================== */

export function Settings() {
  const user = useAuthStore((s) => s.user);
  const { theme, setTheme } = useSettingsStore();
  const navigate = useNavigate();
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

      <div className="relative flex min-w-0 flex-1 flex-col overflow-y-auto">
        {/* Blob decorativo do canto superior direito */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-32 h-80 w-[28rem] rounded-full
                     bg-gradient-to-br from-orange-200/70 via-pink-200/60 to-fuchsia-200/30 blur-2xl"
        />

        {/* Header */}
        <header className="relative flex shrink-0 items-start justify-between gap-4 px-4 pb-4 pt-6 sm:px-8">
          <div className="flex items-start gap-3">
            <PageBackButton />
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-fuchsia-600">Configurações</p>
              <h1 className="font-display text-3xl font-extrabold text-chatz-text">Configurações</h1>
              <p className="mt-1 text-sm text-chatz-text-muted">Personalize sua experiência no chatZ.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/follow-ups')}
              aria-label="Follow-ups"
              className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white
                         text-slate-700 shadow-md transition hover:shadow-lg"
            >
              <BellIcon />
            </button>
            <button
              type="button"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              aria-label="Alternar tema"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white
                         text-slate-700 shadow-md transition hover:shadow-lg"
            >
              <MoonIcon />
            </button>
          </div>
        </header>

        {/* Corpo */}
        <div className="relative flex flex-1 flex-col gap-6 px-4 pb-8 sm:px-8 md:flex-row md:items-start">
          <aside className="w-full shrink-0 overflow-x-auto rounded-2xl border border-slate-100 bg-white p-2 shadow-sm md:w-80 md:overflow-visible">
            <nav className="flex flex-row gap-1 md:flex-col">
              {SECTIONS.map((s) => {
                const active = section === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => setSection(s.key)}
                    className={`flex min-w-[190px] items-center gap-3 rounded-xl border-l-4 px-4 py-3.5 text-left transition-all md:w-full md:min-w-0 ${
                      active
                        ? 'border-l-fuchsia-600 bg-fuchsia-50'
                        : 'border-l-transparent hover:bg-slate-50'
                    }`}
                  >
                    <span className={active ? 'text-fuchsia-600' : 'text-slate-500'}>{s.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-semibold ${active ? 'text-fuchsia-600' : 'text-chatz-text'}`}>
                        {s.label}
                      </p>
                      <p className="truncate text-xs text-chatz-text-muted">{s.description}</p>
                    </div>
                    <span className={`hidden md:block ${active ? 'text-fuchsia-600' : 'text-slate-400'}`}>
                      <ChevronRightIcon />
                    </span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="min-w-0 flex-1">
            {section === 'profile' && (
              <ProfileSection user={user} onChangePassword={() => setSection('account')} />
            )}
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
          </main>
        </div>
      </div>
    </div>
  );
}

/* ======================================================================
 * Perfil
 * ==================================================================== */

function ProfileSection({ user, onChangePassword }: { user: User; onChangePassword: () => void }) {
  return (
    <div className="space-y-6">
      <ProfileHero user={user} />
      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <ProfileForm user={user} />
        <div className="space-y-6">
          <ProfilePhotoCard user={user} />
          <SecurityCard onChangePassword={onChangePassword} />
        </div>
      </div>
    </div>
  );
}

interface ProfileStats {
  totalConversations: number;
  resolved: number;
  averageTime: string; // ex.: "2h 18min"
}

function ProfileHero({ user }: { user: User }) {
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const status = STATUS_STYLE[user.status ?? 'ONLINE'];
  const roleLabel = user.role === 'ADMIN' ? 'Administrador' : 'Atendente';

  useEffect(() => {
    if (user.role !== 'AGENT') return;
    let active = true;
    api
      // ⚠️ endpoint hipotético: ajuste para o que existir no seu backend
      .get<ProfileStats>('/auth/me/stats')
      .then(({ data }) => {
        if (active) setStats(data);
      })
      .catch(() => {
        if (active) setStats(null);
      });
    return () => {
      active = false;
    };
  }, [user.id, user.role]);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-24 h-72 w-[26rem] rounded-full
                   bg-gradient-to-br from-orange-300/50 via-pink-400/50 to-fuchsia-400/30 blur-2xl"
      />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
        <span className="relative shrink-0">
          <ProfileAvatar
            name={user.name}
            pictureUrl={user.profilePictureUrl}
            sizeClass="h-28 w-28"
            textClass="text-4xl"
          />
          <span className={`absolute bottom-1 right-1 h-5 w-5 rounded-full border-4 border-white ${status.dot}`} />
        </span>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-2xl font-extrabold text-chatz-text">{user.name}</h2>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${status.badge}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-chatz-text-muted">
            {roleLabel}
            {user.sector ? ` de ${user.sector.name}` : ''}
          </p>

          {user.role === 'AGENT' && (
            <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-slate-200">
              <HeroStat
                first
                icon={<HeadsetIcon />}
                label="Total de conversas"
                value={stats ? stats.totalConversations.toLocaleString('pt-BR') : '—'}
              />
              <HeroStat
                icon={<CheckCircleIcon />}
                label="Resolvidas"
                value={stats ? stats.resolved.toLocaleString('pt-BR') : '—'}
              />
              <HeroStat icon={<ClockIcon />} label="Tempo médio" value={stats?.averageTime ?? '—'} />
            </dl>
          )}
        </div>
      </div>
    </section>
  );
}

function HeroStat({
  icon,
  label,
  value,
  first,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  first?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 ${first ? 'sm:pr-4' : 'sm:px-4'}`}>
      <span className="text-fuchsia-600">{icon}</span>
      <div>
        <dt className="text-xs text-chatz-text-muted">{label}</dt>
        <dd className="text-xl font-extrabold text-chatz-text">{value}</dd>
      </div>
    </div>
  );
}

function ProfileForm({ user }: { user: User }) {
  const setUser = useAuthStore((s) => s.setUser);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email ?? '');
  const [phone, setPhone] = useState(user.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const dirty =
    name !== user.name || email !== (user.email ?? '') || phone !== (user.phone ?? '');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    setSaving(true);
    try {
      const { data } = await api.patch<User>('/auth/me', {
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
      });
      setUser(data);
      setMessage('Alterações salvas.');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="">
      <CardHeader
        icon={<UserIcon />}
        title="Informações do Perfil"
        subtitle="Mantenha seus dados sempre atualizados."
      />
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nome" icon={<UserIcon />}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={FIELD_INPUT}
          />
        </Field>
        <Field label="Email" icon={<MailIcon />}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={FIELD_INPUT}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Telefone" icon={<PhoneIcon />}>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={FIELD_INPUT}
            />
          </Field>
          <Field label="Setor" icon={<BriefcaseIcon />}>
            <input
              value={user.sector?.name ?? '—'}
              disabled
              className={`${FIELD_INPUT} cursor-not-allowed opacity-70`}
            />
          </Field>
        </div>

        {error && <p role="alert" className="text-sm text-chatz-danger">{error}</p>}
        {message && <p role="status" className="text-sm text-green-700">{message}</p>}

        <button
          type="submit"
          disabled={saving || !dirty}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 to-orange-500
                     px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(217,70,239,0.3)]
                     transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <SaveIcon />
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </form>
    </Card>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-chatz-text">{label}</span>
      <span className="relative block">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
          {icon}
        </span>
        {children}
      </span>
    </label>
  );
}

function ProfilePhotoCard({ user }: { user: User }) {
  const setUser = useAuthStore((s) => s.setUser);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');

  async function uploadFile(file: File | undefined) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Escolha uma imagem JPG, PNG ou WEBP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('A imagem deve ter no máximo 5 MB.');
      return;
    }

    setUploading(true);
    setError('');
    try {
      const body = new FormData();
      body.append('file', file);
      const { data } = await api.post<User>('/auth/me/profile-picture', body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUser(data);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    void uploadFile(file);
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragging(false);
    void uploadFile(event.dataTransfer.files?.[0]);
  }

  async function handleRemove() {
    if (!user.profilePictureUrl) return;
    if (!confirm('Remover sua foto de perfil?')) return;

    setUploading(true);
    setError('');
    try {
      const { data } = await api.delete<User>('/auth/me/profile-picture');
      setUser(data);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className="">
      <CardHeader icon={<ImageIcon />} title="Foto do Perfil" subtitle="Use uma imagem profissional." />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleChange}
      />

      <div className="flex items-stretch gap-4">
        <div className="relative flex shrink-0 items-center justify-center rounded-2xl bg-slate-50 p-3">
          <ProfileAvatar
            name={user.name}
            pictureUrl={user.profilePictureUrl}
            sizeClass="h-28 w-28"
            textClass="text-4xl"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            aria-label="Alterar foto"
            className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full
                       bg-white text-slate-700 shadow-md transition hover:shadow-lg disabled:opacity-50"
          >
            <PencilIcon />
          </button>
        </div>

        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed
                      p-4 text-center transition disabled:opacity-50 ${
                        dragging
                          ? 'border-fuchsia-500 bg-fuchsia-50'
                          : 'border-slate-300 hover:border-fuchsia-400'
                      }`}
        >
          <span className="text-fuchsia-600">
            <CloudUploadIcon />
          </span>
          <span className="text-sm text-chatz-text-muted">
            {uploading ? 'Enviando foto...' : 'Arraste uma imagem aqui ou clique para selecionar'}
          </span>
          <span className="text-[11px] text-slate-400">JPG, PNG, WEBP • Máx. 5MB</span>
        </button>
      </div>

      {user.profilePictureUrl && (
        <button
          type="button"
          onClick={handleRemove}
          disabled={uploading}
          className="mt-3 rounded-full border border-chatz-danger-border px-3 py-1.5 text-xs font-medium
                     text-chatz-danger hover:bg-chatz-danger-light disabled:opacity-50"
        >
          Remover foto
        </button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-chatz-danger">
          {error}
        </p>
      )}
    </Card>
  );
}

function SecurityCard({ onChangePassword }: { onChangePassword: () => void }) {
  return (
    <Card className="">
      <CardHeader
        icon={<ShieldIcon />}
        title="Segurança da Conta"
        subtitle="Mantenha sua conta sempre segura."
      />
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <ShieldCheckIcon />
          </span>
          <div>
            <p className="text-sm font-semibold text-chatz-text">Proteja seu acesso</p>
            <p className="text-xs text-chatz-text-muted">Troque a senha periodicamente.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onChangePassword}
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2
                     text-sm font-semibold text-fuchsia-700 transition hover:bg-fuchsia-50"
        >
          <LockIcon />
          Alterar senha
        </button>
      </div>
    </Card>
  );
}

/* ======================================================================
 * Conta
 * ==================================================================== */

function AccountSection() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    if (newPassword !== confirmPassword) {
      setError('A confirmação da nova senha não corresponde.');
      return;
    }

    setSaving(true);
    try {
      const { data } = await api.put<{ message: string }>('/auth/me/password', {
        currentPassword,
        newPassword,
      });
      setMessage(data.message);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <SectionTitle icon="🔒" title="Conta" description="Segurança e dados da conta" />
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="current-password" className="mb-1 block text-sm font-medium text-chatz-text">Senha atual</label>
            <input id="current-password" type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="w-full rounded-chatz border border-chatz-border bg-chatz-surface px-3 py-2 text-sm text-chatz-text" />
          </div>
          <div>
            <label htmlFor="new-password" className="mb-1 block text-sm font-medium text-chatz-text">Nova senha</label>
            <input id="new-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="w-full rounded-chatz border border-chatz-border bg-chatz-surface px-3 py-2 text-sm text-chatz-text" />
            <p className="mt-1 text-xs text-chatz-text-muted">Use pelo menos 8 caracteres.</p>
          </div>
          <div>
            <label htmlFor="confirm-password" className="mb-1 block text-sm font-medium text-chatz-text">Confirme a nova senha</label>
            <input id="confirm-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full rounded-chatz border border-chatz-border bg-chatz-surface px-3 py-2 text-sm text-chatz-text" />
          </div>
          {error && <p role="alert" className="text-sm text-chatz-danger">{error}</p>}
          {message && <p role="status" className="text-sm text-green-700">{message}</p>}
          <button type="submit" disabled={saving} className="rounded-chatz bg-chatz-primary px-4 py-2 text-sm font-semibold text-white hover:bg-chatz-primary-hover disabled:opacity-50">
            {saving ? 'Salvando...' : 'Alterar senha'}
          </button>
        </form>
      </Card>
    </div>
  );
}

/* ======================================================================
 * Privacidade
 * ==================================================================== */

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

/* ======================================================================
 * Conversas
 * ==================================================================== */

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

/* ======================================================================
 * Notificações
 * ==================================================================== */

function NotificationsSection({
  permission,
  onRequestPermission,
}: {
  permission: NotificationPermission;
  onRequestPermission: () => void;
}) {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const setAccountPreferences = useSettingsStore((state) => state.setAccountPreferences);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [preferencesError, setPreferencesError] = useState('');
  const {
    notificationsEnabled, messageNotifications, ticketNotifications,
    soundEnabled, soundType, showPreview,
    setMessageNotifications, setTicketNotifications, setShowPreview,
  } = useSettingsStore();

  async function saveAccountPreferences(
    preferences: Partial<Pick<User, 'soundEnabled' | 'desktopNotifications' | 'notificationSound'>>
  ) {
    if (!user || savingPreferences) return;
    setSavingPreferences(true);
    setPreferencesError('');
    try {
      const { data } = await api.patch<User>('/auth/me/preferences', preferences);
      setUser(data);
      setAccountPreferences({
        notificationsEnabled: data.desktopNotifications ?? true,
        soundEnabled: data.soundEnabled ?? true,
        soundType: data.notificationSound ?? 'ding',
      });
    } catch (error) {
      setPreferencesError(getErrorMessage(error));
    } finally {
      setSavingPreferences(false);
    }
  }

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
        <ToggleRow label="Notificações ativas" description="Mestre — desliga tudo" checked={notificationsEnabled} onChange={(value) => void saveAccountPreferences({ desktopNotifications: value })} disabled={savingPreferences} />
        <Divider />
        <ToggleRow label="Mensagens do cliente" description="Notifica quando cliente manda mensagem" checked={messageNotifications} onChange={setMessageNotifications} disabled={!notificationsEnabled} />
        <Divider />
        <ToggleRow label="Novo ticket na fila" description="Notifica quando novo atendimento chega no setor" checked={ticketNotifications} onChange={setTicketNotifications} disabled={!notificationsEnabled} />
        <Divider />
        <ToggleRow label="Mostrar prévia" description="Inclui o texto da mensagem na notificação" checked={showPreview} onChange={setShowPreview} disabled={!notificationsEnabled} />
      </Card>

      <Card>
        <p className="text-xs font-semibold text-chatz-text-muted uppercase tracking-wide mb-3">Sons</p>
        <ToggleRow label="Sons ativos" description="Toca som ao receber notificação" checked={soundEnabled} onChange={(value) => void saveAccountPreferences({ soundEnabled: value })} disabled={savingPreferences} />
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
                      void saveAccountPreferences({ notificationSound: s });
                      if (s === 'ding') playDing();
                      if (s === 'notification') playNotification();
                    }}
                    disabled={savingPreferences}
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
        {preferencesError && <p role="alert" className="mt-3 text-sm text-chatz-danger">{preferencesError}</p>}
      </Card>
    </div>
  );
}

/* ======================================================================
 * Aparência
 * ==================================================================== */

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

/* ======================================================================
 * Avançado
 * ==================================================================== */

function AdvancedSection() {
  const { reset } = useSettingsStore();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const navigate = useNavigate();
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetMessage, setResetMessage] = useState('');

  async function resetSettings() {
    if (!user || resetting || !confirm('Resetar todas as configurações?')) return;

    setResetting(true);
    setResetError('');
    setResetMessage('');
    try {
      const { data } = await api.patch<User>('/auth/me/preferences', {
        desktopNotifications: true,
        soundEnabled: true,
        notificationSound: 'ding',
      });
      setUser(data);
      reset();
      setResetMessage('Configurações restauradas para os valores padrão.');
    } catch (error) {
      setResetError(getErrorMessage(error));
    } finally {
      setResetting(false);
    }
  }

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
            type="button"
            onClick={() => void resetSettings()}
            disabled={resetting}
            className="px-4 py-2 rounded-chatz bg-chatz-danger text-white text-sm font-semibold hover:bg-red-600 transition-all disabled:cursor-wait disabled:opacity-50"
          >
            {resetting ? 'Restaurando...' : 'Resetar'}
          </button>
        </div>
        {resetError && <p role="alert" className="mt-3 text-sm text-chatz-danger">{resetError}</p>}
        {resetMessage && <p role="status" className="mt-3 text-sm text-green-700">{resetMessage}</p>}
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

/* ======================================================================
 * Componentes de apoio
 * ==================================================================== */

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

function Card({ children, className = 'mb-4' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-100 bg-chatz-surface p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span className="mt-0.5 text-fuchsia-700">{icon}</span>
      <div>
        <h3 className="text-lg font-bold text-chatz-text">{title}</h3>
        <p className="text-sm text-chatz-text-muted">{subtitle}</p>
      </div>
    </div>
  );
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

/* ======================================================================
 * Ícones
 * ==================================================================== */

const svgProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

function UserIcon() {
  return (<svg {...svgProps}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>);
}
function KeyIcon() {
  return (<svg {...svgProps}><path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/></svg>);
}
function LockIcon() {
  return (<svg {...svgProps}><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>);
}
function ChatIcon() {
  return (<svg {...svgProps}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>);
}
function BellIcon() {
  return (<svg {...svgProps}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>);
}
function PaletteIcon() {
  return (<svg {...svgProps}><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>);
}
function SettingsIcon() {
  return (<svg {...svgProps}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>);
}
function ChevronRightIcon() {
  return (<svg {...svgProps} width={18} height={18}><path d="m9 18 6-6-6-6" /></svg>);
}
function MoonIcon() {
  return (<svg {...svgProps}><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>);
}
function MailIcon() {
  return (<svg {...svgProps}><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-10 6L2 7" /></svg>);
}
function PhoneIcon() {
  return (<svg {...svgProps}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" /></svg>);
}
function BriefcaseIcon() {
  return (<svg {...svgProps}><rect width="20" height="14" x="2" y="7" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>);
}
function SaveIcon() {
  return (<svg {...svgProps}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" /><path d="M17 21v-8H7v8M7 3v5h8" /></svg>);
}
function ImageIcon() {
  return (<svg {...svgProps}><rect width="18" height="18" x="3" y="3" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" /></svg>);
}
function PencilIcon() {
  return (<svg {...svgProps} width={16} height={16}><path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>);
}
function CloudUploadIcon() {
  return (<svg {...svgProps} width={40} height={40} strokeWidth={1.6}><path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2" /><path d="M12 12v9M8 16l4-4 4 4" /></svg>);
}
function ShieldIcon() {
  return (<svg {...svgProps}><path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1Z" /></svg>);
}
function ShieldCheckIcon() {
  return (<svg {...svgProps} width={26} height={26}><path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1Z" /><path d="m9 12 2 2 4-4" /></svg>);
}
function HeadsetIcon() {
  return (<svg {...svgProps} width={24} height={24}><path d="M3 14v-2a9 9 0 0 1 18 0v2" /><path d="M21 16a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2ZM3 16a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2Z" /></svg>);
}
function CheckCircleIcon() {
  return (<svg {...svgProps} width={24} height={24}><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></svg>);
}
function ClockIcon() {
  return (<svg {...svgProps} width={24} height={24}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>);
}