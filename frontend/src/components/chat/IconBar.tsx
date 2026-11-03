import { NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
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

const COLLAPSED_KEY = 'chatz-sidebar-collapsed';

const STATUS_INFO: Record<AgentStatus, { label: string; dot: string }> = {
  ONLINE: { label: 'Online', dot: 'bg-emerald-500' },
  AWAY: { label: 'Ausente', dot: 'bg-amber-400' },
  BUSY: { label: 'Ocupado', dot: 'bg-rose-500' },
  OFFLINE: { label: 'Offline', dot: 'bg-slate-400' },
};

function readCollapsed() {
  try {
    const stored = localStorage.getItem(COLLAPSED_KEY);
    if (stored !== null) return stored === '1';
  } catch {
    // localStorage indisponível: usa o padrão abaixo
  }
  return typeof window !== 'undefined' && window.innerWidth < 1024;
}

export function IconBar() {
  const navigate = useNavigate();
  const { user, logout, updateStatus } = useAuthStore();
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [overdueFollowUps, setOverdueFollowUps] = useState(0);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [menuOpen, setMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

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

  // Fecha o menu do usuário ao clicar fora ou apertar Esc
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

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
    items.push({
      to: '/history',
      label: 'Histórico',
      icon: <HistoryIcon />,
    });
    if (user.role === 'AGENT') {
      items.push({
        to: '/performance',
        label: 'Desempenho',
        icon: <PerformanceIcon />,
      });
    }
    items.push(
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

  const settingsItem: NavItem = { to: '/settings', label: 'Configurações', icon: <SettingsIcon /> };

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        // ignora: a preferência só não será lembrada
      }
      return next;
    });
    setMenuOpen(false);
  }

  async function handleStatusChange(status: AgentStatus) {
    setStatusSaving(true);
    setStatusError('');
    try {
      await updateStatus(status);
      setMenuOpen(false);
    } catch {
      setStatusError('Não foi possível atualizar seu status.');
    } finally {
      setStatusSaving(false);
    }
  }

  async function handleLogout() {
    setMenuOpen(false);
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
  const statusInfo = STATUS_INFO[status];

  return (
    <aside
      className={`relative h-full shrink-0 p-3 transition-[width] duration-200 ${
        collapsed ? 'w-[92px]' : 'w-[264px]'
      }`}
    >
      <div
        className={`relative flex h-full flex-col rounded-[2rem] border border-white
                    bg-gradient-to-b from-white via-[#faf8ff] to-[#f3f0ff] py-5
                    shadow-[0_10px_40px_rgba(88,28,135,0.14)] ring-1 ring-violet-100
                    ${collapsed ? 'px-2' : 'px-4'}`}
      >
        {/* Manchas decorativas (recortadas no formato do card) */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
          <div className="absolute -right-24 -top-24 h-44 w-44 rounded-full bg-gradient-to-br from-violet-300/50 to-transparent" />
          <div className="absolute -right-10 -top-16 h-40 w-40 rounded-full bg-gradient-to-br from-fuchsia-400/60 via-pink-400/60 to-orange-300/70" />
          <div className="absolute -bottom-20 left-4 h-36 w-44 rounded-full bg-gradient-to-t from-violet-400/50 to-transparent" />
          <div className="absolute -bottom-16 -right-8 h-36 w-40 rounded-full bg-gradient-to-tl from-orange-400/80 via-pink-400/60 to-transparent" />
        </div>

        {/* Logo + botão de recolher */}
        <div
          className={`relative z-10 mb-8 flex items-center ${
            collapsed ? 'flex-col gap-3' : 'justify-between gap-2 px-1'
          }`}
        >
          <NavLink to="/chat" title="chatZ" className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-[0_6px_18px_rgba(124,58,237,0.15)]">
              <img src="/logo.jpg" alt="" className="h-10 w-10 rounded-xl object-cover" />
            </span>
            {!collapsed && (
              <span className="font-display text-[28px] font-extrabold tracking-tight text-[#1e1b4b]">
                chat<span className="text-chatz-gradient">Z</span>
              </span>
            )}
          </NavLink>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            aria-expanded={!collapsed}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-violet-100
                       bg-white/80 text-[#1e1b4b] shadow-sm transition hover:bg-white"
          >
            <span className={`transition-transform ${collapsed ? 'rotate-180' : ''}`}>
              <ChevronLeftIcon />
            </span>
          </button>
        </div>

        {/* Navegação principal */}
        <nav className="relative z-10 min-h-0 flex-1 overflow-y-auto" aria-label="Menu principal">
          <ul className="space-y-1.5">
            {items.map((item) => (
              <SidebarLink key={item.to} item={item} collapsed={collapsed} />
            ))}
          </ul>
        </nav>

        {/* Divisor + Configurações */}
        <div className="relative z-10 mt-3">
          <div className="mx-3 mb-3 h-px bg-violet-200/70" />
          <ul>
            <SidebarLink item={settingsItem} collapsed={collapsed} showChevron />
          </ul>
        </div>

        {/* Cartão do usuário */}
        <div ref={userMenuRef} className="relative z-10 mt-4">
          {menuOpen && (
            <div
              role="menu"
              className="absolute bottom-full left-0 z-50 mb-2 w-full min-w-[14rem] rounded-2xl border border-violet-100
                         bg-white p-2 shadow-xl"
            >
              {user.role === 'AGENT' && (
                <>
                  <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold text-slate-500">Status de atendimento</p>
                  {(['ONLINE', 'AWAY', 'BUSY'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      role="menuitemradio"
                      aria-checked={status === option}
                      disabled={statusSaving}
                      onClick={() => void handleStatusChange(option)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-[#1e1b4b]
                                 transition hover:bg-violet-50 disabled:opacity-60"
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${STATUS_INFO[option].dot}`} />
                      <span className="flex-1">{STATUS_INFO[option].label}</span>
                      {status === option && <CheckIcon />}
                    </button>
                  ))}
                  <div className="my-1.5 h-px bg-violet-100" />
                </>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  navigate('/settings');
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-[#1e1b4b] transition hover:bg-violet-50"
              >
                Perfil e configurações
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => void handleLogout()}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50"
              >
                <LogoutIcon />
                Sair
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title={collapsed ? `${user.name} · ${statusInfo.label}` : 'Menu do usuário'}
            className={`flex w-full items-center rounded-2xl border border-violet-100 bg-white/70 shadow-sm
                        backdrop-blur-sm transition hover:bg-white ${
                          collapsed ? 'justify-center p-2' : 'gap-3 p-3'
                        }`}
          >
            <span className="relative shrink-0">
              <ProfileAvatar
                name={user.name}
                pictureUrl={user.profilePictureUrl}
                sizeClass={collapsed ? 'h-10 w-10' : 'h-12 w-12'}
                textClass="text-sm"
              />
              <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${statusInfo.dot}`} />
            </span>
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-bold text-[#1e1b4b]">{user.name}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-600">
                    <span className={`h-2 w-2 rounded-full ${statusInfo.dot}`} />
                    {statusInfo.label}
                  </span>
                </span>
                <span className={`shrink-0 text-[#1e1b4b] transition-transform ${menuOpen ? 'rotate-180' : ''}`}>
                  <ChevronDownIcon />
                </span>
              </>
            )}
          </button>

          {statusError && (
            <p role="alert" className="mt-2 px-2 text-[11px] text-rose-600">
              {statusError}
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}

/* ======================================================================
 * Item de navegação
 * ==================================================================== */

function SidebarLink({
  item,
  collapsed,
  showChevron,
}: {
  item: NavItem;
  collapsed: boolean;
  showChevron?: boolean;
}) {
  return (
    <li className={`relative ${collapsed ? 'pl-2' : 'pl-3'}`}>
      <NavLink
        to={item.to}
        title={collapsed ? item.label : undefined}
        className={({ isActive }) =>
          `flex min-h-[52px] items-center rounded-full text-[15px] font-medium transition-all ${
            collapsed ? 'justify-center px-0' : 'gap-4 px-5'
          } ${
            isActive
              ? 'bg-gradient-to-r from-fuchsia-600 via-rose-500 to-orange-500 text-white shadow-[0_8px_22px_rgba(244,63,94,0.35)]'
              : 'text-[#1e1b4b] hover:bg-white/80 hover:shadow-sm'
          }`
        }
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-full bg-fuchsia-600"
              />
            )}
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
            {!collapsed && <span className="min-w-0 flex-1 leading-tight">{item.label}</span>}
            {!collapsed && showChevron && <ChevronRightIcon />}
          </>
        )}
      </NavLink>
    </li>
  );
}

/* ======================================================================
 * Ícones
 * ==================================================================== */

const svgProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

function ChatIcon() {
  return (
    <svg {...svgProps}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function FollowUpIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg {...svgProps}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function PerformanceIcon() {
  return (
    <svg {...svgProps}>
      <rect x="3" y="14" width="4" height="7" rx="1" />
      <rect x="10" y="9" width="4" height="12" rx="1" />
      <rect x="17" y="3" width="4" height="18" rx="1" />
    </svg>
  );
}

function ContactsIcon() {
  return (
    <svg {...svgProps}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function QuickReplyIcon() {
  return (
    <svg {...svgProps}>
      <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
    </svg>
  );
}

function SectorIcon() {
  return (
    <svg {...svgProps}>
      <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg {...svgProps}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="m16 11 2 2 4-4" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="3" />
      <path d="m19.4 15 .1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0V19a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 12.1h-.2a2 2 0 1 1 0-4H3a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 9.9 1h.2a2 2 0 1 1 4 0v.2A1.7 1.7 0 0 0 17 2.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 2.9Z" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg {...svgProps} width={18} height={18} strokeWidth={2.2}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg {...svgProps} width={18} height={18} strokeWidth={2.2}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg {...svgProps} width={18} height={18} strokeWidth={2.2}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg {...svgProps} width={16} height={16} strokeWidth={2.4} className="text-fuchsia-600">
      <path d="m5 12 5 5 9-10" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg {...svgProps} width={18} height={18}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}