import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';

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
    { to: '/settings', label: 'Configurações', icon: <SettingsIcon /> },
  ];

  if (user.role === 'ADMIN') {
    items.push(
      { to: '/sectors', label: 'Setores', icon: <SectorIcon /> },
      { to: '/users', label: 'Usuários', icon: <UsersIcon /> }
    );
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <aside className="w-[68px] bg-chatz-surface border-r border-chatz-border flex flex-col items-center py-4 shrink-0">
      <NavLink
        to="/chat"
        className="mb-6 w-10 h-10 rounded-chatz flex items-center justify-center
                   hover:bg-chatz-surface-hover transition-all"
        title="chatZ"
      >
        <img
          src="/logo.jpg"
          alt="chatZ"
          className="w-9 h-9 rounded-md object-cover"
        />
      </NavLink>

      <nav className="flex-1 flex flex-col gap-1 w-full px-2">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={item.label}
            className={({ isActive }) =>
              `w-12 h-12 rounded-chatz flex items-center justify-center
               transition-all group relative ${
                 isActive
                   ? 'bg-chatz-primary text-white shadow-[0_4px_12px_rgba(59,130,246,0.30)]'
                   : 'text-chatz-text-muted hover:bg-chatz-surface-hover hover:text-chatz-text'
               }`
            }
          >
            {item.icon}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={handleLogout}
        title="Sair"
        className="w-12 h-12 rounded-chatz flex items-center justify-center
                   text-chatz-text-muted hover:bg-chatz-danger-light hover:text-chatz-danger
                   transition-all mt-2"
      >
        <LogoutIcon />
      </button>
    </aside>
  );
}

function ChatIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function SectorIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" />
      <path d="M5 21V7l8-4v18" />
      <path d="M19 21V11l-6-4" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  );
}