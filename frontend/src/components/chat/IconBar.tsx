import { NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/auth';
import { ProfileAvatar } from '../ProfileAvatar';
import { api } from '../../lib/api';
import type { AgentStatus } from '../../types';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

export function IconBar() {
  const navigate = useNavigate();
  const { user, logout, updateStatus } = useAuthStore();
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [overdueFollowUps, setOverdueFollowUps] = useState(0);

  useEffect(() => {
    if (!user || (user.role !== 'ADMIN' && user.role !== 'AGENT')) return;
    let active = true;
    async function loadOverdueCount() {
      try {
        const { data } = await api.get<{ count: number }>(
          '/follow-ups/mine/overdue-count'
        );
        if (active) setOverdueFollowUps(data.count);
      } catch (error) {
        if (active) {
          console.error('Não foi possível carregar os follow-ups vencidos:', error);
        }
      }
    }

    void loadOverdueCount();
    const interval = window.setInterval(() => void loadOverdueCount(), 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [user]);

  if (!user) return null;

  const items: NavItem[] = [
    { to: '/chat', label: 'Conversas', icon: <ChatIcon /> },
  ];

  if (user.role === 'ADMIN' || user.role === 'AGENT') {
    items.push({
      to: '/follow-ups',
      label: 'Follow-ups',
      icon: <FollowUpIcon />,
      badge: overdueFollowUps,
    });
    if (user.role === 'AGENT') {
      items.push({
        to: '/history',
        label: 'Histórico',
        icon: <HistoryIcon />,
      });
      items.push({
        to: '/performance',
        label: 'Desempenho',
        icon: <PerformanceIcon />,
      });
    }
    items.push(
      { to: '/knowledge-base', label: 'Base de conhecimento', icon: <KnowledgeBaseIcon /> },
      { to: '/contacts', label: 'Contatos', icon: <ContactsIcon /> },
      { to: '/quick-replies', label: 'Respostas rápidas', icon: <QuickReplyIcon /> }
    );
  }

  if (user.role === 'ADMIN') {
    items.push(
      { to: '/sectors', label: 'Setores', icon: <SectorIcon /> },
      { to: '/users', label: 'Equipe', icon: <UsersIcon /> }
    );
  }

  items.push({ to: '/settings', label: 'Configurações', icon: <SettingsIcon /> });

  async function handleStatusChange(status: AgentStatus) {
    setStatusSaving(true);
    setStatusError('');
    try {
      await updateStatus(status);
    } catch {
      setStatusError('Não foi possível atualizar seu status.');
    } finally {
      setStatusSaving(false);
    }
  }

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

  const status = user.status ?? 'ONLINE';
  const statusLabel = {
    ONLINE: 'Online',
    AWAY: 'Ausente',
    BUSY: 'Ocupado',
    OFFLINE: 'Offline',
  }[status];
  const statusColor = {
    ONLINE: 'bg-emerald-400',
    AWAY: 'bg-amber-400',
    BUSY: 'bg-rose-400',
    OFFLINE: 'bg-slate-400',
  }[status];

  return (
    <aside
      className="relative flex h-full w-[68px] shrink-0 flex-col overflow-hidden
                 bg-[linear-gradient(180deg,#0a0f2e_0%,#0c1033_55%,#160f47_100%)]
                 px-2 py-5 text-slate-200 lg:w-[200px] lg:px-4"
    >
      {/* Arco decorativo do canto inferior esquerdo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-16 -left-32 h-80 w-80 rounded-full
                   bg-gradient-to-tr from-fuchsia-600 via-pink-500 to-transparent p-[6px] opacity-80"
      >
        <div className="h-full w-full rounded-full bg-gradient-to-br from-[#2a1a6e] via-[#1b1255] to-[#0c1033]" />
      </div>

      <NavLink
        to="/chat"
        className="relative z-10 mb-8 flex h-12 items-center justify-center gap-2.5 px-0 lg:justify-start lg:px-1"
        title="chatZ"
      >
        <img src="/logo.jpg" alt="" className="h-10 w-10 rounded-xl object-cover" />
        <span className="hidden font-display text-[28px] font-extrabold tracking-tight text-white lg:inline">
          chat<span className="text-chatz-gradient">Z</span>
        </span>
      </NavLink>

      <nav className="relative z-10 flex-1 space-y-1.5 overflow-y-auto" aria-label="Menu principal">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex min-h-12 items-center justify-center gap-3 rounded-2xl px-1 py-2.5 text-[15px] font-medium
               lg:justify-start lg:px-4
               transition-all ${
                 isActive
                   ? 'bg-gradient-to-r from-fuchsia-600 via-rose-500 to-orange-500 text-white shadow-[0_8px_22px_rgba(244,63,94,0.35)]'
                   : 'text-slate-200 hover:bg-white/10 hover:text-white'
               }`
            }
          >
            <span className="relative shrink-0">
              {item.icon}
              {item.badge ? (
                <span
                  aria-label={`${item.badge} follow-ups vencidos`}
                  className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center
                             rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white"
                >
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              ) : null}
            </span>
            <span className="hidden min-w-0 flex-1 leading-tight lg:block">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="relative z-10 mt-4 rounded-2xl border border-white/10 bg-white/5 p-1.5 backdrop-blur-sm lg:p-2.5">
        <div className="flex flex-col items-center gap-1 lg:flex-row lg:items-center lg:gap-1">
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="flex w-full min-w-0 items-center justify-center gap-2.5 rounded-xl p-0 text-left
                         transition-colors hover:bg-white/10 lg:justify-start lg:p-1"
              title="Abrir perfil e configurações"
            >
              <span className="relative shrink-0">
                <ProfileAvatar
                  name={user.name}
                  pictureUrl={user.profilePictureUrl}
                  sizeClass="h-9 w-9 lg:h-10 lg:w-10"
                  textClass="text-xs"
                />
                <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#0c1033] ${statusColor}`} />
              </span>
              <span className="hidden min-w-0 flex-1 lg:block">
                <span className="block truncate text-xs font-semibold text-white">{user.name}</span>
              </span>
            </button>
            {user.role === 'AGENT' ? (
              <select
                aria-label="Status de atendimento"
                value={status}
                disabled={statusSaving}
                onChange={(event) =>
                  void handleStatusChange(event.target.value as AgentStatus)
                }
                className="mt-0.5 block w-full max-w-full cursor-pointer border-0 bg-transparent p-0 text-center text-[11px] text-slate-300 outline-none focus:text-white disabled:opacity-60 lg:ml-[52px] lg:w-auto lg:text-left"
              >
                <option value="ONLINE" className="bg-[#0c1033]">Online</option>
                <option value="AWAY" className="bg-[#0c1033]">Ausente</option>
                <option value="BUSY" className="bg-[#0c1033]">Ocupado</option>
              </select>
            ) : (
              <span className="hidden text-[11px] text-slate-300 lg:ml-[52px] lg:block">{statusLabel}</span>
            )}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title="Sair"
            aria-label="Sair"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
                       text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogoutIcon />
          </button>
        </div>
      </div>
      {statusError && (
        <p role="alert" className="relative z-10 mt-2 px-2 text-[10px] text-rose-300">
          {statusError}
        </p>
      )}
    </aside>
  );
}

function ChatIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ContactsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a7 7 0 0 1 7-7h2a7 7 0 0 1 7 7v1" />
    </svg>
  );
}

function QuickReplyIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
    </svg>
  );
}

function KnowledgeBaseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}

function FollowUpIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 2v4M16 2v4M3 10h18" />
      <path d="M21 12V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7" />
      <circle cx="17" cy="17" r="4" />
      <path d="M17 15v2l1 1" />
    </svg>
  );
}

function PerformanceIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 21h18" />
      <rect x="4" y="12" width="4" height="9" rx="1" />
      <rect x="10" y="6" width="4" height="15" rx="1" />
      <rect x="16" y="9" width="4" height="12" rx="1" />
    </svg>
  );
}

function SectorIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87" />
      <circle cx="9" cy="7" r="4" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="m19.4 15 .1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0V19a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 12.1h-.2a2 2 0 1 1 0-4H3a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 9.9 1h.2a2 2 0 1 1 4 0v.2A1.7 1.7 0 0 0 17 2.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 2.9Z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}