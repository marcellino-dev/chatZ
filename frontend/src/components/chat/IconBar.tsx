import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';
import { ProfileAvatar } from '../ProfileAvatar';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

export function IconBar() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  if (!user) return null;

  const items: NavItem[] = [
    { to: '/chat', label: 'Conversas', icon: <ChatIcon /> },
  ];

  if (user.role === 'ADMIN' || user.role === 'AGENT') {
    items.push(
      { to: '/contacts', label: 'Contatos', icon: <ContactsIcon /> },
      { to: '/quick-replies', label: 'Respostas prontas', icon: <QuickReplyIcon /> }
    );
  }

  if (user.role === 'ADMIN') {
    items.push(
      { to: '/sectors', label: 'Setores', icon: <SectorIcon /> },
      { to: '/users', label: 'Equipe', icon: <UsersIcon /> }
    );
  }

  items.push({ to: '/settings', label: 'Configurações', icon: <SettingsIcon /> });

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <aside
      className="flex h-full w-[68px] shrink-0 flex-col border-r border-slate-800/70
                 bg-[#07111b] bg-cover bg-center px-2 py-5 text-slate-200
                 lg:w-[228px] lg:px-4"
      style={{ backgroundImage: "url('/chatz_imagens_ptbr/barra-lateral.png')" }}
    >
      <NavLink
        to="/chat"
        className="mb-8 flex h-12 items-center justify-center gap-2.5 px-0 lg:justify-start lg:px-2"
        title="chatZ"
      >
        <img src="/logo.jpg" alt="" className="h-9 w-9 rounded-lg object-cover" />
        <span className="hidden font-display text-2xl font-extrabold tracking-tight text-white lg:inline">
          chat<span className="text-chatz-gradient">Z</span>
        </span>
      </NavLink>

      <nav className="flex-1 space-y-2" aria-label="Menu principal">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex min-h-11 items-center justify-center gap-3 rounded-xl px-1 py-2.5 text-sm font-medium
               lg:justify-start lg:px-3.5
               transition-all ${
                 isActive
                   ? 'bg-gradient-to-r from-[#e719b5] via-[#f43f8e] to-[#ff711d] text-white shadow-[0_6px_18px_rgba(231,25,181,0.28)]'
                   : 'text-slate-300 hover:bg-white/10 hover:text-white'
               }`
            }
          >
            <span className="shrink-0">{item.icon}</span>
            <span className="hidden min-w-0 flex-1 truncate lg:block">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-5 flex items-center justify-center gap-0 border-t border-white/10 pt-4 lg:justify-start lg:gap-2">
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="flex min-w-0 items-center justify-center gap-2.5 rounded-xl p-0 text-left
                     lg:flex-1 lg:justify-start lg:p-2
                     transition-colors hover:bg-white/10"
          title="Abrir perfil e configurações"
        >
          <span className="relative shrink-0">
            <ProfileAvatar
              name={user.name}
              pictureUrl={user.profilePictureUrl}
              sizeClass="h-8 w-8 lg:h-10 lg:w-10"
              textClass="text-xs"
            />
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#07111b] bg-emerald-400" />
          </span>
          <span className="hidden min-w-0 flex-1 lg:block">
            <span className="block truncate text-xs font-semibold text-white">{user.name}</span>
            <span className="block text-[10px] text-slate-400">Online</span>
          </span>
          <span className="hidden text-lg leading-none text-slate-400 lg:block" aria-hidden="true">›</span>
        </button>
        <button
          type="button"
          onClick={handleLogout}
          title="Sair"
          aria-label="Sair"
          className="flex h-8 w-5 shrink-0 items-center justify-center rounded-lg
                     lg:h-9 lg:w-9
                     text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogoutIcon />
        </button>
      </div>
    </aside>
  );
}

function ChatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ContactsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="4" />
      <path d="M3 21v-2a6 6 0 0 1 12 0v2M16 4.5a4 4 0 0 1 0 7M21 21v-2a6 6 0 0 0-3-5.2" />
    </svg>
  );
}

function QuickReplyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function SectorIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87" />
      <circle cx="9" cy="7" r="4" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
